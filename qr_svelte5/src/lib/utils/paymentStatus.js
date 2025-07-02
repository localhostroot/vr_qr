import { globals } from '$lib/stores/+stores.svelte.js';
import axios from 'axios';

export const usePaymentStatus = (databaseApi) => {
  const checkPaymentStatus = async () => {
    const orderId = localStorage.getItem('paykeeperOrderID');

    if (!orderId) {
      return;
    }

    globals.set('isPaymentLoading', true);
    globals.set('paymentError', null);

    try {
      const response = await axios.get(`${databaseApi}api/status/status/`, {
        params: { order_id: orderId }
      });

      if (response.data.status === 'success') {
        await processSuccessfulPayment(orderId, databaseApi);
      } else if (response.data.status === 'checked') {
        localStorage.removeItem('paykeeperOrderID');
      }
    } catch (error) {
      globals.set('paymentError', 'Network error while checking payment status');
    } finally {
      globals.set('isPaymentLoading', false);
    }
  };

  const processSuccessfulPayment = async (orderId, databaseApi) => {
    try {
      let getTokenUrl = `${databaseApi}api/tokens/get_token_by_order/`;
      const currentToken = globals.get('token');

      const tokenResponse = await axios.get(getTokenUrl, {
        params: {
          order_id: orderId,
          current_token: currentToken
        }
      });

      if (!tokenResponse.data.valid || !tokenResponse.data.token) {
        throw new Error('Invalid token for this order');
      }

      const filmsResponse = await axios.get(`${databaseApi}api/tokens/get_films/`, {
        params: { token: tokenResponse.data.token }
      });

      if (!filmsResponse.data.valid) {
        globals.set('token', null);
        localStorage.removeItem('payment_token');
        globals.set('paidFilms', []);
        throw new Error('Invalid token');
      }

      globals.set('token', tokenResponse.data.token);
      globals.set('tokenExpiry', filmsResponse.data.expires_at);

      const paidFilms = filmsResponse.data.films || [];
      globals.set('paidFilms', paidFilms);
      globals.set('queue', []);  // Clear queue on successful payment

      localStorage.removeItem('queuePendingPayment');
      localStorage.removeItem('queue');
      localStorage.removeItem('paykeeperOrderID');

      await axios.post(`${databaseApi}api/status/checked/`, null, {
        params: { order_id: orderId }
      });
    } catch (error) {
      globals.set('paymentError', 'Error processing successful payment');
    }
  };

  return { checkPaymentStatus };
};

