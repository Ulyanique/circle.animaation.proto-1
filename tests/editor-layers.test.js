import test from 'node:test';
import assert from 'node:assert/strict';
import { EDITOR_LAYERS, layersForScene, editorViewport } from '../src/editor-layers.js';

test('список содержит только редактируемые элементы каждой сцены', () => {
  assert.equal(new Set(EDITOR_LAYERS.map(layer => layer.id)).size, EDITOR_LAYERS.length);
  assert.deepEqual(layersForScene('waiting').map(layer => layer.id), ['logo', 'title', 'subtitle', 'date']);
  assert.deepEqual(layersForScene('brand').map(layer => layer.id), ['logo', 'title', 'brandDecor']);
  assert.deepEqual(layersForScene('photo-pause').map(layer => layer.id), ['logo', 'photoLabel']);
  assert.deepEqual(layersForScene('finale').map(layer => layer.id), ['logo', 'title', 'subtitle']);
  assert.deepEqual(layersForScene('unknown'), []);
});

test('кадр получает место между панелями, обычный режим не изменён', () => {
  assert.deepEqual(editorViewport(1350, 845, false), {left: 0, top: 0, width: 1350, height: 845});
  const wide = editorViewport(1350, 845, true);
  assert.deepEqual(wide, {left: 220, top: 78, width: 840, height: 627});
  const narrow = editorViewport(700, 700, true);
  assert.deepEqual(narrow, {left: 8, top: 100, width: 684, height: 425});
  const small = editorViewport(250, 200, true);
  assert.ok(small.width > 0 && small.height > 0);
});
