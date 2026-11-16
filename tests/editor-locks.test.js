import test from 'node:test';
import assert from 'node:assert/strict';
import { editorLockDefaults, layerLocked } from '../src/editor-locks.js';
import { EDITOR_LAYERS } from '../src/editor-layers.js';
import { WAITING_DEFAULTS } from '../src/scenes/waiting.js';
import { BRAND_DEFAULTS } from '../src/scenes/brand.js';
import { parseConfigJSON, configToJSON } from '../src/config.js';

test('блокировки существуют для всех элементов, не меняют старые сцены и сохраняются раздельно', () => {
  const defaults = editorLockDefaults();
  assert.deepEqual(Object.keys(defaults).sort(), EDITOR_LAYERS.map(layer => layer.id).sort());
  const intro = parseConfigJSON('{"logo":{"offsetX":0.3}}', WAITING_DEFAULTS);
  const brand = parseConfigJSON('{}', BRAND_DEFAULTS);
  for (const {id} of EDITOR_LAYERS) assert.equal(layerLocked(intro, id), false);
  assert.equal(layerLocked({}, 'logo'), false);
  intro.editorLocks.logo = true;
  assert.equal(intro.logo.offsetX, 0.3);
  assert.equal(layerLocked(brand, 'logo'), false);
  assert.equal(layerLocked(parseConfigJSON(configToJSON(intro), WAITING_DEFAULTS), 'logo'), true);
});
