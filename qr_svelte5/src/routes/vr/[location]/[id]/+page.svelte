<script>
  import { page } from '$app/stores';
  import { globals } from '$lib/stores/+stores.svelte.js';
  import { onMount } from 'svelte';
  import { initializeMainPageData } from '$lib/utils/mainPageData.js';
  import Header from '$lib/components/widgets/Header.svelte';
  import VrPlayer from '$lib/components/MainPage/VrPlayer.svelte';
  import StartScreen from '$lib/components/widgets/StartScreen.svelte';
  import MainPageHeader from '$lib/components/MainPage/MainPageHeader.svelte';

  let location = $derived($page.params.location);
  let id = $derived($page.params.id);
  let library = $derived(globals.get('library'));
  let isLibraryLoading = $derived(globals.get('isLibraryLoading'));
  let isClientsLoading = $derived(globals.get('isClientsLoading'));

  globals.set('currentClient', { location, id });
  
  let noveltyRef = $state();
  let pageInitialized = $state(false);

  onMount(async () => {
    const result = await initializeMainPageData(location, id);
    if (result.isValid) {
      pageInitialized = true;
    }
  });

</script>

<!-- Start Screen - covers everything including navigation -->
<StartScreen isVisible={isLibraryLoading || isClientsLoading || !pageInitialized} />

<!-- Main content - always rendered but hidden behind StartScreen when loading -->
{#if library}
  <div class="mainPage">
    <!-- <Header /> -->
    <MainPageHeader />
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
