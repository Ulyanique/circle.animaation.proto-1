import test from 'node:test';
import assert from 'node:assert/strict';
import {logoTimingPhase, logoTimingDefaults} from '../src/logo-timing.js';
import {WAITING_DEFAULTS} from '../src/scenes/waiting.js';
import {BRAND_DEFAULTS} from '../src/scenes/brand.js';
import {configToJSON, parseConfigJSON, mergeConfig} from '../src/config.js';

const tl=WAITING_DEFAULTS.timeline, cycle=tl.drawDuration+tl.emergeDuration+tl.holdDuration+tl.fadeDuration+tl.restDuration;
const phase={name:'fade',draw:.41,outline:.53,fill:.35,reveal:.62};
test('исходная прорисовка и уход не меняются в сценарном режиме и старых конфигах',()=>{
  const expected={draw:.41,outline:.53,fill:.35,reveal:.62,reverse:true};
  assert.deepEqual(logoTimingPhase(5,tl,logoTimingDefaults(),phase),expected);
  assert.deepEqual(logoTimingPhase(5,tl,undefined,phase),expected);
  assert.equal(parseConfigJSON('{}',WAITING_DEFAULTS).logoTiming.timingMode,'scene');
});
test('собственный интервал ограничивает прорисовку и металл, обратный уход привязан к его концу',()=>{
  const cfg={timingMode:'custom',timingStart:20,timingEnd:80,timingFade:20};
  const time=p=>tl.startDelay+cycle*p, at=p=>logoTimingPhase(time(p),tl,cfg,phase);
  assert.deepEqual(at(.1),{draw:0,outline:0,fill:0,reveal:0,reverse:false});
  assert.deepEqual(at(.5),{draw:1,outline:1,fill:1,reveal:1,reverse:false});
  assert.equal(at(.75).reverse,true); assert.ok(at(.75).reveal>0 && at(.75).reveal<1);
  assert.deepEqual(at(.9),{draw:0,outline:0,fill:0,reveal:0,reverse:false});
  assert.deepEqual(logoTimingPhase(0,tl,cfg,phase),{draw:0,outline:0,fill:0,reveal:0,reverse:false});
  const first=at(.23);at(.9);assert.deepEqual(at(.23),first);
});
test('собственный интервал сохраняется независимо в сцене и JSON',()=>{
  const intro=mergeConfig(WAITING_DEFAULTS,{}), brand=mergeConfig(BRAND_DEFAULTS,{});
  Object.assign(intro.logoTiming,{timingMode:'custom',timingStart:33,timingEnd:77});
  assert.equal(brand.logoTiming.timingMode,'scene');
  assert.deepEqual(parseConfigJSON(configToJSON(intro),WAITING_DEFAULTS).logoTiming,intro.logoTiming);
});
