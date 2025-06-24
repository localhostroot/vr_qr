import { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import LOCAL_STORAGE_KEYS from "@/shared/constants/localStorageKeys.js";

const usePaykeeperPayment = (databaseApi, userId) => {
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const queue = useSelector(state => state.queue.queue);
  const dispatch = useDispatch();

  const paykeeperUrl = "https://4-neba.server.paykeeper.ru/create/";
  const successUrl = `${window.location.origin}/payment-result?success=true`;
  const failUrl = `${window.location.origin}/payment-result?success=false`;

  const handlePaymentClick = async () => {
    if (!userId) {
      setError("Вы не выбрали очки. Перейдите на начальную страницу и выберите очки");
      return;
    }

    if (queue.length === 0) {
      setError("Ваша очередь пуста. Добавьте фильмы для оплаты.");
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const createOrderResponse = await fetch(`${databaseApi}api/payments/create_order/`, {
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
        setError("Ошибка при создании заказа: " + (errorData.error || "Неизвестная ошибка"));
        setIsLoading(false);
        return;
      }

      const orderData = await createOrderResponse.json();
      const orderId = orderData.order_id;
      const totalAmount = orderData.amount;

      localStorage.setItem(LOCAL_STORAGE_KEYS.PAYKEEPER_ORDER_ID, orderId);
      localStorage.setItem(LOCAL_STORAGE_KEYS.QUEUE_PENDING_PAYMENT, JSON.stringify(queue));

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

      addInput('sum', totalAmount);
      addInput('clientid', userId);
      addInput('orderid', orderId);
      addInput('name', "Оплата за просмотр фильмов");
      addInput('success_url', successUrl);
      addInput('fail_url', failUrl);

      document.body.appendChild(form);
      form.submit();

    } catch (error) {
      setError("Ошибка сети или сервера.");
      setIsLoading(false);
    }
  };

  return { handlePaymentClick, error, isLoading };
};

export default usePaykeeperPayment;