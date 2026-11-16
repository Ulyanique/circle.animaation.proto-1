import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { AnamorphicFlare, flarePosition } from '../src/sparks.js';

test('ореол и яркая полоса затухают до края плоскости блика', () => {
  const flare = new AnamorphicFlare();
  const shader = flare.mesh.material.fragmentShader;
  assert.match(shader, /float edge = \(1\.0 - smoothstep\(0\.60, 1\.0, x\)\) \* \(1\.0 - smoothstep\(0\.75, 1\.0, y\)\)/);
  assert.match(shader, /\(core \* streak \+ halo\) \* edge \* uI/);
  flare.set(.4, .2, '#ffe7a6', -.3, 3.2);
  assert.equal(flare.mesh.visible, true);
  assert.deepEqual(flare.mesh.position.toArray(), [.4, -.3, .2]);
  assert.equal(flare.mesh.scale.x, 3.2);
  flare.set(0, 0, '#ffe7a6');
  assert.equal(flare.mesh.visible, false);
  flare.mesh.geometry.dispose(); flare.mesh.material.dispose();
});

test('блик привязан к перекладине и следует положению, масштабу и повороту знака', () => {
  assert.deepEqual(flarePosition(-.2, 1), {x: -.2, y: -.665});
  assert.deepEqual(flarePosition(-.2, 0), {x: 0, y: -.665});
  const root = new THREE.Group(), flare = new AnamorphicFlare();
  root.position.set(.3, 1.1, 0); root.scale.setScalar(.5); root.rotation.y = Math.PI / 2;
  root.add(flare.mesh); flare.set(-.2, .5, '#ffffff', -.665, 1.2, 0);
  root.updateMatrixWorld(true);
  const actual = flare.mesh.getWorldPosition(new THREE.Vector3());
  assert.ok(Math.abs(actual.y - (1.1 - .665 * .5)) < 1e-9);
  assert.ok(Math.abs(actual.x - .3) < 1e-9); assert.ok(Math.abs(actual.z - .1) < 1e-9);
  flare.mesh.geometry.dispose(); flare.mesh.material.dispose();
});
