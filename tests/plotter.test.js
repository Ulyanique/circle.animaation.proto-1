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

test('режиссёрский жест интро плавно ускоряется и не меняет соседние сцены', () => {
  const tl = WAITING_DEFAULTS.timeline, D=tl.drawDuration;
  const start=Math.min(.5,D*.3), end=D*.68, transferEnd=D*.83;
  const sample=(t, opts) => plotSequence(computePhase(tl.startDelay+t,tl),tl,opts);
  const directed={intro:true,directed:true};
  const old={intro:true};
  assert.equal(sample(start,directed).sweep,0); assert.equal(sample(end,directed).sweep,1);
  assert.equal(sample(end,directed).transfer,0); assert.equal(sample(transferEnd,directed).transfer,1);
  const dt=(end-start)/20;
  const progress=i=>sample(start+i*dt,directed).sweep;
  assert.ok(progress(1)<sample(start+dt,old).sweep, 'мягкое начало');
  assert.ok(progress(20)-progress(19)<sample(end,old).sweep-sample(end-dt,old).sweep, 'мягкая остановка');
  for(let i=1;i<=20;i++)assert.ok(progress(i)>=progress(i-1));
  const phase=computePhase(tl.startDelay+start+dt,tl);
  assert.deepEqual(plotSequence(phase,tl,{directed:true}),plotSequence(phase,tl));
  assert.deepEqual(plotSequence(phase,tl,{intro:true,finale:true,directed:true}),plotSequence(phase,tl,{intro:true,finale:true}));
  const cfg=mergeConfig(WAITING_DEFAULTS, {}), plotter=new Plotter(new THREE.Texture(),fakeLogo(),{twoHeads:true});
  plotter.update(phase,cfg); assert.equal(plotter.uniforms.uDirected.value,1);
  const first=plotter.head.position.clone();
  plotter.update(computePhase(tl.startDelay+end,tl),cfg);plotter.update(phase,cfg);
  assert.ok(first.distanceTo(plotter.head.position)<1e-9);
  cfg.logo.directedMotion=false;plotter.update(phase,cfg);assert.equal(plotter.uniforms.uDirected.value,0);
  assert.equal(plotter.head.scale.x,.17);
  plotter.dispose();
});
