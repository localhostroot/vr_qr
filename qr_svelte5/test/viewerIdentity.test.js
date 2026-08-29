import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatHeadsetId,
  formatViewerId,
  normalizeHeadsetId,
  normalizeViewerClient,
  sameHeadsetId,
} from '../src/lib/utils/viewerIdentity.js';

test('viewer routes accept either spelling and display two digits', () => {
  assert.equal(normalizeHeadsetId('01'), '1');
  assert.equal(sameHeadsetId('1', '01'), true);
  assert.equal(formatHeadsetId('1'), '01');
  assert.equal(formatViewerId('VDNH/1'), 'VDNH/01');
  assert.equal(formatViewerId('VDNH:01'), 'VDNH:01');
});

test('stored viewer clients use the stable internal id', () => {
  assert.deepEqual(
    normalizeViewerClient({ location: ' VDNH ', id: '01', extra: true }),
    { location: 'VDNH', id: '1', extra: true },
  );
});

test('non-numeric ids and ids above the safe integer range are preserved', () => {
  assert.equal(formatHeadsetId('demo'), 'demo');
  assert.equal(
    normalizeHeadsetId('000900719925474099312345'),
    '900719925474099312345',
  );
});
