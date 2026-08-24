import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ensurePaidPlaybackSession,
  finalizePaidPlaybackSession,
  markPaidAuthorization,
  updatePaidPlaybackSession,
  verifyPaidAccess,
} from '../services/paidPlayback.js';

const createClient = () => ({
  id: '30',
  location: 'CDH',
  paidAuthorizations: {},
  activePlaybackSession: null,
});

test('payment verification requires confirmed access to the requested film', async () => {
  const fetchImplementation = async () => ({
    ok: true,
    async json() {
      return {
        valid: true,
        film_valid: true,
        payment_confirmed: true,
        viewer_id: 'CDH/30',
      };
    },
  });

  const authorization = await verifyPaidAccess('paid-token', 'film-1', fetchImplementation);
  assert.equal(authorization.viewerId, 'CDH/30');
});

test('an unpaid headset playback does not create a statistics session', () => {
  const client = createClient();
  const events = [];

  const session = ensurePaidPlaybackSession(client, 'film-1', 0, async (event) => {
    events.push(event);
  });

  assert.equal(session, null);
  assert.deepEqual(events, []);
});

test('one paid playback reports one start and one final event', async () => {
  const client = createClient();
  const events = [];
  const reporter = async (event) => {
    events.push(event);
  };

  markPaidAuthorization(client, 'film-1', { verifiedAt: 0 });
  const session = ensurePaidPlaybackSession(client, 'film-1', 0, reporter);
  const duplicate = ensurePaidPlaybackSession(client, 'film-1', 1_000, reporter);

  assert.equal(duplicate.sessionId, session.sessionId);
  assert.equal(events.length, 1);
  assert.equal(events[0].event, 'start');

  updatePaidPlaybackSession(
    client,
    { isPlaying: true, playbackPosition: 0, duration: 100 },
    0,
  );
  updatePaidPlaybackSession(
    client,
    { isPlaying: false, playbackPosition: 21, duration: 100 },
    21_000,
  );
  await finalizePaidPlaybackSession(client, 'stopped', 21_000, reporter);

  assert.equal(events.length, 2);
  assert.equal(events[1].event, 'finish');
  assert.equal(events[1].session_id, events[0].session_id);
  assert.equal(events[1].playback_position, 21);
  assert.equal(events[1].duration, 100);
  assert.equal(events[1].played_seconds, 21);
  assert.equal(events[1].end_reason, 'stopped');
  assert.equal(client.activePlaybackSession, null);
});
