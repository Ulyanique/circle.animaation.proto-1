import test from 'node:test';
import assert from 'node:assert/strict';
import { WAITING_DEFAULTS } from '../src/scenes/waiting.js';
import { BRAND_DEFAULTS } from '../src/scenes/brand.js';
import { configToJSON, parseConfigJSON } from '../src/config.js';
import { duplicatePlan } from '../src/editor-duplicate.js';

test('регистр собственной надписи не меняет исходный текст и копируется независимо', () => {
  const a = parseConfigJSON('{"textLayers":{"text1Present":true,"text1Text":"Привет Straße"}}', WAITING_DEFAULTS);
  const b = parseConfigJSON('{}', BRAND_DEFAULTS);
  assert.equal(a.textLayers.text1Case,'none');
  a.textLayers.text1Case='uppercase';
  assert.equal(a.textLayers.text1Text,'Привет Straße');
  assert.equal(a.textLayers.text2Case,'none'); assert.equal(b.textLayers.text1Case,'none');
  const copy=duplicatePlan(a,WAITING_DEFAULTS,'text1');
  assert.equal(copy.changes.find(c=>c.key==='text2Case').value,'uppercase');
  assert.equal(copy.changes.find(c=>c.key==='text2Text').value,'Привет Straße');
  const restored=parseConfigJSON(configToJSON(a),WAITING_DEFAULTS);
  assert.equal(restored.textLayers.text1Case,'uppercase'); assert.equal(restored.textLayers.text1Text,'Привет Straße');
});
