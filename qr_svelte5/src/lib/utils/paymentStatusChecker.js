import { browser } from '$app/environment';
import { PUBLIC_DATABASE } from '$env/static/public';
import { globals } from '$lib/stores/+stores.svelte.js';
import LOCAL_STORAGE_KEYS from '$lib/constants/localStorageKeys.js';

const filmSignature = (films) => (films || [])
  .map((film) => `${film.film_id || film.id}:${film.is_series ? 1 : 0}`)
  .sort()
  .join('|');

function applyAccessData(data) {
  const previousToken = globals.get('token');
  const films = Array.isArray(data.films) ? data.films : [];

  globals.set('token', data.token);
  globals.set('tokenExpiry', data.expires_at);

  if (filmSignature(globals.get('paidFilms')) !== filmSignature(films)) {
    globals.set('paidFilms', films);
  }

  return previousToken !== data.token;
}

/**
 * Restore current access by viewer id.  This is the F5/manual-issuance path:
 * it does not depend on a pending order id surviving in localStorage.
 */
export async function syncLatestAccessForUser(userId) {
  if (!browser || !userId) return { success: false, pending: false };

  try {
    const response = await fetch(
      `${PUBLIC_DATABASE}api/tokens/latest_for_user/?user_id=${encodeURIComponent(userId)}`,
    );

    if (!response.ok) {
      return { success: false, pending: true };
    }

    const data = await response.json();
    if (!data.valid || !data.token || !Array.isArray(data.films)) {
      // latest_for_user is authoritative. Access can end before its original
      // two-hour expiry when the headset presence timeout closes the session.
      globals.set('token', null);
      globals.set('tokenExpiry', null);
      globals.set('paidFilms', []);
      return { success: false, pending: false };
    }

    const tokenChanged = applyAccessData(data);

    // A different server token means a newer purchase was issued (or an old
    // deleted token was recovered).  Only then is it safe to clear the basket.
    if (tokenChanged) {
      globals.set('queue', []);
      localStorage.removeItem(LOCAL_STORAGE_KEYS.QUEUE_PENDING_PAYMENT);
      localStorage.removeItem(LOCAL_STORAGE_KEYS.QUEUE);
    }

    return { success: true, pending: false, tokenChanged };
  } catch (error) {
    console.warn('Не удалось восстановить доступ зрителя, повторим проверку:', error);
    return { success: false, pending: true };
  }
}

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
      if (getTokenResponse.status === 404) {
        return { success: false, pending: true };
      }
      return { success: false, error: "Не удалось получить токен по ID заказа" };
    }

    const tokenData = await getTokenResponse.json();

    if (!tokenData.valid || !tokenData.token) {
      // Payment may already be confirmed while an administrator is still
      // issuing the token. Keep polling instead of requiring a page reload.
      return { success: false, pending: true };
    }

    // Get films for the token
    const filmsResponse = await fetch(`${PUBLIC_DATABASE}api/tokens/get_films/?token=${tokenData.token}`);
    
    if (!filmsResponse.ok) {
      return { success: false, error: "Не удалось получить информацию о фильмах" };
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
      return { success: false, error: "Токен недействителен" };
    }

    applyAccessData({
      token: tokenData.token,
      expires_at: filmsData.expires_at,
      films: filmsData.films,
    });

    // Clear queue since payment was successful
    globals.set('queue', []);
    
    // Mark order as checked BEFORE cleaning localStorage
    const checkedResponse = await fetch(`${PUBLIC_DATABASE}api/status/checked/?order_id=${orderId}`, {
      method: 'POST',
    });

    // A 400 here normally means another tab already acknowledged the order.
    // Other failures are retried without discarding the local recovery id.
    if (!checkedResponse.ok && checkedResponse.status !== 400) {
      return { success: true, pending: true };
    }
    
    // Clean up localStorage only after successful API call
    if (browser) {
      localStorage.removeItem(LOCAL_STORAGE_KEYS.QUEUE_PENDING_PAYMENT);
      localStorage.removeItem(LOCAL_STORAGE_KEYS.QUEUE);
      localStorage.removeItem(LOCAL_STORAGE_KEYS.PAYKEEPER_ORDER_ID);
      localStorage.removeItem(LOCAL_STORAGE_KEYS.ORDER_TIME);
    }

    return { success: true, pending: false };

  } catch (error) {
    console.warn('Не удалось обновить выданный доступ, повторим проверку:', error);
    return { success: false, error: "Ошибка сети при получении доступа" };
  }
}

let statusCheckInFlight = null;

async function runPaymentStatusCheck() {
  const orderId = localStorage.getItem(LOCAL_STORAGE_KEYS.PAYKEEPER_ORDER_ID);

  if (!orderId) {
    return { success: false, pending: false };
  }

  try {
    const response = await fetch(`${PUBLIC_DATABASE}api/status/status/?order_id=${orderId}`);

    if (response.ok) {
      const data = await response.json();

      if (data.status === 'success') {
        return await processSuccessfulPayment(orderId);
      } else if (data.status === 'checked') {
        // Another tab may have acknowledged the order first.  Recover its
        // token before removing the only local link to that purchase.
        return await processSuccessfulPayment(orderId);
      }

      return { success: false, pending: true };
    }

    console.warn("Не удалось получить статус платежа, повторим проверку");
    return { success: false, pending: true, error: "Ошибка при получении статуса платежа" };
  } catch (error) {
    console.warn("Сетевая ошибка проверки платежа, повторим проверку:", error);
    return { success: false, pending: true, error: "Ошибка сети при проверке статуса платежа" };
  }
}

/**
 * Check payment status for pending orders
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export function checkPaymentStatus() {
  if (!browser) return { success: false };

  if (statusCheckInFlight) {
    return statusCheckInFlight;
  }

  statusCheckInFlight = runPaymentStatusCheck().finally(() => {
    statusCheckInFlight = null;
  });

  return statusCheckInFlight;
}

/**
 * Poll pending payment/token state and refresh immediately when the page
 * regains focus or network connectivity.
 * @param {{intervalMs?: number}} options
 * @returns {() => void} cleanup function
 */
export function startPaymentStatusMonitor({ intervalMs = 5000, userId = null } = {}) {
  if (!browser) return () => {};

  let stopped = false;
  let refreshInFlight = null;

  const refresh = () => {
    if (stopped || refreshInFlight) return;

    refreshInFlight = (async () => {
      await checkPaymentStatus();
      if (userId) {
        await syncLatestAccessForUser(userId);
      }
    })().finally(() => {
      refreshInFlight = null;
    });
  };

  const refreshWhenVisible = () => {
    if (document.visibilityState === 'visible') {
      refresh();
    }
  };

  refresh();
  const intervalId = window.setInterval(refreshWhenVisible, intervalMs);
  window.addEventListener('focus', refresh);
  window.addEventListener('online', refresh);
  document.addEventListener('visibilitychange', refreshWhenVisible);

  return () => {
    stopped = true;
    window.clearInterval(intervalId);
    window.removeEventListener('focus', refresh);
    window.removeEventListener('online', refresh);
    document.removeEventListener('visibilitychange', refreshWhenVisible);
  };
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
