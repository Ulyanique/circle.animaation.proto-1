import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { effectVisibility, EFFECT_TIMING_DEFAULTS } from '../src/effect-timing.js';
import { BrandDecor } from '../src/brand-decor.js';
import { ParticleCloud } from '../src/particle-cloud.js';
import { BackgroundGlow } from '../src/background-glow.js';
import { BACKGROUND_GLOW_IDS } from '../src/background-glow-config.js';
import { SCENES } from '../src/scenes/catalog.js';
import { mergeConfig, configToJSON, parseConfigJSON, projectToJSON, parseProjectJSON } from '../src/config.js';

const timeline = {startDelay: 1, drawDuration: 5, emergeDuration: 5, holdDuration: 5, fadeDuration: 3, restDuration: 2};
const phase = {beforeStart: false, reveal: 0, rings: 0};
const custom = {timingMode: 'custom', timingStart: 20, timingEnd: 80, timingFade: 20};

test('огибающая совместима с прежними фазами, независима и повторяема при перемотке', () => {
  const previous = {beforeStart: false, reveal: .5, rings: .7};
  assert.equal(effectVisibility(10, previous, timeline, {}), .35);
  assert.equal(effectVisibility(0, {...previous, beforeStart: true}, timeline, {}), 0);
  const at = t => effectVisibility(t, phase, timeline, custom);
  assert.equal(at(0), 0); assert.equal(at(4), 0);
  assert.equal(at(11), 1); assert.equal(at(18), 0);
  assert.equal(at(31), at(11));
  assert.ok(at(6.5) > 0 && at(6.5) < 1);
  assert.ok(at(16.5) > 0 && at(16.5) < 1);
  assert.equal(at(21), 0);
  assert.equal(effectVisibility(21, phase, {...timeline, holdDuration: 25}, custom), 1);
  assert.ok(Number.isFinite(effectVisibility(20.9, phase, timeline, {...custom, timingStart: 99, timingEnd: 1, timingFade: 0})));
});

test('реальные объекты эффектов используют свой интервал вместо фаз логотипа', () => {
  for (const scene of SCENES.filter(s => s.defaults)) {
    const config = mergeConfig(scene.defaults, {timeline, decor: {present: true, enabled: true, ...custom},
      particleCloud: {present: true, enabled: true, ...custom},
      backgroundGlow: {present: true, enabled: true, ...custom},
      backgroundGlow2: {present: true, enabled: true, timingMode: 'custom', timingStart: 50, timingEnd: 95, timingFade: 15}});
    const texture = new THREE.Texture(), root = new THREE.Group();
    const ring = new BrandDecor(), cloud = new ParticleCloud();
    const glow = new BackgroundGlow(texture), glow2 = new BackgroundGlow(texture, 'backgroundGlow2');
    const update = t => { ring.update(t, phase, config, root); cloud.update(t, phase, config); glow.update(t, phase, config); glow2.update(t, phase, config); };
    update(4); assert.equal(ring.group.visible, false); assert.equal(cloud.group.visible, false); assert.equal(glow.group.visible, false);
    update(7); assert.equal(ring.group.visible, true); assert.equal(cloud.group.visible, true); assert.equal(glow.group.visible, true); assert.equal(glow2.group.visible, false);
    update(13); assert.equal(glow2.group.visible, true);
    update(18); assert.equal(ring.group.visible, false); assert.equal(cloud.group.visible, false); assert.equal(glow.group.visible, false);
    update(11); const opacity = [ring.ring.material.opacity, cloud.material.opacity, glow.material.opacity];
    update(18); update(11);
    assert.deepEqual([ring.ring.material.opacity, cloud.material.opacity, glow.material.opacity], opacity);
    ring.group.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); });
    cloud.dispose(); cloud.geometry.dispose(); cloud.material.dispose();
    glow.material.dispose(); glow2.material.dispose(); texture.dispose();
  }
});

test('старые настройки сохраняют прежние фазы; новые интервалы сохраняются по эффектам и сценам', () => {
  const scenes = SCENES.filter(s => s.defaults), configs = {};
  for (const [index, scene] of scenes.entries()) {
    const legacy = parseConfigJSON('{"decor":{"enabled":true},"particleCloud":{"present":true},"backgroundGlow":{"present":true}}', scene.defaults);
    for (const section of ['decor', 'particleCloud', ...BACKGROUND_GLOW_IDS]) {
      assert.deepEqual(Object.fromEntries(Object.keys(EFFECT_TIMING_DEFAULTS).map(k => [k, legacy[section][k]])), EFFECT_TIMING_DEFAULTS);
    }
    const cfg = mergeConfig(scene.defaults, {decor: {...custom, timingStart: 10 + index}, particleCloud: {...custom, timingStart: 15 + index},
      backgroundGlow: {...custom, timingStart: 20 + index}, backgroundGlow2: {...custom, timingStart: 30 + index}});
    configs[scene.id] = cfg;
    const restored = parseConfigJSON(configToJSON(cfg), scene.defaults);
    for (const section of ['decor', 'particleCloud', ...BACKGROUND_GLOW_IDS]) assert.deepEqual(restored[section], cfg[section]);
    assert.equal(scene.defaults.decor.timingMode, 'scene');
  }
  const ids = scenes.map(s => s.id), project = parseProjectJSON(projectToJSON(configs, ids), ids);
  for (const id of ids) for (const section of ['decor', 'particleCloud', ...BACKGROUND_GLOW_IDS]) assert.deepEqual(project.scenes[id][section], configs[id][section]);
});

test('характер проявления меняет огибающую только собственного интервала', () => {
  const t = 6.5;
  const normal = effectVisibility(t, phase, timeline, custom);
  const soft = effectVisibility(t, phase, timeline, {...custom, timingCurve:'soft'});
  const bright = effectVisibility(t, phase, timeline, {...custom, timingCurve:'bright'});
  assert.ok(0 < soft && soft < normal && normal < bright && bright < 1);
  for (const curve of ['normal', 'soft', 'bright']) {
    assert.equal(effectVisibility(4, phase, timeline, {...custom, timingCurve:curve}), 0);
    assert.equal(effectVisibility(11, phase, timeline, {...custom, timingCurve:curve}), 1);
    assert.equal(effectVisibility(t, phase, timeline, {...custom, timingCurve:curve}), effectVisibility(t + 20, phase, timeline, {...custom, timingCurve:curve}));
    assert.equal(effectVisibility(t, {beforeStart:false, reveal:.5, rings:.7}, timeline, {timingMode:'scene', timingCurve:curve}), .35);
  }
  assert.equal(effectVisibility(t, phase, timeline, {...custom, timingCurve:'unknown'}), normal);
  const scene = SCENES.find(s => s.defaults);
  const restored = parseConfigJSON(configToJSON(mergeConfig(scene.defaults, {decor:{...custom, timingCurve:'soft'}})), scene.defaults);
  assert.equal(restored.decor.timingCurve, 'soft');
});
