<script>
  import { goto } from '$app/navigation';
  import AddToQueueBtn from '$lib/components/SingleMovieItem/AddToQueueBtn.svelte';
  import { getSubfolder } from '$lib/utils/+helpers.svelte';

  let { item } = $props();

  function handleClick() {
    if (item.series) {
      goto(`${getSubfolder()}/film/${item.route_id}`);
    } else {
      goto(`${getSubfolder()}/content/${item.route_id}`);
    }
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="contentCard" onclick={handleClick}>
  <div
    class="afisha"
    style="background-image: url({item.queueImg || item.backImg || item.image})"
  >
    <div class="afishaInfo">
      <div class="format">
        {item.format || 'VR'}
      </div>
      <AddToQueueBtn {item} />
    </div>
    <div class="afishaBottomInfo">
      <div class="time">
        {item.time || item.duration || ''}
      </div>
    </div>
  </div>
  <div class="bottomInfo">
    <div class="name">{item.name || item.title}</div>
    <div class="price">{item.price}₽</div>
  </div>
</div>

<style>
  .contentCard {
    width: var(--width-vw-950);
    height: fit-content;
    border-radius: var(--radius-5);
    display: flex;
    flex-direction: column;
    margin-bottom: var(--spacing-10);
    cursor: pointer;
  }

  .afisha {
    width: var(--width-vw-950) !important;
    height: 53.451vw;
    background-repeat: no-repeat;
    background-position: center;
    background-size: cover;
    border-top-right-radius: var(--radius-5);
    border-top-left-radius: var(--radius-5);
    position: relative;
  }

  .afishaInfo {
    width: 100%;
    display: flex;
    position: absolute;
    top: 0;
    justify-content: space-between;
  }

  .format {
    font-weight: 600;
    color: var(--color-white-90);
    background: var(--color-dark-50);
    margin-left: var(--spacing-3);
    margin-top: var(--spacing-3);
    height: fit-content;
    width: fit-content;
    padding: 4px 4px;
    border-radius: var(--radius-5);
    font-size: var(--font-9);

    backdrop-filter: blur(5px);

    border: 1px solid var(--color-white-10);
  }

  .afishaBottomInfo {
    position: absolute;
    bottom: var(--spacing-5);
    right: var(--spacing-5);
  }

  .time {
    font-weight: 400;
    font-size: var(--font-vw-35);
    color: var(--color-white-80);
    background: var(--color-dark-50);
    padding: var(--spacing-3) var(--spacing-5);
    border-radius: var(--radius-10);
    backdrop-filter: blur(5px);
    border: 1px solid var(--color-white-10);
  }

  .bottomInfo {
    width: 100%;
    display: flex;
    flex-direction: column;
    font-weight: var(--font-weight-400);
    font-size: var(--font-vw-35);
    color: var(--color-white);
    background: var(--color-dark-secondary);
    border-bottom-right-radius: var(--radius-5);
    border-bottom-left-radius: var(--radius-5);
    gap: var(--spacing-3);
  }

  .name {
    padding-left: var(--spacing-vw-25);
    padding-top: var(--spacing-vw-25);
    font-size: var(--font-11);
    font-weight: var(--font-weight-500);
  }

  .price {
    align-content: center;
    border-bottom: 1px solid var(--color-white);
    width: fit-content;
    margin-left: var(--spacing-vw-25);
    padding: var(--spacing-2);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: var(--spacing-vw-25);
    font-size: var(--font-10);
    font-weight: var(--font-weight-400);
  }
</style>
