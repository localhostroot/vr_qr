<script>
  import { goto } from '$app/navigation';
  import { globals } from '$lib/stores/+stores.svelte.js';
  import { icons } from '$lib/icons/icons.js';
  import Header from '$lib/components/widgets/Header.svelte';
  import ContentCardBig from '$lib/components/Queue/ContentCardBig.svelte';
  import LOCAL_STORAGE_KEYS from '$lib/constants/localStorageKeys.js';
  import { createPaykeeperPayment } from '$lib/utils/paykeeperPayment.js';
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
      // No valid client found - show error or redirect to error page
      console.error('No valid client found for navigation');
      // You could redirect to an error page or show a modal
      alert('Ошибка: не найдена информация о VR устройстве. Отсканируйте QR код заново.');
    }
  }

  const { handlePaymentClick, error, isLoading } = createPaykeeperPayment();

  function handleOpenModal() {
    modalVisible = true;
  }

  function handleCloseModal() {
    modalVisible = false;
  }
</script>

<div class="queue-page">

  <Header />
  <div class="specificHeader">
    <!-- <button class="inst" onclick={handleOpenModal}>
      {@html icons.plus}
    </button> -->

    <div class="pageName">Корзина</div>
  </div>
  <div class="content">
    {#if queue && queue.length > 0}
      <div class="info">
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
  {#if modalVisible}
    <div class="modalOverlay">
      <div class="modalContent">
        <button class="modalCloseButton" onclick={handleCloseModal}>
          {@html icons.buttonClose}
        </button>
        <div class="instructions">

          <div class="instEl"><div class="number">1.</div>
            <div class="descr">После оплаты в приложении банка не забудьте нажать "Вернуться в магазин"!</div>
          </div>

          <div class="instEl"><div class="number">2.</div>
            <div class="descr">Оплата является окончательной и не подлежит возврату.</div>
          </div>
          <div class="instEl"><div class="number">3.</div>
            <div class="descr">Ваше право на выбор - досматривать фильм или нет.</div>
          </div>
          <div class="instEl"><div class="number">4.</div>
            <div class="descr">Возможно перейти к следующему фильму.</div>
          </div>
          <div class="instEl"><div class="number">5.</div>
            <div class="descr">После просмотра всех фильмов, система переходит в режим ожидания.</div>
          </div>
          <div class="instEl"><div class="number">6.</div>
            <div class="descr">Если возникнут вопросы, наш администратор всегда готов помочь.</div>
          </div>
        </div>
        <div class="payBtn" onclick={handlePaymentClick}>
          {isLoading ? 'Обработка...' : 'Оплата'}
        </div>
        {#if error}
          <div class="error">{error}</div>
        {/if}
        <div class="agreement">
          Нажимая на "Оплатить", вы соглашаетесь с условиями просмотра.
        </div>
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
    align-items: center;
    justify-content: space-between;
    font-family: 'Montserrat', sans-serif;

    margin-bottom: var(--spacing-10);
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

  .inst {
    width: 10vw;
    height: 10vw;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: var(--color-white-10);
    border-radius: var(--radius-30);
    border: none;
    cursor: pointer;
    transition: var(--transition-100);
  }

  .inst:hover {
    background-color: var(--color-white-50);
  }

  .queue-actions {
    display: flex;
    justify-content: space-between;
    margin-bottom: var(--spacing-20);
  }

  .clear-btn, .paymentBtn {
    background: var(--color-white-90);
    border: 1px solid var(--color-info-30);
    color: var(--color-dark-80);
    padding: var(--spacing-2) var(--spacing-7);
    border-radius: var(--radius-30);
    cursor: pointer;
    transition: var(--transition-background);
  }

  .clear-btn:hover, .paymentBtn:hover {
    background: var(--color-white);
  }

  .queue-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-10);
  }

  .queue-item {
    background: var(--color-white-10);
    border-radius: var(--radius-10);
    padding: var(--spacing-10);
    display: flex;
    align-items: center;
    gap: var(--spacing-10);
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

  .modalOverlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: var(--color-white-50);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: var(--z-1000);
    backdrop-filter: var(--blur-backdrop);
  }

  .modalContent {
    background: var(--color-gray);
    width: var(--width-vw-950);
    height: fit-content;
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    font-family: "Montserrat", serif;
    gap: var(--spacing-vw-25);
    border-radius: var(--radius-15);
  }

  .modalCloseButton {
    position: absolute;
    top: var(--spacing-vw-20);
    right: var(--spacing-vw-20);
    background: none;
    border: none;
    width: 4vw;
    height: 4vw;
    cursor: pointer;

    top: 1em;
    right: 1.5em;
  }

  .instructions {
    width: 86.567vw;
    display: flex;
    height: fit-content;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-vw-15);
    margin-top: var(--spacing-vw-40);
  }

  .instEl {
    width: 97%;
    display: flex;
    font-weight: 500;
    font-size: var(--font-vw-35);
    gap: var(--spacing-5);
    color: var(--color-dark-primary);
  }

  .grace {
    width: 74.626vw;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    font-weight: var(--font-weight-500);
    font-size: var(--font-vw-35);
    color: var(--color-dark-primary);
  }

  .payBtn {
    display: flex;
    flex-direction: column;
    width: 86.567vw;
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
    margin-bottom: var(--spacing-vw-25);
    width: 90%;
    font-weight: 500;
  }
</style>
