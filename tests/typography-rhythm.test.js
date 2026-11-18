import test from 'node:test';
import assert from 'node:assert/strict';
import { WAITING_DEFAULTS } from '../src/scenes/waiting.js';
import { FINALE_DEFAULTS } from '../src/scenes/finale.js';
import { BRAND_DEFAULTS } from '../src/scenes/brand.js';
import { PHOTO_PAUSE_DEFAULTS } from '../src/scenes/photo-pause.js';
import { configToJSON, parseConfigJSON, SCHEMA } from '../src/config.js';

test('титр для зала: интервалы букв, размер даты и настройка камеры', () => {
  // Подзаголовок больше не распадается на буквы; дата идёт плотнее.
  assert.equal(WAITING_DEFAULTS.typography.subtitleTracking, .18);
  assert.equal(WAITING_DEFAULTS.typography.dateTracking, .24);
  // Финальная фраза остаётся со своим, более узким интервалом.
  assert.equal(FINALE_DEFAULTS.typography.subtitleTracking, .18);
  // Камера: новая группа настроек и совместимость со старыми JSON.
  assert.ok(SCHEMA.find((section) => section.id === 'camera').fields.some((f) => f.key === 'holdDolly'));
  for (const defaults of [WAITING_DEFAULTS, FINALE_DEFAULTS, BRAND_DEFAULTS, PHOTO_PAUSE_DEFAULTS]) {
    const old = parseConfigJSON('{"logo":{"scale":1}}', defaults);
    assert.equal(old.camera.holdDolly, 0, 'старые настройки не должны включать подъезд камеры');
    old.camera.holdDolly = .02;
    assert.equal(parseConfigJSON(configToJSON(old), defaults).camera.holdDolly, .02);
  }
  // Сцены независимы: правка одной не меняет умолчания остальных.
  const before = BRAND_DEFAULTS.camera.holdDolly;
  WAITING_DEFAULTS.camera.holdDolly = .01;
  assert.equal(BRAND_DEFAULTS.camera.holdDolly, before);
  WAITING_DEFAULTS.camera.holdDolly = 0;
});

test('параллакс слоёв: ноль выключен, шов не меняется, seek детерминирован', async () => {
  const { layerParallax } = await import('../src/timeline.js');
  const tl = WAITING_DEFAULTS.timeline;
  const cycle = tl.drawDuration + tl.emergeDuration + tl.holdDuration + tl.fadeDuration + tl.restDuration;
  const zero = layerParallax(3.7, tl, 0);
  assert.deepEqual(zero, { x: 0, y: 0 });
  // Шов: смещение в конце круга совпадает со смещением в начале.
  const start = layerParallax(0, tl, 1);
  const seam = layerParallax(cycle, tl, 1);
  assert.ok(Math.abs(start.x - seam.x) < 1e-12 && Math.abs(start.y - seam.y) < 1e-12);
  const seamBefore = layerParallax(cycle - 1 / 60, tl, 1);
  assert.ok(Math.abs(seamBefore.x - start.x) < 0.002, 'сдвиг на последнем кадре виден');
  // Амплитуда — единицы пикселей при 1080p, а не сдвиг композиции.
  let max = 0;
  for (let i = 0; i <= 600; i++) {
    const p = layerParallax((cycle * i) / 600, tl, 1);
    max = Math.max(max, Math.abs(p.x), Math.abs(p.y));
  }
  // amount=1 даёт 0,01 мировой единицы — это единицы пикселей на 1080p.
  assert.ok(max <= 0.0100001, `амплитуда вне допуска: ${max}`);
  assert.ok(max > 0.005, `параллакс слишком слабый: ${max}`);
  // Детерминизм: то же время — то же смещение.
  assert.deepEqual(layerParallax(9.13, tl, 1), layerParallax(9.13, tl, 1));
  assert.equal(WAITING_DEFAULTS.camera.parallax, 1);
});
