import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ConstructionGuides } from '../src/construction-guides.js';
import { SCENES } from '../src/scenes/catalog.js';
import { mergeConfig, configToJSON, parseConfigJSON } from '../src/config.js';

test('линии следуют знаку, перекрестия — двум кругам и скрываются по отдельным флагам', () => {
  const brand = SCENES.find(s => s.id === 'waiting');
  const cfg = mergeConfig(brand.defaults, {}), guides = new ConstructionGuides();
  const root = {position: new THREE.Vector3(.5, -.3, 0)}, sides = {left: {x:-4,y:2}, right: {x:4,y:-2}};
  const phase = {reveal:1, rings:1, beforeStart:false};
  guides.update(10, phase, cfg, root, sides);
  assert.equal(guides.group.visible, true); assert.equal(guides.group.position.x, .5);
  assert.equal(guides.crosses.left.position.x + guides.group.position.x, -4);
  assert.equal(guides.crosses.right.position.x + guides.group.position.x, 4);
  assert.ok(guides.material.opacity > 0 && guides.material.opacity < .2);
  cfg.rings.leftVisible = false; cfg.constructionGuides.scale = 2;
  guides.update(10, phase, cfg, root, sides);
  assert.equal(guides.crosses.left.visible, false); assert.equal(guides.crosses.right.visible, true);
  cfg.constructionGuides.enabled = false; guides.update(10, phase, cfg, root, sides);
  assert.equal(guides.group.visible, false);
  assert.deepEqual(parseConfigJSON(configToJSON(cfg), brand.defaults).constructionGuides, cfg.constructionGuides);
  for (const scene of SCENES.filter(s => s.defaults && s.status === 'ready' && s.id !== 'waiting' && s.id !== 'finale')) assert.equal(scene.defaults.constructionGuides.enabled, false);
});

test('для интро крупное перекрестие заменяет направляющие и предшествует контуру', async () => {
  const { constructionSegments, introCrossSegments, introGuidesVisibility, introGuidesProgress } = await import('../src/scenes/construction-layout.js');
  const { computePhase } = await import('../src/timeline.js');
  const scene = SCENES.find(s => s.id === 'waiting'), cfg = mergeConfig(scene.defaults, {}), tl = cfg.timeline;
  const cross = introCrossSegments();
  assert.deepEqual(cross, [[-2.25, 0], [2.25, 0], [0, -1.55], [0, 1.55]]);
  const segments = constructionSegments();
  const slope = (a, b) => (b[0] - a[0]) / (b[1] - a[1]);
  assert.ok(Math.abs(slope(segments[0], segments[1]) - slope(segments[2], segments[3])) < 1e-10);
  assert.ok(Math.abs(slope(segments[4], segments[5]) - slope(segments[6], segments[7])) < 1e-10);
  assert.ok(Math.abs(slope(segments[0], segments[1]) + slope(segments[4], segments[5])) < 1e-10);
  assert.equal(segments[0][1], 5); assert.equal(segments[1][1], -5);
  const early = computePhase(tl.startDelay + tl.drawDuration * .3, tl);
  assert.ok(introGuidesVisibility(early, tl) > .9); assert.equal(early.draw, 0); assert.equal(early.reveal, 0);
  assert.ok(introGuidesProgress(early, tl) > 0 && introGuidesProgress(early, tl) < 1);
  const done = computePhase(tl.startDelay + tl.drawDuration * .55, tl);
  assert.equal(introGuidesProgress(done, tl), 1); assert.equal(done.draw, 0);
  assert.equal(introGuidesVisibility(computePhase(0, tl), tl), 0);
  assert.equal(introGuidesVisibility(computePhase(tl.startDelay + tl.drawDuration + tl.emergeDuration, tl), tl), 0);
  const guides = new ConstructionGuides(), root = new THREE.Group();
  root.position.set(.3, .2, -.4); root.scale.setScalar(.5);
  cfg.constructionGuides.offsetX = .7; cfg.constructionGuides.offsetY = -.3;
  const sides = {left: {x:-4,y:2}, right: {x:4,y:-2}};
  guides.update(tl.startDelay + tl.drawDuration * .3, early, cfg, root, sides, true);
  guides.group.updateMatrixWorld(true);
  const actual = guides.crosses.left.getWorldPosition(new THREE.Vector3());
  assert.ok(Math.abs(actual.x - sides.left.x) < 1e-9 && Math.abs(actual.y - sides.left.y) < 1e-9);
  assert.ok(Math.abs(actual.z - .02) < 1e-9);
  assert.equal(guides.center.visible, false); assert.equal(guides.introCenter.visible, true);
  assert.equal(guides.introCenter.scale.x, cfg.rings.radius);
  const worldCenter = guides.introCenter.getWorldPosition(new THREE.Vector3());
  assert.ok(Math.abs(worldCenter.z + .08) < 1e-9);
  const fade = guides.introCenter.geometry.getAttribute('aFade');
  assert.equal(fade.getX(0), 0); assert.ok(fade.getX(32) > .99); assert.ok(fade.getX(63) < .0001);
  const shader = {vertexShader:'#include <common>\n#include <begin_vertex>', fragmentShader:'#include <common>\n#include <color_fragment>'};
  guides.material.onBeforeCompile(shader, null);
  assert.match(shader.fragmentShader, /diffuseColor\.a \*= vGuideFade/);
  assert.ok(guides.introCenter.geometry.drawRange.count > 0 && guides.introCenter.geometry.drawRange.count < guides.introCenter.geometry.getAttribute('position').count);
});

test('разметка перенесена однократно без потери её прочих настроек', async () => {
  const { loadSceneConfig, saveSceneConfig, sceneStorageKey } = await import('../src/config.js');
  const store = new Map(), old = globalThis.localStorage;
  globalThis.localStorage = {getItem: k => store.get(k) ?? null, setItem: (k,v) => store.set(k,String(v)), removeItem: k => store.delete(k)};
  try {
    for (const [id, previous] of [['waiting', false], ['brand', true]]) {
      const defaults = SCENES.find(s => s.id === id).defaults;
      store.set(sceneStorageKey(id), JSON.stringify({constructionGuides: {enabled: previous, color: '#123456'}}));
      const cfg = loadSceneConfig(id, defaults);
      assert.equal(cfg.constructionGuides.enabled, !previous); assert.equal(cfg.constructionGuides.color, '#123456');
      cfg.constructionGuides.enabled = previous; saveSceneConfig(id, cfg);
      assert.equal(loadSceneConfig(id, defaults).constructionGuides.enabled, previous);
    }
  } finally { globalThis.localStorage = old; }
});


test('разметка прорисовывается и при пользовательском интервале', async () => {
  const { computePhase } = await import('../src/timeline.js');
  const cfg = mergeConfig(SCENES.find(s => s.id === 'waiting').defaults, {});
  Object.assign(cfg.constructionGuides, {timingMode:'custom', timingStart:10, timingEnd:90, timingFade:25});
  const tl = cfg.timeline, cycle = tl.drawDuration + tl.emergeDuration + tl.holdDuration + tl.fadeDuration + tl.restDuration;
  const guides = new ConstructionGuides(), root = new THREE.Group(), corners = {left:{x:-1,y:1}, right:{x:1,y:-1}};
  const update = fraction => { const time = tl.startDelay + fraction * cycle; guides.update(time, computePhase(time, tl), cfg, root, corners, true); return guides.introCenter.geometry.drawRange.count; };
  const early = update(.19), later = update(.24);
  assert.ok(early > 0 && later > early); assert.equal(later, guides.introCenter.geometry.getAttribute('position').count);
  assert.equal(update(.19), early);
});
