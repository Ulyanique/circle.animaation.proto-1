import test from 'node:test';
import assert from 'node:assert/strict';
import { frameCount, frameTimestamp } from '../src/offline-video.js';

test('offline export samples the whole cycle at the output frame rate and configured speed', () => {
  assert.equal(frameCount(2, 1, 60), 120);
  assert.equal(frameCount(2, 2, 60), 60);
  assert.equal(frameCount(2, .5, 60), 240);
  assert.equal(frameCount(1, 7, 60), 9);
  assert.equal(frameCount(.001, 10, 60), 1);
  const count = frameCount(1, 7, 60);
  assert.ok((count - 1) * 7 / 60 < 1);
  assert.ok(count * 7 / 60 >= 1);
});
test('timestamps do not accumulate rounding drift', () => {
  assert.equal(frameTimestamp(0, 60), 0);
  assert.equal(frameTimestamp(1, 60), .016667);
  assert.equal(frameTimestamp(60, 60), 1);
  assert.equal(frameTimestamp(36000, 60), 600);
});
test('invalid export plans are rejected', () => {
  for (const args of [[0,1,60], [1,0,60], [NaN,1,60], [1,1,0], [1,1,29.5]])
    assert.throws(() => frameCount(...args));
});
