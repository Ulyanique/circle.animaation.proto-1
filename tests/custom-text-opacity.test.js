import test from 'node:test';
import assert from 'node:assert/strict';
import { WAITING_DEFAULTS } from '../src/scenes/waiting.js';
import { BRAND_DEFAULTS } from '../src/scenes/brand.js';
import { configToJSON, parseConfigJSON } from '../src/config.js';
import { duplicatePlan } from '../src/editor-duplicate.js';

test('непрозрачность надписей независима, наследует прежний вид и копируется', () => {
  const a = parseConfigJSON('{"textLayers":{"text1Present":true}}', WAITING_DEFAULTS);
  const b = parseConfigJSON('{}', BRAND_DEFAULTS);
  assert.equal(a.textLayers.text1Opacity,1);assert.equal(b.textLayers.text1Opacity,1);
  a.textLayers.text1Opacity=.35;
  assert.equal(a.textLayers.text2Opacity,1);assert.equal(b.textLayers.text1Opacity,1);
  assert.equal(parseConfigJSON(configToJSON(a),WAITING_DEFAULTS).textLayers.text1Opacity,.35);
  assert.equal(duplicatePlan(a,WAITING_DEFAULTS,'text1').changes.find(c=>c.key==='text2Opacity').value,.35);
});
