<script>
  import MovieCard from './MovieCard.svelte';
  
  let { library } = $props();
</script>

<div class="movie-grid">
  {#if library && library.length > 0}
    <div class="grid-container">
      {#each library as item}
        <MovieCard {item} />
      {/each}
    </div>
  {:else}
    <div class="empty-state">
      <p>Нет доступных фильмов</p>
    </div>
  {/if}
</div>

<style>

  .movie-grid {
    width: 100%;
    padding: var(--spacing-10);
    box-sizing: border-box;
  }

  .grid-container {
    width: 100%;
  }

  .empty-state {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 200px;
    color: var(--color-white-70);
  }

  
</style>
