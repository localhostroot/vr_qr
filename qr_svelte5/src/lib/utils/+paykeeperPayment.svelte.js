import { browser } from '$app/environment';
import { goto } from '$app/navigation';
import { PUBLIC_DATABASE } from '$env/static/public';
import { globals } from '$lib/stores/+stores.svelte.js';
import LOCAL_STORAGE_KEYS from '$lib/constants/localStorageKeys.js';
import { syncLatestAccessForUser } from '$lib/utils/paymentStatusChecker.js';
import { getViewerRoute } from '$lib/utils/viewerRoutes.js';


/** @param {string} paymentUrl */
const getPaymentTarget = (paymentUrl) => {
  if (typeof paymentUrl !== 'string') return null;

  try {
    const paymentTarget = new URL(paymentUrl);
    if (
      paymentTarget.protocol === 'https:'
      && paymentTarget.hostname === '4-neba.server.paykeeper.ru'
      && paymentTarget.pathname.startsWith('/bill/')
    ) {
      return paymentTarget;
    }
  } catch (error) {
    console.warn('PayKeeper returned an invalid payment URL:', error);
  }

  return null;
};


/**
 * Factory function for creating Paykeeper payment handlers
 * @returns {Object} Payment handling functions and state setters
 */
export function createPaykeeperPayment() {
  // Use reactive loading state for Svelte 5
  let loadingState = $state(false);

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
    if (!browser || loadingState) return;

    globals.set('queueErrorState', '');

    const userId = getCurrentUserId();
    let queue = globals.get('queue');

    // Validation
    if (!userId) {
      globals.set('queueErrorState', "Хедсет не найден! Отсканируйте QR код ещё раз");
      return;
    }

    if (!queue || queue.length === 0) {
      globals.set('queueErrorState', "Ваша корзина пуста. Добавьте фильмы для оплаты");
      return;
    }

    const existingOrderId = localStorage.getItem(LOCAL_STORAGE_KEYS.PAYKEEPER_ORDER_ID);
    let freeAccess = false;
    try {
      const freeAccessResponse = await fetch(
        `${PUBLIC_DATABASE}api/payments/free_access_status/?user_id=${encodeURIComponent(userId)}`,
      );
      if (freeAccessResponse.ok) {
        const freeAccessData = await freeAccessResponse.json();
        freeAccess = freeAccessData.free_access === true;
      }
    } catch (error) {
      console.warn('Не удалось проверить бесплатный режим:', error);
    }

    // A bank invoice created before free mode was enabled must not block the
    // explicitly configured free viewer.  The provider order itself is left
    // untouched; only this browser's recovery pointer is discarded.
    if (freeAccess && existingOrderId) {
      localStorage.removeItem(LOCAL_STORAGE_KEYS.PAYKEEPER_ORDER_ID);
      localStorage.removeItem(LOCAL_STORAGE_KEYS.ORDER_TIME);
      localStorage.removeItem(LOCAL_STORAGE_KEYS.QUEUE_PENDING_PAYMENT);
    } else if (existingOrderId) {
      try {
        const existingResponse = await fetch(
          `${PUBLIC_DATABASE}api/status/status/?order_id=${encodeURIComponent(existingOrderId)}&include_payment_url=true`,
        );

        if (existingResponse.ok) {
          const existingData = await existingResponse.json();
          if (existingData.status === 'pending') {
            const existingPaymentTarget = getPaymentTarget(existingData.payment_url);
            if (existingPaymentTarget) {
              globals.set('queueErrorState', 'Открываем ранее созданный счёт...');
              window.location.assign(existingPaymentTarget.href);
              return;
            }

            globals.set(
              'queueErrorState',
              'Предыдущий заказ уже создан и ожидает подтверждения.',
            );
            return;
          }

          if (['success', 'checked'].includes(existingData.status)) {
            // A confirmed order is terminal and must never block the next
            // purchase. Refresh access first, but preserve the basket the
            // viewer has just assembled for the new order: a newer token can
            // legitimately make syncLatestAccessForUser clear the old basket.
            const selectedQueue = queue;
            const accessResult = await syncLatestAccessForUser(userId);
            globals.set('queue', selectedQueue);
            queue = selectedQueue;

            if (accessResult.pending) {
              globals.set(
                'queueErrorState',
                'Не удалось обновить предыдущую покупку. Повторите через несколько секунд.',
              );
              return;
            }

            localStorage.removeItem(LOCAL_STORAGE_KEYS.PAYKEEPER_ORDER_ID);
            localStorage.removeItem(LOCAL_STORAGE_KEYS.ORDER_TIME);
            localStorage.removeItem(LOCAL_STORAGE_KEYS.QUEUE_PENDING_PAYMENT);
          }

          localStorage.removeItem(LOCAL_STORAGE_KEYS.PAYKEEPER_ORDER_ID);
          localStorage.removeItem(LOCAL_STORAGE_KEYS.ORDER_TIME);
          localStorage.removeItem(LOCAL_STORAGE_KEYS.QUEUE_PENDING_PAYMENT);
        } else if (existingResponse.status === 404) {
          localStorage.removeItem(LOCAL_STORAGE_KEYS.PAYKEEPER_ORDER_ID);
        } else {
          globals.set('queueErrorState', 'Не удалось проверить предыдущий заказ. Повторите через несколько секунд.');
          return;
        }
      } catch (error) {
        globals.set('queueErrorState', 'Не удалось проверить предыдущий заказ. Повторите через несколько секунд.');
        return;
      }
    }

    loadingState = true;
    globals.set('queueErrorState', '');

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
        globals.set('queueErrorState', "Ошибка при создании заказа: " + (errorData.error || "Неизвестная ошибка"));
        loadingState = false;
        return;
      }

      const orderData = await createOrderResponse.json();
      const orderId = orderData.order_id;
      const totalAmount = orderData.amount;
      const paymentUrl = orderData.payment_url;

      if (orderData.free_access === true) {
        const accessResult = await syncLatestAccessForUser(userId);
        if (!accessResult.success) {
          globals.set(
            'queueErrorState',
            'Доступ выдан, но список фильмов пока не обновился. Повторите через несколько секунд.',
          );
          loadingState = false;
          return;
        }

        localStorage.removeItem(LOCAL_STORAGE_KEYS.PAYKEEPER_ORDER_ID);
        localStorage.removeItem(LOCAL_STORAGE_KEYS.ORDER_TIME);
        localStorage.removeItem(LOCAL_STORAGE_KEYS.QUEUE_PENDING_PAYMENT);
        await goto(getViewerRoute(globals.get('currentClient'), 'films'));
        loadingState = false;
        return;
      }

      if (!orderId || !totalAmount || !paymentUrl) {
        globals.set('queueErrorState', 'Ошибка создания заказа, попробуйте ещё раз');
        loadingState = false;
        return;
      }

      const paymentTarget = getPaymentTarget(paymentUrl);
      if (!paymentTarget) {
        globals.set('queueErrorState', 'Платёжный шлюз вернул некорректную ссылку');
        loadingState = false;
        return;
      }

      // Store order data for later verification
      localStorage.setItem(LOCAL_STORAGE_KEYS.PAYKEEPER_ORDER_ID, orderId);
      localStorage.setItem(LOCAL_STORAGE_KEYS.ORDER_TIME, new Date().toISOString());
      localStorage.setItem(LOCAL_STORAGE_KEYS.QUEUE_PENDING_PAYMENT, JSON.stringify(queue));

      window.location.assign(paymentTarget.href);

    } catch (err) {
      console.error('Payment error:', err);
      globals.set('queueErrorState', "Ошибка сети или сервера.");
      loadingState = false;
    }
  };

  return {
    get isLoading() { return loadingState; },
    handlePaymentClick,
    clearError: () => { globals.set('queueErrorState', ''); }
  };
}
