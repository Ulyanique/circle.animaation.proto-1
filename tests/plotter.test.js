import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Plotter } from '../src/plotter.js';
import { WAITING_DEFAULTS } from '../src/scenes/waiting.js';
import { mergeConfig } from '../src/config.js';
import { computePhase, plotSequence, seamCurtainOpacity } from '../src/timeline.js';

function fakeLogo() {
  const root = new THREE.Group(), outline = new THREE.Group(); root.add(outline);
  return {root, outline, outlineAnchors: new Float32Array([.12, -.2]), parsed: {cx:0, cy:0, subPaths:[{getPointAt: () => ({x:0,y:0})}]}};
}

test('в интро две противоположные точки совместно рисуют всю окружность до знака', () => {
  for (const duration of [.5, 2.6, 8]) {
    const cfg = mergeConfig(WAITING_DEFAULTS, {timeline: {drawDuration: duration}}), tl = cfg.timeline;
    const at = local => computePhase(tl.startDelay + local, tl);
    const start = Math.min(.5, duration * .3), end = duration * .68;
    assert.equal(seamCurtainOpacity(at(start), tl), 0);
    const p = new Plotter(new THREE.Texture(), fakeLogo(), {twoHeads:true});
    p.update(at(start), cfg);
    assert.equal(p.uniforms.uSweep.value, 0); assert.ok(p.head.material.opacity > 0 && p.head2.material.opacity > 0);
    const initial = p.head.position.clone();
    p.update(at((start + end) / 2), cfg);
    assert.ok(p.uniforms.uSweep.value > 0 && p.uniforms.uSweep.value < 1);
    assert.ok(p.uniforms.uOpacity.value > 0 && p.head.material.opacity > 0 && p.head2.material.opacity > 0);
    assert.ok(Math.abs(p.head.position.x + p.head2.position.x) < 1e-9);
    assert.ok(Math.abs(p.head.position.y + p.head2.position.y) < 1e-9);
    assert.notDeepEqual(p.head.position.toArray(), initial.toArray());
    assert.equal(at((start + end) / 2).draw, 0);
    p.update(at(end), cfg);
    assert.equal(p.uniforms.uSweep.value, 1); assert.equal(p.uniforms.uTransfer.value, 0);
    assert.equal(at(end).draw, 0);
    // Две полуокружности начинаются и заканчиваются в общих точках.
    const a = p.line.geometry.getAttribute('position'), b = p.line2.geometry.getAttribute('position');
    for (const [i, j] of [[0, b.count - 2], [a.count - 2, 0]]) {
      assert.ok(Math.hypot(a.getX(i)-b.getX(j), a.getY(i)-b.getY(j)) < 1e-6);
    }
    p.update(at(duration * .83), cfg);
    assert.equal(p.uniforms.uTransfer.value, 1); assert.equal(p.head2.material.opacity, 0);
    assert.ok(at(duration * .83).draw > 0);
    const result = p.head.position.clone();
    p.update(at((start + end) / 2), cfg); p.update(at(duration * .83), cfg);
    assert.ok(p.head.position.distanceTo(result) < 1e-9, 'перемотка не меняет состояние');
    p.dispose();
  }
});

test('другие сцены сохраняют исходную одну точку и обратный уход', () => {
  const cfg = mergeConfig(WAITING_DEFAULTS, {}), tl = cfg.timeline;
  const plotter = new Plotter(new THREE.Texture(), fakeLogo());
  assert.equal(plotter.head2, undefined); assert.equal(plotter.line2, undefined);
  const phase = computePhase(tl.startDelay + tl.drawDuration * .6, tl);
  plotter.update(phase, cfg);
  assert.equal(plotter.uniforms.uSweep.value, plotSequence(phase, tl).sweep);
  const outro = computePhase(tl.startDelay + tl.drawDuration + tl.emergeDuration + tl.holdDuration + tl.fadeDuration * .9, tl);
  assert.equal(plotSequence(outro, tl, {intro:true}).reverse, true);
  plotter.dispose();
});
