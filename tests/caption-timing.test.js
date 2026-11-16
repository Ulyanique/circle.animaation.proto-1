import test from 'node:test';
import assert from 'node:assert/strict';
import {captionTimedLine, captionTimingDefaults} from '../src/caption-timing.js';
import {WAITING_DEFAULTS} from '../src/scenes/waiting.js';
import {FINALE_DEFAULTS} from '../src/scenes/finale.js';
import {configToJSON, parseConfigJSON, mergeConfig, projectToJSON, parseProjectJSON} from '../src/config.js';

test('штатные маски не меняются без явного включения собственного времени', () => {
  const tl=WAITING_DEFAULTS.timeline, line={outline:.38,fill:.22};
  for (const id of ['title','subtitle','date']) {
    assert.equal(captionTimedLine(10,tl,captionTimingDefaults(),id,line),line);
    assert.equal(captionTimedLine(10,tl,undefined,id,line),line);
  }
});
test('своё время каждой строки вычисляется без истории, до старта и за интервалом маска нулевая', () => {
  const tl=WAITING_DEFAULTS.timeline, cfg=captionTimingDefaults(), line={outline:.5,fill:.5};
  Object.assign(cfg,{titleTimingMode:'custom',titleStart:20,titleEnd:70,titleFade:15});
  const cycle=tl.drawDuration+tl.emergeDuration+tl.holdDuration+tl.fadeDuration+tl.restDuration;
  const at = p => tl.startDelay+cycle*p;
  assert.deepEqual(captionTimedLine(0,tl,cfg,'title',line),{outline:0,fill:0});
  assert.deepEqual(captionTimedLine(at(.1),tl,cfg,'title',line),{outline:0,fill:0});
  assert.deepEqual(captionTimedLine(at(.4),tl,cfg,'title',line),{outline:1,fill:1});
  assert.deepEqual(captionTimedLine(at(.8),tl,cfg,'title',line),{outline:0,fill:0});
  assert.equal(captionTimedLine(at(.4),tl,cfg,'subtitle',line),line);
  const a=captionTimedLine(at(.22),tl,cfg,'title',line);
  captionTimedLine(at(.8),tl,cfg,'title',line);
  assert.deepEqual(captionTimedLine(at(.22),tl,cfg,'title',line),a);
});
test('настройки независимы по сценам, сохраняются в JSON и старые файлы остаются сценарными', () => {
  const waiting=mergeConfig(WAITING_DEFAULTS,{}), finale=mergeConfig(FINALE_DEFAULTS,{});
  Object.assign(waiting.captionTiming,{titleTimingMode:'custom',titleStart:30,titleEnd:72,titleTimingInitialized:true});
  assert.equal(finale.captionTiming.titleTimingMode,'scene');
  const restored=parseConfigJSON(configToJSON(waiting),WAITING_DEFAULTS);
  assert.deepEqual(restored.captionTiming,waiting.captionTiming);
  assert.equal(parseConfigJSON('{}',WAITING_DEFAULTS).captionTiming.titleTimingMode,'scene');
  const project=parseProjectJSON(projectToJSON({waiting,finale},['waiting','finale']),['waiting','finale']);
  assert.equal(project.scenes.waiting.captionTiming.titleStart,30);
  assert.equal(project.scenes.finale.captionTiming.titleTimingMode,'scene');
});

test('штатные титры по умолчанию проявляются без обводки; стиль сохраняется по строкам', () => {
  const cfg = captionTimingDefaults();
  for (const id of ['title','subtitle','date']) assert.equal(cfg[`${id}RevealStyle`], 'fade');
  const changed = mergeConfig(WAITING_DEFAULTS, {captionTiming:{titleRevealStyle:'fade-up'}});
  const restored = parseConfigJSON(configToJSON(changed), WAITING_DEFAULTS);
  assert.equal(restored.captionTiming.titleRevealStyle, 'fade-up');
  assert.equal(restored.captionTiming.subtitleRevealStyle, 'fade');
  assert.equal(parseConfigJSON('{}',WAITING_DEFAULTS).captionTiming.titleRevealStyle, 'fade');
});
