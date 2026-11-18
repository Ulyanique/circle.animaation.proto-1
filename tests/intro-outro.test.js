import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { WAITING_DEFAULTS } from '../src/scenes/waiting.js';
import { mergeConfig } from '../src/config.js';
import { introCues, introSequence, introOutro } from '../src/scenes/cues.js';
import { introGuidesVisibility, introGuidesProgress } from '../src/scenes/construction-layout.js';
import { computePhase, plotSequence } from '../src/timeline.js';
import { captionState } from '../src/caption.js';
import { Plotter } from '../src/plotter.js';
import { Background } from '../src/fx.js';

const logo = () => {
  const root = new THREE.Group(), outline = new THREE.Group(); root.add(outline);
  return {root, outline, outlineAnchors: new Float32Array([.1, .2]), parsed:{cx:0, cy:0, subPaths:[{getPointAt: u => ({x:u, y:0})}]}};
};

test('интро уходит в обратном порядке: титры, подъём, круги, знак, орбита и разметка', () => {
  for (const fadeDuration of [2.3, 5, 8]) for (const restDuration of [0, .2, 1.2]) {
    const cfg = mergeConfig(WAITING_DEFAULTS, {timeline: {fadeDuration, restDuration}}), tl = cfg.timeline;
    const start = tl.drawDuration + tl.emergeDuration + tl.holdDuration;
    const phase = p => computePhase(tl.startDelay + start + p * fadeDuration, tl);
    const sequence = p => introSequence(phase(p), tl, cfg.intro);
    const exit = p => introOutro(phase(p), tl);
    const captions = p => captionState(tl.startDelay + start + p * fadeDuration, tl, sequence(p).captionStart, .42).lines;
    assert.equal(captions(.26).title.outline, 0);
    assert.equal(sequence(.24).lift, 1); assert.equal(sequence(.26).corners, 1);
    assert.ok(sequence(.33).lift > 0 && sequence(.33).lift < 1);
    assert.equal(sequence(.45).lift, 0); assert.ok(sequence(.49).corners > 0 && sequence(.49).corners < 1);
    assert.equal(sequence(.54).corners, 0); assert.equal(exit(.54).reveal, 1);
    assert.ok(exit(.59).reveal > 0 && exit(.59).reveal < 1);
    assert.equal(exit(.67).reveal, 0); assert.equal(exit(.67).draw, 1);
    assert.ok(exit(.72).draw > 0 && exit(.72).draw < 1);
    assert.ok(introGuidesVisibility(phase(.72), tl) > 0);
    const withExit = p => ({...phase(p), ...exit(p)});
    const plot = new Plotter(new THREE.Texture(), logo(), {twoHeads:true});
    plot.update(withExit(.72), cfg);
    assert.ok(plot.head.material.opacity > 0 && plot.uniforms.uTransfer.value === 1);
    plot.update(withExit(.82), cfg);
    assert.ok(plot.uniforms.uTransfer.value > 0 && plot.uniforms.uTransfer.value < 1);
    plot.update(withExit(.92), cfg);
    assert.ok(plot.head.material.opacity > 0 && plot.head2.material.opacity > 0);
    assert.ok(plot.uniforms.uSweep.value > 0 && plot.uniforms.uSweep.value < 1);
    assert.ok(introGuidesProgress(phase(.92), tl) > 0 && introGuidesProgress(phase(.92), tl) < 1);
    assert.ok(introCues(phase(.94), tl).approach > 0.99, 'камера вернулась в стартовое положение');
    if (restDuration > 0) {
      const rest = computePhase(tl.startDelay + start + fadeDuration + restDuration * .1, tl);
      assert.equal(plotSequence(rest, tl, {intro:true}).head, 0);
      assert.equal(introGuidesVisibility(rest, tl), 0);
    }
    plot.dispose();
  }
});

test('фоновый ореол затухает радиально, а не обрезается горизонтальной маской', () => {
  const bg = new Background(), shader = bg.material.fragmentShader;
  assert.match(shader, /halo = exp\(-radius \* radius \* 2\.4\)/);
  assert.match(shader, /0\.14 \* halo \+ 0\.50 \* rays \* clearCaption/);
  assert.doesNotMatch(shader, /\(0\.14 \* halo \+ 0\.50 \* rays\) \* clearCaption/);
  bg.mesh.geometry.dispose(); bg.material.dispose();
});

test('блик и приглушение углов следуют фактическому началу титров интро и финала', async () => {
  const { heroGlint, compositionFocus } = await import('../src/timeline.js');
  const { FINALE_DEFAULTS } = await import('../src/scenes/finale.js');
  for (const defaults of [WAITING_DEFAULTS, FINALE_DEFAULTS]) for (const delay of [0, .7, 2]) {
    const cfg = mergeConfig(defaults, {intro:{titleDelay:delay}}), tl = cfg.timeline;
    const phase = local => computePhase(tl.startDelay + local, tl);
    const seq = introSequence(phase(tl.drawDuration + tl.emergeDuration), tl, cfg.intro);
    const start = seq.captionStart, exit = tl.drawDuration + tl.emergeDuration + tl.holdDuration;
    assert.equal(heroGlint(phase(start - .2), tl, start).intensity, 0);
    assert.ok(heroGlint(phase(start + .7), tl, start).intensity > .8);
    assert.equal(heroGlint(phase(start + 2.2), tl, start).intensity, 0);
    assert.equal(heroGlint(phase(exit + .01), tl, start).intensity, 0);
    assert.equal(compositionFocus(phase(start - .4), tl, start), 0);
    assert.equal(compositionFocus(phase(start + 1.4), tl, start), 1);
  }
});

test('если для титра не осталось времени, блик не вспыхивает на выходе', async () => {
  const { heroGlint } = await import('../src/timeline.js');
  const tl = {...WAITING_DEFAULTS.timeline, holdDuration:1};
  const end = tl.drawDuration + tl.emergeDuration + tl.holdDuration;
  for (const t of [end-.1, end, end+.1]) {
    assert.equal(heroGlint(computePhase(tl.startDelay+t, tl), tl, end+1).intensity, 0);
  }
});

test('обратная точка без скачка передаёт контур орбите на выходе интро', () => {
  for (const fadeDuration of [1, 2.3, 8]) {
    const tl = {...WAITING_DEFAULTS.timeline, fadeDuration};
    const start = tl.drawDuration + tl.emergeDuration + tl.holdDuration;
    const sample = p => {
      const phase = computePhase(tl.startDelay + start + p * fadeDuration, tl);
      return plotSequence({...phase, ...introOutro(phase, tl)}, tl, {intro:true});
    };
    const before = sample(.80 - 1e-5), after = sample(.80 + 1e-5);
    for (const key of ['sweep', 'transfer', 'head', 'trace']) {
      assert.ok(Math.abs(before[key] - after[key]) < .001, `${key} скачет при передаче`);
    }
    assert.ok(sample(.73).trace < sample(.70).trace);
  }
});

test('режиссёрская подача задерживает правый круг, не меняя начало и конец', async () => {
  const {introCornerEnvelopes} = await import('../src/scenes/cues.js');
  for (const env of [0, .1, .3, .5, .8, 1]) {
    const legacy = introCornerEnvelopes(env, false), directed = introCornerEnvelopes(env, true);
    assert.equal(legacy.left, env); assert.equal(legacy.right, env);
    assert.equal(directed.left, env); assert.ok(directed.right <= env && directed.right >= 0);
  }
  assert.equal(introCornerEnvelopes(0, true).right, 0);
  assert.equal(introCornerEnvelopes(1, true).right, 1);
  assert.ok(introCornerEnvelopes(.5, true).right < .5);
  for (let i=1; i<=100; i++) assert.ok(introCornerEnvelopes(i/100,true).right >= introCornerEnvelopes((i-1)/100,true).right);
});

test('режиссёрская подача настраивается и включена только для интро', async () => {
  const {BRAND_DEFAULTS} = await import('../src/scenes/brand.js');
  const {PHOTO_PAUSE_DEFAULTS} = await import('../src/scenes/photo-pause.js');
  const {FINALE_DEFAULTS} = await import('../src/scenes/finale.js');
  const {SCHEMA, configToJSON, parseConfigJSON} = await import('../src/config.js');
  assert.equal(WAITING_DEFAULTS.logo.directedMotion, true);
  for (const scene of [BRAND_DEFAULTS, PHOTO_PAUSE_DEFAULTS, FINALE_DEFAULTS]) assert.equal(scene.logo.directedMotion, false);
  assert.ok(SCHEMA.find(x=>x.id==='logo').fields.some(x=>x.key==='directedMotion'));
  const cfg=mergeConfig(WAITING_DEFAULTS,{logo:{directedMotion:false}});
  assert.equal(parseConfigJSON(configToJSON(cfg), WAITING_DEFAULTS).logo.directedMotion,false);
});
