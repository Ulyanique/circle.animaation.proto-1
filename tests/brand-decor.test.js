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

test('настройки декора сохраняются отдельно и не добавляются в другие сцены', () => {
  const cfg = mergeConfig(BRAND_DEFAULTS, { decor: { radius: 1.4, speed: -0.02 } });
  assert.equal(parseConfigJSON(configToJSON(cfg), BRAND_DEFAULTS).decor.radius, 1.4);
  assert.equal(parseConfigJSON(configToJSON(cfg), BRAND_DEFAULTS).decor.speed, -0.02);
  for (const other of [WAITING_DEFAULTS, PHOTO_PAUSE_DEFAULTS, FINALE_DEFAULTS]) assert.equal(other.decor, undefined);
  assert.ok(BRAND_DEFAULTS.logo.offsetY < WAITING_DEFAULTS.logo.offsetY);
});
