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
  for (const scene of SCENES.filter(s => s.defaults && s.status === "ready")) {
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
  const scenes = SCENES.filter(s => s.defaults && s.status === "ready");
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

test('четыре облака имеют независимые объекты, настройки, огибающие и рисунок частиц', async () => {
  const { PARTICLE_CLOUD_IDS, particleCloudDefaults } = await import('../src/particle-cloud-config.js');
  const { SCHEMA } = await import('../src/config.js');
  assert.equal(PARTICLE_CLOUD_IDS.length, 4);
  const defaults = particleCloudDefaults();
  assert.notEqual(defaults.particleCloud, defaults.particleCloud2);
  for (const id of PARTICLE_CLOUD_IDS) assert.ok(SCHEMA.some(s => s.id === id));
  const configs = {};
  for (const scene of SCENES.filter(s => s.defaults && s.status === "ready")) {
    const cfg = mergeConfig(scene.defaults, {}); configs[scene.id] = cfg;
    const clouds = PARTICLE_CLOUD_IDS.map(id => new ParticleCloud(id));
    for (const [i, id] of PARTICLE_CLOUD_IDS.entries()) {
      Object.assign(cfg[id], {present: true, enabled: true, offsetX: i, radius: 1 + i / 2,
        count: 100 + i * 10, color: i ? '#123456' : '#e8c77e', timingMode: 'custom', timingStart: i * 10, timingEnd: 90});
    }
    const cycle = cfg.timeline.drawDuration + cfg.timeline.emergeDuration + cfg.timeline.holdDuration + cfg.timeline.fadeDuration + cfg.timeline.restDuration;
    const phase = {beforeStart: false, reveal: 0, rings: 0}, time = cfg.timeline.startDelay + cycle * .5;
    clouds.forEach(cloud => cloud.update(time, phase, cfg));
    for (const [i, cloud] of clouds.entries()) {
      assert.equal(cloud.group.visible, true);
      assert.equal(cloud.group.position.x, i);
      assert.equal(cloud.group.scale.x, 1 + i / 2);
      assert.equal(cloud.geometry.getAttribute('position').count, 100 + i * 10);
    }
    assert.deepEqual(clouds[0].geometry.getAttribute('position').array, cloudPositions(100));
    assert.notDeepEqual(clouds[1].geometry.getAttribute('position').array.slice(0, 30), clouds[0].geometry.getAttribute('position').array.slice(0, 30));
    cfg.particleCloud2.enabled = false;
    clouds.forEach(cloud => cloud.update(time, phase, cfg));
    assert.equal(clouds[1].group.visible, false);
    assert.equal(clouds[0].group.visible, true); assert.equal(clouds[2].group.visible, true);
    cfg.particleCloud2.enabled = true;
    clouds.forEach(cloud => cloud.update(cfg.timeline.startDelay + cycle * .15, phase, cfg));
    assert.equal(clouds[0].group.visible, true); assert.equal(clouds[2].group.visible, false);
    assert.equal(layersForScene(scene.id, cfg).filter(layer => PARTICLE_CLOUD_IDS.includes(layer.id)).length, 4);
    const copy = parseConfigJSON(configToJSON(cfg), scene.defaults);
    for (const id of PARTICLE_CLOUD_IDS) assert.deepEqual(copy[id], cfg[id]);
    for (const cloud of clouds) { cloud.dispose(); cloud.geometry.dispose(); cloud.material.dispose(); }
  }
  const ids = Object.keys(configs), project = parseProjectJSON(projectToJSON(configs, ids), ids);
  for (const scene of ids) for (const id of PARTICLE_CLOUD_IDS) assert.deepEqual(project.scenes[scene][id], configs[scene][id]);
});

test('старый JSON с одним облаком не создаёт дополнительные облака', async () => {
  const { PARTICLE_CLOUD_IDS } = await import('../src/particle-cloud-config.js');
  for (const scene of SCENES.filter(s => s.defaults && s.status === "ready")) {
    const old = parseConfigJSON('{"particleCloud":{"present":true,"offsetX":1.23,"color":"#abcdef"}}', scene.defaults);
    assert.equal(old.particleCloud.present, true);
    assert.equal(old.particleCloud.offsetX, 1.23); assert.equal(old.particleCloud.color, '#abcdef');
    for (const id of PARTICLE_CLOUD_IDS.slice(1)) assert.equal(old[id].present, false);
    assert.deepEqual(layersForScene(scene.id, old).filter(layer => PARTICLE_CLOUD_IDS.includes(layer.id)).map(layer => layer.id), ['particleCloud']);
  }
});
