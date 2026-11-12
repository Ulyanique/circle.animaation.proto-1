import test from 'node:test';
import assert from 'node:assert/strict';
import { ringSidePosition, ringSideVisible, ringSideScale } from '../src/scenes/ring-sides.js';
import { moveWorldOffset } from '../src/editor-math.js';
import { SCENES } from '../src/scenes/catalog.js';
import { mergeConfig, parseConfigJSON, configToJSON } from '../src/config.js';

test('два исходных круга имеют независимые смещения и совместимы со старыми конфигами', () => {
  const rings = {cornerX: .44, cornerY: .42};
  assert.deepEqual(ringSidePosition('left', rings, 5, 3), {x:-4.4, y:2.52});
  assert.deepEqual(ringSidePosition('right', rings, 5, 3), {x:4.4, y:-2.52});
  assert.equal(ringSideVisible(rings, 'left'), true);
  assert.equal(ringSideScale(rings, 'right'), 1);
  rings.leftOffsetX = 1; rings.leftOffsetY = -2;
  assert.deepEqual(ringSidePosition('left', rings, 5, 3), {x:-3.4000000000000004, y:0.52});
  assert.deepEqual(ringSidePosition('right', rings, 5, 3), {x:4.4, y:-2.52});
  assert.deepEqual(moveWorldOffset({x: 9, y: -9}, 5, -5), {x:10, y:-10});
});

test('положение, масштаб и видимость групп сохраняются раздельно в каждой сцене', () => {
  for (const scene of SCENES.filter(s => s.defaults && s.status === "ready")) {
    const cfg = mergeConfig(scene.defaults, {rings:{leftOffsetX: 3, leftOffsetY: -1, rightScale: 1.7, leftVisible: false}});
    const loaded = parseConfigJSON(configToJSON(cfg), scene.defaults);
    assert.equal(loaded.rings.leftOffsetX, 3);
    assert.equal(loaded.rings.leftOffsetY, -1);
    assert.equal(loaded.rings.rightScale, 1.7);
    assert.equal(loaded.rings.rightOffsetX, 0);
    assert.equal(loaded.rings.leftVisible, false);
    const old = parseConfigJSON('{"rings":{"cornerX":0.3}}', scene.defaults);
    assert.equal(old.rings.leftVisible, true); assert.equal(old.rings.leftOffsetX, 0);
    assert.equal(old.rings.rightScale, 1);
  }
});
