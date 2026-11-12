import test from 'node:test';
import assert from 'node:assert/strict';
import { CUSTOM_TEXT_IDS, customTextDefaults, customTextKeys } from '../src/custom-text.js';
import { layersForScene } from '../src/editor-layers.js';
import { EditorHistory } from '../src/editor-history.js';
import { SCENES } from '../src/scenes/catalog.js';
import { mergeConfig, configToJSON, parseConfigJSON, projectToJSON, parseProjectJSON } from '../src/config.js';

test('дополнительные надписи независимы по сценам и сохраняются в JSON', () => {
  assert.equal(CUSTOM_TEXT_IDS.length, 8);
  const scenes = SCENES.filter(scene => scene.defaults && scene.status === "ready");
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
  assert.equal(fields.length, 19);
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

test('собственный интервал текста привязан к циклу, непрерывен и независим от других надписей', async () => {
  const { customTextAnimation } = await import('../src/custom-text.js');
  const tl = { startDelay: 1, drawDuration: 5, emergeDuration: 5, holdDuration: 5, fadeDuration: 3, restDuration: 2 };
  const cfg = customTextDefaults();
  Object.assign(cfg, {text1Start: 20, text1End: 80, text1Fade: 20, text2Start: 50, text2End: 90});
  const a = t => customTextAnimation(t, tl, cfg, 'text1');
  const b = t => customTextAnimation(t, tl, cfg, 'text2');
  assert.deepEqual(a(0), {outline: 0, fill: 0});
  assert.deepEqual(a(4), {outline: 0, fill: 0});
  assert.deepEqual(a(11), {outline: 1, fill: 1});
  assert.deepEqual(b(9), {outline: 0, fill: 0});
  assert.deepEqual(a(18), {outline: 0, fill: 0});
  assert.deepEqual(a(31), a(11));
  assert.ok(a(5.2).outline > 0 && a(5.2).outline < 1);
  assert.ok(a(16.5).outline > 0 && a(16.5).outline < 1);
  assert.deepEqual(a(21), {outline: 0, fill: 0});
  const long = { ...tl, holdDuration: 25 };
  assert.deepEqual(customTextAnimation(21, long, cfg, 'text1'), {outline: 1, fill: 1});
  Object.assign(cfg, {text1Start: 99, text1End: 1, text1Fade: 0});
  const short = customTextAnimation(20.85, tl, cfg, 'text1');
  assert.ok(Number.isFinite(short.outline) && Number.isFinite(short.fill));
});

test('старые JSON сохраняют привязку дополнительных надписей к названию', () => {
  const scene = SCENES.find(s => s.id === 'waiting');
  const imported = parseConfigJSON('{"textLayers":{"text1Present":true,"text1Text":"До обновления"}}', scene.defaults);
  assert.equal(imported.textLayers.text1TimingMode, 'scene');
  assert.equal(imported.textLayers.text1AutoFit, false);
  imported.textLayers.text1AutoFit = true;
  assert.equal(imported.textLayers.text1Start, 25);
  imported.textLayers.text1TimingMode = 'custom';
  imported.textLayers.text1Start = 10;
  imported.textLayers.text1End = 70;
  imported.textLayers.text1Fade = 25;
  const saved = parseConfigJSON(configToJSON(imported), scene.defaults);
  assert.deepEqual(saved.textLayers, imported.textLayers);
});

test('порядок надписей совместим со старыми и повреждёнными настройками', async () => {
  const { customTextOrder, customTextInsertion, customTextReorder } = await import('../src/custom-text.js');
  const scene = SCENES.find(s => s.id === 'waiting');
  const cfg = parseConfigJSON('{"textLayers":{"text1Present":true,"text2Present":true,"text3Present":true}}', scene.defaults);
  const t = cfg.textLayers;
  assert.deepEqual(customTextOrder(t, true), ['text1', 'text2', 'text3']);
  assert.deepEqual(layersForScene(scene.id, cfg).filter(l => l.custom).map(l => l.id), ['text3', 'text2', 'text1']);
  Object.assign(t, {text1Order: NaN, text2Order: 'wrong', text3Order: 0});
  assert.deepEqual(customTextOrder(t, true), ['text1', 'text3', 'text2']);
  const changes = customTextReorder(t, 'text1', 'front');
  for (const {key, value} of changes) t[key] = value;
  assert.deepEqual(customTextOrder(t, true), ['text3', 'text1', 'text2']);
  assert.deepEqual(customTextReorder(t, 'text2', 'front'), []);
  assert.deepEqual(customTextReorder(t, 'text3', 'back'), []);
  t.text2Order = 1e308;
  const insertion = customTextInsertion(t, 'text4');
  for (const {key, value} of insertion) t[key] = value;
  t.text4Present = true;
  assert.deepEqual(customTextOrder(t, true), ['text3', 'text1', 'text2', 'text4']);
  assert.deepEqual(parseConfigJSON(configToJSON(cfg), scene.defaults).textLayers, t);
});

test('перестановка — атомарная история, отдельно для каждой сцены', async () => {
  const { customTextOrder, customTextReorder } = await import('../src/custom-text.js');
  const scenes = SCENES.filter(s => s.defaults && s.status === "ready"), history = new EditorHistory();
  const configs = scenes.map(s => mergeConfig(s.defaults, {}));
  for (const cfg of configs) Object.assign(cfg.textLayers, {text1Present: true, text2Present: true});
  const cfg = configs[0], before = structuredClone(cfg.textLayers);
  const changes = customTextReorder(cfg.textLayers, 'text1', 'front').map(c => ({...c, before: cfg.textLayers[c.key], after: c.value}));
  for (const {key, after} of changes) cfg.textLayers[key] = after;
  history.record(scenes[0].id, changes);
  assert.deepEqual(customTextOrder(cfg.textLayers, true), ['text2', 'text1']);
  for (const other of configs.slice(1)) assert.deepEqual(customTextOrder(other.textLayers, true), ['text1', 'text2']);
  assert.equal(history.apply(scenes[0].id, cfg, 'undo'), 'applied');
  assert.deepEqual(cfg.textLayers, before);
  assert.equal(history.apply(scenes[0].id, cfg, 'redo'), 'applied');
  assert.deepEqual(customTextOrder(cfg.textLayers, true), ['text2', 'text1']);
});
