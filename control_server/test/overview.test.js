import assert from 'node:assert/strict';
import test from 'node:test';

import { APIHandler } from '../handlers/index.js';

const responseSocket = () => {
  const messages = [];
  return {
    messages,
    send(message) {
      messages.push(JSON.parse(message));
    },
  };
};

test('overview separates waiting, watching and offline glasses', async () => {
  const socket = responseSocket();
  const clients = [
    {
      location: 'CDH',
      id: '73',
      activity: 2,
      queue: [],
      connectionTimestamp: Date.now() - 5000,
    },
    {
      location: 'CDH',
      id: '74',
      activity: 1,
      queue: ['film-1'],
      currentVideoId: 'film-1',
      playbackPosition: 90,
      isPlaying: true,
      connectionTimestamp: Date.now() - 10000,
    },
    {
      location: 'CDH',
      id: '76',
      activity: 0,
      queue: ['film-2'],
      connectionTimestamp: Date.now() - 3000,
    },
  ];
  const presenceHistory = {
    async getOfflineForCurrentWindow() {
      return {
        offline: [{ location: 'CDH', id: '75', offlineSince: new Date().toISOString() }],
        window: { timezone: 'Europe/Moscow' },
      };
    },
  };

  await APIHandler.getVrOverview(socket, {}, {}, clients, [], presenceHistory);

  assert.equal(socket.messages.length, 1);
  assert.equal(socket.messages[0].type, 'vrOverview');
  assert.deepEqual(socket.messages[0].waiting.map((client) => client.id), ['73']);
  assert.deepEqual(socket.messages[0].watching.map((client) => client.id), ['74', '76']);
  assert.deepEqual(socket.messages[0].offline.map((client) => client.id), ['75']);
  assert.equal(socket.messages[0].watching[0].currentVideoId, 'film-1');
  assert.equal(socket.messages[0].watching[0].playbackPosition, 90);
  assert.equal(socket.messages[0].watching[1].currentVideoId, 'film-2');
});

test('legacy getVr response stays compatible', () => {
  const socket = responseSocket();
  const clients = [
    { location: 'CDH', id: '73', queue: [], connectionTimestamp: Date.now() },
    { location: 'CDH', id: '74', queue: ['film-1'], connectionTimestamp: Date.now() },
  ];

  APIHandler.getVr(socket, {}, {}, clients, []);

  assert.ok(Array.isArray(socket.messages[0]));
  assert.deepEqual(socket.messages[0].map((client) => client.id), ['73']);
});
