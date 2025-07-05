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

  const getUserId = currentClient => {
    if (currentClient?.location && currentClient?.id) {
      return `${currentClient.location}/${currentClient.id}`;
    }
    return null;
  }

  let userId = $derived(getUserId(currentClient));

  let hideNavAndFooter = $derived(currentPath === '/');
</script>

{#if !hideNavAndFooter}
<nav class="fixedNavigation">
  <div>
      <a href={currentClient?.location && currentClient?.id ? `${getSubfolder()}/vr/${currentClient.location}/${currentClient.id}` : '#'}>
          <div class="nav-item">
            <div class="nav-icon">
              {@html currentPath.startsWith(`${getSubfolder()}/vr/`) ? icons.mainActive : icons.main}
            </div>
            <div class="nav-label">Главная</div>
          </div>
      </a>
  </div>
  <div>
      <a href="{getSubfolder()}/queue">
          <div class="nav-item">
            <div class="nav-icon">
              {@html currentPath === `${getSubfolder()}` ? icons.basketActive : icons.basket}
            </div>
            <div class="nav-label">Корзина</div>
          </div>
      </a>
      {#if queue && queue.length > 0}
          <div class="queue">{queue.length}</div>
      {/if}
  </div>
  <div>
      <a href="{getSubfolder()}/films">
          <div class="nav-item">
            <div class="nav-icon">
              {@html currentPath === `${getSubfolder()}` ? icons.playActive : icons.play}
            </div>
            <div class="nav-label">Мои фильмы</div>
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
    gap: 2px;
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
  }
</style>
