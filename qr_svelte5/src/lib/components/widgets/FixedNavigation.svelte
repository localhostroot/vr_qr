<script>
// @ts-nocheck

  import { globals } from '$lib/stores/+stores.svelte.js';
  import { page } from '$app/stores';
  import { icons } from '$lib/icons/icons.js';
  import { getSubfolder } from '$lib/utils/+helpers.svelte';

  let currentPath = $derived($page.url.pathname);
  let currentClient = $derived(globals.get('currentClient'));
  let paidFilms = $derived(globals.get('paidFilms'));
  let queue = $derived(globals.get('queue'));
  let isViewerRoute = $derived($page.route.id?.startsWith('/[location]/[id]'));
  let clientLocation = $derived(isViewerRoute ? $page.params.location : currentClient?.location || null);
  let clientId = $derived(isViewerRoute ? $page.params.id : currentClient?.id || null);

  let clientBasePath = $derived(
    clientLocation && clientId
      ? `${getSubfolder()}/${encodeURIComponent(clientLocation)}/${encodeURIComponent(clientId)}`
      : null
  );
  let homePath = $derived(clientBasePath || '#');
  let queuePath = $derived(clientBasePath ? `${clientBasePath}/queue` : `${getSubfolder()}/queue`);
  let filmsPath = $derived(clientBasePath ? `${clientBasePath}/films` : `${getSubfolder()}/films`);
  let isHomeActive = $derived(Boolean(clientBasePath) && currentPath === clientBasePath);
  let isQueueActive = $derived(currentPath === queuePath || currentPath === `${getSubfolder()}/queue`);
  let isFilmsActive = $derived(currentPath === filmsPath || currentPath === `${getSubfolder()}/films`);

  let hideNavAndFooter = $derived(currentPath === '/');
</script>

{#if !hideNavAndFooter}
<nav class="fixedNavigation">
  <div>
      <a href={homePath}>
          <div class="nav-item">
            <div class="nav-icon">
              {@html isHomeActive ? icons.mainActive : icons.main}
            </div>
            <div class="nav-label" class:active={isHomeActive}>Главная</div>
          </div>
      </a>
  </div>
  <div>
      <a href={queuePath}>
          <div class="nav-item">
            <div class="nav-icon">
              {@html isQueueActive ? icons.basketActive : icons.basket}
            </div>
            <div class="nav-label" class:active={isQueueActive}>Корзина</div>
          </div>
      </a>
      {#if queue && queue.length > 0}
          <div class="queue">{queue.length}</div>
      {/if}
  </div>
  <div>
      <a href={filmsPath}>
          <div class="nav-item">
            <div class="nav-icon">
              {@html isFilmsActive ? icons.playActive : icons.play}
            </div>
            <div class="nav-label" class:active={isFilmsActive}>Мои фильмы</div>
          </div>
      </a>
      {#if paidFilms && paidFilms.length > 0}
          <div class="paid">{paidFilms.length}</div>
      {/if}
  </div>
</nav>
{/if}

<style>
  .fixedNavigation {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    width: 100%;
    height: var(--navigation-height);
    display: flex;
    align-items: center;
    justify-content: space-evenly;
    background-color: var(--color-dark-95);
    backdrop-filter: var(--blur-backdrop);
    border-top: 1px solid var(--color-white-10);
    z-index: var(--z-1000);
  }

  .fixedNavigation > div {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;
    height: 100%;
    transition: var(--transition-100);
  }

  .fixedNavigation > div:hover {
    background-color: var(--color-white-5);
  }

  .fixedNavigation a {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    text-decoration: none;
  }

  .queue {
    position: absolute;
    top: 8px;
    right: 40%;
    width: 16px;
    height: 16px;
    background-color: var(--color-red);
    color: var(--color-white);
    border-radius: var(--radius-full);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: var(--font-weight-bold);
    z-index: var(--z-1);
    min-width: 16px;
  }

  .paid {
    position: absolute;
    top: 8px;
    right: 40%;
    width: 16px;
    height: 16px;
    background-color: var(--color-red);
    color: var(--color-white);
    border-radius: var(--radius-full);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: var(--font-weight-bold);
    z-index: var(--z-1);
    min-width: 16px;
  }

  .nav-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
  }

  .nav-icon {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .nav-icon :global(svg) {
    width: 20px;
    height: 20px;
  }

  .nav-label {
    font-size: 10px;
    color: var(--color-white-70);
    font-weight: 500;
    font-family: 'Montserrat', sans-serif;
    text-align: center;
    line-height: 1;
    transition: color 0.2s ease;
  }
  
  .nav-label.active {
    color: var(--color-white);
    font-weight: 600;
  }
</style>
