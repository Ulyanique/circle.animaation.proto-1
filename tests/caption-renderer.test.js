import test from "node:test";
import assert from "node:assert/strict";
import { createSceneDefaults } from "../src/scenes/defaults.js";
import { captionFrameState, delayedFill } from "../src/caption-renderer.js";

test("captionFrameState is deterministic for the same absolute time", () => {
  const cfg = createSceneDefaults("waiting");
  const a = captionFrameState(4.8, cfg, "waiting");
  const b = captionFrameState(4.8, cfg, "waiting");
  assert.deepEqual(a, b);
  assert.equal(a.lines.length, 3);
  assert.equal(a.rules.length, 2);
  assert.equal(a.lines[0].text, "Янтарный циркуль");
  assert.equal(a.layers, 1);
  assert.equal(a.offsetPx, 0);
});

test("outline layers and fill delay are part of the pure caption state", () => {
  const base = createSceneDefaults("waiting");
  const custom = JSON.parse(JSON.stringify(base));
  custom.caption.outlineLayers = 3;
  custom.caption.outlineOffset = 0.02;
  custom.caption.fillDelay = 0.5;
  custom.caption.penGlow = 1.4;
  const a = captionFrameState(4.8, base, "waiting");
  const b = captionFrameState(4.8, custom, "waiting");
  assert.equal(b.layers, 3);
  assert.ok(b.offsetPx > 0);
  assert.equal(b.penGlow, 1.4);
  assert.ok(b.lines[0].fill <= a.lines[0].fill);
  assert.equal(delayedFill(0.5, 0.5), 0);
  assert.equal(delayedFill(1, 0.5), 1);
});

test("field and finale scenes get their own deterministic line sets", () => {
  const brand = captionFrameState(8.4, createSceneDefaults("brand"), "brand");
  const photo = captionFrameState(8.4, createSceneDefaults("photo-pause"), "photo-pause");
  const finale = captionFrameState(8.4, createSceneDefaults("finale"), "finale");
  assert.equal(brand.lines.length, 1);
  assert.equal(brand.lines[0].text, "Янтарный циркуль");
  assert.equal(photo.lines[0].text, "Фотопауза");
  assert.equal(finale.lines.length, 2);
  assert.equal(finale.lines[0].text, "Янтарный циркуль");
  assert.equal(finale.lines[1].text, "ИСТОРИЯ ПРОДОЛЖАЕТСЯ");
});
