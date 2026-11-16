import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { apertureCue, apertureSegments } from '../src/scenes/aperture-layout.js';
import { PhotoAperture } from '../src/photo-aperture.js';
import { PHOTO_PAUSE_DEFAULTS } from '../src/scenes/photo-pause.js';
import { mergeConfig, parseConfigJSON, configToJSON } from '../src/config.js';
import { computePhase } from '../src/timeline.js';

test('апертура раскрывается до начала обводки логотипа при изменении длительностей', () => {
  const closed = apertureSegments(0), opened = apertureSegments(1);
  assert.ok(closed.length > 1000); assert.equal(closed.length, opened.length);
  // После окружности идёт первая лопасть: её внутренняя вершина движется наружу.
  const inner = 120 * 6 + 17 * 6 + 3;
  assert.ok(Math.hypot(opened[inner], opened[inner + 1]) > Math.hypot(closed[inner], closed[inner + 1]) + .75);
  for (const duration of [0.5, 2.6, 8]) {
    const cfg = mergeConfig(PHOTO_PAUSE_DEFAULTS, {timeline: {drawDuration: duration}}), tl = cfg.timeline;
    const at = t => computePhase(tl.startDelay + t, tl);
    assert.deepEqual(apertureCue({beforeStart:true, local:0}, tl), {open:0, opacity:0});
    const mid = apertureCue(at(duration * .4), tl);
    assert.ok(mid.open > 0 && mid.open < 1 && mid.opacity > 0);
    assert.equal(apertureCue(at(duration * .62), tl).open, 1);
    assert.equal(at(duration * .62).draw, 0);
    assert.equal(at(duration * .75).draw, 0);
    assert.ok(at(duration * .8).draw > 0);
    assert.equal(apertureCue(at(duration * 1.1), tl).opacity, 0);
  }
});

test('апертура управляется и сохраняется отдельно от текста и знака', () => {
  const cfg = mergeConfig(PHOTO_PAUSE_DEFAULTS, {photo: {apertureOffsetX: .4, apertureRadius: 1.7}});
  const a = new PhotoAperture(), root = new THREE.Group(); root.position.set(.2, -.1, 0);
  const phase = computePhase(cfg.timeline.startDelay + cfg.timeline.drawDuration * .4, cfg.timeline);
  a.update(phase, cfg, root);
  assert.equal(a.group.visible, true); assert.ok(Math.abs(a.group.position.x - .6) < 1e-9);
  assert.equal(a.group.scale.x, 1.7); assert.equal(a.geometry.drawRange.count, Infinity);
  const previous = [...a.geometry.getAttribute('position').array];
  a.update(computePhase(cfg.timeline.startDelay + cfg.timeline.drawDuration * .2, cfg.timeline), cfg, root);
  assert.notDeepEqual([...a.geometry.getAttribute('position').array], previous);
  a.update(phase, cfg, root); assert.deepEqual([...a.geometry.getAttribute('position').array], previous);
  cfg.photo.apertureEnabled = false; a.update(phase, cfg, root); assert.equal(a.group.visible, false);
  assert.equal(parseConfigJSON(configToJSON(cfg), PHOTO_PAUSE_DEFAULTS).photo.apertureEnabled, false);
  assert.equal(cfg.photo.textEnabled, false); assert.equal(cfg.logo.visible, true);
  a.dispose();
});
