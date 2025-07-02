<script>
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { PUBLIC_DATABASE } from '$env/static/public';
  import axios from 'axios';
  import SingleMovieItem from '$lib/components/SingleMovieItem/SingleMovieItem.svelte';
  import Loader from '$lib/components/widgets/Loader.svelte';

  let item = $state(null);
  let list = $state([]);
  let isItemLoading = $state(true);
  let isListLoading = $state(true);
  let error = $state(null);

  let id = $derived($page.params.id);

  async function fetchItem() {
    if (!id) return;
    
    try {
      isItemLoading = true;
      const response = await axios.get(`${PUBLIC_DATABASE}api/movie/`);
      item = response.data.find(item => item.route_id === id);
      error = null;
    } catch (err) {
      console.error('Failed to fetch item:', err);
      error = err.message || 'Failed to fetch movie';
      item = null;
    } finally {
      isItemLoading = false;
    }
  }

  async function fetchList() {
    try {
      isListLoading = true;
      const response = await axios.get(`${PUBLIC_DATABASE}api/movie/`);
      list = response.data;
    } catch (err) {
      console.error('Failed to fetch list:', err);
      list = [];
    } finally {
      isListLoading = false;
    }
  }

  let filmsList = $derived(() => {
    if (!item || !list) return [];
    return list.filter((listFilm) => 
      listFilm.cat_id && listFilm.cat_id.cat_id === item.cat_id.cat_id
    );
  });

  onMount(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo(0, 0);
    }
    fetchItem();
    fetchList();
  });

  $effect(() => {
    if (id) {
      if (typeof window !== 'undefined') {
        window.scrollTo(0, 0);
      }
      fetchItem();
    }
  });
</script>

<div class="serial-film-page">
  {#if isItemLoading || isListLoading}
    <Loader />
  {:else if error}
    <div class="error">
      {error}
    </div>
  {:else if item}
    <SingleMovieItem 
      {item} 
      list={filmsList} 
      itemRouteId={item.cat_id.route_id} 
    />
  {:else}
    <div class="not-found">
      Фильм не найден
    </div>
  {/if}
</div>

<style>
  .serial-film-page {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    height: fit-content;
  }

  .error,
  .not-found {
    color: white;
    text-align: center;
    padding: 2rem;
    font-family: 'Montserrat', sans-serif;
  }

  .error {
    color: #ff6b6b;
  }
</style>
