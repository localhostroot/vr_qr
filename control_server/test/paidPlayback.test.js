import assert from 'node:assert/strict';
import test from 'node:test';

import {
  checkViewerFilmAccess,
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
  let requestData = null;
  const fetchImplementation = async (url, options) => {
    requestData = { url, options };
    return {
      ok: true,
      async json() {
        return {
          valid: true,
          film_valid: true,
          payment_confirmed: true,
          viewer_id: 'CDH/30',
        };
      },
    };
  };

  const authorization = await verifyPaidAccess(
    'paid-token',
    'film-1',
    'CDH/30',
    fetchImplementation,
  );
  assert.equal(authorization.viewerId, 'CDH/30');
  assert.equal(requestData.options.method, 'POST');
  assert.deepEqual(JSON.parse(requestData.options.body), {
    token: 'paid-token',
    film_id: 'film-1',
    user_id: 'CDH/30',
  });
});

test('headset can classify paid film access without authorizing playback', async () => {
  const fetchImplementation = async (url, options) => ({
    ok: true,
    async json() {
      const payload = JSON.parse(options.body);
      return {
        success: true,
        valid: payload.film_id === 'film-paid',
        paid: payload.film_id === 'film-paid',
        free_access: false,
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
  assert.equal(paid.freeAccess, false);
  assert.equal(paid.authorization, null);
  assert.equal(unpaid.available, true);
  assert.equal(unpaid.paid, false);
  assert.equal(unpaid.freeAccess, false);
});

test('free headset access carries an authorization for direct playback', async () => {
  const fetchImplementation = async () => ({
    ok: true,
    async json() {
      return {
        success: true,
        valid: true,
        paid: false,
        free_access: true,
        viewer_id: 'VDNH/40',
      };
    },
  });

  const access = await checkViewerFilmAccess(
    { ...createClient(), id: '40', location: 'VDNH' },
    'film-free',
    fetchImplementation,
  );

  assert.equal(access.paid, false);
  assert.equal(access.freeAccess, true);
  assert.equal(access.authorization.viewerId, 'VDNH/40');
});

test('headset access requests canonicalize zero-padded numeric ids', async () => {
  let requestBody = null;
  const fetchImplementation = async (url, options) => {
    requestBody = JSON.parse(options.body);
    return {
      ok: true,
      async json() {
        return {
          success: true,
          valid: true,
          paid: true,
          free_access: false,
          viewer_id: requestBody.user_id,
        };
      },
    };
  };

  const access = await checkViewerFilmAccess(
    { ...createClient(), id: '02', location: 'VDNH' },
    'film-paid',
    fetchImplementation,
  );

  assert.equal(access.paid, true);
  assert.equal(access.freeAccess, false);
  assert.equal(access.authorization, null);
  assert.equal(requestBody.user_id, 'VDNH/2');
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
