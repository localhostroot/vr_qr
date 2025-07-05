<script>
  import { globals } from '$lib/stores/+stores.svelte.js';
  import { goto } from '$app/navigation';
  import { getSubfolder } from '$lib/utils/+helpers.svelte';
  
  let { item } = $props();

  function addToQueue(item) {
    const queue = globals.get('queue');
    const existsInQueue = queue.some(queueItem => queueItem.id === item.id);
    if (!existsInQueue) {
      globals.update('queue', currentQueue => [...currentQueue, item]);
    }
  }

  function goToContent(item) {
    goto(`${getSubfolder()}/content/${item.route_id}`);
  }
</script>

<div class="movie-card">
  <div class="image-container">
    {#if item.image}
      <img src={item.image} alt={item.title || item.name} />
    {:else}
      <div class="placeholder-image">
        <span>Нет изображения</span>
      </div>
    {/if}
  </div>
  
  <div class="card-content">
    <h3>{item.title || item.name}</h3>
    <div class="card-actions">
      <button class="btn-primary" onclick={() => goToContent(item)}>
        Подробнее
      </button>
      <button class="btn-secondary" onclick={() => addToQueue(item)}>
        В корзину
      </button>
    </div>
  </div>
</div>

<style>

  .movie-card {
    display: flex;
    flex-direction: column;
    background: var(--color-white-10);
    border-radius: var(--radius-15);
    overflow: hidden;
    width: 100%;

    margin-bottom: 1em;
  }

  .movie-card:last-of-type {
    margin-bottom: 0;
  }

  .image-container {
    position: relative;
    width: 100%;
    aspect-ratio: 16/9; /* Fixed 16:9 aspect ratio */
    overflow: hidden;
  }

  .movie-card img,
  .placeholder-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .placeholder-image {
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-white-5);
    color: var(--color-white-50);
  }

  .card-content {
    padding: var(--spacing-10);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-15);
  }

  .card-content h3 {
    font-size: 1.125em;
    margin: 0;
    color: var(--color-white);
    font-weight: var(--font-weight-600);
    line-height: 1.3;
  }

  .card-actions {
    display: flex;
    gap: var(--spacing-8);
  }

  .btn-primary,
  .btn-secondary {
    padding: var(--spacing-10) var(--spacing-15);
    border-radius: var(--radius-10);
    border: none;
    cursor: pointer;
    font-family: inherit;
    font-size: var(--font-10);
    transition: var(--transition-300);
    flex: 1;
  }

  .btn-primary {
    background: var(--color-white-90);
    color: var(--color-dark-primary);
  }

  .btn-primary:hover {
    background: var(--color-white);
    transform: var(--transform-hover-lift-2);
  }

  .btn-secondary {
    background: transparent;
    color: var(--color-white);
    border: 2px solid var(--color-white-50);
  }

  .btn-secondary:hover {
    background: var(--color-white-10);
    border-color: var(--color-white-80);
  }
</style>
