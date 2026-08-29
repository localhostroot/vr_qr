import assert from 'node:assert/strict';
import test from 'node:test';

import {
  migratePresenceRecords,
  migrateUptimeRecords,
} from '../scripts/migrateHeadsetIdentity.js';

test('presence migration keeps the latest state and one canonical id', () => {
  const result = migratePresenceRecords([
    { location: 'VDNH', id: '01', lastSeenAt: '2026-08-28T09:00:00Z', activity: 1 },
    { location: 'VDNH', id: '1', lastSeenAt: '2026-08-28T11:00:00Z', activity: 2 },
    { location: 'VDNH', id: '8', lastSeenAt: '2026-08-28T10:00:00Z', activity: 1 },
  ]);

  assert.equal(result.summary.before, 3);
  assert.equal(result.summary.after, 2);
  assert.deepEqual(result.summary.aliasGroups, [
    { key: 'VDNH:1', aliases: ['01', '1'] },
  ]);
  assert.deepEqual(
    result.data.find((record) => record.id === '1'),
    {
      location: 'VDNH',
      id: '1',
      lastSeenAt: '2026-08-28T11:00:00Z',
      lastSeenInServiceWindowAt: null,
      offlineSince: '2026-08-28T11:00:00Z',
      activity: 2,
    },
  );
});

test('uptime migration combines aliases without losing entries', () => {
  const result = migrateUptimeRecords({
    VDNH_1: ['01:00:00'],
    VDNH_01: ['00:30:00', '00:45:00'],
    VDNH_8: ['00:20:00'],
    demo_headset: ['00:10:00'],
  });

  assert.deepEqual(result.data.VDNH_1, ['01:00:00', '00:30:00', '00:45:00']);
  assert.deepEqual(result.data.VDNH_8, ['00:20:00']);
  assert.deepEqual(result.data.demo_headset, ['00:10:00']);
  assert.equal(result.summary.valuesBefore, result.summary.valuesAfter);
  assert.deepEqual(result.summary.aliasGroups, [
    { key: 'VDNH_1', aliases: ['VDNH_01', 'VDNH_1'] },
  ]);
});
