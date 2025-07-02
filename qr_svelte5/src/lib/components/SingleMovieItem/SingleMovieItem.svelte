<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { globals } from '$lib/stores/+stores.svelte.js';
  import { icons } from '$lib/icons/icons.js';
  import LOCAL_STORAGE_KEYS from '$lib/constants/localStorageKeys.js';
  import MovieBottomInfo from './MovieBottomInfo.svelte';
  import SerialTable from './SerialTable.svelte';
  import Loader from '$lib/components/widgets/Loader.svelte';

  let { item, list, itemRouteId } = $props();

  let imageLoading = $state(true);

  function handleClick() {
    history.back();
  }

  function handleReverseClick() {
    if (!item || !item.cat_id || !item.cat_id.cat_id || !list || list.length === 0) {
      return;
    }

    const filteredList = list.filter(listItem => {
      return listItem && listItem.cat_id && listItem.cat_id.cat_id === item.cat_id.cat_id;
    });

    if (filteredList.length === 0) {
      return;
    }

    const currentIndex = filteredList.findIndex(listItem => listItem.id === item.id);

    if (currentIndex === -1) {
      return;
    }

    let nextItem;
    if (currentIndex + 1 < filteredList.length) {
      nextItem = filteredList[currentIndex + 1];
    } else {
      nextItem = filteredList[0];
    }

    if (nextItem) {
      goto(`/film/${nextItem.route_id}`);
    }
  }

  function handleClickReturn() {
    goto(`/content/${itemRouteId}`);
  }

  function handleVrClick() {
    
    const clientString = localStorage.getItem(LOCAL_STORAGE_KEYS.CLIENT);
    const client = clientString ? JSON.parse(clientString) : null;
    const clLocation = client?.location || null;
    const id = client?.id || null;
    const userId = clLocation && id ? `${clLocation}/${id}` : null;

    if (item.serial) {
      goto(userId ? `/vr/${userId}` : `/`);
    } else {
      handleClick();
    }
  }

  onMount(() => {
    const img = new Image();
    img.src = item.backImg;

    img.onload = () => {
      imageLoading = false;
    };

    img.onerror = () => {
      console.error("Не удалось загрузить изображение", item.backImg);
      imageLoading = false;
    };
  });
</script>

{#if imageLoading}
  <Loader />
{:else}
  <div class="single-movie">
    <div class="upper-info">
      <img
        class="back"
        alt="афиша"
        src={item.backImg}
      />
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="btn" onclick={handleVrClick}>
        {@html icons.arrow}
      </div>
      {#if item.series && !item.serial}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="btn-reverse" onclick={handleReverseClick}>
          {@html icons.arrow}
        </div>
      {/if}
      {#if item.series && !item.serial}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="btn-return" onclick={handleClickReturn}>
          {@html icons.vector}
        </div>
      {/if}
    </div>
    {#if item.serial}
      <div class="serial-info">
        <MovieBottomInfo {item} />
        <SerialTable item={list} series={item.series} />
      </div>
    {:else}
      <MovieBottomInfo {item} />
    {/if}
  </div>
{/if}

<style>
  .single-movie {
    width: 100%;
    display: flex;
    flex-direction: column;
    height: fit-content;
    align-items: center;
    gap: 6.2189vw;
  }

  .upper-info {
    width: 100%;
    height: fit-content;
    position: relative;
  }

  .back {
    position: relative;
    width: 100%;
    height: 50vw;
    z-index: 0;
    object-fit: cover;
  }

  .btn {
    position: absolute;
    width: 9.4527vw;
    height: 9.4527vw;
    top: var(--spacing-10);
    left: var(--spacing-10);
    display: flex;
    justify-content: center;
    align-items: center;
    background: var(--color-white-10);
    border-radius: var(--radius-full);
    cursor: pointer;
    transition: var(--transition-100);
  }

  .btn:hover {
    background: var(--color-white-20);
  }

  .btn-reverse {
    position: absolute;
    width: 9.4527vw;
    height: 9.4527vw;
    top: 9.9502vw;
    right: 2.4875vw;
    display: flex;
    justify-content: center;
    align-items: center;
    background: var(--color-white-10);
    border-radius: var(--radius-full);
    cursor: pointer;
    transform: scaleX(-1);
    transition: var(--transition-100);
  }

  .btn-reverse:hover {
    background: var(--color-white-20);
  }

  .btn-return {
    position: absolute;
    width: 9.4527vw;
    height: 9.4527vw;
    bottom: 2.4875vw;
    right: 2.4875vw;
    display: flex;
    justify-content: center;
    align-items: center;
    background: var(--color-white-10);
    border-radius: var(--radius-full);
    cursor: pointer;
    transition: var(--transition-100);
  }

  .btn-return:hover {
    background: var(--color-white-20);
  }

  .time {
    position: absolute;
    bottom: 3.7313vw;
    right: 2.4875vw;
    font-weight: 400;
    font-size: 3.4825vw;
    background: rgba(0,0,0, 0.7);
    padding: 3px 5px;
    border-radius: 10px;
    color: rgba(255,255,255, 0.8);
    font-family: "Manrope", serif;
  }

  .serial-info {
    gap: 12.4378vw;
    display: flex;
    flex-direction: column;
  }
</style>
