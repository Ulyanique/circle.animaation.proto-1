import test from 'node:test';
import assert from 'node:assert/strict';
import { circularGlyphLayout, viewfinderSegments } from '../src/scenes/photo-layout.js';
import { PHOTO_PAUSE_DEFAULTS } from '../src/scenes/photo-pause.js';
import { BRAND_DEFAULTS } from '../src/scenes/brand.js';
import { mergeConfig, parseConfigJSON, configToJSON } from '../src/config.js';

test('фотопауза хранит свою композицию и параметры в JSON', () => {
  const cfg = mergeConfig(PHOTO_PAUSE_DEFAULTS, {photo: { text: 'КАДР', rotationSpeed: -0.05 }});
  assert.equal(cfg.logo.offsetY, 0);
  assert.equal(cfg.photo.frameEnabled, true);
  assert.equal(cfg.photo.text, 'КАДР');
  assert.equal(parseConfigJSON(configToJSON(cfg), PHOTO_PAUSE_DEFAULTS).photo.rotationSpeed, -0.05);
  assert.equal(BRAND_DEFAULTS.photo, undefined);
});

test('круговая надпись распределяет повторы без пересечения даже для длинного текста', () => {
  const radius = 100;
  const text = circularGlyphLayout('ФОТОПАУЗА', 4, radius, () => 10);
  assert.equal(text.filter(g => g.glyph === '•').length, 4);
  assert.ok(text.every((g, i) => i === 0 || text[i - 1].angle < g.angle));
  assert.ok(text.at(-1).angle - text[0].angle < Math.PI * 2);
  assert.ok(text.every(g => g.scale === 1));
  const long = circularGlyphLayout('ФОТОПАУЗА'.repeat(4), 8, radius, () => 10);
  assert.ok(long.every(g => g.scale > 0 && g.scale < 1));
  assert.ok(long.at(-1).angle - long[0].angle < Math.PI * 2);
});

test('четыре уголка равномерно отступают от краёв кадра', () => {
  const v = viewfinderSegments(16, 9, 0.05, 0.08);
  assert.equal(v.length, 48);
  const x = 16 * 0.9, y = 9 * 0.9;
  assert.deepEqual(v.slice(0, 3), [-x, -y, 0]);
  assert.deepEqual(v.slice(36, 39), [x, y, 0]);
  assert.ok(Math.abs(v[3] - (-x + 18 * 0.08)) < 1e-9);
});
