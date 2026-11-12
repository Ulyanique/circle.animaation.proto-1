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

test('video size estimate uses output frame count and target bitrate', async () => {
  const { estimateVideoBytes } = await import('../src/offline-video.js');
  assert.equal(estimateVideoBytes(600, 60), 50000000);
  assert.equal(estimateVideoBytes(120, 60, 8000), 2000);
  for (const args of [[0,60], [1,0], [1,60,-1], [1.5,60]]) assert.throws(() => estimateVideoBytes(...args));
});

test('bitrate scales with the master frame area for large screens', async () => {
  const { videoBitrateFor, DEFAULT_VIDEO_BITRATE, MAX_VIDEO_BITRATE } = await import('../src/offline-video.js');
  assert.equal(videoBitrateFor(1920, 1080), DEFAULT_VIDEO_BITRATE);
  assert.equal(videoBitrateFor(3840, 2160), MAX_VIDEO_BITRATE);
  assert.ok(videoBitrateFor(2560, 1440) > DEFAULT_VIDEO_BITRATE);
  assert.ok(videoBitrateFor(2560, 1440) < MAX_VIDEO_BITRATE);
  assert.equal(videoBitrateFor(1280, 720), DEFAULT_VIDEO_BITRATE, 'меньше базы не опускаемся');
  for (const args of [[0,1080], [1920,0], [NaN,1080], [1920,Infinity]])
    assert.throws(() => videoBitrateFor(...args));
});
