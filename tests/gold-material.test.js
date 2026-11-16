import test from 'node:test';
import assert from 'node:assert/strict';
import { WAITING_DEFAULTS } from '../src/scenes/waiting.js';
import { FINALE_DEFAULTS } from '../src/scenes/finale.js';
import { BRAND_DEFAULTS } from '../src/scenes/brand.js';
import { PHOTO_PAUSE_DEFAULTS } from '../src/scenes/photo-pause.js';
import { configToJSON, parseConfigJSON, SCHEMA } from '../src/config.js';
import { createGoldSurfaceMaps, METAL_ROUGHNESS_MIN, METAL_ROUGHNESS_MAX, LOGO_BEVEL_SEGMENTS, LOGO_BEVEL_WIDTH_RATIO } from '../src/gold-material-maps.js';

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

test('карты шероховатости и микрорельефа золота детерминированы, тайлятся и держат диапазон P0-4', () => {
  const a = createGoldSurfaceMaps(64);
  const b = createGoldSurfaceMaps(64);
  assert.deepEqual(a.roughBytes, b.roughBytes, 'карта шероховатости должна быть детерминирована');
  assert.deepEqual(a.normalBytes, b.normalBytes, 'карта нормалей должна быть детерминирована');

  let minFactor = Infinity, maxFactor = -Infinity;
  for (let i = 1; i < a.roughBytes.length; i += 4) {
    const f = a.roughBytes[i] / 255;
    minFactor = Math.min(minFactor, f);
    maxFactor = Math.max(maxFactor, f);
  }
  const effMin = minFactor * 0.35;
  const effMax = maxFactor * 0.35;
  assert.ok(effMin >= METAL_ROUGHNESS_MIN - 0.01 && effMax <= METAL_ROUGHNESS_MAX + 0.01,
    `диапазон шероховатости вне 0.20..0.35: ${effMin.toFixed(3)}..${effMax.toFixed(3)}`);
  assert.ok(effMax - effMin > 0.08, `недостаточная неоднородность шероховатости: ${(effMax - effMin).toFixed(3)}`);

  let maxTilt = 0;
  for (let i = 0; i < a.normalBytes.length; i += 4) {
    const nx = a.normalBytes[i] / 127.5 - 1;
    const ny = a.normalBytes[i + 1] / 127.5 - 1;
    const nz = a.normalBytes[i + 2] / 127.5 - 1;
    assert.ok(nz > 0.7, `нормаль микрорельефа слишком крутая: nz=${nz}`);
    maxTilt = Math.max(maxTilt, Math.hypot(nx, ny));
  }
  assert.ok(maxTilt > 0.02 && maxTilt < 0.7, `амплитуда микрорельефа: ${maxTilt.toFixed(3)}`);

  a.roughnessMap.dispose();
  a.normalMap.dispose();
  b.roughnessMap.dispose();
  b.normalMap.dispose();
});

test('фаска и контактная тень P0-4 настроены и совместимы со старыми сохранениями', () => {
  assert.ok(LOGO_BEVEL_SEGMENTS >= 9 && LOGO_BEVEL_SEGMENTS <= 12, `bevelSegments=${LOGO_BEVEL_SEGMENTS}`);
  assert.ok(LOGO_BEVEL_WIDTH_RATIO >= 0.88 && LOGO_BEVEL_WIDTH_RATIO <= 0.92, `bevelWidthRatio=${LOGO_BEVEL_WIDTH_RATIO}`);
  for (const defaults of [WAITING_DEFAULTS, FINALE_DEFAULTS, BRAND_DEFAULTS, PHOTO_PAUSE_DEFAULTS]) {
    assert.ok(defaults.lights.shadowOpacity > 0 && defaults.lights.shadowOpacity <= 0.4,
      `контактная тень должна быть мягко включена: ${defaults.lights.shadowOpacity}`);
    const explicitZero = parseConfigJSON('{"lights":{"shadowOpacity":0}}', defaults);
    assert.equal(explicitZero.lights.shadowOpacity, 0, 'явно выключенная тень из JSON должна сохраняться');
    const missing = parseConfigJSON('{"logo":{"scale":0.5}}', defaults);
    assert.equal(missing.lights.shadowOpacity, defaults.lights.shadowOpacity);
  }
});
