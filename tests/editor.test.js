import test from "node:test";
import assert from "node:assert/strict";
import { createDefaultProject, SETTINGS_VERSION } from "../src/scenes/defaults.js";
import { migrateLegacyProject } from "../src/config.js";
import { captionFrameState } from "../src/caption-renderer.js";
import {
  createElementDefaults, elementIdsForScene, elementAnimation, elementWorldTransform,
  setElementTransform, snapValue, worldToNormalized, normalizedToWorld, applyElementOpacity,
  elementKeyframeState, upsertKeyframe, removeKeyframe, copyElementAnimation,
} from "../src/element-registry.js";

test("element registry has scene-specific elements and normalized coordinates", () => {
  assert.equal(createDefaultProject().settingsVersion, SETTINGS_VERSION);
  assert.ok(elementIdsForScene("waiting").includes("date"));
  assert.ok(elementIdsForScene("brand").includes("decor"));
  assert.ok(elementIdsForScene("photo-pause").includes("circularText"));
  assert.ok(elementIdsForScene("photo-pause").includes("edgeCorners"));
  assert.ok(elementIdsForScene("finale").includes("finalCircle"));
  assert.ok(elementIdsForScene("finale").includes("phrase"));
  const logo = createElementDefaults("photo-pause").logo;
  assert.equal(logo.x, 0.5);
  assert.equal(logo.y, 0.5);
  const p = worldToNormalized(0, 0);
  assert.deepEqual(p, { x: 0.5, y: 0.5 });
  const w = normalizedToWorld(0.25, 0.25);
  assert.ok(w.x < 0 && w.y > 0);
  assert.equal(snapValue(0.237, 0.01), 0.24);
  assert.equal(snapValue(0.237, 0), 0.237);
});

test("element animation and transforms are pure functions of time and config", () => {
  const el = createElementDefaults("brand").title;
  el.x = 0.3;
  el.y = 0.4;
  el.scale = 1.5;
  el.rotation = 0.2;
  el.timing = { start: 1, duration: 2 };
  const a = elementAnimation(el, 5, 18);
  const b = elementAnimation(el, 5, 18);
  assert.deepEqual(a, b);
  const p = elementWorldTransform(el, 5, 18, 4, 2.25);
  assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
  assert.equal(p.scale, 1.5 * a.scale);
  assert.equal(p.rotation, 0.2 + a.rotation);
  const holder = { elements: { title: el } };
  const updated = setElementTransform(holder, "title", { timing: { start: 2 }, color: "#ff0000" });
  assert.equal(updated.timing.start, 2);
  assert.equal(updated.color, "#ff0000");
});

test("captionFrameState applies element transforms and z-order", () => {
  const cfg = createDefaultProject().scenes.finale;
  cfg.elements.title.x = 0.3;
  cfg.elements.title.y = 0.4;
  cfg.elements.title.scale = 1.5;
  cfg.elements.title.zIndex = 9;
  cfg.elements.title.color = "#ff0000";
  cfg.elements.phrase.zIndex = -3;
  const state = captionFrameState(10, cfg, "finale");
  const title = state.lines.find((line) => line.key === "title");
  assert.ok(title);
  assert.equal(title.x, 0.3);
  assert.ok(Math.abs(title.y - 0.4 * 1080) < 1);
  assert.equal(title.scale, 1.5);
  assert.equal(title.zIndex, 9);
  assert.equal(title.color, "#ff0000");
  assert.equal(state.lines[0].key, "phrase");
  assert.equal(state.lines[state.lines.length - 1].key, "title");
});

test("migrateLegacyProject upgrades phase 2/3a sections but keeps user edits", () => {
  const legacy = createDefaultProject();
  delete legacy.settingsVersion;
  legacy.scenes.waiting.caption.title = "Мой титр";
  legacy.scenes.brand.decor = { old: true };
  legacy.scenes["photo-pause"].layout.logoY = 0.55;
  legacy.scenes["photo-pause"].layout.viewfinderOpacity = 0.24;
  legacy.scenes["photo-pause"].photoPause = { old: true };
  legacy.scenes.finale.finale = { finalCircle: "none" };
  legacy.scenes.waiting.elements = undefined;
  const migrated = migrateLegacyProject(legacy, { force: true });
  assert.equal(migrated.settingsVersion, SETTINGS_VERSION);
  assert.equal(migrated.scenes.waiting.caption.title, "Мой титр");
  assert.equal(migrated.scenes.brand.decor.preset, "blueprint-arcs");
  assert.equal(migrated.scenes["photo-pause"].layout.logoY, 0);
  assert.equal(migrated.scenes["photo-pause"].layout.viewfinderOpacity, 0);
  assert.equal(migrated.scenes["photo-pause"].photoPause.text, "фотопауза • ");
  assert.equal(migrated.scenes.finale.finale.finalCircle, "center-construction");
  assert.ok(migrated.scenes.waiting.elements.logo);
  assert.ok(migrated.scenes["photo-pause"].elements.circularText);
});

test("migrateLegacyProject preserve mode fills missing ?config fields without overwriting", () => {
  const data = createDefaultProject();
  delete data.settingsVersion;
  data.scenes.brand.decor = { preset: "quiet-dust", opacity: 0.9 };
  const migrated = migrateLegacyProject(data, { force: true, preserve: true });
  assert.equal(migrated.settingsVersion, SETTINGS_VERSION);
  assert.equal(migrated.scenes.brand.decor.preset, "quiet-dust");
  assert.equal(migrated.scenes.brand.decor.opacity, 0.9);
  assert.ok(migrated.scenes.brand.decor.speed !== undefined);
  assert.ok(migrated.scenes.brand.elements.logo);
});

test("default corners layer is -2 and opacity state is frame-local", () => {
  assert.equal(createElementDefaults("waiting").corners.zIndex, -2);
  const material = { opacity: 0.8, transparent: false, userData: {} };
  const object = { traverse: (fn) => fn({ material }) };
  applyElementOpacity(object, 0.5, 1);
  assert.equal(material.opacity, 0.4);
  // Следующий кадр сцена выставила новую базу; старый кэш не должен вернуться.
  material.opacity = 0.6;
  applyElementOpacity(object, 0.5, 2);
  assert.equal(material.opacity, 0.3);
});

test("keyframes are deterministic, wrap at the seam and can be copied", () => {
  const el = createElementDefaults("brand").logo;
  el.keyframes = [
    { t: 0, x: 0.2, y: 0.5, scale: 1, rotation: 0, opacity: 1, easing: "linear" },
    { t: 5, x: 0.8, y: 0.5, scale: 1, rotation: 0, opacity: 1, easing: "linear" },
  ];
  assert.equal(elementKeyframeState(el, 2.5, 10).x, 0.5);
  assert.deepEqual(elementKeyframeState(el, 1, 10), elementKeyframeState(el, 11, 10));
  const added = upsertKeyframe(el, 2.5, 10, { x: 0.55 });
  assert.equal(added.length, 3);
  assert.equal(removeKeyframe({ keyframes: added }, 2.5, 10).length, 2);
  const project = createDefaultProject();
  project.scenes.brand.elements.logo.keyframes = added;
  copyElementAnimation(project, "brand", "logo", ["photo-pause", "finale"]);
  assert.deepEqual(project.scenes["photo-pause"].elements.logo.keyframes, added);
  assert.deepEqual(project.scenes.finale.elements.logo.keyframes, added);
});

test("settingsVersion 4 migration keeps phase 3a transforms and adds keyframes", () => {
  const project = createDefaultProject();
  project.settingsVersion = 3;
  project.scenes.brand.elements.logo.x = 0.42;
  delete project.scenes.brand.elements.logo.keyframes;
  delete project.scenes["photo-pause"].elements.circularText.keyframes;
  migrateLegacyProject(project, { force: true });
  assert.equal(project.settingsVersion, 4);
  assert.equal(project.scenes.brand.elements.logo.x, 0.42);
  assert.deepEqual(project.scenes.brand.elements.logo.keyframes, []);
  assert.deepEqual(project.scenes["photo-pause"].elements.circularText.keyframes, []);
});
