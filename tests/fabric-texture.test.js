import test from 'node:test';
import assert from 'node:assert/strict';
import { Background } from '../src/fx.js';
import { SCHEMA, mergeConfig, configToJSON, parseConfigJSON } from '../src/config.js';
import { WAITING_DEFAULTS } from '../src/scenes/waiting.js';
import { BRAND_DEFAULTS } from '../src/scenes/brand.js';
import { PHOTO_PAUSE_DEFAULTS } from '../src/scenes/photo-pause.js';
import { FINALE_DEFAULTS } from '../src/scenes/finale.js';

test('каменная фактура регулируется и хранится независимо от других сцен', () => {
  assert.equal(WAITING_DEFAULTS.background.fabricTexture, .8);
  for (const defaults of [BRAND_DEFAULTS, PHOTO_PAUSE_DEFAULTS, FINALE_DEFAULTS]) assert.equal(defaults.background.fabricTexture, 0);
  assert.ok(SCHEMA.find(s => s.id === 'background').fields.some(f => f.key === 'fabricTexture' && f.type === 'range'));
  const cfg = mergeConfig(WAITING_DEFAULTS, {}), bg = new Background();
  for (const [value, expected] of [[0,0], [.42,.42], [2,1], [-1,0]]) {
    cfg.background.fabricTexture = value; bg.update(10, cfg);
    assert.equal(bg.uniforms.uFabricTexture.value, expected);
  }
  cfg.background.fabricTexture = .37;
  assert.equal(parseConfigJSON(configToJSON(cfg), WAITING_DEFAULTS).background.fabricTexture, .37);
  assert.equal(parseConfigJSON('{"background":{"fog":0.2}}', WAITING_DEFAULTS).background.fabricTexture, .8);
  bg.mesh.geometry.dispose(); bg.material.dispose();
});
