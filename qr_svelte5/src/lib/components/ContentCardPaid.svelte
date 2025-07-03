<script>
  import { onMount } from 'svelte';
  import { globals } from '$lib/stores/+stores.svelte.js';
  import { icons } from '$lib/icons/icons.js';
  import { browser } from '$app/environment';

  let { item, clientId, location, client } = $props();

  // State variables using $state rune
  let isValidToken = $state(false);
  let isValidFilm = $state(false);
  let isLoading = $state(true);
  let requestError = $state('');
  let isActive = $state(false);
  let isPending = $state(false);
  let isInQueue = $state(false);
  let isOtherActive = $state(false);

  // Get token from store using $derived
  let token = $derived(globals.get('token'));
  let tokenExpiry = $derived(globals.get('tokenExpiry'));

  // Format time utility function
  const formatTime = (seconds) => {
    if (!seconds) return '00:00';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  import { PUBLIC_DATABASE, PUBLIC_BACKEND } from '$env/static/public';
  
  // API URLs from environment
  const databaseApi = PUBLIC_DATABASE;
  const backendApi = PUBLIC_BACKEND;

  // Content card state logic
  const updateContentCardState = () => {
    if (!client || !item) {
      isActive = false;
      isPending = false;
      isInQueue = false;
      isOtherActive = false;
      return;
    }

    isActive = client.currentFilm && client.currentFilm.film_id === item.film_id;
    isPending = client.pendingFilm && client.pendingFilm.film_id === item.film_id;
    
    const queue = globals.get('queue') || [];
    isInQueue = queue.some(queueItem => queueItem.film_id === item.film_id);
    
    isOtherActive = client.currentFilm && client.currentFilm.film_id !== item.film_id;
  };

  // Token validation
  const validateToken = async () => {
    if (!token || !databaseApi || !item) {
      isValidToken = false;
      isValidFilm = false;
      isLoading = false;
      return;
    }

    try {
      // Check if token is expired
      if (tokenExpiry && new Date(tokenExpiry) <= new Date()) {
        isValidToken = false;
        isValidFilm = false;
        isLoading = false;
        return;
      }

      // Validate token and film access
      let url = `${databaseApi}api/tokens/validate/?token=${token}`;
      if (item.film_id) {
        url += `&film_id=${item.film_id}`;
      }
      
      const response = await fetch(url);
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.valid) {
          isValidToken = true;
          
          if (item.film_id) {
            const filmValid = data.film_valid || false;
            isValidFilm = filmValid;
            
            if (!filmValid) {
              // Remove film from paid films if not valid
              const paidFilms = globals.get('paidFilms') || [];
              const updatedPaidFilms = paidFilms.filter(film => film.film_id !== item.film_id);
              globals.set('paidFilms', updatedPaidFilms);
            }
          } else {
            isValidFilm = true;
          }
          
          // Update token expiry if provided
          if (data.expires_at) {
            globals.set('tokenExpiry', data.expires_at);
          }
        } else {
          isValidToken = false;
          isValidFilm = false;
          
          if (item.film_id) {
            // Remove film from paid films if token is invalid
            const paidFilms = globals.get('paidFilms') || [];
            const updatedPaidFilms = paidFilms.filter(film => film.film_id !== item.film_id);
            globals.set('paidFilms', updatedPaidFilms);
          }
          
          if (data.error && data.error.includes("истек")) {
            globals.set('token', null);
            globals.set('tokenExpiry', null);
          }
        }
      } else {
        isValidToken = false;
        isValidFilm = false;
        
        if (item.film_id) {
          // Remove film from paid films on error
          const paidFilms = globals.get('paidFilms') || [];
          const updatedPaidFilms = paidFilms.filter(film => film.film_id !== item.film_id);
          globals.set('paidFilms', updatedPaidFilms);
        }
      }
    } catch (error) {
      console.error('Token validation error:', error);
      isValidToken = false;
      isValidFilm = false;
    }
    
    isLoading = false;
  };

  // Send request via WebSocket
  const sendRequest = async (type, filmId = null) => {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`${backendApi}`);

      ws.onopen = () => {
        const message = JSON.stringify({
          type: type,
          clientId: clientId,
          location: location,
          videoId: filmId || null,
          token: token || null
        });
        ws.send(message);
      };

      ws.onmessage = (event) => {
        const response = JSON.parse(event.data);
        if (response.type === 'requestResponse') {
          if (response.success) {
            resolve(response);
          } else {
            reject(new Error(response.message || 'Неизвестная ошибка'));
          }
        }
      };

      ws.onerror = (error) => {
        reject(error);
      };

      ws.onclose = () => {
        reject(new Error('Соединение закрыто без ответа'));
      };
    });
  };

  // Event handlers
  const handleWatchClick = async () => {
    if (!isValidToken || !isValidFilm) {
      requestError = "Нет доступа к этому фильму. Возможно, токен истек или не действителен.";
      return;
    }

    try {
      await sendRequest('videoForClient', item.film_id);
      requestError = null;
      console.log('Запрос на просмотр отправлен.');
    } catch (error) {
      console.error('Ошибка при отправке запроса:', error);
      requestError = `Произошла ошибка: ${error.message}`;
    }
  };

  const handleStop = async () => {
    if (!isValidToken) {
      requestError = "Недействительный токен доступа.";
      return;
    }

    try {
      await sendRequest('stop', item.film_id);
      requestError = null;
    } catch (error) {
      requestError = `Произошла ошибка: ${error.message}`;
    }
  };

  const handleAddToQueue = async () => {
    if (!isValidToken || !isValidFilm) {
      requestError = "Нет доступа к этому фильму. Возможно, токен истек или не действителен.";
      return;
    }

    try {
      await sendRequest('addToQueue', item.film_id);
      requestError = null;
    } catch (error) {
      requestError = `Произошла ошибка: ${error.message}`;
    }
  };

  const handleRemoveFromQueue = async () => {
    if (!isValidToken) {
      requestError = "Недействительный токен доступа.";
      return;
    }

    try {
      await sendRequest('removeFromQueue', item.film_id);
      requestError = null;
    } catch (error) {
      requestError = `Произошла ошибка: ${error.message}`;
    }
  };

  const handleCleanQueue = async () => {
    if (!isValidToken) {
      requestError = "Недействительный токен доступа.";
      return;
    }

    try {
      await sendRequest('clean');
      requestError = null;
    } catch (error) {
      requestError = `Произошла ошибка: ${error.message}`;
    }
  };

  // Formatted playback position using $derived
  let formattedPlaybackPosition = $derived(
    client && client.playbackPosition ? formatTime(client.playbackPosition) : '00:00'
  );

  onMount(() => {
    validateToken();
    updateContentCardState();
  });

  // Reactive updates using $effect
  $effect(() => {
    updateContentCardState();
  });

  // Watch for token changes and revalidate
  $effect(() => {
    if (token !== undefined) {
      validateToken();
    }
  });
</script>

<div class="contentCard">
  {#if isLoading}
    <div class="loading">Проверка доступа...</div>
  {:else}
    <div class="afisha">
      <img class="paidAfisha" src={item.queueImg} alt="покупки" />
      <div class="afishaInfo">
        <div class="format">{item.format}</div>
        <div class="afishaBottomInfo">
          <div class="time">{item.time}</div>
        </div>
      </div>
    </div>
    
    <div class="bottomInfo">
      <div class="name">{item.name}</div>
      
      {#if isValidToken && isValidFilm}
        <div class="queueButton">
          {#if isActive}
            <div class="activeButton">
              <div class="activeInfo">
                <span>Активен: {formattedPlaybackPosition}</span>
              </div>
              <button class="stopBtn" onclick={handleStop}>
                {@html icons.stop || '⏹'}
                Остановить
              </button>
            </div>
          {:else if isPending}
            <div class="pendingButton">
              <span>Ожидание...</span>
            </div>
          {:else if isInQueue}
            <div class="queueActions">
              <button class="removeFromQueueBtn" onclick={handleRemoveFromQueue}>
                {@html icons.minus || '−'}
                Убрать из очереди
              </button>
              {#if !isOtherActive}
                <button class="watchBtn" onclick={handleWatchClick}>
                  {@html icons.play || '▶'}
                  Смотреть
                </button>
              {/if}
            </div>
          {:else}
            <div class="defaultActions">
              <button class="addToQueueBtn" onclick={handleAddToQueue}>
                {@html icons.plus || '+'}
                Добавить в очередь
              </button>
              {#if !isOtherActive}
                <button class="watchBtn" onclick={handleWatchClick}>
                  {@html icons.play || '▶'}
                  Смотреть
                </button>
              {/if}
            </div>
          {/if}
        </div>
      {:else}
        <div class="accessDenied">
          Нет доступа к фильму
        </div>
      {/if}
    </div>

    {#if requestError}
      <div class="error">
        {requestError}
      </div>
    {/if}
  {/if}
</div>

<style>
  .contentCard {
    width: 95.024vw;
    height: fit-content;
    border-radius: var(--radius-5);
    display: flex;
    flex-direction: column;
    margin-bottom: var(--spacing-10);
  }

  .afisha {
    width: 95.024vw;
    height: fit-content;
    border-top-right-radius: var(--radius-5);
    border-top-left-radius: var(--radius-5);
    position: relative;
  }

  .paidAfisha {
    width: 100%;
    height: auto;
    position: relative;
    z-index: 0;
  }

  .afishaInfo {
    width: 100%;
    height: 100%;
    display: flex;
    position: absolute;
    top: 0;
    justify-content: space-between;
  }

  .format {
    font-weight: 300;
    color: rgba(255, 255, 255, 0.9);
    background: rgba(43, 43, 43, 0.5);
    margin-left: 3px;
    margin-top: 3px;
    height: fit-content;
    width: fit-content;
    padding: 4px;
    border-radius: 30px;
  }

  .afishaBottomInfo {
    position: absolute;
    right: 0;
    bottom: 5px;
  }

  .time {
    font-weight: 400;
    font-size: 3.4825vw;
    color: rgba(255, 255, 255, 0.8);
  }

  .bottomInfo {
    width: 100%;
    display: flex;
    flex-direction: column;
    font-weight: 400;
    font-size: 3.4825vw;
    color: var(--color-white);
    background: var(--color-dark-secondary);
    border-bottom-right-radius: var(--radius-5);
    border-bottom-left-radius: var(--radius-5);
    gap: 3px;
  }

  .name {
    padding-left: 2.4875vw;
    padding-top: 2.4875vw;
  }

  .queueButton {
    padding: var(--spacing-10) 2.4875vw;
  }

  .activeButton {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-5);
  }

  .activeInfo {
    font-size: var(--font-9);
    color: var(--color-success-30);
    font-weight: var(--font-weight-600);
  }

  .stopBtn {
    background: var(--color-error-20);
    border: 1px solid var(--color-error-30);
    color: var(--color-red);
    padding: var(--spacing-7) var(--spacing-10);
    border-radius: var(--radius-5);
    cursor: pointer;
    font-family: inherit;
    display: flex;
    align-items: center;
    gap: var(--spacing-5);
    transition: var(--transition-background);
  }

  .stopBtn:hover {
    background: var(--color-error-30);
  }

  .pendingButton {
    background: var(--color-warning-20);
    border: 1px solid var(--color-warning-30);
    color: var(--color-orange);
    padding: var(--spacing-7) var(--spacing-10);
    border-radius: var(--radius-5);
    text-align: center;
    font-weight: var(--font-weight-500);
  }

  .queueActions, .defaultActions {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-5);
  }

  .addToQueueBtn {
    background: var(--color-info-20);
    border: 1px solid var(--color-info-30);
    color: var(--color-blue);
    padding: var(--spacing-7) var(--spacing-10);
    border-radius: var(--radius-5);
    cursor: pointer;
    font-family: inherit;
    display: flex;
    align-items: center;
    gap: var(--spacing-5);
    transition: var(--transition-background);
  }

  .addToQueueBtn:hover {
    background: var(--color-info-30);
  }

  .removeFromQueueBtn {
    background: var(--color-warning-20);
    border: 1px solid var(--color-warning-30);
    color: var(--color-orange);
    padding: var(--spacing-7) var(--spacing-10);
    border-radius: var(--radius-5);
    cursor: pointer;
    font-family: inherit;
    display: flex;
    align-items: center;
    gap: var(--spacing-5);
    transition: var(--transition-background);
  }

  .removeFromQueueBtn:hover {
    background: var(--color-warning-30);
  }

  .watchBtn {
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
    transition: var(--transition-background);
  }

  .watchBtn:hover {
    background: var(--color-success-30);
  }

  .accessDenied {
    color: var(--color-error);
    text-align: center;
    padding: var(--spacing-10);
    font-weight: var(--font-weight-500);
  }

  .loading {
    color: var(--color-warning);
    text-align: center;
    padding: var(--spacing-20);
    font-weight: var(--font-weight-500);
  }

  .error {
    background: var(--color-error-10);
    border: 1px solid var(--color-error-30);
    color: var(--color-red);
    padding: var(--spacing-10);
    margin: var(--spacing-10) 2.4875vw;
    border-radius: var(--radius-5);
    font-size: var(--font-9);
  }

  button :global(svg) {
    width: 16px;
    height: 16px;
  }
</style>
