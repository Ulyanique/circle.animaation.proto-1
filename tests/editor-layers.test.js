import test from 'node:test';
import assert from 'node:assert/strict';
import { EDITOR_LAYERS, layersForScene, editorViewport, layerVisible } from '../src/editor-layers.js';

test('список содержит только редактируемые элементы каждой сцены', () => {
  assert.equal(new Set(EDITOR_LAYERS.map(layer => layer.id)).size, EDITOR_LAYERS.length);
  assert.deepEqual(layersForScene('waiting').map(layer => layer.id), ['logo', 'title', 'subtitle', 'date', 'ringLeft', 'ringRight', 'constructionGuides', 'topIllumination']);
  assert.deepEqual(layersForScene('brand').map(layer => layer.id), ['logo', 'title', 'ringLeft', 'ringRight', 'constructionGuides', 'topIllumination', 'photoLabel', 'brandDecor']);
  assert.deepEqual(layersForScene('photo-pause').map(layer => layer.id), ['logo', 'ringLeft', 'ringRight', 'constructionGuides', 'topIllumination', 'photoLabel', 'photoAperture']);
  assert.deepEqual(layersForScene('finale').map(layer => layer.id), ['logo', 'title', 'subtitle', 'ringLeft', 'ringRight', 'constructionGuides', 'topIllumination']);
  assert.deepEqual(layersForScene('unknown'), []);
});

test('кадр получает место между панелями, обычный режим не изменён', () => {
  assert.deepEqual(editorViewport(1350, 845, false), {left: 0, top: 0, width: 1350, height: 845});
  const wide = editorViewport(1350, 845, true);
  assert.equal(wide.left, 196); assert.equal(wide.top, 68); assert.equal(wide.width, 908);
  assert.equal(wide.height, 507);
  assert.deepEqual(editorViewport(978, 938, true), {left: 196, top: 68, width: 536, height: 600});
  assert.equal(editorViewport(780, 700, true).left, 8);
  assert.equal(editorViewport(781, 700, true).left, 196);
  const narrow = editorViewport(700, 700, true);
  assert.deepEqual(narrow, {left: 8, top: 100, width: 684, height: 313});
  const small = editorViewport(250, 200, true);
  assert.ok(small.width > 0 && small.height > 0);
});


test('видимость элементов сохраняется независимо и старые JSON получают прежние значения', async () => {
  const { SCENES } = await import('../src/scenes/catalog.js');
  const { mergeConfig, configToJSON, parseConfigJSON, projectToJSON, parseProjectJSON } = await import('../src/config.js');
  const scenes = SCENES.filter(scene => scene.defaults);
  const configs = Object.fromEntries(scenes.map(scene => [scene.id, mergeConfig(scene.defaults, {})]));
  for (const scene of scenes) {
    const old = parseConfigJSON('{"caption":{"titleX":0.1},"logo":{"scale":0.5}}', scene.defaults);
    for (const layer of layersForScene(scene.id)) assert.equal(layerVisible(old, layer), !(scene.id === 'brand' && layer.id === 'title') && !(!['waiting', 'finale'].includes(scene.id) && layer.id === 'constructionGuides'));
  }
  for (const scene of scenes) {
    for (const layer of layersForScene(scene.id)) {
      configs[scene.id][layer.visibility.section][layer.visibility.key] = false;
    }
    const restored = parseConfigJSON(configToJSON(configs[scene.id]), scene.defaults);
    for (const layer of layersForScene(scene.id)) assert.equal(layerVisible(restored, layer), false);
  }
  const ids = scenes.map(scene => scene.id);
  const project = parseProjectJSON(projectToJSON(configs, ids), ids);
  for (const scene of scenes) {
    for (const layer of layersForScene(scene.id)) assert.equal(layerVisible(project.scenes[scene.id], layer), false);
    assert.equal(scene.defaults.logo.visible, true);
  }
});
