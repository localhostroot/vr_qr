<script>
  // @ts-nocheck
  import { globals } from '$lib/stores/+stores.svelte.js';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { PUBLIC_DATABASE } from '$env/static/public';
  import { getSubfolder } from '$lib/utils/+helpers.svelte';
  import { formatHeadsetId, normalizeViewerClient } from '$lib/utils/viewerIdentity.js';

  let overview = $derived(globals.get('vrOverview'));
  let legacyClients = $derived(globals.get('clients'));
  let isLoading = $derived(globals.get('isClientsLoading'));
  let clientsError = $derived(globals.get('clientsError'));
  let waiting = $derived(overview?.waiting ?? legacyClients ?? []);
  let watching = $derived(overview?.watching ?? []);
  let offline = $derived(overview?.offline ?? []);
  let connectionHealth = $derived(overview?.connectionHealth ?? []);
  let dailyDisconnects = $derived(
    connectionHealth.reduce((total, client) => total + (Number(client?.disconnectCount) || 0), 0)
  );
  let contentById = $state({});

  function selectClient(location, id) {
    const client = normalizeViewerClient({ location, id });
    globals.set('currentClient', client);
    goto(`${getSubfolder()}/${encodeURIComponent(client.location)}/${encodeURIComponent(formatHeadsetId(client.id))}`);
  }

  function formatDuration(seconds) {
    const value = Number(seconds);
    if (!Number.isFinite(value) || value < 0) return '00:00';

    const rounded = Math.round(value);
    const hours = Math.floor(rounded / 3600);
    const minutes = Math.floor((rounded % 3600) / 60);
    const remainingSeconds = rounded % 60;

    if (hours > 0) {
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
    }

    return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
  }

  function formatConnectionDuration(seconds) {
    const value = Number(seconds);
    if (!Number.isFinite(value) || value < 0) return '—';

    const totalSeconds = Math.round(value);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const remainingSeconds = totalSeconds % 60;
    const time = [hours, minutes, remainingSeconds]
      .map((part) => String(part).padStart(2, '0'))
      .join(':');

    return days > 0 ? `${days} д. ${time}` : time;
  }

  function formatLastDataAge(seconds) {
    const value = Number(seconds);
    if (!Number.isFinite(value) || value < 0) return 'нет данных';
    if (value < 5) return 'только что';
    if (value < 60) return `${Math.round(value)} сек. назад`;
    if (value < 3600) return `${Math.round(value / 60)} мин. назад`;
    return `${Math.round(value / 3600)} ч. назад`;
  }

  function formatServerTime(timestamp) {
    if (!timestamp) return '—';

    const timezone = overview?.serviceWindow?.timezone;
    const options = {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    };

    if (timezone && timezone !== 'server-local') {
      options.timeZone = timezone;
    }

    try {
      return new Intl.DateTimeFormat('ru-RU', options).format(new Date(timestamp));
    } catch {
      return new Intl.DateTimeFormat('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(new Date(timestamp));
    }
  }

  function getContent(client) {
    return client?.currentVideoId ? contentById[client.currentVideoId] : null;
  }

  function getContentTitle(client) {
    return getContent(client)?.title || client?.currentVideoId || 'Получаем название фильма…';
  }

  function getTotalDuration(client) {
    if (Number.isFinite(client?.duration)) {
      return formatDuration(client.duration);
    }

    return getContent(client)?.duration || null;
  }

  async function loadContentIndex() {
    const results = await Promise.allSettled([
      fetch(`${PUBLIC_DATABASE}api/category/`).then((response) => {
        if (!response.ok) throw new Error(`Categories: ${response.status}`);
        return response.json();
      }),
      fetch(`${PUBLIC_DATABASE}api/movie/`).then((response) => {
        if (!response.ok) throw new Error(`Movies: ${response.status}`);
        return response.json();
      }),
    ]);

    const index = {};
    for (const result of results) {
      if (result.status !== 'fulfilled' || !Array.isArray(result.value)) continue;

      for (const item of result.value) {
        if (!item?.film_id) continue;
        index[item.film_id] = {
          title: item.name || item.title || item.name_short || item.film_id,
          duration: item.time || item.timer || null,
        };
      }
    }

    contentById = index;
  }

  onMount(() => {
    loadContentIndex().catch((error) => {
      console.error('Не удалось загрузить названия фильмов:', error);
    });
  });
</script>

<div class="wrapper">
  <main class="overview">
    <div class="overview-heading">
      <div>
        <h1>Состояние VR-очков</h1>
        <p>Обновляется автоматически без перезагрузки страницы</p>
      </div>
      {#if overview?.serverTime}
        <div class="last-update">Данные на {formatServerTime(overview.serverTime)}</div>
      {/if}
    </div>

    {#if clientsError}
      <div class="connection-notice">Связь с сервером восстанавливается. Показаны последние полученные данные.</div>
    {/if}

    {#if isLoading && !overview}
      <div class="loading">Загружаем состояние VR-систем…</div>
    {:else}
      <section class="status-section">
        <div class="section-heading">
          <div>
            <h2>Очки в ожидании</h2>
            <p>Свободны и доступны для выбора</p>
          </div>
          <span class="count waiting-count">{waiting.length}</span>
        </div>

        {#if waiting.length > 0}
          <div class="vr-grid">
            {#each waiting as client}
              <button class="vr-card waiting-card" onclick={() => selectClient(client.location, client.id)}>
                <span class="client-number">{client.location}:{formatHeadsetId(client.id)}</span>
                <span class="status waiting-status">Ожидание</span>
                {#if client.currentUptime}
                  <span class="meta">Онлайн {client.currentUptime}</span>
                {/if}
              </button>
            {/each}
          </div>
        {:else}
          <div class="empty-state">Сейчас нет свободных очков</div>
        {/if}
      </section>

      <section class="status-section">
        <div class="section-heading">
          <div>
            <h2>Сейчас смотрят</h2>
            <p>Очки с активным воспроизведением</p>
          </div>
          <span class="count watching-count">{watching.length}</span>
        </div>

        {#if watching.length > 0}
          <div class="vr-grid">
            {#each watching as client}
              <article class="vr-card watching-card">
                <span class="client-number">{client.location}:{formatHeadsetId(client.id)}</span>
                <span class="status watching-status">
                  {client.activity !== 1 ? 'Запускается' : client.isPlaying ? 'Просмотр' : 'Пауза'}
                </span>
                <strong class="content-title">{getContentTitle(client)}</strong>
                <span class="timing">
                  {formatDuration(client.playbackPosition)}
                  {#if getTotalDuration(client)} / {getTotalDuration(client)}{/if}
                </span>
              </article>
            {/each}
          </div>
        {:else}
          <div class="empty-state">Сейчас никто не смотрит</div>
        {/if}
      </section>

      <section class="status-section">
        <div class="section-heading">
          <div>
            <h2>Сегодня были онлайн, сейчас отключены</h2>
            <p>
              Активность с 08:00 до 22:00 по времени сервера
              {#if overview?.serviceWindow?.timezone} ({overview.serviceWindow.timezone}){/if}
            </p>
          </div>
          <span class="count offline-count">{offline.length}</span>
        </div>

        {#if offline.length > 0}
          <div class="vr-grid">
            {#each offline as client}
              <article class="vr-card offline-card">
                <span class="client-number">{client.location}:{formatHeadsetId(client.id)}</span>
                <span class="status offline-status">Не в сети</span>
                <span class="meta">Последний раз в смене: {formatServerTime(client.lastSeenInServiceWindowAt)}</span>
                {#if client.currentVideoId}
                  <strong class="content-title">Смотрели: {getContentTitle(client)}</strong>
                  <span class="timing">На отметке {formatDuration(client.playbackPosition)}</span>
                {/if}
              </article>
            {/each}
          </div>
        {:else}
          <div class="empty-state">За текущую смену отключившихся очков нет</div>
        {/if}
      </section>

      <section class="status-section">
        <div class="section-heading">
          <div>
            <h2>Стабильность связи</h2>
            <p>Диагностика WebSocket-соединений за текущую смену</p>
          </div>
          <span class="count health-count" title="Отключений за смену">{dailyDisconnects}</span>
        </div>

        {#if connectionHealth.length > 0}
          <div class="vr-grid health-grid">
            {#each connectionHealth as client}
              <article class="vr-card health-card" class:health-card-offline={!client.isOnline}>
                <span class="client-number">{client.location}:{formatHeadsetId(client.id)}</span>
                <span
                  class="status"
                  class:health-online-status={client.isOnline}
                  class:offline-status={!client.isOnline}
                >
                  {client.isOnline ? 'В сети' : 'Не в сети'}
                </span>
                {#if client.isOnline}
                  <span class="meta">Непрерывно: {formatConnectionDuration(client.continuousSeconds)}</span>
                {:else}
                  <span class="meta">Отключены: {formatConnectionDuration(client.offlineDurationSeconds)}</span>
                {/if}
                <span class="health-metric">
                  Отключений: {client.disconnectCount ?? 0}
                  · дольше 30 сек.: {client.significantDisconnectCount ?? 0}
                </span>
                <span class="meta">Последние данные: {formatLastDataAge(client.lastDataAgeSeconds)}</span>
                {#if client.lastDisconnectAt}
                  <span class="meta">
                    Последний обрыв: {formatServerTime(client.lastDisconnectAt)}
                    {#if Number.isFinite(client.lastDisconnectDurationSeconds)}
                      · {formatConnectionDuration(client.lastDisconnectDurationSeconds)}
                    {/if}
                  </span>
                {/if}
              </article>
            {/each}
          </div>
        {:else}
          <div class="empty-state">В текущую смену данные о соединениях ещё не поступали</div>
        {/if}
      </section>
    {/if}
  </main>
</div>

<style>
  .wrapper {
    min-height: 100vh;
    background: var(--color-dark-primary);
    color: white;
  }

  .overview {
    width: min(1180px, calc(100% - 32px));
    margin: 0 auto;
    padding: 24px 0 48px;
    font-family: 'Montserrat', sans-serif;
  }

  .overview-heading,
  .section-heading {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 20px;
  }

  .overview-heading { margin-bottom: 24px; }
  h1, h2, p { margin: 0; }
  h1 { font-size: clamp(24px, 4vw, 36px); }
  h2 { font-size: clamp(18px, 3vw, 24px); }

  p,
  .last-update,
  .meta {
    color: rgba(255, 255, 255, 0.58);
  }

  .overview-heading p,
  .section-heading p {
    margin-top: 6px;
    font-size: 13px;
  }

  .last-update {
    padding-top: 7px;
    font-size: 12px;
    white-space: nowrap;
  }

  .connection-notice {
    margin-bottom: 20px;
    padding: 12px 16px;
    border: 1px solid rgba(255, 184, 77, 0.35);
    border-radius: 10px;
    background: rgba(255, 184, 77, 0.08);
    color: #ffd18b;
    font-size: 13px;
  }

  .status-section {
    margin-bottom: 22px;
    padding: 20px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.025);
  }

  .section-heading { margin-bottom: 16px; }

  .count {
    min-width: 34px;
    padding: 6px 10px;
    border-radius: 999px;
    text-align: center;
    font-weight: 700;
  }

  .waiting-count { background: rgba(80, 200, 120, 0.16); color: #72dc98; }
  .watching-count { background: rgba(99, 140, 255, 0.16); color: #8cafff; }
  .offline-count { background: rgba(255, 255, 255, 0.08); color: rgba(255, 255, 255, 0.62); }
  .health-count { background: rgba(255, 184, 77, 0.14); color: #ffd18b; }

  .vr-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
    gap: 12px;
  }

  .vr-card {
    position: relative;
    min-width: 0;
    padding: 16px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    background: #1e1e1e;
    color: white;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 7px;
    text-align: left;
    font: inherit;
  }

  button.vr-card {
    cursor: pointer;
    transition: transform 0.18s ease, border-color 0.18s ease;
  }

  button.vr-card:hover {
    transform: translateY(-2px);
    border-color: rgba(114, 220, 152, 0.55);
  }

  .client-number { font-size: 17px; font-weight: 700; }

  .status {
    position: absolute;
    top: 16px;
    right: 16px;
    padding: 4px 8px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 700;
    white-space: nowrap;
  }

  .waiting-status { color: #72dc98; background: rgba(80, 200, 120, 0.12); }
  .watching-status { color: #8cafff; background: rgba(99, 140, 255, 0.12); }
  .offline-status { color: rgba(255, 255, 255, 0.55); background: rgba(255, 255, 255, 0.06); }
  .health-online-status { color: #72dc98; background: rgba(80, 200, 120, 0.12); }
  .health-card-offline { border-color: rgba(255, 184, 77, 0.22); }
  .health-metric { color: rgba(255, 255, 255, 0.82); font-size: 12px; }

  .content-title { overflow-wrap: anywhere; line-height: 1.35; }
  .timing { color: rgba(255, 255, 255, 0.78); font-variant-numeric: tabular-nums; }
  .meta { font-size: 12px; }

  .empty-state,
  .loading {
    padding: 24px 12px;
    color: rgba(255, 255, 255, 0.48);
    text-align: center;
    font-size: 13px;
  }

  @media (max-width: 640px) {
    .overview {
      width: min(100% - 20px, 1180px);
      padding-top: 16px;
    }

    .overview-heading { flex-direction: column; gap: 8px; }
    .last-update { padding-top: 0; }
    .status-section { padding: 15px; }
    .vr-grid { grid-template-columns: 1fr 1fr; gap: 9px; }
    .vr-card { padding: 13px; }
    .status { top: 13px; right: 13px; }
  }

  @media (max-width: 430px) {
    .vr-grid { grid-template-columns: 1fr; }
  }
</style>
