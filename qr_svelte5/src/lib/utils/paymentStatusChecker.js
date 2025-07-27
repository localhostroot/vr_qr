import { browser } from '$app/environment';
import { PUBLIC_DATABASE } from '$env/static/public';
import { globals } from '$lib/stores/+stores.svelte.js';
import LOCAL_STORAGE_KEYS from '$lib/constants/localStorageKeys.js';

/**
 * Process successful payment by getting token and updating paid films
 * @param {string} orderId - Order ID from successful payment
 */
async function processSuccessfulPayment(orderId) {
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
    
    // Mark order as checked BEFORE cleaning localStorage
    await fetch(`${PUBLIC_DATABASE}api/status/checked/?order_id=${orderId}`, {
      method: 'POST',
    });
    
    // Clean up localStorage only after successful API call
    if (browser) {
      localStorage.removeItem(LOCAL_STORAGE_KEYS.QUEUE_PENDING_PAYMENT);
      localStorage.removeItem(LOCAL_STORAGE_KEYS.QUEUE);
      localStorage.removeItem(LOCAL_STORAGE_KEYS.PAYKEEPER_ORDER_ID);
    }

    return { success: true };

  } catch (error) {
    console.error('Error processing successful payment:', error);
    throw error;
  }
}

/**
 * Check payment status for pending orders
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function checkPaymentStatus() {
  if (!browser) return { success: false };

  const orderId = localStorage.getItem(LOCAL_STORAGE_KEYS.PAYKEEPER_ORDER_ID);
  
  if (!orderId) {
    return { success: false };
  }

  try {
    const response = await fetch(`${PUBLIC_DATABASE}api/status/status/?order_id=${orderId}`);

    if (response.ok) {
      const data = await response.json();

      if (data.status === 'success') {
        await processSuccessfulPayment(orderId);
        return { success: true };
      } else if (data.status === 'checked') {
        // Order was already processed, clean up
        localStorage.removeItem(LOCAL_STORAGE_KEYS.PAYKEEPER_ORDER_ID);
        return { success: false };
      }
    } else {
      console.error("Error getting payment status");
      return { success: false, error: "Ошибка при получении статуса платежа" };
    }
  } catch (error) {
    console.error("Network error checking payment status:", error);
    return { success: false, error: "Ошибка сети при проверке статуса платежа" };
  }

  return { success: false };
}

/**
 * Svelte 5 composable for payment status management
 * @returns {Object} Payment status functions and state
 */
export function createPaymentStatusChecker() {
  let isLoading = $state(false);
  let error = $state(null);

  const checkStatus = async () => {
    if (!browser) return;

    isLoading = true;
    error = null;

    try {
      const result = await checkPaymentStatus();
      if (result.error) {
        error = result.error;
      }
    } catch (err) {
      error = "Ошибка при проверке статуса платежа";
    } finally {
      isLoading = false;
    }
  };

  return {
    get isLoading() { return isLoading; },
    get error() { return error; },
    checkStatus,
    clearError: () => { error = null; }
  };
}
