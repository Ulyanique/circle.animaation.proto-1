import test from 'node:test';
import assert from 'node:assert/strict';
import { DitherEffect } from '../src/dither-effect.js';

test('dither strength is clamped to a sane range', () => {
  const effect = new DitherEffect();
  assert.equal(effect.strength, 1);
  effect.strength = 2.5;
  assert.equal(effect.strength, 2.5);
  effect.strength = -3;
  assert.equal(effect.strength, 0);
  effect.strength = 99;
  assert.equal(effect.strength, 4);
  effect.strength = 'nonsense';
  assert.equal(effect.strength, 0);
});

test('dither effect carries its uniform under the expected name', () => {
  const effect = new DitherEffect({ strength: 0.75 });
  assert.ok(effect.uniforms.has('strength'));
  assert.equal(effect.uniforms.get('strength').value, 0.75);
});
