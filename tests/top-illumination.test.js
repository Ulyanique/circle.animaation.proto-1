import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { updateTopIllumination } from '../src/top-illumination.js';
import { SCENES } from '../src/scenes/catalog.js';
import { mergeConfig, parseConfigJSON, configToJSON, projectToJSON, parseProjectJSON } from '../src/config.js';

test('старые настройки сохраняют исходный вид и фазы верхнего света', () => {
  for (const scene of SCENES.filter(s => s.defaults)) {
    const cfg = parseConfigJSON('{"lights":{"topGlow":10}}', scene.defaults);
    const light = new THREE.PointLight(), glow = new THREE.Sprite(new THREE.SpriteMaterial());
    updateTopIllumination(light, glow, cfg, .5, 1.2);
    assert.deepEqual(light.position.toArray(), [0, 2.4, -.8]);
    assert.deepEqual(glow.position.toArray(), [0, 1.5, -.6]);
    assert.equal(glow.scale.x, 9); assert.equal(light.color.getHexString(), 'ffe2a6');
    assert.equal(glow.material.color.getHexString(), 'ffd98a');
    assert.equal(light.intensity, 6); assert.equal(glow.material.opacity, .075);
    assert.equal(light.visible, true); assert.equal(glow.visible, true);
    updateTopIllumination(light, glow, cfg, 0, 1);
    assert.equal(light.intensity, 0); assert.equal(glow.material.opacity, 0);
  }
});

test('настройки верхнего света независимы по сценам и сохраняются в JSON', () => {
  const scenes = SCENES.filter(s => s.defaults);
  const configs = Object.fromEntries(scenes.map(s => [s.id, mergeConfig(s.defaults, {})]));
  const cfg = configs[scenes[0].id];
  Object.assign(cfg.topIllumination, {offsetX: 2, offsetY: -1, scale: .5, color: '#123456', lightColor: '#654321', enabled: false});
  const light = new THREE.PointLight(), glow = new THREE.Sprite(new THREE.SpriteMaterial());
  updateTopIllumination(light, glow, cfg, .8, 2);
  assert.equal(light.position.x, 2); assert.ok(Math.abs(light.position.y + .1) < 1e-12); assert.equal(light.position.z, -.8);
  assert.deepEqual(glow.position.toArray(), [2, -1, -.6]);
  assert.equal(glow.scale.x, 4.5); assert.equal(light.color.getHexString(), '654321');
  assert.equal(glow.material.color.getHexString(), '123456');
  assert.equal(light.visible, false); assert.equal(glow.visible, false);
  assert.deepEqual(parseConfigJSON(configToJSON(cfg), scenes[0].defaults).topIllumination, cfg.topIllumination);
  const ids = scenes.map(s => s.id), project = parseProjectJSON(projectToJSON(configs, ids), ids);
  assert.deepEqual(project.scenes[ids[0]].topIllumination, cfg.topIllumination);
  for (const scene of scenes.slice(1)) assert.deepEqual(project.scenes[scene.id].topIllumination, scene.defaults.topIllumination);
});

test('верхние лучи движутся и сохраняются на удержании во всех четырёх сценах', async () => {
  const { updateUpperRays } = await import('../src/top-illumination.js');
  const { Background } = await import('../src/fx.js');
  const { computePhase } = await import('../src/timeline.js');
  for (const scene of SCENES.filter(s => s.defaults)) {
    const cfg = mergeConfig(scene.defaults, {}), bg = new Background(), tl = cfg.timeline;
    const at = local => computePhase(tl.startDelay + local, tl);
    const intro = scene.id === 'waiting';
    updateUpperRays(bg, at(0), cfg, intro, 0, 0);
    assert.equal(bg.uniforms.uIntroLight.value, 0);
    const heldTime = tl.drawDuration + tl.emergeDuration + tl.holdDuration / 2;
    updateUpperRays(bg, at(heldTime), cfg, intro, 0, heldTime);
    assert.ok(bg.uniforms.uIntroLight.value > 0);
    assert.equal(bg.uniforms.uUpperTime.value, heldTime);
    assert.equal(bg.uniforms.uUpperColor.value.getHexString(), 'ffd98a');
    assert.match(bg.material.fragmentShader, /sin\(ut \* 0\.21\)/);
    const fadeEnd = tl.drawDuration + tl.emergeDuration + tl.holdDuration + tl.fadeDuration;
    updateUpperRays(bg, at(fadeEnd), cfg, intro, 0, fadeEnd);
    assert.equal(bg.uniforms.uIntroLight.value, 0);
    cfg.topIllumination.enabled = false;
    cfg.topIllumination.raysColor = '#123456'; cfg.topIllumination.raysSpeed = 0;
    updateUpperRays(bg, at(heldTime), cfg, intro, 0, heldTime);
    assert.ok(bg.uniforms.uIntroLight.value > 0); assert.equal(bg.uniforms.uUpperTime.value, 0);
    assert.equal(bg.uniforms.uUpperColor.value.getHexString(), '123456');
    cfg.topIllumination.raysEnabled = false;
    updateUpperRays(bg, at(heldTime), cfg, intro, 0, heldTime);
    assert.equal(bg.uniforms.uIntroLight.value, 0);
    const restored = parseConfigJSON(configToJSON(cfg), scene.defaults);
    assert.deepEqual(restored.topIllumination, cfg.topIllumination);
    bg.mesh.geometry.dispose(); bg.material.dispose();
  }
});
