import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectorProperties } from '../src/editor-properties.js';
import { WAITING_DEFAULTS } from '../src/scenes/waiting.js';
import { FINALE_DEFAULTS } from '../src/scenes/finale.js';

const names = (id, scene, cfg) => inspectorProperties(id, scene, cfg).map(p => `${p.section}.${p.field.key}`);
test('инспектор показывает параметры выбранного объекта и помечает общие', () => {
  const logo = names('logo', 'waiting', WAITING_DEFAULTS);
  assert.ok(logo.includes('logo.depth')); assert.ok(logo.includes('logo.outlineColor'));
  assert.ok(!logo.includes('logo.offsetX')); assert.ok(!logo.includes('logo.swaySpeed'));
  const title = inspectorProperties('title', 'waiting', WAITING_DEFAULTS);
  assert.ok(title.some(p => p.field.key === 'titleAutoFit'));
  assert.ok(title.some(p => p.field.key === 'titleFont' && p.shared));
  assert.ok(!title.some(p => p.field.key === 'subtitleTracking'));
  assert.ok(names('subtitle', 'finale', FINALE_DEFAULTS).includes('finale.subtitleMoveDuration'));
  assert.ok(inspectorProperties('ringLeft', 'waiting', WAITING_DEFAULTS).some(p => p.section === 'rings' && p.shared));
  assert.ok(names('constructionGuides', 'waiting', WAITING_DEFAULTS).includes('constructionGuides.opacity'));
  assert.ok(names('topIllumination', 'waiting', WAITING_DEFAULTS).includes('lights.topGlow'));
  assert.ok(names('backgroundGlow2', 'waiting', WAITING_DEFAULTS).includes('backgroundGlow2.pulse'));
  assert.ok(!names('backgroundGlow2', 'waiting', WAITING_DEFAULTS).includes('backgroundGlow2.radius'));
});
