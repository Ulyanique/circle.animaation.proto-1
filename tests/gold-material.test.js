import test from 'node:test';
import assert from 'node:assert/strict';
import { WAITING_DEFAULTS } from '../src/scenes/waiting.js';
import { FINALE_DEFAULTS } from '../src/scenes/finale.js';
import { BRAND_DEFAULTS } from '../src/scenes/brand.js';
import { PHOTO_PAUSE_DEFAULTS } from '../src/scenes/photo-pause.js';
import { configToJSON, parseConfigJSON, SCHEMA } from '../src/config.js';

test('объём граней регулируется и хранится отдельно для каждой сцены', () => {
  assert.equal(WAITING_DEFAULTS.logo.facetPolish, .65);
  assert.equal(FINALE_DEFAULTS.logo.facetPolish, .65);
  assert.equal(BRAND_DEFAULTS.logo.facetPolish, 0);
  assert.equal(PHOTO_PAUSE_DEFAULTS.logo.facetPolish, 0);
  assert.ok(SCHEMA.find(s => s.id === 'logo').fields.some(f => f.key === 'facetPolish'));
  for (const defaults of [WAITING_DEFAULTS, FINALE_DEFAULTS, BRAND_DEFAULTS, PHOTO_PAUSE_DEFAULTS]) {
    const old = parseConfigJSON('{"logo":{"roughness":0.4}}', defaults);
    assert.equal(old.logo.facetPolish, defaults.logo.facetPolish);
    old.logo.facetPolish = .23;
    assert.equal(parseConfigJSON(configToJSON(old), defaults).logo.facetPolish, .23);
  }
});

test('янтарный срез — общая настройка логотипа, совместимая со старыми JSON', () => {
  assert.equal(WAITING_DEFAULTS.logo.amber, .4);
  assert.ok(SCHEMA.find(s => s.id === 'logo').fields.some(f => f.key === 'amber'));
  for (const defaults of [WAITING_DEFAULTS, FINALE_DEFAULTS, BRAND_DEFAULTS, PHOTO_PAUSE_DEFAULTS]) {
    // Старый файл без ключа получает значение сцены, а не NaN.
    const old = parseConfigJSON('{"logo":{"scale":1}}', defaults);
    assert.equal(old.logo.amber, defaults.logo.amber);
    // Своё значение переживает экспорт и импорт.
    old.logo.amber = 0;
    assert.equal(parseConfigJSON(configToJSON(old), defaults).logo.amber, 0);
  }
  // Сцены независимы: правка одной не меняет умолчания остальных.
  const before = BRAND_DEFAULTS.logo.amber;
  WAITING_DEFAULTS.logo.amber = .1;
  assert.equal(BRAND_DEFAULTS.logo.amber, before);
  WAITING_DEFAULTS.logo.amber = .4;
});
