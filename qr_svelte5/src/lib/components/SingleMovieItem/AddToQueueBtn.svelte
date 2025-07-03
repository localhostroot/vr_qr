<script>
  import { goto } from '$app/navigation';
  import { globals } from '$lib/stores/+stores.svelte.js';
  import { icons } from '$lib/icons/icons.js';
  import { getSubfolder } from '$lib/utils/+helpers.svelte';

  let { item, styles } = $props();

  let queue = $derived(globals.get('queue'));

  let isAdded = $derived(queue.some(i => i.id === item.id));

  function handleToggleQueue(event) {
    event.stopPropagation();
    
    if (item.serial) {
      goto(`${getSubfolder()}/content/${item.id}`);
    } else {
      if (isAdded) {
        globals.update('queue', currentQueue => 
          currentQueue.filter(queueItem => queueItem.id !== item.id)
        );
      } else {
        globals.update('queue', currentQueue => [...currentQueue, item]);
      }
    }
  }

  function styleObjectToCss(styleObj) {
    
    return Object.entries(styleObj)
      .map(([key, value]) => {
        // Convert camelCase to kebab-case
        const kebabKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
        return `${kebabKey}: ${value}`;
      })
      .join('; ');
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div 
  class="button" 
  onclick={handleToggleQueue}
  style={styles ? styleObjectToCss(styles) : ''}
>
  {#if isAdded}
    {@html icons.minus}
  {:else}
    {@html icons.plus}
  {/if}
</div>

<style>
  .button {
    width: 7.4627vw;
    height: 7.4627vw;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-white-10);
    border-radius: var(--radius-full);
    cursor: pointer;
    transition: var(--transition-100);
  }

  .button:hover {
    background: var(--color-white-20);
  }

  .button :global(svg) {
    width: 7vw;
    height: auto;
  }
</style>
