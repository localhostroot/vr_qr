import { useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import LOCAL_STORAGE_KEYS from "@/shared/constants/localStorageKeys.js";

const usePaymentStatus = (databaseApi) => {
  const dispatch = useDispatch();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const currentToken = useSelector(state => state.token.token);

  const checkPaymentStatus = useCallback(async () => {
    const orderId = localStorage.getItem(LOCAL_STORAGE_KEYS.PAYKEEPER_ORDER_ID);
    
    if (!orderId) {
      return; 
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${databaseApi}api/status/status/?order_id=${orderId}`);

      if (response.ok) {
        const data = await response.json();

        if (data.status === 'success') {
          await processSuccessfulPayment(orderId, databaseApi, dispatch, currentToken);
        } else if (data.status === 'checked') {
          localStorage.removeItem(LOCAL_STORAGE_KEYS.PAYKEEPER_ORDER_ID);
        }
      } else {
        setError("Ошибка при получении статуса платежа");
      }
    } catch (error) {
      setError("Ошибка сети при проверке статуса платежа");
    } finally {
      setIsLoading(false);
    }
  }, [databaseApi, dispatch, currentToken]);

  return { checkPaymentStatus, isLoading, error };
};

const processSuccessfulPayment = async (orderId, databaseApi, dispatch, currentToken) => {
  try {
    let getTokenUrl = `${databaseApi}api/tokens/get_token_by_order/?order_id=${orderId}`;
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

    const filmsResponse = await fetch(`${databaseApi}api/tokens/get_films/?token=${tokenData.token}`);
    
    if (!filmsResponse.ok) {
      throw new Error("Не удалось получить информацию о фильмах");
    }

    const filmsData = await filmsResponse.json();

    if (!filmsData.valid) {
      dispatch({ type: 'REMOVE_TOKEN' });
      dispatch({ type: 'SET_PAID_FILMS', payload: [] });  
      localStorage.removeItem(LOCAL_STORAGE_KEYS.PAID_FILMS); 
      throw new Error("Токен недействителен");
    }

    dispatch({
      type: 'SET_TOKEN',
      payload: {
        token: tokenData.token,
        expiry: filmsData.expires_at
      }
    });

    dispatch({ type: 'SET_PAID_FILMS', payload: [] });

    if (filmsData.films && Array.isArray(filmsData.films)) {
      filmsData.films.forEach(film => {
        dispatch({ type: 'ADD_PAID_FILM', payload: film });
      });
    }

    dispatch({ type: 'CLEAR_QUEUE' });
    localStorage.removeItem(LOCAL_STORAGE_KEYS.QUEUE_PENDING_PAYMENT);
    localStorage.removeItem(LOCAL_STORAGE_KEYS.QUEUE);
    localStorage.removeItem(LOCAL_STORAGE_KEYS.PAYKEEPER_ORDER_ID);

    await fetch(`${databaseApi}api/status/checked/?order_id=${orderId}`, {
      method: 'POST',
    });

  } catch (error) {
    setError("Ошибка при обработке успешного платежа");
    throw error;
  }
};

export default usePaymentStatus;