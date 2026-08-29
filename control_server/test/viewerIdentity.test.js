import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildViewerId,
  formatHeadsetId,
  normalizeHeadsetId,
  sameHeadsetId,
} from '../utils/viewerIdentity.js';

test('numeric headset ids have one stable internal identity', () => {
  assert.equal(normalizeHeadsetId('1'), '1');
  assert.equal(normalizeHeadsetId('01'), '1');
  assert.equal(normalizeHeadsetId('001'), '1');
  assert.equal(sameHeadsetId('01', '1'), true);
  assert.equal(buildViewerId(' VDNH ', '01'), 'VDNH/1');
});

test('single digit numeric ids are displayed with two digits', () => {
  assert.equal(formatHeadsetId('1'), '01');
  assert.equal(formatHeadsetId('01'), '01');
  assert.equal(formatHeadsetId('9'), '09');
  assert.equal(formatHeadsetId('10'), '10');
  assert.equal(formatHeadsetId('0'), '0');
});

test('non-numeric and very large ids remain lossless', () => {
  assert.equal(normalizeHeadsetId(' demo '), 'demo');
  assert.equal(formatHeadsetId('demo'), 'demo');
  assert.equal(
    normalizeHeadsetId('000900719925474099312345'),
    '900719925474099312345',
  );
});
