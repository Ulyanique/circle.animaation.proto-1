import test from 'node:test';
import assert from 'node:assert/strict';
import { canDuplicate, duplicateTarget, duplicatePlan } from '../src/editor-duplicate.js';
import { EditorHistory } from '../src/editor-history.js';
import { ParticleCloud, cloudPositions } from '../src/particle-cloud.js';
import { PARTICLE_CLOUD_IDS, cloudSeedForId } from '../src/particle-cloud-config.js';
import { DECOR_SLOTS } from '../src/brand-decor-config.js';
import { BACKGROUND_GLOW_IDS } from '../src/background-glow-config.js';
import { CUSTOM_TEXT_IDS } from '../src/custom-text.js';
import { SCENES } from '../src/scenes/catalog.js';
import { mergeConfig, parseConfigJSON, configToJSON } from '../src/config.js';

function apply(cfg, plan, history, scene) {
  const entries = plan.changes.map(({section, key, value}) => ({section, key, before: cfg[section][key], after: value}));
  for (const {section, key, after} of entries) cfg[section][key] = after;
  history.record(scene, entries);
}

test('копирование каждого типа создаёт независимый слот и атомарно отменяется в каждой сцене', () => {
  for (const scene of SCENES.filter(s => s.defaults)) {
    const cfg = mergeConfig(scene.defaults, {}), history = new EditorHistory();
    Object.assign(cfg.textLayers, {text1Present: true, text1Text: 'Копия', text1Color: '#125578', text1X: .2, text1Y: -.3,
      text1AutoFit: true, text1TimingMode: 'custom', text1Start: 20, text1End: 70, text1Fade: 25, text1Visible: false});
    Object.assign(cfg.decor, {present: true, followLogo: true, offsetX: 2, offsetY: -1, color: '#aabbcc', timingMode: 'custom', timingStart: 20});
    Object.assign(cfg.particleCloud, {present: true, count: 250, color: '#123456', offsetX: 1});
    Object.assign(cfg.backgroundGlow, {present: true, intensity: .8, offsetY: 2, enabled: false});
    for (const [id, dest, section, sourceSection] of [
      ['text1', 'text2', 'textLayers', 'textLayers'], ['brandDecor', 'brandDecor2', 'decor2', 'decor'],
      ['particleCloud', 'particleCloud2', 'particleCloud2', 'particleCloud'], ['backgroundGlow', 'backgroundGlow2', 'backgroundGlow2', 'backgroundGlow'],
    ]) {
      const beforeSource = structuredClone(cfg[sourceSection]);
      const beforeDestination = structuredClone(cfg[section]);
      const plan = duplicatePlan(cfg, scene.defaults, id);
      assert.equal(plan.target, dest);
      apply(cfg, plan, history, scene.id);
      if (id === 'text1') {
        assert.equal(cfg.textLayers.text2Text, 'Копия'); assert.equal(cfg.textLayers.text2Visible, false);
        assert.equal(cfg.textLayers.text2AutoFit, true); assert.equal(cfg.textLayers.text2TimingMode, 'custom'); assert.equal(cfg.textLayers.text2Start, 20);
        assert.ok(cfg.textLayers.text2X > cfg.textLayers.text1X);
      } else {
        assert.equal(cfg[section].present, true);
        for (const key of Object.keys(scene.defaults[section])) {
          if (key !== 'offsetX' && key !== 'offsetY') assert.deepEqual(cfg[section][key], cfg[sourceSection][key], `${id}: ${key}`);
        }
        assert.notEqual(cfg[section].offsetX, cfg[sourceSection].offsetX);
        assert.notEqual(cfg[section].offsetY, cfg[sourceSection].offsetY);
      }
      const after = structuredClone(cfg[section]);
      assert.equal(history.apply(scene.id, cfg, 'undo'), 'applied');
      assert.deepEqual(cfg[section], beforeDestination);
      assert.equal(history.apply(scene.id, cfg, 'redo'), 'applied');
      assert.deepEqual(cfg[section], after);
      if (section !== sourceSection) assert.deepEqual(cfg[sourceSection], beforeSource);
      else for (const [key, value] of Object.entries(beforeSource).filter(([key]) => key.startsWith('text1'))) assert.equal(cfg.textLayers[key], value);
      assert.deepEqual(parseConfigJSON(configToJSON(cfg), scene.defaults)[section], cfg[section]);
    }
  }
});

test('слоты не переписываются при лимите и копия смещается внутрь допустимых границ', () => {
  const scene = SCENES.find(s => s.id === 'waiting'), cfg = mergeConfig(scene.defaults, {});
  assert.equal(canDuplicate('logo'), false); assert.equal(duplicatePlan(cfg, scene.defaults, 'logo'), null);
  Object.assign(cfg.decor, {present: true, offsetX: 10, offsetY: -10});
  let plan = duplicatePlan(cfg, scene.defaults, 'brandDecor');
  assert.equal(plan.changes.find(c => c.key === 'offsetX').value, 9.75);
  assert.equal(plan.changes.find(c => c.key === 'offsetY').value, -9.8);
  cfg.decor.offsetX = 12; plan = duplicatePlan(cfg, scene.defaults, 'brandDecor');
  assert.equal(plan.changes.find(c => c.key === 'offsetX').value, 12.25);
  for (const {section} of DECOR_SLOTS) cfg[section].present = true;
  assert.equal(duplicateTarget(cfg, 'brandDecor'), null); assert.equal(duplicatePlan(cfg, scene.defaults, 'brandDecor'), null);
  for (const id of PARTICLE_CLOUD_IDS) cfg[id].present = true;
  for (const id of BACKGROUND_GLOW_IDS) cfg[id].present = true;
  for (const id of CUSTOM_TEXT_IDS) cfg.textLayers[`${id}Present`] = true;
  for (const id of ['particleCloud', 'backgroundGlow', 'text1']) assert.equal(duplicateTarget(cfg, id), null);
  cfg.particleCloud3.present = false;
  assert.equal(duplicateTarget(cfg, 'particleCloud'), 'particleCloud3');
});

test('копия частиц повторяет рисунок источника; старые облака сохраняют прежнее зерно', () => {
  const scene = SCENES.find(s => s.id === 'waiting');
  const cfg = parseConfigJSON('{"particleCloud":{"present":true,"count":100},"particleCloud2":{"present":false}}', scene.defaults);
  assert.equal(cfg.particleCloud.seed, cloudSeedForId('particleCloud'));
  assert.equal(cfg.particleCloud2.seed, cloudSeedForId('particleCloud2'));
  const first = new ParticleCloud('particleCloud'), second = new ParticleCloud('particleCloud2');
  const plan = duplicatePlan(cfg, scene.defaults, 'particleCloud');
  apply(cfg, plan, new EditorHistory(), scene.id);
  const phase = {beforeStart: false, reveal: 1, rings: 1};
  first.update(10, phase, cfg); second.update(10, phase, cfg);
  assert.deepEqual(first.geometry.getAttribute('position').array, cloudPositions(100));
  assert.deepEqual(second.geometry.getAttribute('position').array, first.geometry.getAttribute('position').array);
  const oldGeometry = second.geometry;
  cfg.particleCloud2.seed++; second.update(10, phase, cfg);
  assert.notEqual(second.geometry, oldGeometry);
  assert.notDeepEqual(second.geometry.getAttribute('position').array, first.geometry.getAttribute('position').array);
  for (const cloud of [first, second]) { cloud.dispose(); cloud.geometry.dispose(); cloud.material.dispose(); }
});

test('копия повторно использует свободный слот, но оказывается поверх остальных', async () => {
  const { customTextOrder } = await import('../src/custom-text.js');
  const scene = SCENES.find(s => s.id === 'waiting'), cfg = mergeConfig(scene.defaults, {}), history = new EditorHistory();
  Object.assign(cfg.textLayers, { text1Present: false, text2Present: true, text3Present: true, text2Order: 5, text3Order: 8 });
  const before = structuredClone(cfg.textLayers), plan = duplicatePlan(cfg, scene.defaults, 'text2');
  assert.equal(plan.target, 'text1');
  apply(cfg, plan, history, scene.id);
  assert.deepEqual(customTextOrder(cfg.textLayers, true), ['text2', 'text3', 'text1']);
  assert.equal(history.apply(scene.id, cfg, 'undo'), 'applied');
  assert.deepEqual(cfg.textLayers, before);
  assert.equal(history.apply(scene.id, cfg, 'redo'), 'applied');
  assert.deepEqual(customTextOrder(cfg.textLayers, true), ['text2', 'text3', 'text1']);
});
