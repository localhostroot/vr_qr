<script>
  import { page } from '$app/stores';
  import { browser } from '$app/environment';
  import { globals } from '$lib/stores/+stores.svelte.js';
  import { onMount } from 'svelte';
  import { initializeMainPageData } from '$lib/utils/mainPageData.js';
  import Header from '$lib/components/widgets/Header.svelte';
  import VrPlayer from '$lib/components/MainPage/VrPlayer.svelte';
  import StartScreen from '$lib/components/widgets/StartScreen.svelte';
import MainPageHeader from '$lib/components/MainPage/MainPageHeader.svelte';
import { setCookie } from '$lib/utils/+helpers.svelte.js';

  let location = $derived($page.params.location);
  let id = $derived($page.params.id);
  let library = $derived(globals.get('library'));
  let isLibraryLoading = $derived(globals.get('isLibraryLoading'));
  let isClientsLoading = $derived(globals.get('isClientsLoading'));
  
  let noveltyRef = $state();
  let pageInitialized = $state(false);

  const checkSessionStorage = () => {
    if (!browser) return true;
    const hasLoadedBefore = sessionStorage.getItem('app_has_loaded') == 'true';

    return !hasLoadedBefore;
  }

  let isInitialLoad = $state(checkSessionStorage());


  onMount(async () => {
    // Set current client data in browser only
    if (browser) {
      const currentClient = { location, id };
      globals.set('currentClient', currentClient);
      localStorage.setItem('CLIENT', JSON.stringify(currentClient));
      setCookie('CURRENT_CLIENT', JSON.stringify(currentClient), 7);
    }

    const result = await initializeMainPageData(location, id);

    if (result.isValid) {

      pageInitialized = true;
      
      // Mark app as loaded in this session
      if (browser && isInitialLoad) {
        sessionStorage.setItem('app_has_loaded', 'true');
        // Hide start screen after animation
        setTimeout(() => {
          isInitialLoad = false;
        }, 1200);
      }
    }
  });

</script>

<!-- Start Screen - only shows on initial app load -->
<StartScreen isVisible={isInitialLoad && (isLibraryLoading || isClientsLoading || !pageInitialized)} />

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
