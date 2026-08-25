import { browser } from '$app/environment';
import { PUBLIC_DATABASE } from '$env/static/public';
import { globals } from '$lib/stores/+stores.svelte.js';
import LOCAL_STORAGE_KEYS from '$lib/constants/localStorageKeys.js';


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
    const queue = globals.get('queue');

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
    if (existingOrderId) {
      try {
        const existingResponse = await fetch(
          `${PUBLIC_DATABASE}api/status/status/?order_id=${encodeURIComponent(existingOrderId)}`,
        );

        if (existingResponse.ok) {
          const existingData = await existingResponse.json();
          if (['pending', 'success', 'checked'].includes(existingData.status)) {
            globals.set(
              'queueErrorState',
              existingData.status === 'pending'
                ? 'Предыдущий заказ уже создан и ожидает подтверждения.'
                : 'Предыдущий заказ уже подтверждён. Доступ обновляется автоматически.',
            );
            return;
          }
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

      if (!orderId || !totalAmount || !paymentUrl) {
        globals.set('queueErrorState', 'Ошибка создания заказа, попробуйте ещё раз');
        loadingState = false;
        return;
      }

      const paymentTarget = new URL(paymentUrl);
      if (
        paymentTarget.protocol !== 'https:'
        || paymentTarget.hostname !== '4-neba.server.paykeeper.ru'
        || !paymentTarget.pathname.startsWith('/bill/')
      ) {
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
