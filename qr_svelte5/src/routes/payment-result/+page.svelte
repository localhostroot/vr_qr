<script>
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { getSubfolder } from '$lib/utils/+helpers.svelte';
  import { checkPaymentStatus } from '$lib/utils/paymentStatusChecker.js';
  import { browser } from '$app/environment';
  import LOCAL_STORAGE_KEYS from '$lib/constants/localStorageKeys.js';
  import { PUBLIC_DATABASE } from '$env/static/public';
  import { globals } from '$lib/stores/+stores.svelte.js';

  let status = $state('loading');
  let retryCount = $state(0);
  let orderId = $state(null);
  let orderIdShort = $state(null);
  let orderTime = $state(null);
  const maxRetries = 10; // Try for about 30 seconds

  const currentClient = $derived(globals.get('currentClient'))

  async function checkForTokenAndProcess() {
    if (!browser || !orderId) return;
    
    try {
      // Check if there's a token for this order
      const currentToken = globals.get('token');
      let getTokenUrl = `${PUBLIC_DATABASE}api/tokens/get_token_by_order/?order_id=${orderId}`;
      if (currentToken) {
        getTokenUrl += `&current_token=${currentToken}`;
      }
      
      const getTokenResponse = await fetch(getTokenUrl);
      
      if (getTokenResponse.ok) {
        const tokenData = await getTokenResponse.json();
        
        if (tokenData.valid && tokenData.token) {
          // Get films for the token
          const filmsResponse = await fetch(`${PUBLIC_DATABASE}api/tokens/get_films/?token=${tokenData.token}`);
          
          if (filmsResponse.ok) {
            const filmsData = await filmsResponse.json();
            
            if (filmsData.valid && filmsData.films) {
              // Update token and expiry
              globals.set('token', tokenData.token);
              globals.set('tokenExpiry', filmsData.expires_at);
              
              // Clear and set paid films
              globals.set('paidFilms', filmsData.films);
              
              // Clear queue since payment was successful
              globals.set('queue', []);
              
              // Clean up localStorage
              localStorage.removeItem(LOCAL_STORAGE_KEYS.QUEUE_PENDING_PAYMENT);
              localStorage.removeItem(LOCAL_STORAGE_KEYS.QUEUE);
              localStorage.removeItem(LOCAL_STORAGE_KEYS.PAYKEEPER_ORDER_ID);
              localStorage.removeItem(LOCAL_STORAGE_KEYS.ORDER_TIME);
              
              // Mark order as checked
              await fetch(`${PUBLIC_DATABASE}api/status/checked/?order_id=${orderId}`, {
                method: 'POST',
              });
              
              status = 'success';
              return true;
            }
          }
        }
      }
    } catch (error) {
      console.error('Error checking for token:', error);
    }
    
    return false;
  }

  async function processPaymentResult(isSuccess) {
    if (!isSuccess) {
      status = 'error';
      return;
    }

    // First check if token is already available
    const tokenFound = await checkForTokenAndProcess();
    if (tokenFound) {
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
        
        // Check for token again
        const tokenFound = await checkForTokenAndProcess();
        if (tokenFound) {
          return;
        }
        
        // If no success yet, wait and retry
        attempts++;
        if (attempts < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
        }
      } catch (error) {
        console.error('Error checking payment status:', error);
        attempts++;
        if (attempts < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
    
    // If we've exhausted retries, show error
    status = 'error';
  }

  function getOrderTime() {
    if (!browser) return null;
    const storedOrderTime = localStorage.getItem(LOCAL_STORAGE_KEYS.ORDER_TIME);
    return storedOrderTime ? new Date(storedOrderTime).toLocaleString('ru-RU', {
      year: 'numeric',
      month: '2-digit', 
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }) : null;
  }

  async function refreshPaymentStatus() {
    if (!browser || !orderId) return;
    
    // Check for token again
    const tokenFound = await checkForTokenAndProcess();
    if (tokenFound) {
      return;
    }
    
    // If no token yet, show message to wait
    status = 'waiting_for_token';
  }

  onMount(() => {
    if (browser) {
      // Get order ID from localStorage
      const storedOrderId = localStorage.getItem(LOCAL_STORAGE_KEYS.PAYKEEPER_ORDER_ID);
      if (storedOrderId) {
        orderId = storedOrderId;
        orderIdShort = storedOrderId.slice(0, 8);
      }
      
      // Get order time from localStorage
      orderTime = getOrderTime();
    }
    
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
      {#if orderId}
        <p>Произошла ошибка при обработке платежа. Если оплата прошла успешно, обратитесь к администратору.</p>
        <div class="order-info">
          <strong>ID заказа для администратора:</strong> <span class="order-id">{orderIdShort}({currentClient.location}:{currentClient.id})</span>
          {#if orderTime}
            <div style="margin-top: 8px;">
              <strong>Время заказа:</strong> {orderTime}
            </div>
          {/if}
        </div>
        <button class="refresh-button" onclick={refreshPaymentStatus}>
          🔄 Обновить статус
        </button>
      {:else}
        <p>ID заказа не найден. Попробуйте оформить заказ заново.</p>
      {/if}
      <button class="continue-button" onclick={handleContinue}>
        Вернуться в корзину
      </button>
    </div>
  {/if}
  
  {#if status === 'waiting_for_token'}
    <div class="waiting-container">
      <div class="waiting-icon">⏳</div>
      <h2>Ожидание активации</h2>
      <p>Ваш заказ находится в обработке. Администратор активирует доступ в ближайшее время.</p>
      {#if orderId}
        <div class="order-info">
          <strong>ID заказа для администратора:</strong> <span class="order-id">{orderIdShort}({currentClient})</span>
          {#if orderTime}
            <div style="margin-top: 8px;">
              <strong>Время заказа:</strong> {orderTime}
            </div>
          {/if}
        </div>
      {/if}
      <button class="refresh-button" onclick={refreshPaymentStatus}>
        🔄 Проверить статус
      </button>
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

  .waiting-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    max-width: 320px;
  }

  .waiting-container h2 {
    font-size: var(--font-22);
    font-weight: var(--font-weight-600);
    margin: var(--spacing-20) 0 var(--spacing-15) 0;
    color: var(--color-warning, #ffc107);
  }

  .waiting-container p {
    font-size: var(--font-16);
    line-height: 1.5;
    color: var(--color-white-70);
    margin-bottom: var(--spacing-30);
  }

  .waiting-icon {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    background: var(--color-warning, #ffc107);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--font-40);
    color: var(--color-white);
    font-weight: var(--font-weight-bold);
  }

  .order-info {
    background: rgba(255, 255, 255, 0.1);
    padding: var(--spacing-15);
    border-radius: var(--radius-8, 8px);
    margin: var(--spacing-15) 0;
    border: 1px solid rgba(255, 255, 255, 0.2);
  }

  .order-id {
    font-family: monospace;
    background: rgba(255, 255, 255, 0.2);
    padding: 4px 8px;
    border-radius: 4px;
    font-size: var(--font-14, 14px);
    font-weight: bold;
    color: var(--color-white);
  }

  .refresh-button {
    background: var(--color-primary, #007bff);
    color: var(--color-white);
    border: none;
    border-radius: var(--radius-25);
    padding: var(--spacing-10) var(--spacing-30);
    font-size: var(--font-16);
    font-weight: var(--font-weight-600);
    cursor: pointer;
    transition: var(--transition-200);
    width: 100%;
    max-width: 280px;
    margin-bottom: var(--spacing-15);
  }

  .refresh-button:hover {
    background: var(--color-primary-dark, #0056b3);
    transform: translateY(-1px);
  }

  .refresh-button:active {
    transform: translateY(0);
  }
</style>
