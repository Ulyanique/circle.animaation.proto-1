import test from 'node:test';
import assert from 'node:assert/strict';
import { FINALE_DEFAULTS } from '../src/scenes/finale.js';
import { BRAND_DEFAULTS } from '../src/scenes/brand.js';
import { finaleCues } from '../src/scenes/cues.js';
import { computePhase, plotSequence, seamCurtainOpacity } from '../src/timeline.js';
import { captionState } from '../src/caption.js';
import { cycleDuration } from '../src/runtime.js';
import { mergeConfig, parseConfigJSON, configToJSON } from '../src/config.js';

const tl = FINALE_DEFAULTS.timeline;
const fadeStart = tl.drawDuration + tl.emergeDuration + tl.holdDuration;
const at = p => computePhase(tl.startDelay + fadeStart + tl.fadeDuration * p, tl);

test('финал: надписи стираются, затем знак идёт к центру, удаляется и стирается', () => {
  assert.ok(Math.abs(cycleDuration(tl) - 18) < 1e-8);
  assert.equal(tl.fadeDuration, 5);
  const state = p => finaleCues(at(p), tl);
  const text = p => captionState(tl.startDelay + fadeStart + tl.fadeDuration * p, tl, undefined, 0.5).lines;
  assert.ok(text(0.2).title.outline > 0);
  assert.equal(state(0.2).center, 0);
  assert.equal(text(0.32).title.outline, 0);
  assert.equal(text(0.32).subtitle.outline, 0);
  assert.ok(state(0.42).center > 0 && state(0.42).center < 1);
  assert.equal(state(0.42).retreat, 0);
  assert.equal(state(0.55).center, 1);
  assert.ok(state(0.65).retreat > 0 && state(0.65).retreat < 1);
  assert.equal(state(0.65).draw, 1);
  assert.ok(state(0.9).draw > 0 && state(0.9).draw < 1);
  assert.ok(state(0.9).outline > 0);
  const phase = { ...at(0.9), draw: state(0.9).draw };
  assert.equal(plotSequence(phase, tl).reverse, true);
  const rest = computePhase(tl.startDelay + fadeStart + tl.fadeDuration + 0.3, tl);
  assert.equal(finaleCues(rest, tl).center, 1);
  assert.ok(plotSequence(rest, tl).sweep > 0, 'после контура остаётся окружность');
  assert.equal(seamCurtainOpacity(computePhase(tl.startDelay + cycleDuration(tl) - 1 / 60, tl), tl), 1);
});

test('движение к центру и удаление непрерывны при перемотке и на стыках', () => {
  const a = finaleCues(at(0.42), tl);
  finaleCues(at(0.85), tl);
  assert.deepEqual(finaleCues(at(0.42), tl), a);
  for (const boundary of [0, 0.32, 0.53, 0.78, 1]) {
    const before = finaleCues(at(Math.max(0, boundary - 1e-6)), tl);
    const after = finaleCues(at(Math.min(1, boundary + 1e-6)), tl);
    assert.ok(Math.abs(before.center - after.center) < 1e-4);
    assert.ok(Math.abs(before.retreat - after.retreat) < 1e-4);
  }
});

test('глубина и конечный размер финала сохраняются независимо от других сцен', () => {
  const cfg = mergeConfig(FINALE_DEFAULTS, { finale: {retreatDepth: 3.5, retreatScale: 0.4} });
  const restored = parseConfigJSON(configToJSON(cfg), FINALE_DEFAULTS);
  assert.deepEqual(restored.finale, {retreatDepth: 3.5, retreatScale: 0.4});
  assert.equal(BRAND_DEFAULTS.finale, undefined);
});
