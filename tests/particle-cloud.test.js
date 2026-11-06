import test from 'node:test';
import assert from 'node:assert/strict';
import { ParticleCloud, cloudPositions } from '../src/particle-cloud.js';
import { SCENES } from '../src/scenes/catalog.js';
import { mergeConfig, parseConfigJSON, configToJSON, projectToJSON, parseProjectJSON } from '../src/config.js';
import { layersForScene } from '../src/editor-layers.js';
import { computePhase } from '../src/timeline.js';

test('частицы воспроизводимы, ограничены радиусом и максимальным количеством', () => {
  const a = cloudPositions(180), b = cloudPositions(180);
  assert.deepEqual(a, b);
  assert.equal(a.length, 540);
  for (let i = 0; i < a.length; i += 3) {
    assert.ok(Math.hypot(a[i], a[i + 1]) <= 1.000001);
    assert.ok(Math.abs(a[i + 2]) <= .12);
  }
  assert.equal(cloudPositions(4000).length, 6000);
  assert.equal(cloudPositions(-1).length, 0);
});

test('независимое облако позиционируется, анимируется и скрывается детерминированно', () => {
  for (const scene of SCENES.filter(s => s.defaults)) {
    const cfg = mergeConfig(scene.defaults, {particleCloud: {present: true, offsetX: 1.5, offsetY: -.6, radius: 2, count: 100, speed: 0.1}});
    const effect = new ParticleCloud();
    const time = cfg.timeline.startDelay + cfg.timeline.drawDuration + cfg.timeline.emergeDuration + 1;
    const phase = computePhase(time, cfg.timeline);
    effect.update(time, phase, cfg);
    assert.equal(effect.group.visible, true);
    assert.equal(effect.group.position.x, 1.5); assert.equal(effect.group.position.y, -.6);
    assert.equal(effect.group.scale.x, 2); assert.equal(effect.geometry.getAttribute('position').count, 100);
    assert.equal(effect.group.rotation.z, time * 0.1);
    assert.ok(effect.material.opacity > 0 && effect.material.map);
    const old = effect.geometry;
    cfg.particleCloud.count = 80; effect.update(time, phase, cfg);
    assert.notEqual(effect.geometry, old); assert.equal(effect.geometry.getAttribute('position').count, 80);
    cfg.particleCloud.enabled = false; effect.update(time, phase, cfg); assert.equal(effect.group.visible, false);
    cfg.particleCloud.enabled = true; cfg.particleCloud.present = false; effect.update(time, phase, cfg); assert.equal(effect.group.visible, false);
    effect.dispose(); effect.geometry.dispose(); effect.material.dispose();
  }
});

test('старые конфиги не добавляют облако; новая настройка независима и сохраняется в JSON', () => {
  const scenes = SCENES.filter(s => s.defaults);
  const configs = {};
  for (const [i, scene] of scenes.entries()) {
    const old = parseConfigJSON('{"logo":{"offsetX":0.2}}', scene.defaults);
    assert.equal(old.particleCloud.present, false);
    assert.equal(layersForScene(scene.id, old).some(layer => layer.id === 'particleCloud'), false);
    const cfg = mergeConfig(scene.defaults, {particleCloud: {present: true, offsetX: i, color: '#123456', count: 300}});
    configs[scene.id] = cfg;
    assert.ok(layersForScene(scene.id, cfg).some(layer => layer.id === 'particleCloud'));
    assert.deepEqual(parseConfigJSON(configToJSON(cfg), scene.defaults).particleCloud, cfg.particleCloud);
    assert.equal(scene.defaults.particleCloud.present, false);
  }
  const ids = scenes.map(scene => scene.id);
  const project = parseProjectJSON(projectToJSON(configs, ids), ids);
  for (const id of ids) assert.deepEqual(project.scenes[id].particleCloud, configs[id].particleCloud);
});
