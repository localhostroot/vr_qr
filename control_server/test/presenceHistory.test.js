import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { PresenceHistory } from '../state/presenceHistory.js';

const atLocalTime = (dayOffset, hour, minute = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hour, minute, 0, 0);
  return date;
};

test('returns only currently offline glasses seen in today service window', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'vr-presence-'));
  const filePath = path.join(directory, 'presence-history.json');

  try {
    const history = new PresenceHistory(filePath);
    const client = {
      location: 'CDH',
      id: '73',
      activity: 1,
      currentVideoId: 'film-1',
      playbackPosition: 125,
      isPlaying: true,
    };

    await history.markOnline(client, atLocalTime(0, 9));
    await history.markOffline(client, atLocalTime(0, 10));

    const midday = await history.getOfflineForCurrentWindow([], atLocalTime(0, 12));
    assert.equal(midday.offline.length, 1);
    assert.equal(midday.offline[0].currentVideoId, 'film-1');
    assert.equal(midday.offline[0].playbackPosition, 125);

    const onlineAgain = await history.getOfflineForCurrentWindow([client], atLocalTime(0, 12));
    assert.equal(onlineAgain.offline.length, 0);

    const nextDay = await history.getOfflineForCurrentWindow([], atLocalTime(1, 12));
    assert.equal(nextDay.offline.length, 0);

    history.dispose();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('keeps the last state after persistence and server restart', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'vr-presence-'));
  const filePath = path.join(directory, 'presence-history.json');

  try {
    const history = new PresenceHistory(filePath);
    const client = { location: 'CDH', id: '74', activity: 2 };

    await history.markOnline(client, atLocalTime(0, 9));
    await history.markOffline(client, atLocalTime(0, 11));
    await history.flush();

    const restored = new PresenceHistory(filePath);
    const result = await restored.getOfflineForCurrentWindow([], atLocalTime(0, 12));

    assert.equal(result.offline.length, 1);
    assert.equal(result.offline[0].id, '74');

    restored.dispose();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('treats a persisted online record as offline after an unclean restart', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'vr-presence-'));
  const filePath = path.join(directory, 'presence-history.json');

  try {
    const history = new PresenceHistory(filePath);
    const client = { location: 'CDH', id: '76', activity: 2 };

    await history.markOnline(client, atLocalTime(0, 9));
    await history.flush();

    const restored = new PresenceHistory(filePath);
    const result = await restored.getOfflineForCurrentWindow([], atLocalTime(0, 12));

    assert.equal(result.offline.length, 1);
    assert.equal(result.offline[0].id, '76');

    restored.dispose();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('frequent heartbeats do not postpone the pending disk write', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'vr-presence-'));
  const filePath = path.join(directory, 'presence-history.json');

  try {
    const history = new PresenceHistory(filePath);
    const client = { location: 'CDH', id: '77', activity: 2 };

    await history.markOnline(client, atLocalTime(0, 9));
    const firstSaveTimer = history.saveTimer;
    await history.markOnline(client, atLocalTime(0, 9, 1));

    assert.equal(history.saveTimer, firstSaveTimer);
    await history.flush();

    const restored = new PresenceHistory(filePath);
    const result = await restored.getOfflineForCurrentWindow([], atLocalTime(0, 12));
    assert.equal(result.offline[0].id, '77');

    restored.dispose();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('merges persisted zero-padded aliases into one canonical headset', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'vr-presence-'));
  const filePath = path.join(directory, 'presence-history.json');

  try {
    const earlier = atLocalTime(0, 9).toISOString();
    const later = atLocalTime(0, 11).toISOString();
    await writeFile(filePath, JSON.stringify([
      {
        location: 'VDNH',
        id: '01',
        lastSeenAt: earlier,
        lastSeenInServiceWindowAt: earlier,
        offlineSince: earlier,
        currentVideoId: 'old-film',
      },
      {
        location: 'VDNH',
        id: '1',
        lastSeenAt: later,
        lastSeenInServiceWindowAt: later,
        offlineSince: later,
        currentVideoId: 'latest-film',
      },
    ]));

    const history = new PresenceHistory(filePath);
    const result = await history.getOfflineForCurrentWindow([], atLocalTime(0, 12));
    assert.equal(result.offline.length, 1);
    assert.equal(result.offline[0].id, '1');
    assert.equal(result.offline[0].currentVideoId, 'latest-film');

    const online = await history.getOfflineForCurrentWindow(
      [{ location: 'VDNH', id: '01' }],
      atLocalTime(0, 12),
    );
    assert.equal(online.offline.length, 0);
    history.dispose();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
