import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { BackgroundGlow } from '../src/background-glow.js';
import { SCENES } from '../src/scenes/catalog.js';
import { mergeConfig, parseConfigJSON, configToJSON, projectToJSON, parseProjectJSON } from '../src/config.js';
import { layersForScene } from '../src/editor-layers.js';
import { computePhase } from '../src/timeline.js';

test('свечение самостоятельно, детерминированно и не требует включённых колец или знака', () => {
  for (const scene of SCENES.filter(s => s.defaults && s.status === "ready")) {
    const cfg = mergeConfig(scene.defaults, {
      backgroundGlow: {present: true, offsetX: 1.7, offsetY: -0.4, radius: 2, color: '#24aaff', intensity: 0.6, pulse: 0.5, speed: 0.25},
      rings: {enabled: false}, logo: {visible: false},
    });
    const texture = new THREE.Texture(), effect = new BackgroundGlow(texture);
    const time = cfg.timeline.startDelay + cfg.timeline.drawDuration + cfg.timeline.emergeDuration + 1;
    const phase = computePhase(time, cfg.timeline);
    effect.update(time, phase, cfg);
    assert.equal(effect.group.visible, true);
    assert.equal(effect.group.position.x, 1.7); assert.equal(effect.group.position.y, -0.4);
    assert.equal(effect.group.position.z, -1.4); assert.equal(effect.sprite.scale.x, 4);
    assert.equal(effect.material.color.getHexString(), '24aaff');
    assert.equal(effect.material.map, texture); assert.ok(effect.material.opacity > 0);
    const opacity = effect.material.opacity;
    effect.update(time + 1, phase, cfg); effect.update(time, phase, cfg);
    assert.equal(effect.material.opacity, opacity, 'перемотка на тот же кадр должна давать ту же яркость');
    effect.update(0, {beforeStart: true, reveal: 1, rings: 1}, cfg); assert.equal(effect.group.visible, false);
    cfg.backgroundGlow.enabled = false; effect.update(time, phase, cfg); assert.equal(effect.group.visible, false);
    cfg.backgroundGlow.enabled = true; cfg.backgroundGlow.present = false; effect.update(time, phase, cfg); assert.equal(effect.group.visible, false);
    effect.material.dispose(); texture.dispose();
  }
});

test('новое свечение отсутствует в старых настройках и сохраняется отдельно для каждой сцены', () => {
  const scenes = SCENES.filter(s => s.defaults && s.status === "ready"), configs = {};
  for (const [i, scene] of scenes.entries()) {
    const old = parseConfigJSON('{"logo":{"offsetX":0.2}}', scene.defaults);
    assert.equal(old.backgroundGlow.present, false);
    assert.equal(layersForScene(scene.id, old).some(layer => layer.id === 'backgroundGlow'), false);
    const cfg = mergeConfig(scene.defaults, {backgroundGlow: {present: true, offsetX: i, color: '#123456', intensity: 0.75}});
    configs[scene.id] = cfg;
    assert.ok(layersForScene(scene.id, cfg).some(layer => layer.id === 'backgroundGlow'));
    assert.deepEqual(parseConfigJSON(configToJSON(cfg), scene.defaults).backgroundGlow, cfg.backgroundGlow);
    assert.equal(scene.defaults.backgroundGlow.present, false);
  }
  const ids = scenes.map(scene => scene.id);
  const project = parseProjectJSON(projectToJSON(configs, ids), ids);
  for (const id of ids) assert.deepEqual(project.scenes[id].backgroundGlow, configs[id].backgroundGlow);
});

test('до четырёх ореолов в сцене независимы и используют отдельные настройки и объекты', async () => {
  const { BACKGROUND_GLOW_IDS, backgroundGlowDefaults } = await import('../src/background-glow-config.js');
  const { SCHEMA } = await import('../src/config.js');
  assert.equal(BACKGROUND_GLOW_IDS.length, 4);
  const defaults = backgroundGlowDefaults();
  assert.notEqual(defaults.backgroundGlow, defaults.backgroundGlow2);
  assert.deepEqual(BACKGROUND_GLOW_IDS.map(id => SCHEMA.some(s => s.id === id)), [true, true, true, true]);
  for (const scene of SCENES.filter(s => s.defaults && s.status === "ready")) {
    const cfg = mergeConfig(scene.defaults, {});
    const texture = new THREE.Texture();
    const effects = BACKGROUND_GLOW_IDS.map(id => new BackgroundGlow(texture, id));
    for (const [i, id] of BACKGROUND_GLOW_IDS.entries()) {
      Object.assign(cfg[id], {present: true, enabled: true, offsetX: i, radius: 1 + i / 2, intensity: (i + 1) / 5});
    }
    const time = cfg.timeline.startDelay + cfg.timeline.drawDuration + cfg.timeline.emergeDuration + 1;
    const phase = computePhase(time, cfg.timeline);
    effects.forEach(effect => effect.update(time, phase, cfg));
    for (const [i, effect] of effects.entries()) {
      assert.equal(effect.group.visible, true);
      assert.equal(effect.group.position.x, i);
      assert.equal(effect.sprite.scale.x, 2 + i);
    }
    cfg.backgroundGlow2.enabled = false;
    effects.forEach(effect => effect.update(time, phase, cfg));
    assert.equal(effects[1].group.visible, false);
    assert.equal(effects[0].group.visible, true); assert.equal(effects[2].group.visible, true);
    assert.equal(layersForScene(scene.id, cfg).filter(layer => BACKGROUND_GLOW_IDS.includes(layer.id)).length, 4);
    const copy = parseConfigJSON(configToJSON(cfg), scene.defaults);
    for (const id of BACKGROUND_GLOW_IDS) assert.deepEqual(copy[id], cfg[id]);
    effects.forEach(effect => effect.material.dispose()); texture.dispose();
  }
});

test('старый JSON с одним свечением сохраняет его и не создаёт новые', async () => {
  const { BACKGROUND_GLOW_IDS } = await import('../src/background-glow-config.js');
  for (const scene of SCENES.filter(s => s.defaults && s.status === "ready")) {
    const old = parseConfigJSON('{"backgroundGlow":{"present":true,"offsetX":1.23,"color":"#abcdef"}}', scene.defaults);
    assert.equal(old.backgroundGlow.present, true);
    assert.equal(old.backgroundGlow.offsetX, 1.23); assert.equal(old.backgroundGlow.color, '#abcdef');
    for (const id of BACKGROUND_GLOW_IDS.slice(1)) assert.equal(old[id].present, false);
    assert.deepEqual(layersForScene(scene.id, old).filter(layer => BACKGROUND_GLOW_IDS.includes(layer.id)).map(layer => layer.id), ['backgroundGlow']);
  }
});
