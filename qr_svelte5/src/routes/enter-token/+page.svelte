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
    font-family: var(--font-family-primary);
  }

  .container {
    background: var(--color-dark-secondary);
    border-radius: var(--radius-16);
    padding: var(--spacing-40);
    max-width: 500px;
    width: 100%;
    box-shadow: var(--shadow-xl);
    border: 1px solid var(--color-dark-50);
  }

  .title {
    color: var(--color-white);
    font-size: var(--font-28);
    font-weight: var(--font-weight-600);
    text-align: center;
    margin-bottom: var(--spacing-32);
    line-height: 1.3;
  }

  .token-form {
    margin-bottom: var(--spacing-32);
  }

  .input-group {
    margin-bottom: var(--spacing-24);
  }

  .label {
    display: block;
    color: var(--color-white-90);
    font-size: var(--font-16);
    font-weight: var(--font-weight-500);
    margin-bottom: var(--spacing-8);
  }

  .token-input {
    width: 100%;
    padding: var(--spacing-16);
    background: var(--color-dark-80);
    border: 2px solid var(--color-dark-50);
    border-radius: var(--radius-12);
    color: var(--color-white);
    font-size: var(--font-16);
    transition: var(--transition-300);
    box-sizing: border-box;
  }

  .token-input::placeholder {
    color: var(--color-white-50);
  }

  .token-input:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px var(--color-primary-10);
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
    color: var(--color-error-light);
    padding: var(--spacing-12) var(--spacing-16);
    border-radius: var(--radius-8);
    margin-bottom: var(--spacing-20);
    font-size: var(--font-14);
    animation: slideIn 0.3s ease;
  }

  .success-message {
    background: var(--color-success-10);
    border: 1px solid var(--color-success-30);
    color: var(--color-success-light);
    padding: var(--spacing-12) var(--spacing-16);
    border-radius: var(--radius-8);
    margin-bottom: var(--spacing-20);
    font-size: var(--font-14);
    animation: slideIn 0.3s ease;
  }

  .submit-button {
    width: 100%;
    padding: var(--spacing-16);
    background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%);
    color: var(--color-white);
    border: none;
    border-radius: var(--radius-12);
    font-size: var(--font-16);
    font-weight: var(--font-weight-600);
    cursor: pointer;
    transition: var(--transition-300);
    position: relative;
    overflow: hidden;
  }

  .submit-button:hover:not(:disabled) {
    background: linear-gradient(135deg, var(--color-primary-dark) 0%, var(--color-primary-darker) 100%);
    transform: translateY(-2px);
    box-shadow: var(--shadow-lg);
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
    background: var(--color-dark-90);
    border-radius: var(--radius-12);
    padding: var(--spacing-24);
    margin-bottom: var(--spacing-24);
    border: 1px solid var(--color-dark-70);
  }

  .instructions h3 {
    color: var(--color-white);
    font-size: var(--font-18);
    font-weight: var(--font-weight-600);
    margin-bottom: var(--spacing-16);
    margin-top: 0;
  }

  .instructions p {
    color: var(--color-white-70);
    font-size: var(--font-14);
    line-height: 1.5;
    margin-bottom: var(--spacing-12);
  }

  .instructions p:last-child {
    margin-bottom: 0;
  }

  .back-button {
    width: 100%;
    padding: var(--spacing-14);
    background: transparent;
    color: var(--color-white-50);
    border: 2px solid var(--color-dark-50);
    border-radius: var(--radius-12);
    font-size: var(--font-16);
    font-weight: var(--font-weight-500);
    cursor: pointer;
    transition: var(--transition-300);
  }

  .back-button:hover:not(:disabled) {
    background: var(--color-dark-70);
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
      padding: var(--spacing-16);
      align-items: flex-start;
      padding-top: var(--spacing-40);
    }

    .container {
      padding: var(--spacing-32) var(--spacing-24);
    }

    .title {
      font-size: var(--font-24);
      margin-bottom: var(--spacing-24);
    }

    .token-input {
      padding: var(--spacing-14);
      font-size: var(--font-16);
    }

    .submit-button {
      padding: var(--spacing-14);
      font-size: var(--font-16);
    }

    .instructions {
      padding: var(--spacing-20);
    }

    .instructions h3 {
      font-size: var(--font-16);
    }

    .instructions p {
      font-size: var(--font-13);
    }
  }

  @media (max-width: 480px) {
    .container {
      padding: var(--spacing-24) var(--spacing-20);
    }

    .title {
      font-size: var(--font-22);
    }

    .instructions {
      padding: var(--spacing-16);
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
    border-radius: 50%;
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
    color: var(--color-primary);
  }

  .token-form:has(.success-message) .token-input {
    border-color: var(--color-success-50);
  }

  .token-form:has(.error-message) .token-input {
    border-color: var(--color-error-50);
  }
</style>
