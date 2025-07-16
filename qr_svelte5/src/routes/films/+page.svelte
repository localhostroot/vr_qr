<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import { globals } from '$lib/stores/+stores.svelte.js';
  import { icons } from '$lib/icons/icons.js';
  import { useWebSocket } from '$lib/utils/websocket.js';
  import ContentCardPaid from '$lib/components/ContentCardPaid.svelte';
  import { getSubfolder } from '$lib/utils/+helpers.svelte';

  let paidFilms = $derived(globals.get('paidFilms'));

  $inspect(paidFilms)

  let token = $derived(globals.get('token'));
  let tokenExpiry = $derived(globals.get('tokenExpiry'));
  let currentClient = $derived(globals.get('currentClient'));
  let clients = $derived(globals.get('clients'));
  let isClientsLoading = $derived(globals.get('isClientsLoading'));
  let clientsError = $derived(globals.get('clientsError'));

  let modalVisible = false;
  let clientData = null;
  let userId = '';

  // API configuration
  const databaseApi = browser ? import.meta.env.VITE_DATABASE_API : '';
  const getVrApi = browser ? import.meta.env.VITE_WEBSOCKET_API : '';
  const getVrType = 'getVr';

  // WebSocket connection
  let wsManager = null;

  // Client info from localStorage
  $effect(() => {
    if (currentClient) {
      const clLocation = currentClient.location || null;
      const id = currentClient.id || null;
      userId = clLocation && id ? `${clLocation}/${id}` : null;
      
      // Find client data from the clients array
      if (clients && Array.isArray(clients)) {
        clientData = clients.find(client => 
          client.location === clLocation && client.id === id
        ) || null;
      }
    }
  });

  const handleClick = () => {
    if (currentClient?.location && currentClient?.id) {
      goto(`${getSubfolder()}/vr/${currentClient.location}/${currentClient.id}`);
    } else {
      console.error('No valid client found for navigation');
      alert('Ошибка: не найдена информация о VR устройстве. Отсканируйте QR код заново.');
    }
  };

  const handleDelete = async () => {
    if (!currentClient || !databaseApi) return;
    
    try {
      await fetch(`${databaseApi}/send-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientId: currentClient.id,
          location: currentClient.location,
          type: 'reset'
        })
      });
    } catch (error) {
      console.error('Error sending reset request:', error);
    }
  };

  const handleOpenModal = () => {
    modalVisible = true;
  };

  const handleCloseModal = () => {
    modalVisible = false;
  };

  onMount(() => {
    // Scroll to top
    if (browser) {
      window.scrollTo(0, 0);
    }

    // Initialize WebSocket connection if we have the API
    if (getVrApi) {
      wsManager = useWebSocket(getVrApi, getVrType);
      wsManager.connect();
    }

    return () => {
      if (wsManager) {
        wsManager.disconnect();
      }
    };
  });
</script>

{#if !paidFilms || paidFilms.length === 0}
  <div class="queuePage">
    <!-- Empty state similar to React -->

    <div class="client-name">Очки: <b>№ {currentClient.location}/{currentClient.id}</b></div>

    <div class="info">
      <div class="pageName">
        Мои покупки
      </div>
      <div class="paymentBtn" onclick={handleClick}>
        Вернуться
      </div>
    </div>
  </div>
  
{:else}
  <div class="queuePage">
    <!-- Top icons similar to React -->
    <div class="iconsTop">
      <div class="inst" onclick={handleClick}>
        {@html icons.main}
      </div>
      <!-- <div class="inst" onclick={handleOpenModal}>
        i
      </div> -->
    </div>
    
    <!-- Info section -->
    <div class="info">
      <div class="pageName">
        Мои покупки
      </div>
      <div class="paymentBtn" onclick={handleDelete}>
        Сбросить
      </div>
    </div>

    <div class="client-name">Очки: <b>№ {currentClient.location}/{currentClient.id}</b></div>
    
    <!-- Films queue -->
    <div class="queue">
      {#each paidFilms as film (film.film_id || film.id)}
        <ContentCardPaid
          item={film}
          location={currentClient?.location}
          clientId={currentClient?.id}
          client={clientData}
        />
      {/each}
    </div>
  </div>
{/if}

<!-- Instruction Modal (placeholder for now) -->
{#if modalVisible}
  <div class="modal-backdrop" onclick={handleCloseModal}>
    <div class="modal" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h3>Инструкция</h3>
        <button class="close-btn" onclick={handleCloseModal}>
          {@html icons.close || '✕'}
        </button>
      </div>
      <div class="modal-content">
        <p>Здесь будет инструкция по использованию приложения.</p>
      </div>
    </div>
  </div>
{/if}

<style>
  .queuePage {
    min-height: calc(100vh - var(--navigation-height));
    background: var(--color-dark-primary);
    color: var(--color-white);
    padding: var(--spacing-20) 0;
    font-family: 'Montserrat', sans-serif;
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
  }

  .iconsTop {
    display: flex;
    justify-content: space-between;
    width: 95.024vw;
    padding: var(--spacing-10) 0;
    margin-bottom: var(--spacing-10);
  }

  .inst {
    background: var(--color-white-10);
    color: var(--color-white);
    border: none;
    border-radius: var(--radius-full);
    cursor: pointer;
    transition: var(--transition-200);
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    font-size: 16px;
    font-weight: var(--font-weight-600);
  }

  .inst:hover {
    background: var(--color-white-15);
  }

  .inst :global(svg) {
    width: 24px;
    height: 24px;
  }

  .info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 95.024vw;
    margin-bottom: var(--spacing-20);
    padding: 0 var(--spacing-10);
  }

  .client-name {
    width: 100%;
    display: flex;
    justify-content: center;
    gap: 1em;
    padding: 0 12px;
    box-sizing: border-box;

    font-size: 1.125em;
    font-family: var(--ff);

    margin-bottom: 1em;
  }

  .pageName {
    font-size: var(--font-16);
    font-weight: var(--font-weight-600);
    color: var(--color-white);
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
    padding: 0 var(--spacing-20);
    cursor: pointer;
    border: none;
    transition: var(--transition-200);
  }

  .paymentBtn:hover {
    background: var(--color-white);
  }

  .queue {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    gap: var(--spacing-10);
  }

  /* Modal styles */
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal {
    background: var(--color-dark-secondary);
    border: 1px solid var(--color-white-20);
    border-radius: var(--radius-10);
    max-width: 90vw;
    max-height: 90vh;
    overflow: auto;
    position: relative;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-20);
    border-bottom: 1px solid var(--color-white-20);
  }

  .modal-header h3 {
    margin: 0;
    font-size: var(--font-16);
    font-weight: var(--font-weight-600);
    color: var(--color-white);
  }

  .close-btn {
    background: none;
    border: none;
    color: var(--color-white-70);
    cursor: pointer;
    padding: var(--spacing-5);
    font-size: var(--font-16);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: var(--transition-color);
  }

  .close-btn:hover {
    color: var(--color-white);
  }

  .modal-content {
    padding: var(--spacing-20);
    color: var(--color-white-80);
    line-height: 1.6;
  }

  .modal-content p {
    margin: 0;
  }
</style>
