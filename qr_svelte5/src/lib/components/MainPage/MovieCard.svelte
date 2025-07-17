<script>
// @ts-nocheck

  import { globals } from '$lib/stores/+stores.svelte.js';
  import { goto } from '$app/navigation';
  import { getSubfolder } from '$lib/utils/+helpers.svelte';
  import { PUBLIC_DATABASE } from '$env/static/public';
  import axios from 'axios';
  import { icons } from '$lib/icons/icons.js';
  
  let { item } = $props();
  
  let queue = $derived(globals.get('queue'));
  let seriesData = $state([]);
  let isLoadingSeries = $state(false);
  
  // Check if all episodes from this series are already in queue
  function checkAllEpisodesInQueue() {
    if (!item.serial || seriesData.length === 0) return false;
    return seriesData.every(episode => 
      queue.some(queueItem => queueItem.id === episode.id)
    );
  }
  let allEpisodesInQueue = $derived(checkAllEpisodesInQueue());

  // Check if any episodes from this series are in queue
  function checkSomeEpisodesInQueue() {
    if (!item.serial || seriesData.length === 0) return false;
    return seriesData.some(episode => 
      queue.some(queueItem => queueItem.id === episode.id)
    );
  }
  let someEpisodesInQueue = $derived(checkSomeEpisodesInQueue());
  
  // Load series episodes if this is a series item
  async function loadSeriesEpisodes() {
    if (!item.serial || seriesData.length > 0 || isLoadingSeries) return;
    
    isLoadingSeries = true;
    try {
      const response = await axios.get(`${PUBLIC_DATABASE}api/movie/`);
      const allMovies = response.data;
      
      // Filter episodes that belong to this series
      const episodes = allMovies.filter(movie => 
        movie.cat_id && movie.cat_id.cat_id === item.cat_id
      );
      
      seriesData = episodes;
    } catch (error) {
      console.error('Failed to load series episodes:', error);
      seriesData = [];
    } finally {
      isLoadingSeries = false;
    }
  }

  function addToQueue(item) {
    if (item.serial) {
      handleAddSeries();
    } else {
      // Handle regular item
      const existsInQueue = queue.some(queueItem => queueItem.id === item.id);
      if (!existsInQueue) {
        globals.update('queue', currentQueue => [...currentQueue, item]);
      }
    }
  }
  
  function handleAddSeries() {
    if (!item.serial || seriesData.length === 0) {
      console.warn('No series data available');
      return;
    }

    if (allEpisodesInQueue) {
      // Remove all episodes from queue
      globals.update('queue', currentQueue => 
        currentQueue.filter(queueItem => 
          !seriesData.some(episode => episode.id === queueItem.id)
        )
      );
    } else {
      // Add all episodes that aren't already in queue
      const episodesToAdd = seriesData.filter(episode => 
        !queue.some(queueItem => queueItem.id === episode.id)
      );
      
      if (episodesToAdd.length > 0) {
        globals.update('queue', currentQueue => [...currentQueue, ...episodesToAdd]);
      }
    }
  }

  function goToContent(item) {
    goto(`${getSubfolder()}/content/${item.route_id}`);
  }
  
  // Load series episodes when component mounts if it's a series
  $effect(() => {
    if (item.serial) {
      loadSeriesEpisodes();
    }
  });
</script>

<div class="movie-card">
  <div class="image-container">
    {#if item.image}
      <img src={item.image} alt={item.title || item.name} onclick={() => goToContent(item)} />
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
        {#if item.serial}
          {#if isLoadingSeries}
            Загрузка...
          {:else if allEpisodesInQueue}
            {@html icons.bin || '🗑'} Убрать
          {:else if someEpisodesInQueue}
            {@html icons.plus || '+'} В корзину
          {:else}
            {@html icons.plus || '+'} В корзину
          {/if}
        {:else}
          {@html icons.plus || '+'} В корзину
        {/if}
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
    border-radius: var(--radius-10);
    border: none;
    cursor: pointer;
    font-family: inherit;
    font-size: var(--font-10);
    font-weight: 500;
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
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-5);
    min-height: 40px;
  }

  .btn-secondary:hover {
    background: var(--color-white-10);
    border-color: var(--color-white-80);
  }
  
  .btn-secondary :global(svg) {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }
</style>
