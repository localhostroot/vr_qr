<script>
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { browser } from '$app/environment';
  import { PUBLIC_DATABASE } from '$env/static/public';
  import axios from 'axios';
  import SingleMovieItem from '$lib/components/SingleMovieItem/SingleMovieItem.svelte';
  import StartScreen from '$lib/components/widgets/StartScreen.svelte';
  import Loader from '$lib/components/widgets/Loader.svelte';
  import { globals } from '$lib/stores/+stores.svelte';

  let item = $state(null);
  let list = $state([]);
  let isItemLoading = $state(true);
  let isListLoading = $state(true);
  let error = $state(null);
  let pageInitialized = $state(false);

  let id = $derived($page.params.id);
  const singleMovieItemLoading = $derived(globals.get('singleMovieItemLoading'))

  const checkSessionStorage = () => {
    if (!browser) return true;
    const hasLoadedBefore = sessionStorage.getItem('app_has_loaded') == 'true';
    return !hasLoadedBefore;
  }

  let isInitialLoad = $state(checkSessionStorage());

  async function fetchItem() {
    if (!id) return;
    
    try {
      
      isItemLoading = true;
      const response = await axios.get(`${PUBLIC_DATABASE}api/category/`);

      item = response.data.find(item => item.route_id === id);
      error = null;

    } catch (err) {

      console.error('Failed to fetch item:', err);

      error = err.message || 'Failed to fetch content';

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

  const setFilmList = () => {

    if (!item || !list) return [];

    return list.filter((listFilm) => 
      listFilm.cat_id && listFilm.cat_id.cat_id === item.cat_id
    );
  }

  let filmsList = $derived(setFilmList());

  onMount(async () => {
    if (typeof window !== 'undefined') {
      window.scrollTo(0, 0);
    }
    
    await Promise.all([fetchItem(), fetchList()]);
    
    // Mark page as initialized
    pageInitialized = true;
    
    // Mark app as loaded in this session
    if (browser && isInitialLoad) {
      sessionStorage.setItem('app_has_loaded', 'true');
      // Hide start screen after animation
      setTimeout(() => {
        isInitialLoad = false;
      }, 1200);
    }
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

<!-- Start Screen - only shows on initial app load -->
<StartScreen isVisible={isInitialLoad && (singleMovieItemLoading || isItemLoading || isListLoading || !pageInitialized)} />

<div class="content-descr-page">
  {#if !(isItemLoading || isListLoading) && error}
    <div class="error">{error}</div>
  {:else if item}
    <SingleMovieItem 
      {item} 
      list={filmsList} 
      itemRouteId={item.id} 
    />
  {:else}
    <div class="not-found">
      Контент не найден
    </div>
  {/if}
</div>

<style>
  .content-descr-page {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    height: fit-content;
  }

  .error,
  .not-found {
    color: var(--color-white);
    text-align: center;
    padding: 2rem;
    font-family: 'Montserrat', sans-serif;
  }

  .error {
    color: var(--color-error);
  }
</style>
