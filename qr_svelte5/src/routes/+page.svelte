<script>
  import { globals } from '$lib/stores/+stores.svelte.js';
  import { icons } from '$lib/icons/icons.js';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import Header from '$lib/components/widgets/Header.svelte';
  import { getSubfolder } from '$lib/utils/+helpers.svelte';

  let clients = $derived(globals.get('clients'));
  let isLoading = $derived(globals.get('isClientsLoading'));

  function selectClient(location, id) {
    const client = { location, id };
    globals.set('currentClient', client);

    goto(`${getSubfolder()}/vr/${location}/${id}`);
  }

  onMount(() => {
    // This page should show selection of available VR clients
    // The WebSocket connection should already be established from layout
  });
</script>

{#if clients && clients.length > 0}
  <div class="wrapper">
    
    <Header />
    
    <div class="vrList">
      {#each clients as client, index}
        <div class="vrItem" onclick={() => selectClient(client.location, client.id)}>
          {@html icons.smallLogo}
          <div class="client-info">
            <div class="number">{client.location}:{client.id}</div>
            {#if client.currentUptime}
              <div class="uptime">Uptime: {client.currentUptime}</div>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  </div>
{:else if isLoading}
  <div class="loading-wrapper">
    <div class="loading">Загружаем доступные VR системы...</div>
  </div>
{:else}
  <div class="loading-wrapper">
    <div class="loading">Нет доступных VR систем</div>
  </div>
{/if}

<style>
  .wrapper {
    position: relative;
    display: flex;
    justify-content: center;
    min-height: 100vh;
    background: var(--color-dark-primary);
  }

  .vrList {
    display: grid;
    grid-template-columns: repeat(2, 45vw);
    gap: 5vw;
    margin-top: 10vh;
  }

  .vrItem {
    background-color: #1e1e1e;
    border-radius: 8px;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
    padding: 10px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: transform 0.2s;
    height: fit-content;
  }

  .vrItem:hover {
    transform: scale(1.05);
  }

  .vrItem :global(svg) {
    max-width: 100%;
    height: auto;
  }

  .client-info {
    margin-top: 10px;
    text-align: center;
  }

  .number {
    font-weight: bold;
    color: #6C6C6C;
    font-family: 'Montserrat', sans-serif;
    margin-bottom: 5px;
  }

  .uptime {
    font-size: 12px;
    color: #888;
    font-family: 'Montserrat', sans-serif;
  }

  .loading-wrapper {
    position: relative;
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    background: var(--color-dark-primary);
  }

  .loading {
    font-size: var(--font-12);
    color: var(--color-white-70);
    padding: var(--spacing-20);
    text-align: center;
    font-family: 'Montserrat', sans-serif;
  }
</style>
