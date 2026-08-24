import assert from 'node:assert/strict';
import test from 'node:test';

import { APIHandler, VRHandler } from '../handlers/index.js';

const createSocket = () => {
  const messages = [];

  return {
    messages,
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
  queue: [],
  pendingQueue: [],
  ws: createSocket(),
  ...overrides,
});

const request = (handler, client, payload = {}) => {
  const ws = createSocket();
  handler(
    ws,
    { connection: { remoteAddress: '127.0.0.1' }, headers: {} },
    {
      clientId: client.id,
      location: client.location,
      videoId: 'film-1',
      ...payload,
    },
    [client],
    [],
  );
  return ws;
};

test('repeated immediate watch requests start a film only once', () => {
  const client = createClient();

  const firstResponse = request(APIHandler.videoForClient, client);
  const secondResponse = request(APIHandler.videoForClient, client);
  const thirdResponse = request(APIHandler.videoForClient, client);

  assert.deepEqual(client.queue, ['film-1']);
  assert.equal(client.ws.messages.length, 1);
  assert.equal(client.ws.messages[0].type, 'videoChangeRequested');
  assert.equal(firstResponse.messages[0].duplicate, undefined);
  assert.equal(secondResponse.messages[0].duplicate, true);
  assert.equal(thirdResponse.messages[0].duplicate, true);
});

test('repeated watch requests while the headset is waiting create one pending item', () => {
  const client = createClient({ userPresent: false, activity: 2 });

  request(APIHandler.videoForClient, client);
  request(APIHandler.videoForClient, client);
  request(APIHandler.videoForClient, client);

  assert.deepEqual(client.pendingQueue, ['film-1']);
  assert.deepEqual(client.queue, []);
  assert.equal(client.ws.messages.length, 0);
});

test('a request for the currently playing film does not restart it', () => {
  const client = createClient({ currentVideoId: 'film-1', queue: ['film-1'] });
  const response = request(APIHandler.videoForClient, client);

  assert.deepEqual(client.queue, ['film-1']);
  assert.equal(client.ws.messages.length, 0);
  assert.equal(response.messages[0].duplicate, true);
});

test('stop removes all legacy copies of only the requested film', () => {
  const client = createClient({
    currentVideoId: 'film-1',
    queue: ['film-1', 'film-1', 'film-2'],
    pendingQueue: ['film-1', 'film-1', 'film-3'],
  });
  const response = request(APIHandler.stop, client);

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
  request(APIHandler.stop, client);

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
