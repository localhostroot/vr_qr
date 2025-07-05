<script>
  import { page } from '$app/stores';
  import { globals } from '$lib/stores/+stores.svelte.js';
  import { onMount } from 'svelte';
  import { initializeMainPageData } from '$lib/utils/mainPageData.js';
  import Header from '$lib/components/widgets/Header.svelte';
  import MainPageHeader from '$lib/components/MainPage/MainPageHeader.svelte';
  import VrPlayer from '$lib/components/MainPage/VrPlayer.svelte';
  import Loader from '$lib/components/widgets/Loader.svelte';

  let location = $derived($page.params.location);
  let id = $derived($page.params.id);
  let library = $derived(globals.get('library'));
  let isLibraryLoading = $derived(globals.get('isLibraryLoading'));
  let isClientsLoading = $derived(globals.get('isClientsLoading'));

  globals.set('currentClient', { location, id });
  
  let noveltyRef = $state();
  let pageInitialized = $state(false);

  const scrollToNovelty = () => {

    if (noveltyRef) {

      const top = noveltyRef.getOffsetTop();

      window.scrollTo({
        top: top,
        behavior: 'smooth'
      });
    }
  };

  onMount(async () => {
    const result = await initializeMainPageData(location, id);
    if (result.isValid) {
      pageInitialized = true;
    }
  });
</script>

{#if isLibraryLoading || isClientsLoading || !pageInitialized}
  <Loader />
{:else if library}
  <div class="mainPage">
    <Header />
    <MainPageHeader scrollFunc={scrollToNovelty} />
    <VrPlayer {library} bind:this={noveltyRef} />
  </div>
{/if}

<style>
  .mainPage {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    min-height: calc(100vh - var(--navigation-height));
  }
</style>
