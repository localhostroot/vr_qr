<script>
  import { globals } from '$lib/stores/+stores.svelte.js';
  import { icons } from '$lib/icons/icons.js';

  let paidFilms = $derived(globals.get('paidFilms'));
  let token = $derived(globals.get('token'));
  let tokenExpiry = $derived(globals.get('tokenExpiry'));

  function addToQueue(film) {
    const existsInQueue = globals.get('queue').some(item => item.id === film.id);
    if (!existsInQueue) {
      globals.update('queue', currentQueue => [...currentQueue, film]);
    }
  }

  // let isTokenValid = $derived(token && tokenExpiry && new Date(tokenExpiry) > new Date());
  let isTokenValid = true;
</script>

<div class="films-page">
  <div class="content">
    <h1>Оплаченные фильмы</h1>
    
    {#if !isTokenValid}
      <div class="no-token">
        <div class="empty-icon">
          {@html icons.paid}
        </div>
        <h2>Нет активного токена</h2>
        <p>Для просмотра оплаченных фильмов необходимо приобрести доступ</p>
        <button class="buy-access-btn">
          Купить доступ
        </button>
      </div>
    {:else if paidFilms && paidFilms.length > 0}
      <div class="token-info">
        <p>Токен действителен до: {new Date(tokenExpiry).toLocaleString()}</p>
      </div>
      
      <div class="films-grid">
        {#each paidFilms as film}
          <div class="film-card">
            {#if film.image}
              <img src={film.image} alt={film.title} />
            {/if}
            <div class="film-info">
              <h3>{film.title}</h3>
              {#if film.description}
                <p>{film.description}</p>
              {/if}
              {#if film.duration}
                <span class="duration">{film.duration} мин</span>
              {/if}
              <div class="film-actions">
                <button 
                  class="add-to-queue-btn"
                  onclick={() => addToQueue(film)}
                >
                  {@html icons.plus}
                  Добавить в очередь
                </button>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <div class="empty-films">
        <div class="empty-icon">
          {@html icons.play}
        </div>
        <h2>Нет оплаченных фильмов</h2>
        <p>После оплаты фильмы появятся здесь</p>
      </div>
    {/if}
  </div>
</div>

<style>
  .films-page {
    min-height: calc(100vh - var(--navigation-height));
    background: var(--color-dark-primary);
    color: var(--color-white);
    padding: var(--spacing-20);
    font-family: 'Montserrat', sans-serif;
  }

  .content {
    max-width: 1200px;
    margin: 0 auto;
  }

  h1 {
    text-align: center;
    margin-bottom: var(--spacing-20);
    font-size: var(--font-20);
    font-weight: var(--font-weight-600);
  }

  .token-info {
    text-align: center;
    margin-bottom: var(--spacing-20);
    padding: var(--spacing-10);
    background: var(--color-success-10);
    border: 1px solid var(--color-success-30);
    border-radius: var(--radius-5);
    color: var(--color-green);
  }

  .films-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: var(--spacing-20);
    margin-top: var(--spacing-20);
  }

  .film-card {
    background: var(--color-white-10);
    border-radius: var(--radius-10);
    overflow: hidden;
    transition: var(--transition-transform);
  }

  .film-card:hover {
    transform: var(--transform-hover-lift-5);
    background: var(--color-white-15);
  }

  .film-card img {
    width: 100%;
    height: 200px;
    object-fit: cover;
  }

  .film-info {
    padding: var(--spacing-15);
  }

  .film-info h3 {
    margin: 0 0 var(--spacing-10) 0;
    font-size: var(--font-12);
    font-weight: var(--font-weight-600);
  }

  .film-info p {
    margin: 0 0 var(--spacing-10) 0;
    font-size: var(--font-9);
    color: var(--color-white-70);
  }

  .duration {
    font-size: var(--font-8);
    color: var(--color-white-60);
    background: var(--color-white-10);
    padding: var(--spacing-3) var(--spacing-6);
    border-radius: var(--radius-3);
    display: inline-block;
    margin-bottom: var(--spacing-10);
  }

  .film-actions {
    margin-top: var(--spacing-10);
  }

  .add-to-queue-btn {
    background: var(--color-success-20);
    border: 1px solid var(--color-success-30);
    color: var(--color-green);
    padding: var(--spacing-7) var(--spacing-10);
    border-radius: var(--radius-5);
    cursor: pointer;
    font-family: inherit;
    display: flex;
    align-items: center;
    gap: var(--spacing-5);
    width: 100%;
    justify-content: center;
    transition: var(--transition-background);
  }

  .add-to-queue-btn:hover {
    background: var(--color-success-30);
  }

  .add-to-queue-btn :global(svg) {
    width: 16px;
    height: 16px;
  }

  .no-token, .empty-films {
    text-align: center;
    padding: var(--spacing-40) var(--spacing-20);
  }

  .empty-icon {
    margin-bottom: var(--spacing-20);
    opacity: 0.5;
  }

  .empty-icon :global(svg) {
    width: 80px;
    height: 80px;
  }

  .no-token h2, .empty-films h2 {
    margin-bottom: var(--spacing-10);
    color: var(--color-white-70);
  }

  .no-token p, .empty-films p {
    color: var(--color-white-50);
    margin-bottom: var(--spacing-20);
  }

  .buy-access-btn {
    background: var(--color-info-20);
    border: 1px solid var(--color-info-30);
    color: var(--color-blue);
    padding: var(--spacing-10) var(--spacing-20);
    border-radius: var(--radius-5);
    cursor: pointer;
    font-family: inherit;
    font-size: var(--font-10);
    transition: var(--transition-background);
  }

  .buy-access-btn:hover {
    background: var(--color-info-30);
  }
</style>
