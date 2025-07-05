<script>
  import { goto } from '$app/navigation';
  import { globals } from '$lib/stores/+stores.svelte.js';
  import { icons } from '$lib/icons/icons.js';
  import LOCAL_STORAGE_KEYS from '$lib/constants/localStorageKeys.js';
  import AddToQueueBtn from './AddToQueueBtn.svelte';
  import { getSubfolder } from '$lib/utils/+helpers.svelte';

  let { item } = $props();

  let paidFilms = $derived(globals.get('paidFilms'));
  let queue = $derived(globals.get('queue'));

  function getCurrentClient() {
    const clientString = localStorage.getItem(LOCAL_STORAGE_KEYS.CLIENT);
    const client = clientString ? JSON.parse(clientString) : null;
    const clLocation = client?.location || null;
    const id = client?.id || null;
    return clLocation && id ? `${clLocation}/${id}` : null;
  }

  let isInPaidFilms = $derived(() => {
    return paidFilms.some(film => film.film_id === item.film_id);
  });

  let isQueueEmpty = $derived(() => {
    return queue.length === 0;
  });

  function handleClick() {
    if (isInPaidFilms()) {
      goto(`${getSubfolder()}/films`);
    } else {
      goto(`${getSubfolder()}/queue`);
    }
  }

  function handleHomeClick() {
    const userId = getCurrentClient();
    goto(`${getSubfolder()}/vr/${userId}`);
  }

  const styles = {
    width: '21.6417vw',
    height: '11.19vw',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--color-white-37)',
    borderRadius: 'var(--radius-30)',
  };

  const stylesNone = {
    width: '21.6417vw',
    height: '11.19vw',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--color-white-37)',
    borderRadius: 'var(--radius-30)',
    color: 'var(--color-dark-primary)',
    cursor: 'not-allowed',
    pointerEvents: 'none',
    opacity: '0.3'
  };

  const disabledStyles = {
    opacity: '0.3',
    cursor: 'not-allowed',
    pointerEvents: 'none',
  };
</script>

<div class="movie-bottom-info">
  <div class="upper-info">
    <div class="name">{item.name_short}</div><div class="price">{item.price}₽</div>
    <!-- <div class="title-with-btn">
      <div class="link-container">
        <div class="home" onclick={handleHomeClick}>
          {@html icons.mainActive}
        </div>
      </div>
    </div> -->
  </div>
  <div class="btns">
    <div 
      class="to-queue" 
      onclick={handleClick}
      style={isQueueEmpty() && !isInPaidFilms() ? Object.entries(disabledStyles).map(([k, v]) => `${k}: ${v}`).join('; ') : ''}
    >
      {isInPaidFilms() ? 'К покупкам' : 'Перейти в корзину'}
    </div>
    <AddToQueueBtn 
      {item} 
      styles={item.serial || isInPaidFilms() ? stylesNone : styles} 
    />
  </div>
  <div class="bottom-info">
    <div class="upper">
      <div class="film-name">
        <div class="info-upper-par">
          <div class="par">Название</div>
          <div class="par-descr">{item.country}</div>
        </div>
        <div class="info-upper-par">
          <div class="par">Год</div>
          <div class="par-descr">{item.year}</div>
        </div>
      </div>
    </div>
    <div class="middle">
      <div class="par">
        Описание
      </div>
      <div class="par-descr">
        {item.description}
      </div>
    </div>
    <div class="upper" style="margin-bottom: 3.7313vw;">
      <div class="film-name">
        <div class="info-upper-par">
          <div class="par">Длительность</div>
          <div class="par-descr">{item.time}</div>
        </div>
        <div class="info-upper-par">
          <div class="par">Цена</div>
          <div class="par-descr">{item.price}₽</div>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .movie-bottom-info {
    width: 95.0248vw;
    display: flex;
    flex-direction: column;
    gap: 4.9751vw;
  }

  .upper-info {
    display: flex;
    justify-content: space-between;  

    font-weight: 400;
    font-size: 5.9701vw;
    color: var(--color-white);
    font-family: "Manrope", serif;
    gap: 2.4875vw;
  }

  .price {
    padding-right: 2px;
    padding-left: 2px;
    border-bottom: 1px solid var(--color-white-80);
    width: fit-content;
  }

  .btns {
    display: flex;
    justify-content: space-between;
  }

  .to-queue {
    width: 70.6467vw;
    height: 11.19vw;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 400;
    font-size: 3.99vw;
    background: var(--color-white-90);
    border-radius: var(--radius-30);
    color: var(--color-dark-primary);
    font-family: "Montserrat", serif;
    cursor: pointer;
  }

  .btn-add {
    width: 21.6417vw;
    height: 11.19vw;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-white-37);
    border-radius: var(--radius-30);
  }

  .bottom-info {
    width: 100%;
    height: fit-content;
    background: var(--color-dark-secondary);
    border-radius: var(--radius-5);
    font-family: "Montserrat", serif;
    display: flex;
    flex-direction: column;
    gap: 2.98507vw;
  }

  .upper {
    margin-top: 3.7313vw;
    margin-left: 3.7313vw;
    margin-right: 3.7313vw;
  }

  .middle {
    margin-left: 3.7313vw;
    margin-right: 3.7313vw;
    display: flex;
    flex-direction: column;
    gap: 3.2338vw;
  }

  .film-name {
    display: flex;
    gap: 13.4328vw;
  }

  .info-upper-par {
    display: flex;
    flex-direction: column;
    gap: 3.2338vw;
  }

  .par {
    font-weight: 500;
    font-size: 4.2288vw;
    color: var(--color-white-65);
  }

  .par-descr {
    font-weight: 500;
    font-size: 3.7313vw;
    color: var(--color-white);
  }

  .title-with-btn {
    display: flex;
    width: 100%;
    justify-content: space-between;
    align-items: center;
    height: fit-content;
  }

  .home {
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

  .home:hover {
    background: var(--color-white-20);
  }

  .home :global(svg) {
    height: auto;
  }

  .name {
    height: 100%;
    display: flex;
    align-self: start;
  }

  .link-container {
    align-self: end;
  }
</style>
