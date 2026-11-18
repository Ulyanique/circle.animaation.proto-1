import test from 'node:test';
import assert from 'node:assert/strict';
import { WAITING_DEFAULTS } from '../src/scenes/waiting.js';
import { BRAND_DEFAULTS } from '../src/scenes/brand.js';
import { parseConfigJSON, configToJSON } from '../src/config.js';
import { duplicatePlan } from '../src/editor-duplicate.js';

test('отдельный шрифт надписи сохраняется, копируется и не меняет другие сцены', () => {
  const a = parseConfigJSON('{"textLayers":{"text1Present":true}}', WAITING_DEFAULTS);
  const b = parseConfigJSON('{}', BRAND_DEFAULTS);
  assert.equal(a.textLayers.text1Font,'');
  a.textLayers.text1Font='manrope';
  assert.equal(a.textLayers.text2Font,''); assert.equal(b.textLayers.text1Font,'');
  assert.equal(parseConfigJSON(configToJSON(a),WAITING_DEFAULTS).textLayers.text1Font,'manrope');
  assert.equal(duplicatePlan(a,WAITING_DEFAULTS,'text1').changes.find(c=>c.key==='text2Font').value,'manrope');
});
