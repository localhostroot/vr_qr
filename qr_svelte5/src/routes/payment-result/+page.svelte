<script>
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { getSubfolder } from '$lib/utils/+helpers.svelte';
  import { checkPaymentStatus } from '$lib/utils/paymentStatusChecker.js';

  let status = $state('loading');
  let retryCount = $state(0);
  const maxRetries = 10; // Try for about 30 seconds

  async function processPaymentResult(isSuccess) {
    if (!isSuccess) {
      status = 'error';
      return;
    }

    // For successful payments, we need to check the backend status
    // with retry logic since there might be a delay in PayKeeper callback processing
    let attempts = 0;
    
    while (attempts < maxRetries) {
      retryCount = attempts + 1;
      
      try {
        const result = await checkPaymentStatus();
        
        if (result.success) {
          status = 'success';
          return;
        }
        
        // If no success yet, wait and retry
        attempts++;
        if (attempts < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
        }
      } catch (error) {
        console.error('Error checking payment status:', error);
        attempts++;
        if (attempts < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
    }
    
    // If we've exhausted retries, show error
    status = 'error';
  }

  onMount(() => {
    const urlParams = new URLSearchParams($page.url.search);
    const isSuccess = urlParams.get('success') === 'true';
    
    processPaymentResult(isSuccess);
  });

  function handleContinue() {
    if (status === 'success') {
      goto(`${getSubfolder()}/films/`);
    } else {
      goto(`${getSubfolder()}/queue/`);
    }
  }
</script>

<div class="payment-result">
  {#if status === 'loading'}
    <div class="loading-container">
      <div class="spinner"></div>
      {#if retryCount > 0}
        <p>Проверка статуса платежа... ({retryCount}/{maxRetries})</p>
      {:else}
        <p>Загрузка...</p>
      {/if}
    </div>
  {/if}

  {#if status === 'success'}
    <div class="success-container">
      <div class="success-icon">✓</div>
      <h2>Оплата успешна!</h2>
      <p>Ваш заказ был успешно оплачен. Теперь вы можете смотреть выбранные фильмы.</p>
      <button class="continue-button" onclick={handleContinue}>
        Перейти к фильмам
      </button>
    </div>
  {/if}

  {#if status === 'error'}
    <div class="error-container">
      <div class="error-icon">✗</div>
      <h2>Ошибка оплаты</h2>
      <p>Произошла ошибка при обработке платежа. Попробуйте еще раз.</p>
      <button class="continue-button" onclick={handleContinue}>
        Вернуться в корзину
      </button>
    </div>
  {/if}
</div>

<style>
  .payment-result {
    background: var(--color-dark-primary);
    min-height: 100vh;
    padding: var(--spacing-20);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: var(--color-white);
    font-family: var(--font-family-primary);
  }

  .payment-result h1 {
    font-size: var(--font-24);
    font-weight: var(--font-weight-600);
    margin-bottom: var(--spacing-40);
    text-align: center;
    color: var(--color-white);
  }

  .loading-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-20);
  }

  .loading-container p {
    font-size: var(--font-16);
    color: var(--color-white-70);
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--color-dark-50);
    border-top: 3px solid var(--color-white);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .success-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    max-width: 320px;
  }

  .success-container h2 {
    font-size: var(--font-22);
    font-weight: var(--font-weight-600);
    margin: var(--spacing-20) 0 var(--spacing-15) 0;
    color: var(--color-success);
  }

  .success-container p {
    font-size: var(--font-16);
    line-height: 1.5;
    color: var(--color-white-70);
    margin-bottom: var(--spacing-30);
  }

  .success-icon {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    background: var(--color-success);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--font-40);
    color: var(--color-white);
    font-weight: var(--font-weight-bold);
  }

  .error-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    max-width: 320px;
  }

  .error-container h2 {
    font-size: var(--font-22);
    font-weight: var(--font-weight-600);
    margin: var(--spacing-20) 0 var(--spacing-15) 0;
    color: var(--color-error);
  }

  .error-container p {
    font-size: var(--font-16);
    line-height: 1.5;
    color: var(--color-white-70);
    margin-bottom: var(--spacing-30);
  }

  .error-icon {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    background: var(--color-error);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--font-40);
    color: var(--color-white);
    font-weight: var(--font-weight-bold);
  }

  .continue-button {
    background: var(--color-white);
    color: var(--color-dark-primary);
    border: none;
    border-radius: var(--radius-25);
    padding: var(--spacing-10) var(--spacing-30);
    font-size: var(--font-16);
    font-weight: var(--font-weight-600);
    cursor: pointer;
    transition: var(--transition-200);
    width: 100%;
    max-width: 280px;
  }

  .continue-button:hover {
    background: var(--color-white-90);
    transform: translateY(-1px);
  }

  .continue-button:active {
    transform: translateY(0);
  }
</style>
