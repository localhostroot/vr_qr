import assert from 'node:assert/strict';
import test from 'node:test';

import { APIHandler, VRHandler } from '../handlers/index.js';

const originalFetch = globalThis.fetch;

test.before(() => {
  globalThis.fetch = async (url, options = {}) => ({
    ok: true,
    async json() {
      if (options.body) {
        const payload = JSON.parse(options.body);
        if (payload.user_id && payload.film_id) {
          const valid = payload.film_id !== 'film-unpaid';
          const freeAccess = payload.film_id === 'film-free';
          return {
            success: true,
            valid,
            paid: valid && !freeAccess,
            free_access: freeAccess,
            film_valid: valid,
            payment_confirmed: true,
            viewer_id: payload.user_id,
          };
        }
      }
      return {
        valid: true,
        film_valid: true,
        payment_confirmed: true,
        viewer_id: 'museum/7',
      };
    },
  });
});

test.after(() => {
  globalThis.fetch = originalFetch;
});

const createSocket = () => {
  const messages = [];

  return {
    messages,
    readyState: 1,
    send(message) {
      messages.push(JSON.parse(message));
    },
  };
};

const createClient = (overrides = {}) => ({
  id: '7',
  location: 'museum',
  userPresent: true,
  activity: 1,
  currentVideoId: null,
  activePlaybackSession: null,
  queue: [],
  pendingQueue: [],
  ws: createSocket(),
  ...overrides,
});

const request = async (handler, client, payload = {}) => {
  const ws = createSocket();
  await handler(
    ws,
    { connection: { remoteAddress: '127.0.0.1' }, headers: {} },
    {
      clientId: client.id,
      location: client.location,
      videoId: 'film-1',
      token: 'paid-token',
      ...payload,
    },
    [client],
    [],
  );
  return ws;
};

test('repeated immediate watch requests start a film only once', async () => {
  const client = createClient();

  const firstResponse = await request(APIHandler.videoForClient, client);
  const secondResponse = await request(APIHandler.videoForClient, client);
  const thirdResponse = await request(APIHandler.videoForClient, client);

  assert.deepEqual(client.queue, ['film-1']);
  assert.equal(client.ws.messages.length, 1);
  assert.equal(client.ws.messages[0].type, 'videoChangeRequested');
  assert.equal(firstResponse.messages[0].duplicate, undefined);
  assert.equal(secondResponse.messages[0].duplicate, true);
  assert.equal(thirdResponse.messages[0].duplicate, true);
});

test('zero-padded phone route controls the matching canonical headset id', async () => {
  const client = createClient({ id: '2', location: 'VDNH' });
  const response = await request(APIHandler.videoForClient, client, {
    clientId: '02',
    location: 'VDNH',
  });

  assert.deepEqual(client.queue, ['film-1']);
  assert.equal(client.ws.messages[0].type, 'videoChangeRequested');
  assert.equal(response.messages[0].success, true);
  assert.equal(response.messages[0].paymentVerified, true);
});

test('repeated watch requests while the headset is waiting create one pending item', async () => {
  const client = createClient({ userPresent: false, activity: 2 });

  await request(APIHandler.videoForClient, client);
  await request(APIHandler.videoForClient, client);
  await request(APIHandler.videoForClient, client);

  assert.deepEqual(client.pendingQueue, ['film-1']);
  assert.deepEqual(client.queue, []);
  assert.equal(client.ws.messages.length, 0);
});

test('a request for the currently playing film does not restart it', async () => {
  const client = createClient({ currentVideoId: 'film-1', queue: ['film-1'] });
  const response = await request(APIHandler.videoForClient, client);

  assert.deepEqual(client.queue, ['film-1']);
  assert.equal(client.ws.messages.length, 0);
  assert.equal(response.messages[0].duplicate, true);
});

test('stop removes all legacy copies of only the requested film', async () => {
  const client = createClient({
    currentVideoId: 'film-1',
    queue: ['film-1', 'film-1', 'film-2'],
    pendingQueue: ['film-1', 'film-1', 'film-3'],
  });
  const response = await request(APIHandler.stop, client);

  assert.deepEqual(client.queue, ['film-2']);
  assert.deepEqual(client.pendingQueue, ['film-3']);
  assert.equal(client.ws.messages[0].type, 'videoStopRequested');
  assert.equal(response.messages[0].success, true);
});

test('a late playing state after stop does not authorize or block the stopped film', async () => {
  const client = createClient({
    currentVideoId: 'film-1',
    queue: ['film-1'],
  });
  await request(APIHandler.stop, client);

  const headsetSocket = client.ws;
  headsetSocket.location = client.location;
  headsetSocket.userId = client.id;

  await VRHandler.updateState(
    headsetSocket,
    { connection: { remoteAddress: '127.0.0.1' }, headers: {} },
    {
      params: {
        activity: 1,
        userPresent: true,
        details: { videoId: 'film-1', isPlaying: true, playbackPosition: 12 },
      },
    },
    [client],
    [],
  );

  assert.equal(client.missingVideoTimer, null);
  assert.deepEqual(client.queue, []);
});

test('legacy duplicate pending entries are promoted only once', async () => {
  const client = createClient({
    userPresent: true,
    activity: 0,
    pendingQueue: ['film-1', 'film-1'],
  });
  const headsetSocket = client.ws;
  headsetSocket.location = client.location;
  headsetSocket.userId = client.id;

  await VRHandler.updateState(
    headsetSocket,
    { connection: { remoteAddress: '127.0.0.1' }, headers: {} },
    { params: { activity: 0, userPresent: true, details: {} } },
    [client],
    [],
  );

  assert.deepEqual(client.pendingQueue, []);
  assert.deepEqual(client.queue, ['film-1']);
  assert.equal(client.ws.messages.length, 1);
  assert.equal(client.ws.messages[0].type, 'videoChangeRequested');
});

test('watch request is rejected when payment is not confirmed', async () => {
  const client = createClient();
  const response = await request(APIHandler.videoForClient, client, { token: null });

  assert.deepEqual(client.queue, []);
  assert.deepEqual(client.pendingQueue, []);
  assert.equal(client.ws.messages.length, 0);
  assert.equal(response.messages[0].success, false);
  assert.equal(response.messages[0].paymentVerified, false);
});

test('paid film selected in the headset requires an explicit phone start', async () => {
  const client = createClient({ activity: 0, queue: [] });
  const headsetSocket = client.ws;
  headsetSocket.location = client.location;
  headsetSocket.userId = client.id;

  await VRHandler.updateState(
    headsetSocket,
    { connection: { remoteAddress: '127.0.0.1' }, headers: {} },
    {
      params: {
        activity: 1,
        userPresent: true,
        details: { videoId: 'film-paid', isPlaying: true, playbackPosition: 0 },
      },
    },
    [client],
    [],
  );

  assert.deepEqual(client.queue, []);
  assert.deepEqual(client.ws.messages.map(message => message.type), ['videoStopRequested']);

  await VRHandler.updateState(
    headsetSocket,
    { connection: { remoteAddress: '127.0.0.1' }, headers: {} },
    { params: { activity: 0, userPresent: true, details: {} } },
    [client],
    [],
  );

  const blockMessage = client.ws.messages.find(message => message.type === 'resetClient');
  assert.equal(
    blockMessage.data.text,
    'Нажмите «Смотреть» на телефоне, чтобы запустить фильм.',
  );
  assert.equal(client.activePlaybackSession, null);
});

test('free film selected in a free headset still starts directly', async () => {
  const client = createClient({ id: '40', location: 'VDNH', activity: 0, queue: [] });
  const headsetSocket = client.ws;
  headsetSocket.location = client.location;
  headsetSocket.userId = client.id;

  await VRHandler.updateState(
    headsetSocket,
    { connection: { remoteAddress: '127.0.0.1' }, headers: {} },
    {
      params: {
        activity: 1,
        userPresent: true,
        details: { videoId: 'film-free', isPlaying: true, playbackPosition: 0 },
      },
    },
    [client],
    [],
  );

  assert.deepEqual(client.queue, ['film-free']);
  assert.equal(client.ws.messages.some(message => message.type === 'resetClient'), false);
  assert.equal(client.activePlaybackSession.videoId, 'film-free');
});

test('headset lock clears one launch but the phone can launch the paid film again', async () => {
  const client = createClient({ activity: 0, queue: [] });
  const headsetSocket = client.ws;
  headsetSocket.location = client.location;
  headsetSocket.userId = client.id;

  const firstPhoneResponse = await request(APIHandler.videoForClient, client);
  assert.equal(firstPhoneResponse.messages[0].success, true);
  assert.deepEqual(client.queue, ['film-1']);

  await VRHandler.updateState(
    headsetSocket,
    { connection: { remoteAddress: '127.0.0.1' }, headers: {} },
    {
      params: {
        activity: 1,
        userPresent: true,
        details: { videoId: 'film-1', isPlaying: true, playbackPosition: 5 },
      },
    },
    [client],
    [],
  );
  await VRHandler.updateState(
    headsetSocket,
    { connection: { remoteAddress: '127.0.0.1' }, headers: {} },
    { params: { activity: 2, userPresent: false, details: {} } },
    [client],
    [],
  );

  assert.deepEqual(client.queue, []);
  assert.equal(client.currentVideoId, null);

  await VRHandler.updateState(
    headsetSocket,
    { connection: { remoteAddress: '127.0.0.1' }, headers: {} },
    {
      params: {
        activity: 2,
        userPresent: false,
        details: { unblockAllowed: true },
      },
    },
    [client],
    [],
  );
  await VRHandler.updateState(
    headsetSocket,
    { connection: { remoteAddress: '127.0.0.1' }, headers: {} },
    { params: { activity: 0, userPresent: true, details: {} } },
    [client],
    [],
  );

  assert.equal(client.ws.messages.some(message => message.type === 'resetClient'), false);

  const secondPhoneResponse = await request(APIHandler.videoForClient, client);
  assert.equal(secondPhoneResponse.messages[0].success, true);
  assert.deepEqual(client.queue, ['film-1']);
  assert.equal(
    client.ws.messages.filter(message => message.type === 'videoChangeRequested').length,
    2,
  );
});

test('inactive stale headset film state does not re-block the unlocked main screen', async () => {
  const client = createClient({ activity: 0, queue: [] });
  const headsetSocket = client.ws;
  headsetSocket.location = client.location;
  headsetSocket.userId = client.id;

  await VRHandler.updateState(
    headsetSocket,
    { connection: { remoteAddress: '127.0.0.1' }, headers: {} },
    {
      params: {
        activity: 1,
        userPresent: true,
        details: { videoId: 'stale-film', isPlaying: false, playbackPosition: 0 },
      },
    },
    [client],
    [],
  );

  await VRHandler.updateState(
    headsetSocket,
    { connection: { remoteAddress: '127.0.0.1' }, headers: {} },
    {
      params: {
        activity: 0,
        userPresent: true,
        details: {},
      },
    },
    [client],
    [],
  );

  assert.deepEqual(client.queue, []);
  assert.deepEqual(client.ws.messages, []);
  assert.equal(client.pendingPaymentBlock, undefined);
  assert.equal(client.currentVideoId, null);
  assert.equal(client.activity, 0);
});

test('unlock acknowledgement is not lost during concurrent processing and prevents an immediate re-block', async () => {
  const client = createClient({
    activity: 2,
    queue: [],
    isProcessing: true,
  });
  const headsetSocket = client.ws;
  headsetSocket.location = client.location;
  headsetSocket.userId = client.id;

  await VRHandler.updateState(
    headsetSocket,
    { connection: { remoteAddress: '127.0.0.1' }, headers: {} },
    {
      params: {
        activity: 2,
        userPresent: false,
        details: { unblockAllowed: true },
      },
    },
    [client],
    [],
  );

  assert.ok(client.unblockProtectionUntil > Date.now());

  client.isProcessing = false;
  await VRHandler.updateState(
    headsetSocket,
    { connection: { remoteAddress: '127.0.0.1' }, headers: {} },
    {
      params: {
        activity: 1,
        userPresent: false,
        details: { videoId: 'film-unpaid', isPlaying: true, playbackPosition: 0 },
      },
    },
    [client],
    [],
  );

  assert.deepEqual(client.ws.messages.map(message => message.type), ['videoStopRequested']);
  assert.equal(client.pendingPaymentBlock, null);

  await VRHandler.updateState(
    headsetSocket,
    { connection: { remoteAddress: '127.0.0.1' }, headers: {} },
    { params: { activity: 0, userPresent: false, details: {} } },
    [client],
    [],
  );

  assert.equal(client.ws.messages.some(message => message.type === 'resetClient'), false);
  assert.equal(client.activity, 0);
});

test('real unpaid selection immediately after unlock still shows the payment instruction', async () => {
  const client = createClient({ activity: 2, queue: [] });
  const headsetSocket = client.ws;
  headsetSocket.location = client.location;
  headsetSocket.userId = client.id;

  await VRHandler.updateState(
    headsetSocket,
    { connection: { remoteAddress: '127.0.0.1' }, headers: {} },
    {
      params: {
        activity: 2,
        userPresent: false,
        details: { unblockAllowed: true },
      },
    },
    [client],
    [],
  );

  await VRHandler.updateState(
    headsetSocket,
    { connection: { remoteAddress: '127.0.0.1' }, headers: {} },
    {
      params: {
        activity: 1,
        userPresent: true,
        details: { videoId: 'film-unpaid', isPlaying: true, playbackPosition: 0 },
      },
    },
    [client],
    [],
  );
  await VRHandler.updateState(
    headsetSocket,
    { connection: { remoteAddress: '127.0.0.1' }, headers: {} },
    { params: { activity: 0, userPresent: true, details: {} } },
    [client],
    [],
  );

  const blockMessage = client.ws.messages.find(message => message.type === 'resetClient');
  assert.equal(
    blockMessage.data.text,
    'Оплатите фильм по QR-коду, нанесенному на очки,\n' +
      'затем нажмите «Смотреть» на телефоне.',
  );
  assert.equal(client.pendingPaymentBlock, null);
});

test('unpaid film selected in the headset shows the payment QR instruction', async () => {
  const client = createClient({ activity: 0, queue: [] });
  const headsetSocket = client.ws;
  headsetSocket.location = client.location;
  headsetSocket.userId = client.id;

  await VRHandler.updateState(
    headsetSocket,
    { connection: { remoteAddress: '127.0.0.1' }, headers: {} },
    {
      params: {
        activity: 1,
        userPresent: true,
        details: { videoId: 'film-unpaid', isPlaying: true, playbackPosition: 0 },
      },
    },
    [client],
    [],
  );

  assert.deepEqual(client.queue, []);
  assert.deepEqual(client.ws.messages.map(message => message.type), ['videoStopRequested']);

  await VRHandler.updateState(
    headsetSocket,
    { connection: { remoteAddress: '127.0.0.1' }, headers: {} },
    {
      params: {
        activity: 0,
        userPresent: true,
        details: {},
      },
    },
    [client],
    [],
  );

  const blockMessage = client.ws.messages.find(message => message.type === 'resetClient');
  assert.equal(
    blockMessage.data.text,
    'Оплатите фильм по QR-коду, нанесенному на очки,\n' +
      'затем нажмите «Смотреть» на телефоне.',
  );
  assert.equal(client.pendingPaymentBlock, null);
  assert.equal(client.missingVideoTimer, null);
});
