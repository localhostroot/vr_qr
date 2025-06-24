import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import styles from './paymentresultpage.module.scss';

const PaymentResultPage = () => {
  const [status, setStatus] = useState('loading');
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const isSuccess = queryParams.get('success') === 'true';
    
    if (isSuccess) {
      setStatus('success');
    } else {
      setStatus('error');
    }
  }, [location.search]);

  const handleContinue = () => {
    if (status === 'success') {
      navigate('/films/');
    } else {
      navigate('/queue/');
    }
  };

  return (
    <div className={styles.paymentResult}>

      {status === 'loading' && (
        <div className={styles.loadingContainer}>
          <div className={styles.spinner}></div>
          <p>Загрузка...</p>
        </div>
      )}

      {status === 'success' && (
        <div className={styles.successContainer}>
          <div className={styles.successIcon}>✓</div>
          <h2>Оплата успешна!</h2>
          <p>Ваш заказ был успешно оплачен. Теперь вы можете смотреть выбранные фильмы.</p>
          <button className={styles.continueButton} onClick={handleContinue}>
            Перейти к фильмам
          </button>
        </div>
      )}

      {status === 'error' && (
        <div className={styles.errorContainer}>
          <div className={styles.errorIcon}>✗</div>
          <h2>Ошибка оплаты</h2>
          <p>Произошла ошибка при обработке платежа. Попробуйте еще раз.</p>
          <button className={styles.continueButton} onClick={handleContinue}>
            Вернуться в корзину
          </button>
        </div>
      )}
    </div>
  );
};

export default PaymentResultPage;