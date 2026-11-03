import test from "node:test";
import assert from "node:assert/strict";
import { AnimationRuntime, cycleDuration } from "../src/runtime.js";
import { OUTPUT, SCENES, sceneById } from "../src/scenes/catalog.js";
import { DEFAULTS, cloneDefaults } from "../src/config.js";
import { BRAND_DEFAULTS } from "../src/scenes/brand.js";

test("единый формат и каталог девяти сцен без ложных готовых рендеров", () => {
  assert.deepEqual(OUTPUT, { width: 1920, height: 1080, fps: 60 });
  assert.equal(SCENES.length, 9);
  assert.equal(sceneById("waiting")?.status, "ready");
  assert.equal(sceneById("waiting")?.defaults, DEFAULTS);
  assert.equal(sceneById("brand")?.status, "ready");
  assert.equal(sceneById("brand")?.defaults, BRAND_DEFAULTS);
  assert.equal(cycleDuration(BRAND_DEFAULTS.timeline), 24);
  assert.equal(SCENES.filter((scene) => scene.status === "ready").length, 2);
  assert.equal(sceneById("nonexistent"), undefined);
});

test("описание сцены копируется для настроек, но эталон не меняется", () => {
  const cfg = cloneDefaults(sceneById("waiting").defaults);
  cfg.timeline.speed = 2;
  assert.equal(DEFAULTS.timeline.speed, 1);
  assert.equal(cycleDuration(cfg.timeline), 15.3);
});

test("движок сохраняет точный seek, паузу и реальное время без привязки к кадрам", () => {
  const cfg = cloneDefaults();
  const calls = [];
  const scene = {
    update: (time, dt) => calls.push(["update", time, dt]),
    render: (dt) => calls.push(["render", dt]),
  };
  const runtime = new AnimationRuntime(scene, cfg);
  assert.equal(runtime.cycle, 15.3);
  runtime.renderAt(6.14);
  runtime.renderAt(2.86, 1 / OUTPUT.fps);
  assert.equal(runtime.time, 2.86);
  cfg.timeline.speed = 2;
  runtime.advance(0.5, 0.05);
  assert.equal(runtime.time, 3.86);
  cfg.playback.paused = true;
  runtime.advance(0.5, 0.05);
  assert.equal(runtime.time, 3.86);
  assert.deepEqual(calls[0], ["update", 6.14, 1 / 60]);
  assert.deepEqual(calls[1], ["render", 1 / 60]);
  assert.deepEqual(calls.at(-2), ["update", 3.86, 0.05]);
  assert.deepEqual(calls.at(-1), ["render", 0.05]);
});
