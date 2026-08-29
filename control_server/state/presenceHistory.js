import fs from 'fs/promises';
import path from 'path';
import { normalizeHeadsetId } from '../utils/viewerIdentity.js';

const SERVICE_WINDOW_START_HOUR = 8;
const SERVICE_WINDOW_END_HOUR = 22;
const RETENTION_DAYS = 7;
const SIGNIFICANT_DISCONNECT_SECONDS = 30;

const clientKey = (location, id) => `${location}:${normalizeHeadsetId(id)}`;

const timestampValue = (value) => {
  const timestamp = value ? new Date(value).getTime() : Number.NaN;
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const latestTimestamp = (...values) => values
  .filter(Boolean)
  .sort((first, second) => timestampValue(second) - timestampValue(first))[0] || null;

const localDateKey = (date) => [
  date.getFullYear(),
  String(date.getMonth() + 1).padStart(2, '0'),
  String(date.getDate()).padStart(2, '0'),
].join('-');

const createConnectionStats = (date) => ({
  dateKey: localDateKey(date),
  disconnectCount: 0,
  significantDisconnectCount: 0,
  continuousSince: null,
  lastDisconnectAt: null,
  lastDisconnectDurationSeconds: null,
  lastDisconnectWasSignificant: false,
  lastReconnectAt: null,
});

const normalizeConnectionStats = (stats, date) => {
  if (!stats || stats.dateKey !== localDateKey(date)) {
    return createConnectionStats(date);
  }

  return {
    ...createConnectionStats(date),
    ...stats,
    disconnectCount: Math.max(0, Number(stats.disconnectCount) || 0),
    significantDisconnectCount: Math.max(0, Number(stats.significantDisconnectCount) || 0),
  };
};

const normalizePersistedRecord = (record) => ({
  ...record,
  id: normalizeHeadsetId(record.id),
  offlineSince: record.offlineSince || record.lastSeenAt || null,
});

const mergePersistedRecords = (first, second) => {
  if (!first) return second;

  const latest = timestampValue(second.lastSeenAt) >= timestampValue(first.lastSeenAt)
    ? second
    : first;

  return {
    ...latest,
    id: normalizeHeadsetId(latest.id),
    lastSeenAt: latestTimestamp(first.lastSeenAt, second.lastSeenAt),
    lastSeenInServiceWindowAt: latestTimestamp(
      first.lastSeenInServiceWindowAt,
      second.lastSeenInServiceWindowAt,
    ),
    offlineSince: latest.offlineSince || latest.lastSeenAt || null,
  };
};

const getServiceWindow = (now = new Date()) => {
  const start = new Date(now);
  start.setHours(SERVICE_WINDOW_START_HOUR, 0, 0, 0);

  const end = new Date(now);
  end.setHours(SERVICE_WINDOW_END_HOUR, 0, 0, 0);

  return {
    start,
    end,
    effectiveEnd: new Date(Math.min(now.getTime(), end.getTime())),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'server-local',
  };
};

const isInsideServiceWindow = (date, window) => (
  date.getTime() >= window.start.getTime()
  && date.getTime() <= window.end.getTime()
);

const snapshotClient = (client) => ({
  location: client.location || null,
  id: normalizeHeadsetId(client.id) || null,
  activity: Number.isFinite(client.activity) ? client.activity : null,
  userPresent: Boolean(client.userPresent),
  currentVideoId: client.currentVideoId || null,
  playbackPosition: Number.isFinite(client.playbackPosition) ? client.playbackPosition : null,
  duration: Number.isFinite(client.currentVideoDuration) ? client.currentVideoDuration : null,
  isPlaying: Boolean(client.isPlaying),
});

export class PresenceHistory {
  constructor(filePath = path.join(process.cwd(), 'presence-history.json')) {
    this.filePath = filePath;
    this.records = new Map();
    this.saveTimer = null;
    this.savePromise = Promise.resolve();
    this.readyPromise = this.load();
  }

  async load() {
    try {
      const content = await fs.readFile(this.filePath, 'utf8');
      const savedRecords = JSON.parse(content);

      for (const record of Array.isArray(savedRecords) ? savedRecords : []) {
        if (record?.location && record?.id) {
          // If Node.js stopped before WebSocket close handlers ran, an online
          // record has no offlineSince. On the next start it is offline until
          // the headset reconnects, so use the last heartbeat as the boundary.
          const normalizedRecord = normalizePersistedRecord(record);
          const key = clientKey(normalizedRecord.location, normalizedRecord.id);
          this.records.set(
            key,
            mergePersistedRecords(this.records.get(key), normalizedRecord),
          );
        }
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('Failed to load presence history:', error);
      }
    }
  }

  async markOnline(client, at = new Date()) {
    await this.readyPromise;

    const key = clientKey(client.location, client.id);
    const previous = this.records.get(key) || {};
    const window = getServiceWindow(at);
    const connectionStats = normalizeConnectionStats(previous.connectionStats, at);
    const previousOfflineSince = previous.offlineSince;

    if (previousOfflineSince) {
      const disconnectDurationSeconds = Math.max(
        0,
        Math.round((at.getTime() - timestampValue(previousOfflineSince)) / 1000),
      );
      const belongsToCurrentShift = connectionStats.lastDisconnectAt
        && timestampValue(connectionStats.lastDisconnectAt) === timestampValue(previousOfflineSince);

      connectionStats.lastReconnectAt = at.toISOString();
      connectionStats.continuousSince = at.toISOString();

      if (belongsToCurrentShift) {
        const isSignificant = disconnectDurationSeconds >= SIGNIFICANT_DISCONNECT_SECONDS;
        connectionStats.lastDisconnectDurationSeconds = disconnectDurationSeconds;
        connectionStats.lastDisconnectWasSignificant = isSignificant;

        if (isSignificant) {
          connectionStats.significantDisconnectCount += 1;
        }
      }
    } else if (!connectionStats.continuousSince) {
      connectionStats.continuousSince = at.toISOString();
    }

    const record = {
      ...previous,
      ...snapshotClient(client),
      lastSeenAt: at.toISOString(),
      offlineSince: null,
      connectionStats,
    };

    if (isInsideServiceWindow(at, window)) {
      record.lastSeenInServiceWindowAt = at.toISOString();
    }

    this.records.set(key, record);
    this.prune(at);
    this.scheduleSave();
  }

  async markOffline(client, at = new Date()) {
    await this.readyPromise;

    const key = clientKey(client.location, client.id);
    const previous = this.records.get(key) || {};
    const window = getServiceWindow(at);
    const connectionStats = normalizeConnectionStats(previous.connectionStats, at);

    if (isInsideServiceWindow(at, window)) {
      connectionStats.disconnectCount += 1;
      connectionStats.lastDisconnectAt = at.toISOString();
      connectionStats.lastDisconnectDurationSeconds = null;
      connectionStats.lastDisconnectWasSignificant = false;
    }

    const record = {
      ...previous,
      ...snapshotClient(client),
      lastSeenAt: at.toISOString(),
      offlineSince: at.toISOString(),
      connectionStats,
    };

    if (isInsideServiceWindow(at, window)) {
      record.lastSeenInServiceWindowAt = at.toISOString();
    }

    this.records.set(key, record);
    this.prune(at);
    this.scheduleSave(0);
  }

  async getOfflineForCurrentWindow(onlineClients, now = new Date()) {
    await this.readyPromise;

    const window = getServiceWindow(now);
    const onlineKeys = new Set(
      onlineClients.map((client) => clientKey(client.location, client.id)),
    );

    const offline = [...this.records.entries()]
      .filter(([key, record]) => {
        if (onlineKeys.has(key) || !record.offlineSince || !record.lastSeenInServiceWindowAt) {
          return false;
        }

        const lastSeenInWindow = new Date(record.lastSeenInServiceWindowAt);
        return lastSeenInWindow.getTime() >= window.start.getTime()
          && lastSeenInWindow.getTime() <= window.effectiveEnd.getTime();
      })
      .map(([, record]) => record)
      .sort((a, b) => new Date(b.offlineSince) - new Date(a.offlineSince));

    return {
      offline,
      window: {
        start: window.start.toISOString(),
        end: window.end.toISOString(),
        effectiveEnd: window.effectiveEnd.toISOString(),
        timezone: window.timezone,
      },
    };
  }

  async getConnectionHealth(onlineClients, now = new Date()) {
    await this.readyPromise;

    const window = getServiceWindow(now);
    const onlineByKey = new Map(
      onlineClients.map((client) => [clientKey(client.location, client.id), client]),
    );
    const keys = new Set([...this.records.keys(), ...onlineByKey.keys()]);
    const health = [];

    for (const key of keys) {
      const client = onlineByKey.get(key) || null;
      const record = this.records.get(key) || (client ? snapshotClient(client) : null);
      if (!record) continue;

      const lastSeenInWindow = record.lastSeenInServiceWindowAt
        ? new Date(record.lastSeenInServiceWindowAt)
        : null;
      const seenInCurrentWindow = lastSeenInWindow
        && lastSeenInWindow.getTime() >= window.start.getTime()
        && lastSeenInWindow.getTime() <= window.effectiveEnd.getTime();

      if (!client && !seenInCurrentWindow) continue;

      const connectionStats = normalizeConnectionStats(record.connectionStats, now);
      const clientConnectedAt = client?.connectionTimestamp || null;
      const latestConnectionStart = latestTimestamp(
        connectionStats.continuousSince,
        clientConnectedAt,
      );
      const continuousStartTimestamp = client
        ? Math.max(timestampValue(latestConnectionStart), window.start.getTime())
        : 0;
      const offlineSince = client ? null : record.offlineSince;
      const offlineDurationSeconds = offlineSince
        ? Math.max(0, Math.round((now.getTime() - timestampValue(offlineSince)) / 1000))
        : null;
      const currentDisconnectIsSignificant = Boolean(
        offlineSince
        && connectionStats.lastDisconnectAt
        && timestampValue(connectionStats.lastDisconnectAt) === timestampValue(offlineSince)
        && !connectionStats.lastDisconnectWasSignificant
        && offlineDurationSeconds >= SIGNIFICANT_DISCONNECT_SECONDS
      );
      const rawLastSeenAt = client?.lastSeenAt || record.lastSeenAt || null;

      health.push({
        location: record.location || client?.location || null,
        id: normalizeHeadsetId(record.id || client?.id) || null,
        isOnline: Boolean(client),
        continuousSince: continuousStartTimestamp
          ? new Date(continuousStartTimestamp).toISOString()
          : null,
        continuousSeconds: continuousStartTimestamp
          ? Math.max(0, Math.round((now.getTime() - continuousStartTimestamp) / 1000))
          : null,
        disconnectCount: connectionStats.disconnectCount,
        significantDisconnectCount: connectionStats.significantDisconnectCount
          + (currentDisconnectIsSignificant ? 1 : 0),
        lastDisconnectAt: connectionStats.lastDisconnectAt,
        lastDisconnectDurationSeconds: offlineSince
          && timestampValue(connectionStats.lastDisconnectAt) === timestampValue(offlineSince)
          ? offlineDurationSeconds
          : connectionStats.lastDisconnectDurationSeconds,
        lastReconnectAt: connectionStats.lastReconnectAt,
        lastSeenAt: rawLastSeenAt ? new Date(rawLastSeenAt).toISOString() : null,
        lastDataAgeSeconds: rawLastSeenAt
          ? Math.max(0, Math.round((now.getTime() - timestampValue(rawLastSeenAt)) / 1000))
          : null,
        offlineSince,
        offlineDurationSeconds,
      });
    }

    return health.sort((first, second) => {
      if (first.isOnline !== second.isOnline) return first.isOnline ? 1 : -1;
      if (first.disconnectCount !== second.disconnectCount) {
        return second.disconnectCount - first.disconnectCount;
      }

      return `${first.location}:${first.id}`.localeCompare(
        `${second.location}:${second.id}`,
        undefined,
        { numeric: true },
      );
    });
  }

  prune(now = new Date()) {
    const threshold = now.getTime() - (RETENTION_DAYS * 24 * 60 * 60 * 1000);

    for (const [key, record] of this.records.entries()) {
      if (!record.lastSeenAt || new Date(record.lastSeenAt).getTime() < threshold) {
        this.records.delete(key);
      }
    }
  }

  scheduleSave(delay = 1000) {
    if (this.saveTimer) {
      // Heartbeats can arrive more often than once per second. Keep the first
      // scheduled write instead of postponing it forever on every heartbeat.
      if (delay > 0) {
        return;
      }

      clearTimeout(this.saveTimer);
    }

    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.queueSave().catch((error) => {
        console.error('Failed to save presence history:', error);
      });
    }, delay);
  }

  queueSave() {
    this.savePromise = this.savePromise
      .catch(() => undefined)
      .then(() => this.save());

    return this.savePromise;
  }

  cancelScheduledSave() {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
  }

  async flush() {
    await this.readyPromise;
    this.cancelScheduledSave();
    await this.queueSave();
  }

  dispose() {
    this.cancelScheduledSave();
  }

  async save() {
    const temporaryPath = `${this.filePath}.${process.pid}.tmp`;
    const records = JSON.stringify([...this.records.values()], null, 2);

    await fs.writeFile(temporaryPath, records, 'utf8');
    await fs.rename(temporaryPath, this.filePath);
  }
}
