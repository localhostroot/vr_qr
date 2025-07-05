import { browser } from '$app/environment';
import { goto } from '$app/navigation';
import { PUBLIC_DATABASE } from '$env/static/public';
import { globals } from '$lib/stores/+stores.svelte.js';
import LOCAL_STORAGE_KEYS from '$lib/constants/localStorageKeys.js';
import { getSubfolder } from './+helpers.svelte';

/**
 * Enhanced Paykeeper payment handler with iframe and polling for mobile compatibility
 * @returns {Object} Payment handling functions and state
 */
export function createEnhancedPaykeeperPayment() {
  // State management
  let errorState = '';
  let loadingState = false;
  let pollingState = false;
  let currentOrderId = null;
  let pollInterval = null;
  
  // Configuration
  const POLL_INTERVAL = 3000; // 3 seconds
  const MAX_POLL_ATTEMPTS = 120; // 6 minutes total (120 * 3s = 360s)
  
  /**
   * Get current user ID from client data
   */
  const getCurrentUserId = () => {
    if (!browser) return null;
    
    const client = globals.get('currentClient');
    if (!client) return null;
    
    const clLocation = client.location || null;
    const id = client.id || null;
    return clLocation && id ? `${clLocation}/${id}` : null;
  };

  /**
   * Create payment order
   */
  const createPaymentOrder = async (userId, queue) => {
    const createOrderResponse = await fetch(`${PUBLIC_DATABASE}api/payments/create_order/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: userId,
        description: "Оплата за просмотр фильмов",
        films: queue
      }),
    });

    if (!createOrderResponse.ok) {
      const errorData = await createOrderResponse.json();
      throw new Error("Ошибка при создании заказа: " + (errorData.error || "Неизвестная ошибка"));
    }

    return await createOrderResponse.json();
  };

  /**
   * Open payment in new tab using dedicated payment page
   */
  const openPaymentInNewTab = (paymentWindow, orderData, userId) => {
    const { order_id: orderId, amount: totalAmount } = orderData;
    
    // Build URL for payment page with parameters
    const paymentUrl = `${window.location.origin}${getSubfolder()}/payment?order_id=${orderId}&amount=${totalAmount}&user_id=${encodeURIComponent(userId)}`;
    
    // Navigate the pre-opened window to the payment page
    paymentWindow.location.href = paymentUrl;
    
    console.log('Payment page opened in new tab');
  };

  /**
   * Check payment status via API polling
   */
  const checkPaymentStatus = async (orderId) => {
    try {
      const response = await fetch(`${PUBLIC_DATABASE}api/status/status/?order_id=${orderId}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          return { status: 'error', error: 'Заказ не найден' };
        }
        return { status: 'error', error: 'Ошибка сервера' };
      }
      
      const data = await response.json();
      return { status: data.status, data };
      
    } catch (error) {
      console.error('Payment status check error:', error);
      return { status: 'error', error: 'Ошибка сети' };
    }
  };

  /**
   * Process successful payment
   */
  const processSuccessfulPayment = async (orderId) => {
    try {
      const currentToken = globals.get('token');
      
      // Get token by order ID
      let getTokenUrl = `${PUBLIC_DATABASE}api/tokens/get_token_by_order/?order_id=${orderId}`;
      if (currentToken) {
        getTokenUrl += `&current_token=${currentToken}`;
      }
      
      const getTokenResponse = await fetch(getTokenUrl);
      
      if (!getTokenResponse.ok) {
        throw new Error("Не удалось получить токен по ID заказа");
      }

      const tokenData = await getTokenResponse.json();

      if (!tokenData.valid || !tokenData.token) {
        throw new Error("Токен для этого заказа недействителен");
      }

      // Get films for the token
      const filmsResponse = await fetch(`${PUBLIC_DATABASE}api/tokens/get_films/?token=${tokenData.token}`);
      
      if (!filmsResponse.ok) {
        throw new Error("Не удалось получить информацию о фильмах");
      }

      const filmsData = await filmsResponse.json();

      if (!filmsData.valid) {
        // Token is invalid, clear everything
        globals.set('token', null);
        globals.set('tokenExpiry', null);
        globals.set('paidFilms', []);
        if (browser) {
          localStorage.removeItem(LOCAL_STORAGE_KEYS.PAID_FILMS);
        }
        throw new Error("Токен недействителен");
      }

      // Update token and expiry
      globals.set('token', tokenData.token);
      globals.set('tokenExpiry', filmsData.expires_at);

      // Clear and set paid films
      globals.set('paidFilms', []);
      
      if (filmsData.films && Array.isArray(filmsData.films)) {
        globals.set('paidFilms', filmsData.films);
      }

      // Clear queue since payment was successful
      globals.set('queue', []);
      
      // Clean up localStorage
      if (browser) {
        localStorage.removeItem(LOCAL_STORAGE_KEYS.QUEUE_PENDING_PAYMENT);
        localStorage.removeItem(LOCAL_STORAGE_KEYS.QUEUE);
        localStorage.removeItem(LOCAL_STORAGE_KEYS.PAYKEEPER_ORDER_ID);
      }

      // Mark order as checked
      await fetch(`${PUBLIC_DATABASE}api/status/checked/?order_id=${orderId}`, {
        method: 'POST',
      });

      return { success: true };

    } catch (error) {
      console.error('Error processing successful payment:', error);
      throw error;
    }
  };

  /**
   * Start polling for payment status
   */
  const startPolling = async (orderId) => {
    pollingState = true;
    let attempts = 0;
    
    return new Promise((resolve) => {
      pollInterval = setInterval(async () => {
        attempts++;
        
        try {
          const result = await checkPaymentStatus(orderId);

          console.log(result);
          
          if (result.status === 'success') {
            // Payment successful
            clearInterval(pollInterval);
            pollingState = false;
            
            try {
              await processSuccessfulPayment(orderId);
              resolve({ success: true, redirect: true });
            } catch (error) {
              console.error('Error processing payment:', error);
              resolve({ success: false, error: error.message });
            }
            
          } else if (result.status === 'checked') {
            // Already processed
            clearInterval(pollInterval);
            pollingState = false;
            resolve({ success: false, error: 'Заказ уже был обработан' });
            
          } else if (result.status === 'error') {
            // API error - continue polling for network issues, stop for order not found
            if (result.error === 'Заказ не найден') {
              clearInterval(pollInterval);
              pollingState = false;
              resolve({ success: false, error: result.error });
            }
            // Continue polling for network errors
            
          }
          // For 'fail' status, continue polling
          
        } catch (error) {
          console.error('Polling error:', error);
          // Continue polling on network errors
        }
        
        // Stop polling after max attempts
        if (attempts >= MAX_POLL_ATTEMPTS) {
          clearInterval(pollInterval);
          pollingState = false;
          resolve({ 
            success: false, 
            timeout: true,
            error: 'Истекло время ожидания. Проверьте статус платежа позже.' 
          });
        }
      }, POLL_INTERVAL);
    });
  };


  /**
   * Handle payment completion
   */
  const handlePaymentCompletion = async (result) => {
    loadingState = false;
    currentOrderId = null;
    
    if (result.success && result.redirect) {
      // Redirect to success page
      goto(`${getSubfolder()}/payment-result?success=true`);
    } else if (result.timeout) {
      // Show timeout message but keep order ID for potential retry
      errorState = result.error;
    } else {
      // Show error
      errorState = result.error || 'Произошла ошибка при обработке платежа';
    }
  };

  /**
   * Main payment handler
   */
  const handlePaymentClick = async () => {
    if (!browser) return;

    const userId = getCurrentUserId();
    const queue = globals.get('queue');

    // Validation
    if (!userId) {
      errorState = "Вы не выбрали очки. Перейдите на начальную страницу и выберите очки";
      return;
    }

    if (!queue || queue.length === 0) {
      errorState = "Ваша корзина пуста. Добавьте фильмы для оплаты.";
      return;
    }

    loadingState = true;
    errorState = '';

    // Pre-open the new tab to prevent popup blocking
    const paymentWindow = window.open('', '_blank');
    
    // Check if popup was blocked
    if (!paymentWindow || paymentWindow.closed || typeof paymentWindow.closed == 'undefined') {
      errorState = 'Разрешите всплывающие окна для оплаты. Нажмите на иконку блокировки в адресной строке и разрешите попапы.';
      loadingState = false;
      return;
    }

    try {
      // Create order
      const orderData = await createPaymentOrder(userId, queue);
      const orderId = orderData.order_id;
      
      // Store order data
      currentOrderId = orderId;
      localStorage.setItem(LOCAL_STORAGE_KEYS.PAYKEEPER_ORDER_ID, orderId);
      localStorage.setItem(LOCAL_STORAGE_KEYS.QUEUE_PENDING_PAYMENT, JSON.stringify(queue));

      // Open payment in the pre-opened tab
      openPaymentInNewTab(paymentWindow, orderData, userId);
      loadingState = false;
      
      // Start polling for payment status
      const result = await startPolling(orderId);
      
      // Handle completion
      await handlePaymentCompletion(result);

    } catch (err) {
      console.error('Payment error:', err);
      errorState = err.message || "Ошибка сети или сервера.";
      loadingState = false;
      
      // Close the payment window if there was an error
      if (paymentWindow && !paymentWindow.closed) {
        paymentWindow.close();
      }
    }
  };

  /**
   * Cancel payment process
   */
  const cancelPayment = () => {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
    
    loadingState = false;
    pollingState = false;
    errorState = '';
    currentOrderId = null;
  };

  /**
   * Retry payment status check for timeout cases
   */
  const retryPaymentCheck = async () => {
    if (!currentOrderId) {
      errorState = 'Нет активного заказа для проверки';
      return;
    }

    loadingState = true;
    errorState = '';
    
    try {
      const result = await checkPaymentStatus(currentOrderId);
      
      if (result.status === 'success') {
        await processSuccessfulPayment(currentOrderId);
        goto(`${getSubfolder()}/payment-result?success=true`);
      } else if (result.status === 'checked') {
        errorState = 'Заказ уже был обработан';
      } else {
        errorState = 'Платеж еще не завершен. Попробуйте позже.';
      }
    } catch (error) {
      errorState = 'Ошибка при проверке статуса платежа';
    } finally {
      loadingState = false;
    }
  };

  return {
    get error() { return errorState; },
    get isLoading() { return loadingState; },
    get isPolling() { return pollingState; },
    get currentOrderId() { return currentOrderId; },
    handlePaymentClick,
    cancelPayment,
    retryPaymentCheck,
    clearError: () => { errorState = ''; }
  };
}
