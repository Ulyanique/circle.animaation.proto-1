import test from 'node:test';
import assert from 'node:assert/strict';
import { WAITING_DEFAULTS } from '../src/scenes/waiting.js';
import { FINALE_DEFAULTS } from '../src/scenes/finale.js';
import { BRAND_DEFAULTS } from '../src/scenes/brand.js';
import { PHOTO_PAUSE_DEFAULTS } from '../src/scenes/photo-pause.js';
import { configToJSON, parseConfigJSON, SCHEMA } from '../src/config.js';

test('титр для зала: интервалы букв, размер даты и настройка камеры', () => {
  // Подзаголовок больше не распадается на буквы; дата идёт плотнее.
  assert.equal(WAITING_DEFAULTS.typography.subtitleTracking, .22);
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
