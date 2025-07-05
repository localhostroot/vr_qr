<script>
  import { globals } from '$lib/stores/+stores.svelte.js';
  import { icons } from '$lib/icons/icons.js';

  let { seriesData, styles } = $props();

  let queue = $derived(globals.get('queue'));
  
  // Check if all episodes from this series are already in queue
  function checkAllEpisodesInQueue() {
    if (!seriesData || seriesData.length === 0) return false;
    return seriesData.every(episode => 
      queue.some(queueItem => queueItem.id === episode.id)
    );
  }
  let allEpisodesInQueue = $derived(checkAllEpisodesInQueue());

  // Check if any episodes from this series are in queue
  function checkSomeEpisodesInQueue() {
    if (!seriesData || seriesData.length === 0) return false;
    return seriesData.some(episode => 
      queue.some(queueItem => queueItem.id === episode.id)
    );
  }
  let someEpisodesInQueue = $derived(checkSomeEpisodesInQueue());

  function handleAddSeries(event) {
    event.stopPropagation();
    
    if (!seriesData || seriesData.length === 0) {
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

  function styleObjectToCss(styleObj) {
    return Object.entries(styleObj)
      .map(([key, value]) => {
        const kebabKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
        return `${kebabKey}: ${value}`;
      })
      .join('; ');
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div 
  class="series-button" 
  onclick={handleAddSeries}
  style={styles ? styleObjectToCss(styles) : ''}
  title={allEpisodesInQueue ? 'Удалить все серии из корзины' : 'Добавить все серии в корзину'}
>
  {#if allEpisodesInQueue}
    {@html icons.bin}
  {:else if someEpisodesInQueue}
    {@html icons.plus}
    <span class="badge">+</span>
  {:else}
    {@html icons.plus}
  {/if}
</div>

<style>
  .series-button {
    position: relative;
    width: 21.6417vw;
    height: 11.19vw;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-blue);
    border-radius: var(--radius-30);
    cursor: pointer;
    transition: var(--transition-200);
    color: var(--color-white);
  }

  .series-button:hover {
    background: var(--color-info-30);
    transform: var(--transform-hover-lift-2);
  }

  .series-button :global(svg) {
    width: 24px;
    height: 24px;
  }

  .badge {
    position: absolute;
    top: -5px;
    right: -5px;
    background: var(--color-white);
    color: var(--color-blue);
    border-radius: var(--radius-full);
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: bold;
  }
</style>
