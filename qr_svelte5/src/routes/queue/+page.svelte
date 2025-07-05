<script>
  import { goto } from '$app/navigation';
  import { globals } from '$lib/stores/+stores.svelte.js';
  import { icons } from '$lib/icons/icons.js';
  import Header from '$lib/components/widgets/Header.svelte';
  import ContentCardBig from '$lib/components/Queue/ContentCardBig.svelte';
  import LOCAL_STORAGE_KEYS from '$lib/constants/localStorageKeys.js';
  import { createEnhancedPaykeeperPayment } from '$lib/utils/enhancedPaykeeperPayment.js';
  import { getSubfolder } from '$lib/utils/+helpers.svelte';

  let queue = $derived(globals.get('queue'));

  let modalVisible = $state(false);

  function handleClick() {
    const clientString = localStorage.getItem(LOCAL_STORAGE_KEYS.CLIENT);
    const client = clientString ? JSON.parse(clientString) : null;
    const clLocation = client?.location || null;
    const id = client?.id || null;

    if (clLocation && id) {
      goto(`${getSubfolder()}/vr/${clLocation}/${id}`);
    } else {
      console.error('No valid client found for navigation');
      alert('Ошибка: не найдена информация о VR устройстве. Отсканируйте QR код заново.');
    }
  }

  // Enhanced payment system
  const { 
    handlePaymentClick, 
    cancelPayment, 
    retryPaymentCheck,
    error, 
    isLoading, 
    isPolling,
    iframeVisible,
    currentOrderId,
    clearError 
  } = createEnhancedPaykeeperPayment();

  function handleOpenModal() {
    modalVisible = true;
    clearError();
  }

  function handleCloseModal() {
    modalVisible = false;
    clearError();
  }

  function handleCancelPayment() {
    cancelPayment();
    handleCloseModal();
  }

  function handleRetryPayment() {
    retryPaymentCheck();
  }

  // Calculate total amount for display
  let totalAmount = $derived(() => {
    if (!queue || queue.length === 0) return 0;
    return queue.reduce((sum, item) => sum + (item.price || 0), 0);
  });
</script>

<div class="queue-page">

  <Header />
  <div class="specificHeader">
    <div class="pageName">Корзина</div>
  </div>
  
  <div class="content">
    {#if queue && queue.length > 0}
      <div class="info">
        <div class="payment-summary">
          <div class="total-amount">Итого: {totalAmount()}₽</div>
        </div>
        <div class="paymentBtn" onclick={handleOpenModal}>
          Оплатить все
        </div>
      </div>
      <div class="queue">
        {#each queue as item}
          <ContentCardBig {item} />
        {/each}
      </div>
    {:else}
      <div class="info">
        <div class="paymentBtn" onclick={handleClick}>
          Вернуться
        </div>
      </div>
      <div class="empty-queue">
        <div class="empty-icon">
          {@html icons.basket}
        </div>
        <h2>Корзина пуста</h2>
        <p>Добавьте фильмы на главной странице</p>
      </div>
    {/if}
  </div>

  <!-- Enhanced Payment Modal -->
  {#if modalVisible}
    <div class="modalOverlay">
      <div class="modalContent">
        <!-- Close button (only show if not actively processing payment) -->
        {#if !isLoading && !isPolling}
          <button class="modalCloseButton" onclick={handleCloseModal}>
            {@html icons.buttonClose}
          </button>
        {/if}

        <!-- Payment Status Display -->
        {#if isLoading && !isPolling}
          <div class="payment-status">
            <div class="status-icon loading">
              <div class="spinner"></div>
            </div>
            <h3>Создание заказа...</h3>
            <p>Подготавливаем платеж</p>
          </div>
        {:else if isPolling}
          <div class="payment-status">
            <div class="status-icon polling">
              <div class="pulse"></div>
            </div>
            <h3>Ожидание оплаты</h3>
            <p>Завершите оплату в банковском приложении или на странице оплаты</p>
            <div class="polling-info">
              <small>Проверяем статус платежа...</small>
            </div>
            <button class="cancel-btn" onclick={handleCancelPayment}>
              Отменить
            </button>
          </div>
        {:else if error}
          <div class="payment-status error">
            <div class="status-icon error">❌</div>
            <h3>Ошибка оплаты</h3>
            <p class="error-message">{error}</p>
            
            {#if currentOrderId}
              <div class="retry-section">
                <p>Если вы завершили оплату, попробуйте проверить статус:</p>
                <button class="retry-btn" onclick={handleRetryPayment}>
                  Проверить статус
                </button>
              </div>
            {/if}
            
            <button class="close-btn" onclick={handleCloseModal}>
              Закрыть
            </button>
          </div>
        {:else}
          <!-- Initial payment instructions -->
          <div class="instructions">
            
            <div class="instruction-list">
              <div class="instEl">
                <div class="number">1.</div>
                <div class="descr">Оплата является окончательной и не подлежит возврату.</div>
              </div>
              <div class="instEl">
                <div class="number">2.</div>
                <div class="descr">Ваше право на выбор - досматривать фильм или нет.</div>
              </div>
              <div class="instEl">
                <div class="number">3.</div>
                <div class="descr">Возможно перейти к следующему фильму.</div>
              </div>
              <div class="instEl">
                <div class="number">4.</div>
                <div class="descr">После просмотра всех фильмов, система переходит в режим ожидания.</div>
              </div>
              <div class="instEl">
                <div class="number">5.</div>
                <div class="descr">Если возникнут вопросы, наш администратор всегда готов помочь.</div>
              </div>
            </div>
            
            <!-- <div class="mobile-payment-notice">
              <p><strong>Для мобильных устройств:</strong></p>
              <p>После нажатия "Оплатить" откроется страница оплаты. Вы можете безопасно переключиться в банковское приложение - мы автоматически отследим завершение платежа.</p>
            </div> -->
            
            <div class="payBtn" onclick={handlePaymentClick}>
              Оплатить
            </div>
            
            <div class="agreement">
              Нажимая на "Оплатить", вы соглашаетесь с условиями просмотра.
            </div>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .queue-page {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    gap: var(--spacing-vw-30);
    background: var(--color-dark-primary);
    color: var(--color-white);
    font-family: 'Montserrat', sans-serif;
    position: relative;
    min-height: calc(100vh - var(--navigation-height));
  }

  .content {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .queue {
    display: flex;
    align-items: center;
    flex-direction: column;
    gap: var(--spacing-vw-20);
    width: 100%;
  }

  .info {
    margin-top: 18vw;
    width: 100%;
    box-sizing: border-box;
    padding: 1em;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-10);
    font-family: 'Montserrat', sans-serif;
    margin-bottom: var(--spacing-10);
  }

  .payment-summary {
    text-align: center;
    margin-bottom: var(--spacing-10);
  }

  .total-amount {
    font-size: 1.2em;
    font-weight: var(--font-weight-600);
    color: var(--color-white);
  }

  .pageName {
    font-weight: var(--font-weight-500);
    color: var(--color-white);
    font-size: 1.5em;
  }

  .paymentBtn {
    font-size: 1em;
    font-weight: var(--font-weight-600);
    color: var(--color-dark-primary);
    background: var(--color-white-90);
    border-radius: var(--radius-30);
    display: flex;
    align-items: center;
    justify-content: center;
    height: var(--height-vw-75);
    width: 100%;
    cursor: pointer;
    border: none;
    transition: var(--transition-200);
    padding: var(--spacing-5) 0;
  }

  .paymentBtn:hover {
    background: var(--color-white);
  }

  .specificHeader {
    position: absolute;
    top: var(--spacing-vw-25);
    right: var(--spacing-vw-25);
    width: calc(100% + 8vw - 48px);
    display: flex;
    align-items: center;
    justify-content: center;
    height: 40px;
    z-index: var(--z-100);
  }

  .empty-queue {
    text-align: center;
    padding: var(--spacing-40) var(--spacing-20);
  }

  .empty-icon {
    margin-bottom: var(--spacing-20);
    opacity: 0.5;
  }

  .empty-icon :global(svg) {
    width: 80px;
    height: 80px;
  }

  .empty-queue h2 {
    margin-bottom: var(--spacing-10);
    color: var(--color-white-70);
  }

  .empty-queue p {
    color: var(--color-white-50);
  }

  /* Enhanced Modal Styles */
  .modalOverlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: var(--z-1000);
    backdrop-filter: var(--blur-backdrop);
  }

  .modalContent {
    background: var(--color-gray);
    width: calc(var(--width-vw-950) * 0.9);
    max-height: 85vh;
    overflow-y: auto;
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    font-family: 'Montserrat', sans-serif;
    border-radius: var(--radius-15);
    padding: var(--spacing-20);
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3), 0 10px 20px rgba(0, 0, 0, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .modalCloseButton {
    position: absolute;
    top: var(--spacing-10);
    right: var(--spacing-10);
    background: none;
    border: none;
    width: 30px;
    height: 30px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* Payment Status Styles */
  .payment-status {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: var(--spacing-30) var(--spacing-20);
    gap: var(--spacing-15);
    min-height: 200px;
    justify-content: center;
  }

  .status-icon {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: var(--spacing-20);
    font-size: 2em;
  }

  .status-icon.loading {
    background: var(--color-blue);
  }

  .status-icon.polling {
    background: var(--color-green);
    position: relative;
  }

  .status-icon.error {
    background: var(--color-error);
  }

  .spinner {
    width: 30px;
    height: 30px;
    border: 3px solid rgba(255, 255, 255, 0.3);
    border-top: 3px solid white;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .pulse {
    width: 30px;
    height: 30px;
    background: white;
    border-radius: 50%;
    animation: pulse 2s ease-in-out infinite;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.7; transform: scale(1.1); }
  }

  .payment-status h3 {
    margin: 0;
    font-size: 1.3em;
    color: var(--color-dark-primary);
  }

  .payment-status p {
    margin: 0;
    color: var(--color-dark-80);
    line-height: 1.4;
  }

  .polling-info {
    background: var(--color-white-10);
    padding: var(--spacing-10);
    border-radius: var(--radius-5);
    margin: var(--spacing-10) 0;
  }

  .polling-info small {
    color: var(--color-dark-80);
    font-size: 0.9em;
  }

  .error-message {
    color: var(--color-error) !important;
    font-weight: 500;
  }

  .retry-section {
    background: var(--color-white-10);
    padding: var(--spacing-15);
    border-radius: var(--radius-5);
    margin: var(--spacing-15) 0;
    text-align: center;
  }

  /* Button Styles */
  .cancel-btn, .retry-btn, .close-btn {
    padding: var(--spacing-10) var(--spacing-20);
    border-radius: var(--radius-25);
    border: none;
    cursor: pointer;
    font-family: inherit;
    font-weight: 500;
    transition: var(--transition-200);
    margin: var(--spacing-5);
  }

  .cancel-btn {
    background: var(--color-error);
    color: white;
  }

  .retry-btn {
    background: var(--color-blue);
    color: white;
  }

  .close-btn {
    background: var(--color-dark-80);
    color: white;
  }

  .cancel-btn:hover, .retry-btn:hover, .close-btn:hover {
    opacity: 0.9;
    transform: translateY(-1px);
  }

  /* Instructions Styles */
  .instructions {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-20);
    width: 100%;
  }

  .instructions h3 {
    margin: 0;
    font-size: 1.3em;
    color: var(--color-dark-primary);
  }

  .instruction-list {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-10);
  }

  .instEl {
    display: flex;
    font-weight: 500;
    font-size: var(--font-vw-35);
    gap: var(--spacing-5);
    color: var(--color-dark-primary);
    align-items: flex-start;
  }

  .number {
    flex-shrink: 0;
    width: 20px;
  }

  .mobile-payment-notice {
    background: var(--color-blue);
    color: white;
    padding: var(--spacing-15);
    border-radius: var(--radius-5);
    margin: var(--spacing-10) 0;
  }

  .mobile-payment-notice p {
    margin: var(--spacing-5) 0;
    font-size: 0.9em;
    line-height: 1.4;
  }

  .payBtn {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: var(--height-vw-112);
    background: var(--color-dark-80);
    color: var(--color-white);
    font-weight: var(--font-weight-400);
    font-size: var(--font-vw-40);
    border-radius: var(--radius-10);
    align-items: center;
    justify-content: center;
    cursor: pointer;
    border: none;
    transition: var(--transition-100);
  }

  .payBtn:hover {
    background: var(--color-dark-primary);
  }

  .payBtn:active {
    background: var(--color-dark-80);
  }

  .agreement {
    font-size: var(--font-8);
    color: var(--color-dark-80);
    text-align: center;
    width: 90%;
    font-weight: 500;
  }
</style>
