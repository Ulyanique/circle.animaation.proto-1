import test from 'node:test';
import assert from 'node:assert/strict';
import { WAITING_DEFAULTS } from '../src/scenes/waiting.js';
import { BRAND_DEFAULTS } from '../src/scenes/brand.js';
import { PHOTO_PAUSE_DEFAULTS } from '../src/scenes/photo-pause.js';
import { FINALE_DEFAULTS } from '../src/scenes/finale.js';
import { SCHEMA, mergeConfig, configToJSON, parseConfigJSON } from '../src/config.js';
import { Background } from '../src/fx.js';
import { updateUpperRays } from '../src/top-illumination.js';
import { computePhase } from '../src/timeline.js';

test('кинематографичный вариант включён в интро и фоне и сохраняется в настройках', () => {
  assert.equal(WAITING_DEFAULTS.logo.cinematic, true);
  assert.equal(BRAND_DEFAULTS.logo.cinematic, true);
  for (const scene of [PHOTO_PAUSE_DEFAULTS, FINALE_DEFAULTS]) assert.equal(scene.logo.cinematic, false);
  assert.ok(SCHEMA.find(s => s.id === 'logo').fields.some(f => f.key === 'cinematic' && f.type === 'bool'));
  const cfg = mergeConfig(WAITING_DEFAULTS, {logo:{cinematic:false}});
  assert.equal(parseConfigJSON(configToJSON(cfg), WAITING_DEFAULTS).logo.cinematic, false);
  assert.equal(parseConfigJSON('{"logo":{"scale":0.5}}', WAITING_DEFAULTS).logo.cinematic, true);
});

test('режим света и его скорость следуют настройкам без накопления времени', () => {
  const cfg = mergeConfig(WAITING_DEFAULTS, {}), bg = new Background();
  const t = 10, phase = computePhase(t, cfg.timeline);
  updateUpperRays(bg, phase, cfg, true, 0, t);
  assert.equal(bg.uniforms.uCinematic.value, 1);
  assert.equal(bg.uniforms.uUpperTime.value, t * cfg.topIllumination.raysSpeed);
  cfg.logo.cinematic = false;
  updateUpperRays(bg, phase, cfg, true, 0, t);
  assert.equal(bg.uniforms.uCinematic.value, 0);
  cfg.background.cinematicLight = true;
  updateUpperRays(bg, phase, cfg, true, 0, t);
  assert.equal(bg.uniforms.uCinematic.value, 1); // фон независимо от материала логотипа
  cfg.topIllumination.raysEnabled = false;
  updateUpperRays(bg, phase, cfg, true, 0, t);
  assert.equal(bg.uniforms.uIntroLight.value, 0);
  bg.mesh.geometry.dispose(); bg.material.dispose();
});

test('студийный рельеф интро и фона и совместим со старыми настройками', () => {
  assert.equal(WAITING_DEFAULTS.logo.studioRelief, 0.85);
  assert.equal(BRAND_DEFAULTS.logo.studioRelief, 0.85);
  for (const scene of [PHOTO_PAUSE_DEFAULTS, FINALE_DEFAULTS]) assert.equal(scene.logo.studioRelief, 0);
  assert.ok(SCHEMA.find(s => s.id === 'logo').fields.some(f => f.key === 'studioRelief'));
  const cfg = mergeConfig(WAITING_DEFAULTS, { logo: { studioRelief: 0.3 } });
  assert.equal(parseConfigJSON(configToJSON(cfg), WAITING_DEFAULTS).logo.studioRelief, 0.3);
  assert.equal(parseConfigJSON('{"logo":{"scale":0.5}}', WAITING_DEFAULTS).logo.studioRelief, 0.85);
});
