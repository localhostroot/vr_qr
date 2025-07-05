import { browser } from '$app/environment';
import { PUBLIC_DATABASE, PUBLIC_APP_SUBFOLDER } from '$env/static/public';
import { globals } from '$lib/stores/+stores.svelte.js';
import LOCAL_STORAGE_KEYS from '$lib/constants/localStorageKeys.js';
import { getSubfolder } from './+helpers.svelte';


/**
 * Factory function for creating Paykeeper payment handlers
 * @returns {Object} Payment handling functions and state setters
 */
export function createPaykeeperPayment() {
  // Internal state - will be managed by the component using this
  let errorState = '';
  let loadingState = false;

  // Paykeeper configuration
  const paykeeperUrl = "https://4-neba.server.paykeeper.ru/create/";
  
  // Get success and fail URLs (only available in browser)

  // предыдущие настройки в пэйкипере
  // https://4-neba.ru/payment-result?success=true
  // https://4-neba.ru/payment-result
  // колбэк оплаты отправляется на https://4-neba.ru/api/payments/payment_callback/

  const getSuccessUrl = () => browser ? `${window.location.origin}${getSubfolder()}/payment-result?success=true` : '';
  const getFailUrl = () => browser ? `${window.location.origin}${getSubfolder()}/payment-result?success=false` : '';

  /**
   * Get current user ID from client data
   * @returns {string|null} User ID in format "location/id" or null
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
   * Handle payment click - creates order and redirects to Paykeeper
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

    try {
      // Create order
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
        errorState = "Ошибка при создании заказа: " + (errorData.error || "Неизвестная ошибка");
        loadingState = false;
        return;
      }

      const orderData = await createOrderResponse.json();
      const orderId = orderData.order_id;
      const totalAmount = orderData.amount;

      // Store order data for later verification
      localStorage.setItem(LOCAL_STORAGE_KEYS.PAYKEEPER_ORDER_ID, orderId);
      localStorage.setItem(LOCAL_STORAGE_KEYS.QUEUE_PENDING_PAYMENT, JSON.stringify(queue));

      // Create and submit form to Paykeeper
      const form = document.createElement('form');
      form.action = paykeeperUrl;
      form.method = 'POST';
      form.style.display = 'none';

      const addInput = (name, value) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        input.value = value;
        form.appendChild(input);
      };

      // Add form fields
      addInput('sum', totalAmount);
      addInput('clientid', userId);
      addInput('orderid', orderId);
      addInput('name', "Оплата за просмотр фильмов");
      addInput('success_url', getSuccessUrl());
      addInput('fail_url', getFailUrl());

      // Submit form
      document.body.appendChild(form);
      form.submit();

    } catch (err) {
      console.error('Payment error:', err);
      errorState = "Ошибка сети или сервера.";
      loadingState = false;
    }
  };

  return {
    get error() { return errorState; },
    get isLoading() { return loadingState; },
    handlePaymentClick,
    clearError: () => { errorState = ''; }
  };
}
