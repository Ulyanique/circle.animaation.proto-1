import test from 'node:test';
import assert from 'node:assert/strict';
import { transitionDuration, transitionEase, outgoingOpacity } from '../src/scene-transition.js';
import { SCENES } from '../src/scenes/catalog.js';
import { configToJSON, parseConfigJSON, projectToJSON, parseProjectJSON, SCHEMA } from '../src/config.js';

test('переходы наследуют старое значение и хранятся независимо в проекте', () => {
  const scenes = SCENES.filter(s => s.defaults), ids = scenes.map(s => s.id);
  const configs = Object.fromEntries(scenes.map(s => [s.id, parseConfigJSON('{}', s.defaults)]));
  for (const cfg of Object.values(configs)) assert.equal(transitionDuration(cfg), .9);
  configs.brand.transition.duration = 1.5; configs['photo-pause'].transition.duration = 0;
  assert.equal(configs.waiting.transition.duration, .9);
  assert.equal(parseConfigJSON(configToJSON(configs.brand), scenes[1].defaults).transition.duration, 1.5);
  const restored = parseProjectJSON(projectToJSON(configs, ids), ids);
  assert.equal(restored.scenes['photo-pause'].transition.duration, 0);
  assert.ok(SCHEMA.some(section => section.id === 'transition'));
  assert.equal(transitionDuration({}), .9);
  assert.equal(transitionDuration({transition:{duration:NaN}}), .9);
  assert.equal(transitionDuration({transition:{duration:10}}), 5);
  assert.equal(transitionDuration({transition:{duration:-1}}), 0);
});

test('кривая CSS и прозрачность покадрового растворения ограничены и плавны', () => {
  assert.equal(transitionEase(0), 0); assert.equal(transitionEase(1), 1);
  assert.ok(Math.abs(transitionEase(.2) - .0816598) < .00001);
  assert.ok(Math.abs(transitionEase(.5) - .5) < .000001);
  let prev = 1;
  for (let frame = 0; frame <= 54; frame++) {
    const opacity = outgoingOpacity(frame, 60, .9);
    assert.ok(opacity <= prev && opacity >= 0 && opacity <= 1); prev = opacity;
  }
  assert.equal(outgoingOpacity(0, 60, .9), 1);
  assert.equal(outgoingOpacity(54, 60, .9), 0);
  assert.equal(outgoingOpacity(0, 60, 0), 0);
});

test('экспорт не оставляет изменённое состояние контекста при ошибке наложения', async () => {
  const {drawOutgoingFrame} = await import('../src/scene-transition.js');
  const calls = [];
  const ctx = {globalAlpha: 1, save() { calls.push('save'); },
    restore() { calls.push('restore'); }, drawImage() { calls.push('draw'); throw new Error('canvas error'); }};
  assert.throws(() => drawOutgoingFrame(ctx, {}, 0, 60, .9, 1920, 1080), /canvas error/);
  assert.deepEqual(calls, ['save', 'draw', 'restore']);
  calls.length = 0;
  assert.equal(drawOutgoingFrame(ctx, {}, 0, 60, 0, 1920, 1080), false);
  assert.deepEqual(calls, []);
});
