import test from 'node:test';
import assert from 'node:assert/strict';
import { Background } from '../src/fx.js';
import { WAITING_DEFAULTS } from '../src/scenes/waiting.js';
import { BRAND_DEFAULTS } from '../src/scenes/brand.js';
import { PHOTO_PAUSE_DEFAULTS } from '../src/scenes/photo-pause.js';
import { FINALE_DEFAULTS } from '../src/scenes/finale.js';
import { SCHEMA, parseConfigJSON, configToJSON } from '../src/config.js';

const effects = [
  ['godRaysEnabled', 'godRays', 'uRays'], ['fogEnabled', 'fog', 'uFog'],
  ['brushedEnabled', 'brushed', 'uBrushed'], ['grainEnabled', 'grain', 'uGrain'],
  ['vignetteEnabled', 'vignette', 'uVig'], ['lowerShadeEnabled', 'lowerShade', 'uLowerShade'],
  ['gridEnabled', 'gridOpacity', 'uGrid'],
];
test('выключатели фона сохраняют интенсивности, старые настройки и независимость сцен', () => {
  const fields = SCHEMA.find(s => s.id === 'background').fields;
  for (const defaults of [WAITING_DEFAULTS, BRAND_DEFAULTS, PHOTO_PAUSE_DEFAULTS, FINALE_DEFAULTS]) {
    const cfg = parseConfigJSON('{"background":{"fog":0.42}}', defaults);
    const bg = new Background();
    for (const [flag, intensity, uniform] of effects) {
      assert.equal(cfg.background[flag], true);
      assert.ok(fields.some(f => f.key === flag && f.type === 'bool'));
      const value = cfg.background[intensity];
      bg.update(0, cfg); assert.equal(bg.uniforms[uniform].value, value);
      cfg.background[flag] = false;
      bg.update(0, cfg); assert.equal(bg.uniforms[uniform].value, 0);
      assert.equal(cfg.background[intensity], value);
      const restored = parseConfigJSON(configToJSON(cfg), defaults);
      assert.equal(restored.background[flag], false);
      assert.equal(restored.background[intensity], value);
      cfg.background[flag] = true;
      bg.update(0, cfg); assert.equal(bg.uniforms[uniform].value, value);
      delete cfg.background[flag]; // старый объект без миграции тоже остаётся включённым
      bg.update(0, cfg); assert.equal(bg.uniforms[uniform].value, value);
    }
    bg.mesh.geometry.dispose(); bg.material.dispose();
  }
  assert.equal(BRAND_DEFAULTS.background.fogEnabled, true);
});
