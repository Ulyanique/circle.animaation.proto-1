import test from 'node:test';
import assert from 'node:assert/strict';
import { EditorHistory } from '../src/editor-history.js';

const entry = (section, key, before, after) => ({section, key, before, after});

test('история хранит жест одним шагом и не меняет остальные настройки', () => {
  const h = new EditorHistory(), cfg = {logo: {offsetX: 0.8, offsetY: -0.3, scale: 1}, colors: {gold: 'gold'}};
  h.record('brand', [entry('logo', 'offsetX', 0, 0.8), entry('logo', 'offsetY', 0, -0.3)]);
  assert.equal(h.apply('brand', cfg, 'undo'), 'applied');
  assert.deepEqual(cfg.logo, {offsetX: 0, offsetY: 0, scale: 1});
  cfg.logo.scale = 1.4;
  assert.equal(h.apply('brand', cfg, 'redo'), 'applied');
  assert.deepEqual(cfg.logo, {offsetX: 0.8, offsetY: -0.3, scale: 1.4});
  assert.equal(cfg.colors.gold, 'gold');
});

test('каждая сцена хранит свои команды; новое действие сбрасывает redo', () => {
  const h = new EditorHistory(), a = {logo: {scale: 1.2}}, b = {logo: {scale: 1.6}};
  h.record('a', [entry('logo', 'scale', 1, 1.2)]);
  h.record('b', [entry('logo', 'scale', 1, 1.6)]);
  assert.equal(h.apply('a', a, 'undo'), 'applied');
  assert.equal(b.logo.scale, 1.6);
  a.logo.scale = 1.4;
  h.record('a', [entry('logo', 'scale', 1, 1.4)]);
  assert.equal(h.apply('a', a, 'redo'), 'empty');
  assert.equal(h.apply('b', b, 'undo'), 'applied');
  assert.equal(b.logo.scale, 1);
  assert.equal(h.record('a', [entry('logo', 'scale', 1.4, 1.4)]), false);
});

test('чужая правка не затирается; связанные изменения панели инвалидируют историю', () => {
  const h = new EditorHistory(), cfg = {logo: {scale: 1.2}, caption: {titleX: 0}};
  h.record('a', [entry('logo', 'scale', 1, 1.2)]);
  h.invalidate('a', 'caption', 'titleX');
  assert.equal(h.state('a').undo.length, 1);
  cfg.logo.scale = 1.7;
  assert.equal(h.apply('a', cfg, 'undo'), 'conflict');
  assert.equal(cfg.logo.scale, 1.7);
  assert.equal(h.state('a').undo.length, 0);
  h.record('a', [entry('logo', 'scale', 1, 1.7)]);
  h.invalidate('a', 'logo', 'scale');
  assert.equal(h.state('a').undo.length, 0);
});

test('история ограничена и очищается при замене настроек', () => {
  const h = new EditorHistory(2);
  h.record('a', [entry('logo', 'scale', 1, 2)]);
  h.record('a', [entry('logo', 'scale', 2, 3)]);
  h.record('a', [entry('logo', 'scale', 3, 4)]);
  assert.equal(h.state('a').undo.length, 2);
  h.clear('a');
  assert.equal(h.state('a').undo.length, 0);
});
