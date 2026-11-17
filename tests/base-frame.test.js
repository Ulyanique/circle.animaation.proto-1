import test from 'node:test';
import assert from 'node:assert/strict';
import { BASE_FRAME, BASE_PIXELS, OUTPUT } from '../src/scenes/catalog.js';
import { masterSize, masterPreset, MASTER_PRESETS } from '../src/output-profile.js';
import { videoBitrateFor, DEFAULT_VIDEO_BITRATE } from '../src/offline-video.js';
import { parallaxAmount } from '../src/quality-presets.js';

test('базовый кадр — единственный источник 1920×1080', () => {
  assert.deepEqual(BASE_FRAME, { width: 1920, height: 1080 });
  assert.equal(BASE_PIXELS, 1920 * 1080);
  // OUTPUT наследует размер у базового кадра, а частоту задаёт сам.
  assert.equal(OUTPUT.width, BASE_FRAME.width);
  assert.equal(OUTPUT.height, BASE_FRAME.height);
  assert.equal(OUTPUT.fps, 30);
  assert.equal(masterSize().width, BASE_FRAME.width);
  assert.equal(masterPreset('1080p').label, `${BASE_FRAME.width}×${BASE_FRAME.height}`);
  // 4K ровно вчетверо больше по площади: это база для битрейта.
  const uhd = MASTER_PRESETS['2160p'];
  assert.equal(uhd.width, BASE_FRAME.width * 2);
  assert.equal(uhd.height, BASE_FRAME.height * 2);
  assert.equal(videoBitrateFor(BASE_FRAME.width, BASE_FRAME.height), DEFAULT_VIDEO_BITRATE);
  assert.equal(parallaxAmount(1, { width: uhd.width }), 2);
});
