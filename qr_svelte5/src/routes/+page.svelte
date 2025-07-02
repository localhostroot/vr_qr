<script>
  import { globals } from '$lib/stores/+stores.svelte.js';
  import { icons } from '$lib/icons/icons.js';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  let clients = $derived(globals.get('clients'));
  let isLoading = $derived(globals.get('isClientsLoading'));

  function selectClient(location, id) {
      const client = { location, id };
      globals.set('currentClient', client);
      goto(`/vr/${location}/${id}`);
  }

  onMount(() => {
      // This page should show selection of available VR clients
      // The WebSocket connection should already be established from layout
  });
</script>

<div class="selection-page">
  <div class="header">
      {@html icons.logo}
  </div>
  
  <div class="content">
      {#if isLoading}
          <div class="loading">Загружаем доступные VR системы...</div>
      {:else if clients && clients.length > 0}
          <h2>Выберите VR систему:</h2>
          <div class="clients-grid">
              {#each clients as client}
                  <button 
                      class="client-card" 
                      onclick={() => selectClient(client.location, client.id)}
                  >
                      <div class="client-name">{client.location} - {client.id}</div>
                      <div class="client-status">{client.status || 'Доступно'}</div>
                  </button>
              {/each}
          </div>
      {:else}
          <div class="no-clients">Нет доступных VR систем</div>
      {/if}
  </div>
</div>

<style>
  .selection-page {
      min-height: calc(100vh - var(--navigation-height));
      background: var(--color-dark-primary);
      color: var(--color-white);
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: var(--spacing-20);
      font-family: 'Montserrat', sans-serif;
  }

  .header {
      margin-bottom: var(--spacing-30);
  }

  .header :global(svg) {
      max-width: 300px;
      width: 80vw;
      height: auto;
  }

  .content {
      text-align: center;
      width: 100%;
      max-width: 600px;
  }

  .loading, .no-clients {
      font-size: var(--font-12);
      color: var(--color-white-70);
      padding: var(--spacing-20);
  }

  h2 {
      font-size: var(--font-15);
      margin-bottom: var(--spacing-20);
      font-weight: var(--font-weight-500);
  }

  .clients-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: var(--spacing-10);
      margin-top: var(--spacing-20);
  }

  .client-card {
      background: var(--color-white-10);
      border: 1px solid var(--color-white-20);
      border-radius: var(--radius-10);
      padding: var(--spacing-15);
      cursor: pointer;
      transition: var(--transition-300);
      color: var(--color-white);
      font-family: inherit;
  }

  .client-card:hover {
      background: var(--color-white-20);
      transform: var(--transform-hover-lift-2);
  }

  .client-name {
      font-size: var(--font-11);
      font-weight: var(--font-weight-600);
      margin-bottom: var(--spacing-5);
  }

  .client-status {
      font-size: var(--font-9);
      color: var(--color-white-70);
  }
</style>
