<script>
  import { goto } from '$app/navigation';
  import { PUBLIC_DATABASE } from '$env/static/public';
  import { globals } from '$lib/stores/+stores.svelte.js';
  import { getSubfolder } from '$lib/utils/+helpers.svelte';

  let token = $state('');
  let isLoading = $state(false);
  let error = $state(null);
  let success = $state(false);

  function handleTokenChange(e) {
    token = e.target.value;
    if (error) error = null;
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!token.trim()) {
      error = 'Пожалуйста, введите токен';
      return;
    }

    isLoading = true;
    error = null;

    try {
      const requestUrl = `${PUBLIC_DATABASE}api/tokens/enter_token/`;
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
        // Clear existing paid films
        globals.set('paidFilms', []);

        // Set token and expiry
        globals.set('token', token.trim());
        globals.set('tokenExpiry', data.expires_at);

        // Add new paid films
        if (data.films && Array.isArray(data.films)) {
          globals.set('paidFilms', data.films);
        }

        success = true;
        token = '';

        setTimeout(() => {
          goto(`${getSubfolder()}/films/`);
        }, 2000);
      } else {
        error = data.error || 'Недействительный токен';
      }
    } catch (err) {
      error = 'Произошла ошибка при проверке токена';
    } finally {
      isLoading = false;
    }
  }

  function handleBack() {
    history.back();
  }
</script>

<div class="token-entry-page">
  <div class="container">
    <h1 class="title">Ввод токена доступа</h1>

    <form class="token-form" onsubmit={handleSubmit}>
      <div class="input-group">
        <label for="token" class="label">
          Введите токен доступа:
        </label>
        <input
          type="text"
          id="token"
          class="token-input"
          bind:value={token}
          oninput={handleTokenChange}
          disabled={isLoading}
          placeholder="Введите токен доступа..."
        />
      </div>

      {#if error}
        <div class="error-message">
          {error}
        </div>
      {/if}

      {#if success}
        <div class="success-message">
          Токен успешно проверен! Переход на страницу с фильмами...
        </div>
      {/if}

      <button
        type="submit"
        class="submit-button"
        disabled={isLoading || success}
      >
        {isLoading ? 'Проверка...' : 'Подтвердить'}
      </button>
    </form>

    <div class="instructions">
      <h3>Инструкции:</h3>
      <p>Токен доступа к фильмам выдается после успешной оплаты. Если у вас возникли проблемы с доступом к оплаченным фильмам, введите здесь полученный токен.</p>
      <p>При возникновении проблем, обратитесь к администратору.</p>
    </div>

    <button
      class="back-button"
      onclick={handleBack}
      disabled={isLoading}
    >
      Назад
    </button>
  </div>
</div>

<style>
  .token-entry-page {
    min-height: 100vh;
    background: var(--color-dark-primary);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-20);
    font-family: 'Montserrat', sans-serif;
  }

  .container {
    background: var(--color-dark-secondary);
    border-radius: var(--radius-15);
    padding: var(--spacing-40);
    max-width: var(--container-600);
    width: 100%;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
    border: 1px solid var(--color-dark-50);
  }

  .title {
    color: var(--color-white);
    font-size: var(--font-20);
    font-weight: var(--font-weight-600);
    text-align: center;
    margin-bottom: var(--spacing-30);
    line-height: 1.3;
  }

  .token-form {
    margin-bottom: var(--spacing-30);
  }

  .input-group {
    margin-bottom: var(--spacing-25);
  }

  .label {
    display: block;
    color: var(--color-white-90);
    font-size: var(--font-10);
    font-weight: var(--font-weight-500);
    margin-bottom: var(--spacing-8);
  }

  .token-input {
    width: 100%;
    padding: var(--spacing-15);
    background: rgba(0, 0, 0, 0.6);
    border: 2px solid var(--color-dark-50);
    border-radius: var(--radius-10);
    color: var(--color-white);
    font-size: var(--font-10);
    transition: var(--transition-300);
    box-sizing: border-box;
  }

  .token-input::placeholder {
    color: var(--color-white-50);
  }

  .token-input:focus {
    outline: none;
    border-color: var(--color-blue);
    box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
  }

  .token-input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .token-input:hover:not(:disabled) {
    border-color: var(--color-dark-30);
  }

  .error-message {
    background: var(--color-error-10);
    border: 1px solid var(--color-error-30);
    color: var(--color-red-light);
    padding: var(--spacing-10) var(--spacing-15);
    border-radius: var(--radius-5);
    margin-bottom: var(--spacing-20);
    font-size: var(--font-9);
    animation: slideIn 0.3s ease;
  }

  .success-message {
    background: var(--color-success-10);
    border: 1px solid var(--color-success-30);
    color: var(--color-success);
    padding: var(--spacing-10) var(--spacing-15);
    border-radius: var(--radius-5);
    margin-bottom: var(--spacing-20);
    font-size: var(--font-9);
    animation: slideIn 0.3s ease;
  }

  .submit-button {
    width: 100%;
    padding: var(--spacing-15);
    background: linear-gradient(135deg, var(--color-blue) 0%, #357abd 100%);
    color: var(--color-white);
    border: none;
    border-radius: var(--radius-10);
    font-size: var(--font-10);
    font-weight: var(--font-weight-600);
    cursor: pointer;
    transition: var(--transition-300);
    position: relative;
    overflow: hidden;
  }

  .submit-button:hover:not(:disabled) {
    background: linear-gradient(135deg, #357abd 0%, #2a5a8a 100%);
    transform: var(--transform-hover-lift-2);
    box-shadow: 0 8px 25px rgba(0, 123, 255, 0.3);
  }

  .submit-button:active:not(:disabled) {
    transform: translateY(0);
  }

  .submit-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }

  .instructions {
    background: rgba(0, 0, 0, 0.3);
    border-radius: var(--radius-10);
    padding: var(--spacing-25);
    margin-bottom: var(--spacing-25);
    border: 1px solid var(--color-dark-30);
  }

  .instructions h3 {
    color: var(--color-white);
    font-size: var(--font-12);
    font-weight: var(--font-weight-600);
    margin-bottom: var(--spacing-15);
    margin-top: 0;
  }

  .instructions p {
    color: var(--color-white-70);
    font-size: var(--font-9);
    line-height: 1.5;
    margin-bottom: var(--spacing-10);
  }

  .instructions p:last-child {
    margin-bottom: 0;
  }

  .back-button {
    width: 100%;
    padding: var(--spacing-10);
    background: transparent;
    color: var(--color-white-50);
    border: 2px solid var(--color-dark-50);
    border-radius: var(--radius-10);
    font-size: var(--font-10);
    font-weight: var(--font-weight-500);
    cursor: pointer;
    transition: var(--transition-300);
  }

  .back-button:hover:not(:disabled) {
    background: var(--color-dark-30);
    color: var(--color-white);
    border-color: var(--color-dark-30);
  }

  .back-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @media (max-width: 768px) {
    .token-entry-page {
      padding: var(--spacing-15);
      align-items: flex-start;
      padding-top: var(--spacing-40);
    }

    .container {
      padding: var(--spacing-30) var(--spacing-25);
    }

    .title {
      font-size: var(--font-15);
      margin-bottom: var(--spacing-25);
    }

    .token-input {
      padding: var(--spacing-10);
      font-size: var(--font-10);
    }

    .submit-button {
      padding: var(--spacing-10);
      font-size: var(--font-10);
    }

    .instructions {
      padding: var(--spacing-20);
    }

    .instructions h3 {
      font-size: var(--font-11);
    }

    .instructions p {
      font-size: var(--font-8);
    }
  }

  @media (max-width: 480px) {
    .container {
      padding: var(--spacing-25) var(--spacing-20);
    }

    .title {
      font-size: var(--font-12);
    }

    .instructions {
      padding: var(--spacing-15);
    }
  }

  .submit-button:disabled {
    position: relative;
  }

  .submit-button:disabled::after {
    content: '';
    position: absolute;
    width: 16px;
    height: 16px;
    margin: auto;
    border: 2px solid transparent;
    border-top-color: var(--color-white);
    border-radius: var(--radius-full);
    animation: spin 1s ease infinite;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  }

  @keyframes spin {
    0% {
      transform: translate(-50%, -50%) rotate(0deg);
    }
    100% {
      transform: translate(-50%, -50%) rotate(360deg);
    }
  }

  .token-input:focus + .label {
    color: var(--color-blue);
  }

  .token-form:has(.success-message) .token-input {
    border-color: var(--color-success);
  }

  .token-form:has(.error-message) .token-input {
    border-color: var(--color-error);
  }
</style>
