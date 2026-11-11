import test from 'node:test';
import assert from 'node:assert/strict';
import { WAITING_DEFAULTS } from '../src/scenes/waiting.js';
import { BRAND_DEFAULTS } from '../src/scenes/brand.js';
import { parseConfigJSON, configToJSON } from '../src/config.js';
import { customTextVisual, customTextAnimation } from '../src/custom-text.js';
import { duplicatePlan } from '../src/editor-duplicate.js';

test('мягкое проявление использует прежний интервал и сохраняется по слоям', () => {
  const a=parseConfigJSON('{"textLayers":{"text1Present":true}}',WAITING_DEFAULTS);
  const b=parseConfigJSON('{}',BRAND_DEFAULTS);
  assert.equal(a.textLayers.text1RevealStyle,'draw');
  const start=a.timeline.startDelay,cycle=a.timeline.drawDuration+a.timeline.emergeDuration+a.timeline.holdDuration+a.timeline.fadeDuration+a.timeline.restDuration;
  const frame=t=>customTextVisual(customTextAnimation(start+cycle*t,a.timeline,a.textLayers,'text1'),'fade');
  assert.equal(frame(.2).opacity,0);assert.ok(frame(.28).opacity>0 && frame(.28).opacity<1);
  assert.equal(frame(.5).opacity,1);assert.equal(frame(.95).opacity,0);
  assert.deepEqual(frame(.28).line,{outline:1,fill:1});
  const move = customTextVisual({outline:.4,fill:.1}, 'fade-up');
  assert.equal(move.opacity,.4); assert.ok(Math.abs(move.rise-.48)<1e-9);
  assert.equal(customTextVisual({outline:1,fill:1}, 'fade-up').rise,0);
  assert.equal(customTextVisual({outline:0,fill:0}, 'fade-up').rise,.8);
  const line={outline:.4,fill:.1};assert.deepEqual(customTextVisual(line,'draw'),{line,opacity:1,fade:false});
  assert.deepEqual(customTextVisual(line,'unknown'),{line,opacity:1,fade:false});
  a.textLayers.text1RevealStyle='fade';
  assert.equal(a.textLayers.text2RevealStyle,'draw');assert.equal(b.textLayers.text1RevealStyle,'draw');
  assert.equal(parseConfigJSON(configToJSON(a),WAITING_DEFAULTS).textLayers.text1RevealStyle,'fade');
  assert.equal(duplicatePlan(a,WAITING_DEFAULTS,'text1').changes.find(c=>c.key==='text2RevealStyle').value,'fade');
});
