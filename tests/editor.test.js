import test from 'node:test';
import assert from 'node:assert/strict';
import { moveLogo, moveTitle, snapRect, resizeFromDistance } from '../src/editor-math.js';
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
    const cfg = mergeConfig(scene.defaults, { logo: { offsetX: 0.7, offsetY: 0.2 }, caption: { titleX: 0.1, titleY: -0.05, subtitleX: -0.12, subtitleY: 0.03, subtitleScale: 1.3, titleScale: 1.4, dateX: 0.14, dateY: -0.08, dateScale: 0.8 } });
    const next = parseConfigJSON(configToJSON(cfg), scene.defaults);
    assert.equal(next.logo.offsetX, 0.7);
    assert.equal(next.logo.offsetY, 0.2);
    assert.equal(next.caption.titleX, 0.1);
    assert.equal(next.caption.titleY, -0.05);
    assert.equal(next.caption.titleScale, 1.4);
    assert.equal(next.caption.subtitleScale, 1.3);
    assert.equal(next.caption.dateScale, 0.8);
    assert.equal(next.caption.subtitleX, -0.12);
    assert.equal(next.caption.subtitleY, 0.03);
    assert.equal(next.caption.dateX, 0.14);
    assert.equal(next.caption.dateY, -0.08);
    assert.equal(scene.defaults.logo.offsetX, 0);
    assert.equal(scene.defaults.caption.titleX, 0);
  }
});


test('умное прилипание выравнивает края и центры только в пределах порога', () => {
  const rect = {left: 80, top: 50, width: 40, height: 20};
  const targets = [{left: 0, top: 0, width: 200, height: 100}, {left: 145, top: 80, width: 20, height: 10}];
  const centered = snapRect(rect, 4, -8, targets);
  assert.equal(centered.dx, 0);
  assert.equal(centered.guideX, 100);
  assert.equal(centered.dy, -10);
  assert.equal(centered.guideY, 50);
  const edge = snapRect(rect, 23, 17, targets, 3);
  assert.equal(edge.dx, 25);
  assert.equal(edge.guideX, 145);
  assert.equal(edge.dy, 15);
  assert.equal(edge.guideY, 85);
  const free = snapRect(rect, 13, 5, targets, 2);
  assert.equal(free.dx, 13);
  assert.equal(free.dy, 5);
  assert.equal(free.guideX, null);
  assert.equal(free.guideY, null);
});


test('масштабирование пропорционально и ограничено допустимыми размерами', () => {
  assert.equal(resizeFromDistance(1, 100, 150, 0.5, 2), 1.5);
  assert.equal(resizeFromDistance(1, 100, 400, 0.5, 2), 2);
  assert.equal(resizeFromDistance(1, 100, 10, 0.5, 2), 0.5);
  assert.equal(resizeFromDistance(1, 0, 100, 0.5, 2), 1);
  assert.equal(resizeFromDistance(1, 100, NaN, 0.5, 2), 1);
});
