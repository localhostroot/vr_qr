<script>
  import { globals } from '$lib/stores/+stores.svelte.js';
  import { icons } from '$lib/icons/icons.js';

  let queue = $derived(globals.get('queue'));
  let paidFilms = $derived(globals.get('paidFilms'));
</script>

<div class="headerWrapper">
  <div class="header">VR PLAYER</div>
  <div class="linkContainer">
    <a href="/queue/">
      <div class="link">
        {@html icons.basketActive}
        {#if queue && queue.length > 0}
          <div class="queue"></div>
        {/if}
      </div>
    </a>
    <a href="/films/">
      <div class="link">
        {@html icons.playActive}
        {#if paidFilms && paidFilms.length > 0}
          <div class="queue"></div>
        {/if}
      </div>
    </a>
  </div>
</div>

<style>
  .headerWrapper {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    padding: 1rem 0;
    margin-bottom: 1rem;
  }

  .header {
    font-size: 2rem;
    font-weight: bold;
    color: white;
    letter-spacing: 2px;
  }

  .linkContainer {
    display: flex;
    gap: 1.5rem;
    align-items: center;
  }

  .link {
    position: relative;
    padding: var(--spacing-5);
    background: var(--color-white-10);
    border-radius: var(--radius-full);
    transition: var(--transition-300);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
  }

  .link:hover {
    background: var(--color-white-20);
    transform: scale(1.1);
  }

  .link :global(svg) {
    width: 24px;
    height: 24px;
  }

  .queue {
    position: absolute;
    top: 0;
    right: 0;
    width: 8px;
    height: 8px;
    background: var(--color-red);
    border-radius: var(--radius-full);
    border: 2px solid var(--color-dark-primary);
  }

  a {
    text-decoration: none;
    color: inherit;
  }
</style>
