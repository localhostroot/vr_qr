<script>
  import MovieGrid from './MovieGrid.svelte';
  
  let { library } = $props();

  let instance = $state();

  export const getOffsetTop = () => {
    
    return instance.getBoundingClientRect().y
  }

</script>

<div
  bind:this={instance}
  class="vrPlayer">
  <MovieGrid {library} />
</div>

<style>
  .vrPlayer {
    width: 100%;
    min-height: calc(100vh - var(--navigation-height));
    background: var(--color-dark-primary);
    padding: 0;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
  }
</style>
