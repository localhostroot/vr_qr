import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import style from './tokenentrypage.module.scss';

const TokenEntryPage = () => {
  const [token, setToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const navigate = useNavigate();
  const dispatch = useDispatch();
  const databaseApi = import.meta.env.VITE_REACT_APP_DATABASE;

  const handleTokenChange = (e) => {
    setToken(e.target.value);
    if (error) setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!token.trim()) {
      setError('Пожалуйста, введите токен');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const requestUrl = `${databaseApi}api/tokens/enter_token/`;
      const requestData = { token: token.trim() };

      const response = await fetch(requestUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      const data = await response.json();

      if (response.ok && data.valid) {

        dispatch({ type: 'SET_PAID_FILMS', payload: [] });

        dispatch({
          type: 'SET_TOKEN',
          payload: {
            token: token.trim(),
            expiry: data.expires_at
          }
        });

        if (data.films && Array.isArray(data.films)) {
          data.films.forEach((film) => {
            dispatch({ type: 'ADD_PAID_FILM', payload: film });
          });
        }

        setSuccess(true);
        setToken('');

        setTimeout(() => {
          navigate('/films/');
        }, 2000);
      } else {
        setError(data.error || 'Недействительный токен');
      }
    } catch (error) {
      setError('Произошла ошибка при проверке токена');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={style.tokenEntryPage}>
      <div className={style.container}>
        <h1 className={style.title}>Ввод токена доступа</h1>

        <form className={style.tokenForm} onSubmit={handleSubmit}>
          <div className={style.inputGroup}>
            <label htmlFor="token" className={style.label}>
              Введите токен доступа:
            </label>
            <input
              type="text"
              id="token"
              className={style.tokenInput}
              value={token}
              onChange={handleTokenChange}
              disabled={isLoading}
              placeholder="Введите токен доступа..."
            />
          </div>

          {error && (
            <div className={style.errorMessage}>
              {error}
            </div>
          )}

          {success && (
            <div className={style.successMessage}>
              Токен успешно проверен! Переход на страницу с фильмами...
            </div>
          )}

          <button
            type="submit"
            className={style.submitButton}
            disabled={isLoading || success}
          >
            {isLoading ? 'Проверка...' : 'Подтвердить'}
          </button>
        </form>

        <div className={style.instructions}>
          <h3>Инструкции:</h3>
          <p>Токен доступа к фильмам выдается после успешной оплаты. Если у вас возникли проблемы с доступом к оплаченным фильмам, введите здесь полученный токен.</p>
          <p>При возникновении проблем, обратитесь к администратору.</p>
        </div>

        <button
          className={style.backButton}
          onClick={() => navigate(-1)}
          disabled={isLoading}
        >
          Назад
        </button>
      </div>
    </div>
  );
};

export default TokenEntryPage;