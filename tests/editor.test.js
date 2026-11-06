import test from 'node:test';
import assert from 'node:assert/strict';
import { moveLogo, moveTitle } from '../src/editor-math.js';
import { SCENES } from '../src/scenes/catalog.js';
import { mergeConfig, configToJSON, parseConfigJSON } from '../src/config.js';

test('перемещение учитывает размер кадра и ограничивает диапазон настроек', () => {
  assert.deepEqual(moveTitle({ x: 0, y: 0 }, 192, -108, 1920, 1080), { x: 0.1, y: -0.1 });
  assert.deepEqual(moveTitle({ x: 0, y: 0 }, 96, -54, 960, 540), { x: 0.1, y: -0.1 });
  assert.deepEqual(moveTitle({ x: 0.4, y: 0 }, 2000, -2000, 1920, 1080), { x: 0.45, y: -0.45 });
  assert.deepEqual(moveLogo({ x: 1.9, y: -1.9 }, 1, -1), { x: 2, y: -2 });
  assert.deepEqual(moveTitle({ x: 0, y: 0 }, 10, 10, 0, 0), { x: 0, y: 0 });
});

test('позиции принадлежат отдельной сцене и сохраняются в JSON', () => {
  for (const scene of SCENES.filter(s => s.defaults)) {
    const cfg = mergeConfig(scene.defaults, { logo: { offsetX: 0.7, offsetY: 0.2 }, caption: { titleX: 0.1, titleY: -0.05, subtitleX: -0.12, subtitleY: 0.03, dateX: 0.14, dateY: -0.08 } });
    const next = parseConfigJSON(configToJSON(cfg), scene.defaults);
    assert.equal(next.logo.offsetX, 0.7);
    assert.equal(next.logo.offsetY, 0.2);
    assert.equal(next.caption.titleX, 0.1);
    assert.equal(next.caption.titleY, -0.05);
    assert.equal(next.caption.subtitleX, -0.12);
    assert.equal(next.caption.subtitleY, 0.03);
    assert.equal(next.caption.dateX, 0.14);
    assert.equal(next.caption.dateY, -0.08);
    assert.equal(scene.defaults.logo.offsetX, 0);
    assert.equal(scene.defaults.caption.titleX, 0);
  }
});
