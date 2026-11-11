import test from 'node:test';
import assert from 'node:assert/strict';
import { logoRotation } from '../src/scenes/logo-motion.js';
import { PHOTO_PAUSE_DEFAULTS } from '../src/scenes/photo-pause.js';
import { BRAND_DEFAULTS } from '../src/scenes/brand.js';
import { parseConfigJSON, configToJSON, mergeConfig } from '../src/config.js';
import { computePhase, logoDrawFinish } from '../src/timeline.js';

const state = {intro: false, photo: false, time: 0, local: 0, cycle: 24, swayAmount: .05, swaySpeed: .35};

test('интро всегда лицом к зрителю, независимо от старых настроек покачивания', () => {
  for (const time of [0, .5, 3.5, 10, 23]) {
    assert.deepEqual(logoRotation({...state, intro: true, time, local: time, swayAmount: .4}), {x: 0, y: 0, z: 0});
  }
});

test('фотопауза не поворачивается до завершения контура и плавно начинает оборот', () => {
  const tl = PHOTO_PAUSE_DEFAULTS.timeline, cycle = 24, start = logoDrawFinish(tl);
  const photo = {...state, photo: true, cycle, start, turns: 1};
  const at = local => logoRotation({...photo, local});
  for (const local of [0, start / 2, start - .001, start]) {
    assert.equal(at(local).y, 0);
    if (local < start) assert.ok(computePhase(local, tl).draw < 1);
  }
  assert.equal(computePhase(start, tl).draw, 1);
  assert.ok(at(start + .001).y > 0 && at(start + .001).y < 1e-8, 'старт без рывка');
  assert.ok(at(start + .4).y > 0 && at(start + .8).y > at(start + .4).y);
  assert.ok(at(cycle).y > Math.PI);
  assert.equal(logoRotation({...photo, cycle: 40, local: 12}).y, at(12).y, 'удлинение удержания не замедляет вращение');
  assert.ok(at(12).y > 0 && at(12).y < at(18).y);
  assert.equal(logoRotation({...photo, local: 10, turns: 0}).y, 0);
  assert.equal(logoRotation({...photo, local: 10, turns: -1}).y, -at(10).y);
  assert.ok(at(cycle - 1e-6).y > at(18).y);
  const adjusted = {...tl, drawDuration: 4, emergeDuration: 3};
  assert.ok(computePhase(logoDrawFinish(adjusted) - .01, adjusted).draw < 1);
  assert.equal(logoRotation({...photo, start: logoDrawFinish(adjusted), local: logoDrawFinish(adjusted)}).y, 0);
});

test('число оборотов фотопаузы сохраняется отдельно от других сцен и старые JSON дополняются', () => {
  const cfg = parseConfigJSON('{"photo":{"text":"Свой текст"}}', PHOTO_PAUSE_DEFAULTS);
  assert.equal(cfg.photo.logoTurns, 1);
  cfg.photo.logoTurns = -2;
  assert.equal(parseConfigJSON(configToJSON(cfg), PHOTO_PAUSE_DEFAULTS).photo.logoTurns, -2);
  assert.equal(mergeConfig(PHOTO_PAUSE_DEFAULTS, {}).photo.logoTurns, 1);
  assert.equal(BRAND_DEFAULTS.photo.logoTurns, undefined);
  const other = logoRotation({...state, time: 2});
  assert.notEqual(other.x, 0); assert.notEqual(other.y, 0);
});
