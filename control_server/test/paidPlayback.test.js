import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PAYMENT_SESSION_IDLE_TIMEOUT_MS,
  checkViewerFilmAccess,
  ensurePaidPlaybackSession,
  finalizePaidPlaybackSession,
  markPaidAuthorization,
  resetViewerPaymentSession,
  updateViewerPresenceTimeout,
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

test('default presence timeout matches the headset 60 second timeout', () => {
  assert.equal(PAYMENT_SESSION_IDLE_TIMEOUT_MS, 60_000);
});

test('session reset request identifies the headset viewer and cutoff time', async () => {
  let requestData = null;
  const endedAt = '2026-08-25T12:00:00.000Z';
  const fetchImplementation = async (url, options) => {
    requestData = { url, options };
    return {
      ok: true,
      async json() {
        return { success: true, deactivated: 1 };
      },
    };
  };

  const success = await resetViewerPaymentSession(
    createClient(),
    endedAt,
    fetchImplementation,
  );

  assert.equal(success, true);
  assert.equal(requestData.options.method, 'POST');
  assert.deepEqual(JSON.parse(requestData.options.body), {
    user_id: 'CDH/30',
    ended_at: endedAt,
  });
});

test('headset can check paid film access without receiving a browser token', async () => {
  const fetchImplementation = async (url, options) => ({
    ok: true,
    async json() {
      const payload = JSON.parse(options.body);
      return {
        success: true,
        valid: payload.film_id === 'film-paid',
        viewer_id: payload.user_id,
      };
    },
  });

  const paid = await checkViewerFilmAccess(
    createClient(),
    'film-paid',
    fetchImplementation,
  );
  const unpaid = await checkViewerFilmAccess(
    createClient(),
    'film-unpaid',
    fetchImplementation,
  );

  assert.equal(paid.available, true);
  assert.equal(paid.paid, true);
  assert.equal(paid.authorization.viewerId, 'CDH/30');
  assert.equal(unpaid.available, true);
  assert.equal(unpaid.paid, false);
});

test('presence timeout starts only after a viewer was detected', async () => {
  const client = {
    ...createClient(),
    userPresent: false,
    queue: ['film-1'],
    pendingQueue: ['film-2'],
    ws: { send() {} },
  };
  let resets = 0;
  const resetSession = async () => {
    resets += 1;
    return true;
  };

  updateViewerPresenceTimeout(client, false, { timeoutMs: 10, resetSession });
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.equal(resets, 0);

  client.userPresent = true;
  updateViewerPresenceTimeout(client, true, { timeoutMs: 10, resetSession });
  client.userPresent = false;
  updateViewerPresenceTimeout(client, false, { timeoutMs: 10, resetSession });
  await new Promise(resolve => setTimeout(resolve, 40));

  assert.equal(resets, 1);
  assert.deepEqual(client.queue, []);
  assert.deepEqual(client.pendingQueue, []);
  assert.equal(client.paymentSessionResetPending, false);
});

test('putting the headset back on cancels a pending presence timeout', async () => {
  const client = {
    ...createClient(),
    userPresent: true,
    ws: { send() {} },
  };
  let resets = 0;
  const resetSession = async () => {
    resets += 1;
    return true;
  };

  updateViewerPresenceTimeout(client, true, { timeoutMs: 25, resetSession });
  client.userPresent = false;
  updateViewerPresenceTimeout(client, false, { timeoutMs: 25, resetSession });
  client.userPresent = true;
  updateViewerPresenceTimeout(client, true, { timeoutMs: 25, resetSession });
  await new Promise(resolve => setTimeout(resolve, 50));

  assert.equal(resets, 0);
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
