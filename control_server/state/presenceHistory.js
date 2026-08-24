import fs from 'fs/promises';
import path from 'path';

const SERVICE_WINDOW_START_HOUR = 8;
const SERVICE_WINDOW_END_HOUR = 22;
const RETENTION_DAYS = 7;

const clientKey = (location, id) => `${location}:${id}`;

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
  id: client.id || null,
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
          this.records.set(clientKey(record.location, record.id), {
            ...record,
            offlineSince: record.offlineSince || record.lastSeenAt || null,
          });
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
    const record = {
      ...previous,
      ...snapshotClient(client),
      lastSeenAt: at.toISOString(),
      offlineSince: null,
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
    const record = {
      ...previous,
      ...snapshotClient(client),
      lastSeenAt: at.toISOString(),
      offlineSince: at.toISOString(),
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
