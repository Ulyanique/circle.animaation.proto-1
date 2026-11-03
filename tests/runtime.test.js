import test from "node:test";
import assert from "node:assert/strict";
import { AnimationRuntime, cycleDuration } from "../src/runtime.js";
import { OUTPUT, SCENES, sceneById } from "../src/scenes/catalog.js";
import { DEFAULTS, cloneDefaults } from "../src/config.js";
import { BRAND_DEFAULTS } from "../src/scenes/brand.js";
import { PHOTO_PAUSE_DEFAULTS } from "../src/scenes/photo-pause.js";
import { FINALE_DEFAULTS } from "../src/scenes/finale.js";
import { quietBreath, finaleCues } from "../src/scenes/cues.js";

test("единый формат и каталог девяти сцен без ложных готовых рендеров", () => {
  assert.deepEqual(OUTPUT, { width: 1920, height: 1080, fps: 60 });
  assert.equal(SCENES.length, 9);
  assert.equal(sceneById("waiting")?.status, "ready");
  assert.equal(sceneById("waiting")?.defaults, DEFAULTS);
  assert.equal(sceneById("brand")?.status, "ready");
  assert.equal(sceneById("brand")?.defaults, BRAND_DEFAULTS);
  assert.equal(cycleDuration(BRAND_DEFAULTS.timeline), 24);
  assert.equal(sceneById("photo-pause")?.defaults, PHOTO_PAUSE_DEFAULTS);
  assert.equal(sceneById("finale")?.defaults, FINALE_DEFAULTS);
  assert.equal(cycleDuration(PHOTO_PAUSE_DEFAULTS.timeline), 24);
  assert.equal(cycleDuration(FINALE_DEFAULTS.timeline), 18);
  assert.equal(SCENES.filter((scene) => scene.status === "ready").length, 4);
  assert.equal(sceneById("nonexistent"), undefined);
});

test("фотопауза бесшовна, финальная фраза идёт после названия и уходит до стыка", () => {
  assert.equal(quietBreath(0, 24), 0);
  assert.equal(quietBreath(24 - 1 / 60, 24), 0);
  assert.ok(quietBreath(6, 24) > 0);
  assert.equal(finaleCues(0, 18).symbol, 0);
  assert.equal(finaleCues(18 - 1 / 60, 18).symbol, 0);
  assert.equal(finaleCues(18 - 1 / 60, 18).phraseFill, 0);
  assert.equal(finaleCues(18, 18).titleOutline, 0);
  assert.ok(finaleCues(4.2, 18).titleFill > 0);
  assert.equal(finaleCues(4.2, 18).phraseFill, 0);
  assert.ok(finaleCues(6.2, 18).phraseOutline > 0);
  assert.equal(finaleCues(6.2, 18).phraseFill, 0);
  assert.equal(finaleCues(8, 18).phraseFill, 1);
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
