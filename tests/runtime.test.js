import test from "node:test";
import assert from "node:assert/strict";
import { AnimationRuntime, cycleDuration } from "../src/runtime.js";
import { OUTPUT, RECORDING_CHAIN, SCENES, sceneById } from "../src/scenes/catalog.js";
import { DEFAULTS, cloneDefaults } from "../src/config.js";
import { BRAND_DEFAULTS } from "../src/scenes/brand.js";
import { PHOTO_PAUSE_DEFAULTS } from "../src/scenes/photo-pause.js";
import { FINALE_DEFAULTS } from "../src/scenes/finale.js";
import { FIELD_TIMING, fieldCues, quietBreath, finaleCues } from "../src/scenes/cues.js";
import { crossedBoundary } from "../src/operator.js";
import { exportPlan, outgoingOpacity } from "../src/export-plan.js";

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
  assert.deepEqual(RECORDING_CHAIN, ["waiting", "brand", "photo-pause", "finale"]);
  assert.ok(RECORDING_CHAIN.every((id) => sceneById(id)?.status === "ready"));
  assert.equal(sceneById("nonexistent"), undefined);
});

test("покадровый план: фиксированные 60 FPS, без пропусков и с тремя переходами", () => {
  const plan = exportPlan([
    { id: "waiting", cycle: 15.3 }, { id: "brand", cycle: 24 },
    { id: "photo-pause", cycle: 24 }, { id: "finale", cycle: 18 },
  ], 60);
  assert.equal(plan.totalFrames, 4878);
  assert.deepEqual(plan.segments.map((s) => s.start), [0, 918, 2358, 3798]);
  assert.equal(plan.transitionFrames, 54);
  assert.equal(outgoingOpacity(0, 54), 1);
  assert.ok(outgoingOpacity(27, 54) > 0.49 && outgoingOpacity(27, 54) < 0.51);
  assert.equal(outgoingOpacity(54, 54), 0);
  assert.equal(outgoingOpacity(55, 54), 0);
});

test("автопереход только при пересечении шва во время воспроизведения", () => {
  assert.equal(crossedBoundary(14, 15.89, 0.6, 15.3), false);
  assert.equal(crossedBoundary(15.89, 15.92, 0.6, 15.3), true);
  assert.equal(crossedBoundary(15.92, 16, 0.6, 15.3), false);
  assert.equal(crossedBoundary(23.98, 24.02, 0, 24), true);
  assert.equal(crossedBoundary(10, 10, 0, 24), false);
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

test("№2 и №8: прорисовка, заливка и обратный уход до закрытого шва", () => {
  const cycle = 24;
  assert.equal(FIELD_TIMING.drawDuration + FIELD_TIMING.emergeDuration +
    FIELD_TIMING.fadeDuration + FIELD_TIMING.restDuration, 8);
  assert.equal(fieldCues(0, cycle).titleOutline, 0);
  assert.ok(fieldCues(4.2, cycle).titleOutline > 0);
  assert.equal(fieldCues(4.2, cycle).titleFill, 0);
  assert.equal(fieldCues(8, cycle).titleFill, 1);
  assert.ok(fieldCues(21.6, cycle).titleOutline > fieldCues(21.6, cycle).titleFill);
  assert.equal(fieldCues(cycle - 1 / 60, cycle).titleOutline, 0);
  assert.deepEqual(fieldCues(cycle, cycle), fieldCues(0, cycle));
  assert.equal(finaleCues(15.8, 18).phraseFill, 0);
  assert.ok(finaleCues(15.8, 18).titleOutline > 0);
  assert.equal(finaleCues(18 - 1 / 60, 18).titleOutline, 0);
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
