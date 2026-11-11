import test from 'node:test';
import assert from 'node:assert/strict';
import { WAITING_DEFAULTS } from '../src/scenes/waiting.js';
import { BRAND_DEFAULTS } from '../src/scenes/brand.js';
import { configToJSON, parseConfigJSON } from '../src/config.js';
import { duplicatePlan } from '../src/editor-duplicate.js';

test('интервалы своих надписей сохраняются отдельно и старые настройки не меняют вид', () => {
  const a = parseConfigJSON('{"textLayers":{"text1Present":true,"text1Text":"Текст"}}', WAITING_DEFAULTS);
  const b = parseConfigJSON('{}', BRAND_DEFAULTS);
  assert.equal(a.textLayers.text1Tracking,0); assert.equal(b.textLayers.text1Tracking,0);
  a.textLayers.text1Tracking=.24;
  assert.equal(b.textLayers.text1Tracking,0); assert.equal(a.textLayers.text2Tracking,0);
  assert.equal(parseConfigJSON(configToJSON(a), WAITING_DEFAULTS).textLayers.text1Tracking,.24);
  assert.equal(duplicatePlan(a, WAITING_DEFAULTS, 'text1').changes.find(c=>c.key==='text2Tracking').value,.24);
});
