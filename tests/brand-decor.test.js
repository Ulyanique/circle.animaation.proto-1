import test from 'node:test';
import assert from 'node:assert/strict';
import { BrandDecor } from '../src/brand-decor.js';
import { brandDecorLayout } from '../src/scenes/brand-decor-layout.js';
import { BRAND_DEFAULTS } from '../src/scenes/brand.js';
import { PHOTO_PAUSE_DEFAULTS } from '../src/scenes/photo-pause.js';
import { FINALE_DEFAULTS } from '../src/scenes/finale.js';
import { WAITING_DEFAULTS } from '../src/scenes/waiting.js';
import { mergeConfig, parseConfigJSON, configToJSON } from '../src/config.js';
import { computePhase } from '../src/timeline.js';

test('разметка и орбитальная пыль воспроизводимы и лежат около окружности', () => {
  const a = brandDecorLayout(), b = brandDecorLayout();
  assert.deepEqual(a, b);
  assert.equal(a.ticks.length, 48 * 6);
  assert.equal(a.dust.length, 72 * 3);
  for (let i = 0; i < a.dust.length; i += 3) {
    const radius = Math.hypot(a.dust[i], a.dust[i + 1]);
    assert.ok(radius >= 0.964 && radius <= 1.036);
  }
});

test('окружность следует знаку, вращается, гаснет и выключается', () => {
  const cfg = mergeConfig(BRAND_DEFAULTS, {});
  const decor = new BrandDecor();
  const root = { position: { x: 0, y: 0.86 } };
  const hold = computePhase(cfg.timeline.drawDuration + cfg.timeline.emergeDuration + 1, cfg.timeline);
  decor.update(6, hold, cfg, root);
  assert.equal(decor.group.visible, true);
  assert.equal(decor.group.position.y, root.position.y);
  assert.equal(decor.group.scale.x, cfg.decor.radius);
  cfg.decor.offsetX = 0.3; cfg.decor.offsetY = -0.2;
  decor.update(6, hold, cfg, root);
  assert.ok(Math.abs(decor.group.position.x - 0.3) < 1e-9);
  assert.ok(Math.abs(decor.group.position.y - (root.position.y - 0.2)) < 1e-9);
  const angle = decor.ticks.rotation.z;
  decor.update(7, hold, cfg, root);
  assert.ok(decor.ticks.rotation.z > angle);
  decor.update(6, hold, cfg, root);
  assert.equal(decor.ticks.rotation.z, angle, 'seek не зависит от истории кадров');
  cfg.decor.enabled = false;
  decor.update(7, hold, cfg, root);
  assert.equal(decor.group.visible, false);
  cfg.decor.enabled = true;
  const end = cfg.timeline.drawDuration + cfg.timeline.emergeDuration + cfg.timeline.holdDuration + cfg.timeline.fadeDuration;
  decor.update(end + 0.1, computePhase(end + 0.1, cfg.timeline), cfg, root);
  assert.equal(decor.group.visible, false);
});

test('декор доступен отдельно в каждой сцене и сохраняется в JSON', () => {
  const cfg = mergeConfig(BRAND_DEFAULTS, { decor: { radius: 1.4, speed: -0.02, offsetX: 0.8, offsetY: -0.4 } });
  assert.equal(parseConfigJSON(configToJSON(cfg), BRAND_DEFAULTS).decor.radius, 1.4);
  assert.equal(parseConfigJSON(configToJSON(cfg), BRAND_DEFAULTS).decor.speed, -0.02);
  assert.equal(parseConfigJSON(configToJSON(cfg), BRAND_DEFAULTS).decor.offsetX, 0.8);
  assert.equal(parseConfigJSON(configToJSON(cfg), BRAND_DEFAULTS).decor.offsetY, -0.4);
  for (const other of [WAITING_DEFAULTS, PHOTO_PAUSE_DEFAULTS, FINALE_DEFAULTS]) { assert.equal(other.decor.present, false); assert.equal(other.decor.followLogo, false); }
  assert.equal(BRAND_DEFAULTS.decor.present, true); assert.equal(BRAND_DEFAULTS.decor.followLogo, true);
  assert.ok(BRAND_DEFAULTS.logo.offsetY < WAITING_DEFAULTS.logo.offsetY);
});


test('окружность может быть независима от знака и выключается при удалении', () => {
  for (const defaults of [WAITING_DEFAULTS, BRAND_DEFAULTS, PHOTO_PAUSE_DEFAULTS, FINALE_DEFAULTS]) {
    const cfg = mergeConfig(defaults, {decor: {present: true, enabled: true, followLogo: false, offsetX: 0.7, offsetY: -0.4}});
    const decor = new BrandDecor();
    const root = {position: {x: 0.3, y: 1.1}};
    const phase = computePhase(cfg.timeline.startDelay + cfg.timeline.drawDuration + cfg.timeline.emergeDuration + 1, cfg.timeline);
    decor.update(6, phase, cfg, root);
    assert.equal(decor.group.visible, true);
    assert.equal(decor.group.position.x, 0.7); assert.equal(decor.group.position.y, -0.4);
    root.position.x = -1; root.position.y = -1;
    decor.update(6, phase, cfg, root);
    assert.equal(decor.group.position.x, 0.7); assert.equal(decor.group.position.y, -0.4);
    cfg.decor.followLogo = true; decor.update(6, phase, cfg, root);
    assert.ok(Math.abs(decor.group.position.x - (-0.3)) < 1e-9);
    cfg.decor.present = false; decor.update(6, phase, cfg, root);
    assert.equal(decor.group.visible, false);
    const saved = parseConfigJSON(configToJSON(cfg), defaults);
    assert.equal(saved.decor.followLogo, true); assert.equal(saved.decor.present, false);
  }
});


test('старые настройки сохраняют прежний состав сцен, новая окружность экспортируется', async () => {
  const { layersForScene } = await import('../src/editor-layers.js');
  for (const [id, defaults] of [['waiting', WAITING_DEFAULTS], ['brand', BRAND_DEFAULTS], ['photo-pause', PHOTO_PAUSE_DEFAULTS], ['finale', FINALE_DEFAULTS]]) {
    const old = parseConfigJSON('{"logo":{"offsetX":0.2}}', defaults);
    assert.equal(old.decor.present, id === 'brand');
    assert.equal(layersForScene(id, old).some(layer => layer.id === 'brandDecor'), id === 'brand');
    old.decor.present = true; old.decor.followLogo = false; old.decor.offsetX = 3.5;
    const restored = parseConfigJSON(configToJSON(old), defaults);
    assert.equal(restored.decor.present, true); assert.equal(restored.decor.followLogo, false);
    assert.equal(restored.decor.offsetX, 3.5);
    assert.ok(layersForScene(id, restored).some(layer => layer.id === 'brandDecor'));
  }
});
