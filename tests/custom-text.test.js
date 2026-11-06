import test from 'node:test';
import assert from 'node:assert/strict';
import { CUSTOM_TEXT_IDS, customTextDefaults, customTextKeys } from '../src/custom-text.js';
import { layersForScene } from '../src/editor-layers.js';
import { EditorHistory } from '../src/editor-history.js';
import { SCENES } from '../src/scenes/catalog.js';
import { mergeConfig, configToJSON, parseConfigJSON, projectToJSON, parseProjectJSON } from '../src/config.js';

test('дополнительные надписи независимы по сценам и сохраняются в JSON', () => {
  assert.equal(CUSTOM_TEXT_IDS.length, 8);
  const scenes = SCENES.filter(scene => scene.defaults);
  const configs = Object.fromEntries(scenes.map(scene => [scene.id, mergeConfig(scene.defaults, {})]));
  for (const [index, scene] of scenes.entries()) {
    const cfg = configs[scene.id];
    assert.equal(layersForScene(scene.id, cfg).some(layer => layer.custom), false);
    Object.assign(cfg.textLayers, { text1Present: true, text1Text: `Сцена ${index}`, text1Color: '#123456', text1X: 0.2, text1Y: -0.1, text1Scale: 1.3 });
    assert.equal(layersForScene(scene.id, cfg).filter(layer => layer.custom).length, 1);
    assert.deepEqual(parseConfigJSON(configToJSON(cfg), scene.defaults).textLayers, cfg.textLayers);
    assert.equal(scene.defaults.textLayers.text1Present, false);
  }
  const ids = scenes.map(s => s.id);
  const project = parseProjectJSON(projectToJSON(configs, ids), ids);
  for (const scene of scenes) assert.deepEqual(project.scenes[scene.id].textLayers, configs[scene.id].textLayers);
  const legacy = parseConfigJSON('{"caption":{"titleText":"Прежний текст"}}', scenes[0].defaults);
  assert.deepEqual(legacy.textLayers, customTextDefaults());
});

test('добавление, правка и удаление слоя обратимы без потери других полей', () => {
  const config = { textLayers: customTextDefaults() }, history = new EditorHistory();
  const id = 'text1', fields = customTextKeys(id);
  assert.equal(fields.length, 7);
  history.record('waiting', [{section:'textLayers', key:'text1Present', before:false, after:true}]);
  config.textLayers.text1Present = true;
  history.record('waiting', [{section:'textLayers', key:'text1Text', before:'Новый текст', after:'Мой текст'}]);
  config.textLayers.text1Text = 'Мой текст';
  history.record('waiting', [{section:'textLayers', key:'text1Present', before:true, after:false}]);
  config.textLayers.text1Present = false;
  assert.equal(history.apply('waiting', config, 'undo'), 'applied');
  assert.equal(config.textLayers.text1Present, true);
  assert.equal(config.textLayers.text1Text, 'Мой текст');
  assert.equal(history.apply('waiting', config, 'undo'), 'applied');
  assert.equal(config.textLayers.text1Text, 'Новый текст');
  assert.equal(history.apply('waiting', config, 'undo'), 'applied');
  assert.equal(config.textLayers.text1Present, false);
  assert.equal(history.apply('waiting', config, 'redo'), 'applied');
  assert.equal(config.textLayers.text1Present, true);
});
