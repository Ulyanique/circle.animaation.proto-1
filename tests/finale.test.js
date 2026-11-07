import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { FINALE_DEFAULTS } from '../src/scenes/finale.js';
import { BRAND_DEFAULTS } from '../src/scenes/brand.js';
import { finaleCues, introCues, introSequence } from '../src/scenes/cues.js';
import { computePhase, plotSequence, seamCurtainOpacity } from '../src/timeline.js';
import { finaleCaptionState } from '../src/caption.js';
import { cycleDuration } from '../src/runtime.js';
import { mergeConfig, parseConfigJSON, configToJSON, loadSceneConfig, saveSceneConfig, sceneStorageKey } from '../src/config.js';
import { WAITING_DEFAULTS } from '../src/scenes/waiting.js';
import { Plotter } from '../src/plotter.js';
import { finaleTextTiming } from '../src/scenes/finale-timing.js';

const tl = FINALE_DEFAULTS.timeline;
const fadeStart = tl.drawDuration + tl.emergeDuration + tl.holdDuration;
const at = p => computePhase(tl.startDelay + fadeStart + tl.fadeDuration * p, tl);
const captionStart = introSequence(at(0), tl, FINALE_DEFAULTS.intro).captionStart;
const text = p => finaleCaptionState(tl.startDelay + fadeStart + tl.fadeDuration * p, tl, captionStart).lines;

test('финал начинается в стиле интро: разметка, две точки, свет и последовательность знака', () => {
  assert.equal(FINALE_DEFAULTS.constructionGuides.enabled, true);
  assert.deepEqual(FINALE_DEFAULTS.intro, WAITING_DEFAULTS.intro);
  assert.ok(Math.abs(cycleDuration(tl) - 18) < 1e-8);
  const early = computePhase(tl.startDelay + tl.drawDuration * .5, tl);
  const orbit = plotSequence(early, tl, {intro:true, finale:true});
  assert.equal(early.draw, 0); assert.ok(orbit.sweep > 0 && orbit.sweep < 1 && orbit.head > 0);
  assert.equal(plotSequence(computePhase(tl.startDelay + tl.drawDuration * .68, tl), tl, {intro:true, finale:true}).sweep, 1);
  const mid = computePhase(tl.startDelay + tl.drawDuration * .8, tl);
  assert.ok(introCues(mid, tl).beams > 0); assert.equal(introSequence(mid, tl, FINALE_DEFAULTS.intro).corners, 0);
  const root = new THREE.Group(), outline = new THREE.Group(); root.add(outline);
  const p = new Plotter(new THREE.Texture(), {root, outline, outlineAnchors: new Float32Array([0,0]), parsed:{cx:0,cy:0,subPaths:[{getPointAt:()=>({x:0,y:0})}]}}, {twoHeads:true, finale:true});
  p.update(early, FINALE_DEFAULTS);
  assert.ok(p.head.material.opacity > 0 && p.head2.material.opacity > 0);
  assert.ok(Math.abs(p.head.position.x + p.head2.position.x) < 1e-9);
  p.dispose();
});

test('последний титр остаётся один по центру на чёрном, затем плавно стирается', () => {
  assert.equal(text(.15).title.outline, 0); assert.equal(text(.15).subtitle.outline, 1);
  assert.ok(finaleCues(at(.2), tl).center > 0 && finaleCues(at(.2), tl).center < 1);
  assert.equal(finaleCues(at(.25), tl).center, 1);
  assert.ok(finaleCues(at(.34), tl).reveal > 0 && finaleCues(at(.34), tl).reveal < 1);
  assert.ok(finaleCues(at(.44), tl).draw > 0 && finaleCues(at(.44), tl).draw < 1);
  assert.equal(finaleCues(at(.50), tl).draw, 0);
  const phase = {...at(.60), draw:finaleCues(at(.60), tl).draw};
  const orbit = plotSequence(phase, tl, {intro:true, finale:true});
  assert.equal(orbit.reverse, true); assert.ok(orbit.sweep > 0 && orbit.sweep < 1);
  const held = finaleCues(at(.72), tl);
  assert.equal(held.subtitleCenter, 1); assert.equal(held.blackout, 1); assert.equal(held.corners, 0);
  assert.equal(text(.72).title.outline, 0); assert.equal(text(.72).subtitle.outline, 1); assert.equal(text(.72).subtitle.fill, 1);
  assert.ok(text(.90).subtitle.outline > 0 && text(.90).subtitle.outline < 1);
  assert.equal(text(.995).subtitle.outline, 0);
  const rest = computePhase(tl.startDelay + fadeStart + tl.fadeDuration + .3, tl);
  assert.equal(finaleCues(rest, tl).blackout, 1); assert.equal(plotSequence(rest, tl, {intro:true, finale:true}).head, 0);
  assert.equal(seamCurtainOpacity(computePhase(tl.startDelay + cycleDuration(tl) - 1 / 60, tl), tl), 1);
});

test('центральная строка, затемнение и уход детерминированы и непрерывны', () => {
  for (const p of [0, .15, .25, .39, .50, .68, .82, .995, 1]) {
    const left = finaleCues(at(Math.max(0, p-1e-6)), tl), right = finaleCues(at(Math.min(1, p+1e-6)), tl);
    for (const key of ['center', 'retreat', 'reveal', 'draw', 'subtitleCenter', 'blackout']) assert.ok(Math.abs(left[key] - right[key]) < .001, `${key} @ ${p}`);
    assert.deepEqual(text(p), text(p));
  }
  for (const duration of [.5, 2, 8]) {
    const custom = {...tl, fadeDuration:duration};
    const start = custom.drawDuration + custom.emergeDuration + custom.holdDuration;
    const timing = finaleTextTiming(custom);
    const holdPoint = (timing.moveEnd + timing.eraseStart) / 2;
    const phase = computePhase(custom.startDelay + start + holdPoint, custom);
    assert.equal(finaleCues(phase, custom).blackout, 1);
    assert.equal(finaleCaptionState(custom.startDelay + start + holdPoint, custom, captionStart).lines.subtitle.outline, 1);
  }
});

test('настройки финала и текст сохраняются независимо от других сцен', () => {
  const cfg = mergeConfig(FINALE_DEFAULTS, { finale: {retreatDepth: 3.5, retreatScale: 0.4}, caption:{subtitleText:'Продолжение', subtitleX:.1} });
  const restored = parseConfigJSON(configToJSON(cfg), FINALE_DEFAULTS);
  assert.deepEqual(restored.finale, {...FINALE_DEFAULTS.finale, retreatDepth: 3.5, retreatScale: 0.4});
  assert.equal(restored.caption.subtitleText, 'Продолжение'); assert.equal(restored.caption.subtitleX, .1);
  assert.equal(BRAND_DEFAULTS.finale, undefined);
});

test('старый стандарт разметки финала обновляется один раз, свои настройки не меняются', () => {
  const old = globalThis.localStorage, store = new Map();
  globalThis.localStorage = {getItem:k => store.get(k) ?? null, setItem:(k,v)=>store.set(k,String(v)), removeItem:k=>store.delete(k)};
  try {
    const previous = {...WAITING_DEFAULTS.constructionGuides, enabled:false};
    store.set(sceneStorageKey('finale'), JSON.stringify({constructionGuides:previous, caption:{subtitleText:'Своя фраза'}}));
    const cfg = loadSceneConfig('finale', FINALE_DEFAULTS);
    assert.equal(cfg.constructionGuides.enabled, true); assert.equal(cfg.caption.subtitleText, 'Своя фраза');
    cfg.constructionGuides.enabled = false; saveSceneConfig('finale', cfg);
    assert.equal(loadSceneConfig('finale', FINALE_DEFAULTS).constructionGuides.enabled, false);
    store.clear(); previous.opacity = .31;
    store.set(sceneStorageKey('finale'), JSON.stringify({constructionGuides:previous}));
    assert.equal(loadSceneConfig('finale', FINALE_DEFAULTS).constructionGuides.enabled, false);
  } finally { globalThis.localStorage = old; }
});


test('длительности фразы настраиваются независимо и укладываются в фазу ухода', () => {
  const roomy = {...tl, fadeDuration: 12};
  const opts = {subtitleDrawDuration: 3, subtitleMoveDuration:2, subtitleHoldDuration:3, subtitleEraseDuration:1.5};
  const times = finaleTextTiming(roomy, opts);
  assert.equal(times.factor, 1);
  assert.ok(Math.abs(times.moveEnd - times.moveStart - 2) < 1e-9);
  assert.ok(Math.abs(times.eraseStart - times.moveEnd - 3) < 1e-9);
  assert.ok(Math.abs(times.eraseEnd - times.eraseStart - 1.5) < 1e-9);
  const start = roomy.drawDuration + roomy.emergeDuration + roomy.holdDuration;
  const atSeconds = n => computePhase(roomy.startDelay + start + n, roomy);
  const captionAt = n => finaleCaptionState(roomy.startDelay + start + n, roomy, captionStart, opts).lines.subtitle;
  assert.equal(finaleCues(atSeconds(times.moveEnd + .1), roomy, opts).blackout, 1);
  assert.equal(captionAt(times.eraseStart).outline, 1);
  assert.ok(captionAt((times.eraseStart + times.eraseEnd) / 2).outline < 1);
  assert.equal(captionAt(times.eraseEnd).outline, 0);
  const short = finaleTextTiming({...roomy, fadeDuration:.5}, opts);
  assert.ok(short.factor < 1 && short.moveEnd < short.eraseStart && short.eraseEnd <= .5);
  const slow = finaleCaptionState(roomy.startDelay + captionStart + 2, roomy, captionStart, opts).lines.subtitle;
  const fast = finaleCaptionState(roomy.startDelay + captionStart + 2, roomy, captionStart, {...opts, subtitleDrawDuration:.4}).lines.subtitle;
  assert.ok(slow.fill < fast.fill && fast.fill === 1);
  const saved = parseConfigJSON(configToJSON(mergeConfig(FINALE_DEFAULTS, {finale:opts})), FINALE_DEFAULTS);
  assert.equal(saved.finale.subtitleHoldDuration, 3); assert.equal(saved.finale.subtitleDrawDuration, 3);
});
