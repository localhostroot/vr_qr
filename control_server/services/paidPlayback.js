import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { buildViewerId, normalizeHeadsetId } from '../utils/viewerIdentity.js';

const STATISTICS_API_URL = process.env.STATISTICS_API_URL
  || 'https://stats.local.vr360.pro/api/api/update_statistics/';
const MAX_PLAYING_STATE_GAP_SECONDS = 30;
const RECONNECT_GRACE_MS = 30_000;
const PAYMENT_SESSION_RESUME_URL = process.env.PAYMENT_SESSION_RESUME_URL
  || 'http://127.0.0.1:8000/api/tokens/resume_viewer_session/';
const PAYMENT_VIEWER_FILM_ACCESS_URL = process.env.PAYMENT_VIEWER_FILM_ACCESS_URL
  || 'http://127.0.0.1:8000/api/tokens/viewer_film_access/';
const CONTROL_SERVER_SHARED_SECRET = process.env.CONTROL_SERVER_SHARED_SECRET || '';

const suspendedClients = new Map();
const catalogDurations = new Map();

try {
  const gallery = JSON.parse(
    readFileSync(new URL('../configs/gallery.json', import.meta.url), 'utf8'),
  );
  const visit = (value) => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!value || typeof value !== 'object') return;

    const duration = Number(value.duration);
    if (Number.isFinite(duration) && duration > 0) {
      if (value.id) catalogDurations.set(String(value.id), duration);
      if (value.dbContentId) catalogDurations.set(String(value.dbContentId), duration);
    }
    Object.values(value).forEach(visit);
  };
  visit(gallery);
} catch (error) {
  console.error('Не удалось прочитать длительности из gallery.json:', error);
}

const clientKey = (location, clientId) => `${location}:${normalizeHeadsetId(clientId)}`;
const videoKey = (videoId) => String(videoId);
const finiteNonNegative = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
};

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export const verifyPaidAccess = async (
  token,
  videoId,
  viewerId,
  fetchImplementation = fetch,
) => {
  if (!token || !viewerId || videoId === null || videoId === undefined || videoId === '') {
    return null;
  }

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (CONTROL_SERVER_SHARED_SECRET) {
      headers['X-Control-Server-Secret'] = CONTROL_SERVER_SHARED_SECRET;
    }

    const response = await fetchImplementation(PAYMENT_SESSION_RESUME_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        token,
        film_id: String(videoId),
        user_id: viewerId,
      }),
    });
    if (!response.ok) return null;

    const data = await response.json();
    if (!data.valid || !data.film_valid || !data.payment_confirmed) return null;

    return {
      verifiedAt: Date.now(),
      viewerId: data.viewer_id || null,
    };
  } catch (error) {
    console.error('Не удалось проверить оплату перед запуском:', error);
    return null;
  }
};

export const checkViewerFilmAccess = async (
  client,
  filmId,
  fetchImplementation = fetch,
) => {
  if (!client?.location || !client?.id || !filmId) {
    return { available: true, paid: false, freeAccess: false, authorization: null };
  }

  const headers = { 'Content-Type': 'application/json' };
  if (CONTROL_SERVER_SHARED_SECRET) {
    headers['X-Control-Server-Secret'] = CONTROL_SERVER_SHARED_SECRET;
  }

  try {
    const response = await fetchImplementation(PAYMENT_VIEWER_FILM_ACCESS_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        user_id: buildViewerId(client.location, client.id),
        film_id: String(filmId),
      }),
    });

    if (!response.ok) {
      return { available: false, paid: false, freeAccess: false, authorization: null };
    }

    const data = await response.json();
    const valid = data.success === true && data.valid === true;
    const freeAccess = valid && data.free_access === true;
    const paid = valid && !freeAccess && data.paid !== false;
    return {
      available: true,
      paid,
      freeAccess,
      authorization: freeAccess
        ? { verifiedAt: Date.now(), viewerId: data.viewer_id || null }
        : null,
    };
  } catch (error) {
    console.error('Не удалось проверить оплату фильма для очков:', error);
    return { available: false, paid: false, freeAccess: false, authorization: null };
  }
};

export const markPaidAuthorization = (client, videoId, authorization) => {
  if (!authorization) return false;
  if (!client.paidAuthorizations) client.paidAuthorizations = {};
  client.paidAuthorizations[videoKey(videoId)] = authorization;
  return true;
};

export const reportPlaybackEvent = async (payload, fetchImplementation = fetch) => {
  let lastError = null;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetchImplementation(STATISTICS_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`HTTP ${response.status}: ${body}`);
      }

      const data = await response.json();
      console.log(`Статистика сеанса ${payload.session_id}/${payload.event}:`, data);
      return data;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await delay(attempt * 250);
    }
  }

  console.error(`Не удалось записать статистику сеанса ${payload.session_id}/${payload.event}:`, lastError);
  return null;
};

const eventBase = (client, session) => ({
  session_id: session.sessionId,
  client_id: client.id,
  location_name: client.location,
  video_id: session.videoId,
});

export const ensurePaidPlaybackSession = (
  client,
  videoId,
  now = Date.now(),
  reporter = reportPlaybackEvent,
) => {
  if (client.activePlaybackSession?.videoId === videoId) {
    return client.activePlaybackSession;
  }

  const authorization = client.paidAuthorizations?.[videoKey(videoId)];
  if (!authorization) return null;

  const session = {
    sessionId: randomUUID(),
    videoId,
    startedAt: now,
    lastStateAt: now,
    lastIsPlaying: false,
    playedSeconds: 0,
    maxPlaybackPosition: 0,
    duration: catalogDurations.get(videoKey(videoId)) || null,
  };

  client.activePlaybackSession = session;
  delete client.paidAuthorizations[videoKey(videoId)];

  void reporter({
    event: 'start',
    ...eventBase(client, session),
  });

  return session;
};

const accruePlayingTime = (session, now) => {
  if (session.lastIsPlaying && now > session.lastStateAt) {
    const elapsedSeconds = (now - session.lastStateAt) / 1000;
    session.playedSeconds += Math.min(elapsedSeconds, MAX_PLAYING_STATE_GAP_SECONDS);
  }
  session.lastStateAt = now;
};

export const updatePaidPlaybackSession = (client, details, now = Date.now()) => {
  const session = client.activePlaybackSession;
  if (!session) return null;

  accruePlayingTime(session, now);
  session.lastIsPlaying = Boolean(details.isPlaying);
  session.maxPlaybackPosition = Math.max(
    session.maxPlaybackPosition,
    finiteNonNegative(details.playbackPosition),
  );

  const duration = finiteNonNegative(
    details.duration ?? details.videoDuration ?? details.totalDuration,
  );
  if (duration > 0) session.duration = duration;

  return session;
};

export const finalizePaidPlaybackSession = async (
  client,
  endReason,
  now = Date.now(),
  reporter = reportPlaybackEvent,
) => {
  const session = client.activePlaybackSession;
  if (!session) return null;

  accruePlayingTime(session, now);
  session.lastIsPlaying = false;
  client.activePlaybackSession = null;

  await reporter({
    event: 'finish',
    ...eventBase(client, session),
    playback_position: session.maxPlaybackPosition,
    duration: session.duration,
    played_seconds: session.playedSeconds,
    end_reason: endReason,
  });

  return session;
};

const copyPlaybackFields = (target, source) => {
  for (const field of (
    'activePlaybackSession paidAuthorizations queue pendingQueue currentVideoId playbackPosition currentVideoDuration isPlaying playbackTimeCounter lastPlaybackPosition stopRequestedVideoId unblockProtectionUntil'
  ).split(' ')) {
    if (source[field] !== undefined) target[field] = source[field];
  }
};

export const inheritClientPlayback = (target, source) => {
  if (source) copyPlaybackFields(target, source);
  return target;
};

export const suspendClientPlayback = (client) => {
  if (!client?.location || !client?.id) return;

  const key = clientKey(client.location, client.id);
  const existing = suspendedClients.get(key);
  if (existing) clearTimeout(existing.timer);

  const snapshot = {};
  copyPlaybackFields(snapshot, client);
  snapshot.location = client.location;
  snapshot.id = client.id;

  const timer = setTimeout(async () => {
    suspendedClients.delete(key);
    await finalizePaidPlaybackSession(snapshot, 'disconnect_timeout');
  }, RECONNECT_GRACE_MS);
  timer.unref?.();

  suspendedClients.set(key, { snapshot, timer });
};

export const restoreClientPlayback = (client) => {
  const key = clientKey(client.location, client.id);
  const suspended = suspendedClients.get(key);
  if (!suspended) return false;

  clearTimeout(suspended.timer);
  suspendedClients.delete(key);
  copyPlaybackFields(client, suspended.snapshot);
  return true;
};
