import test from "node:test";
import assert from "node:assert/strict";
import { AnimationRuntime, cycleDuration } from "../src/runtime.js";
import { OUTPUT, RECORDING_CHAIN, SCENES, sceneById } from "../src/scenes/catalog.js";
import { DEFAULTS, cloneDefaults } from "../src/config.js";
import { WAITING_DEFAULTS } from "../src/scenes/waiting.js";
import { BRAND_DEFAULTS } from "../src/scenes/brand.js";
import { PHOTO_PAUSE_DEFAULTS } from "../src/scenes/photo-pause.js";
import { FINALE_DEFAULTS } from "../src/scenes/finale.js";
import { CONTOUR_WAVE_COUNT, CONTOUR_WAVE_PERIOD, contourWave, introCues } from "../src/scenes/cues.js";
import { computePhase, plotSequence, seamCurtainOpacity } from "../src/timeline.js";
import { captionState } from "../src/caption.js";
import { crossedBoundary } from "../src/operator.js";

test("единый формат и каталог девяти сцен без ложных готовых рендеров", () => {
  assert.deepEqual(OUTPUT, { width: 1920, height: 1080, fps: 60 });
  assert.equal(SCENES.length, 9);
  assert.equal(sceneById("waiting")?.status, "ready");
  assert.equal(sceneById("waiting")?.defaults, DEFAULTS);
  assert.equal(sceneById("intro"), sceneById("waiting"));
  assert.match(sceneById("intro").title, /Интро/);
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

test("автопереход только при пересечении шва во время воспроизведения", () => {
  assert.equal(crossedBoundary(14, 15.89, 0.6, 15.3), false);
  assert.equal(crossedBoundary(15.89, 15.92, 0.6, 15.3), true);
  assert.equal(crossedBoundary(15.92, 16, 0.6, 15.3), false);
  assert.equal(crossedBoundary(23.98, 24.02, 0, 24), true);
  assert.equal(crossedBoundary(10, 10, 0, 24), false);
});

test("все готовые сцены рисуются и уходят как первая, с последовательными титрами", () => {
  for (const tl of [BRAND_DEFAULTS.timeline, PHOTO_PAUSE_DEFAULTS.timeline, FINALE_DEFAULTS.timeline]) {
    const cycle = cycleDuration(tl);
    const fade = tl.drawDuration + tl.emergeDuration + tl.holdDuration;
    assert.equal(computePhase(0, tl).name, "draw");
    assert.equal(seamCurtainOpacity(computePhase(0, tl), tl), 1);
    assert.ok(plotSequence(computePhase(1.2, tl), tl).sweep > 0);
    assert.equal(computePhase(1.2, tl).reveal, 0);
    const writing = captionState(tl.drawDuration + tl.emergeDuration / 2 + 1.2, tl).lines;
    assert.ok(writing.title.outline > 0);
    assert.ok(writing.subtitle.outline > 0);
    assert.equal(writing.subtitle.fill, 0);
    const held = captionState(tl.drawDuration + tl.emergeDuration + 2, tl).lines;
    assert.equal(held.title.fill, 1);
    assert.equal(held.subtitle.fill, 1);
    const exiting = captionState(fade + tl.fadeDuration * 0.3, tl).lines;
    assert.ok(exiting.subtitle.outline < exiting.title.outline);
    const reverse = computePhase(fade + tl.fadeDuration * 0.9, tl);
    assert.equal(reverse.name, "fade");
    assert.ok(reverse.outline > 0 && reverse.draw < 1);
    assert.equal(captionState(cycle - 1 / 60, tl).lines.title.outline, 0);
    assert.equal(seamCurtainOpacity(computePhase(cycle - 1 / 60, tl), tl), 1);
  }
});

test("во всех готовых сценах точка подхватывает контур и отматывает орбиту до шва", () => {
  for (const tl of [WAITING_DEFAULTS.timeline, BRAND_DEFAULTS.timeline, PHOTO_PAUSE_DEFAULTS.timeline, FINALE_DEFAULTS.timeline]) {
    const fadeStart = tl.drawDuration + tl.emergeDuration + tl.holdDuration;
    const fadeEnd = fadeStart + tl.fadeDuration;
    const at = (local) => computePhase(tl.startDelay + local, tl);
    const follow = plotSequence(at(fadeStart + 0.9 * tl.fadeDuration), tl);
    assert.ok(follow.reverse && follow.head > 0 && follow.trace > 0 && follow.trace < 1);
    const left = plotSequence(at(fadeEnd - 1e-6), tl);
    const right = plotSequence(at(fadeEnd + 1e-6), tl);
    for (const key of ["sweep", "transfer", "opacity", "head", "trace"]) {
      assert.ok(Math.abs(left[key] - right[key]) < 1e-3, `${key}: скачок между контуром и орбитой`);
    }
    const returning = plotSequence(at(fadeEnd + tl.restDuration * 0.12), tl);
    assert.ok(returning.transfer > 0 && returning.transfer < 1 && returning.head > 0);
    const early = plotSequence(at(fadeEnd + tl.restDuration * 0.38), tl);
    const late = plotSequence(at(fadeEnd + tl.restDuration * 0.62), tl);
    assert.ok(early.opacity > 0 && late.opacity > 0 && early.head > 0 && late.head > 0);
    assert.ok(early.sweep > late.sweep && late.sweep > 0, "орбита должна отматываться");
    assert.equal(seamCurtainOpacity(at(fadeEnd + tl.restDuration * 0.5), tl), 0);
    assert.equal(seamCurtainOpacity(at(fadeEnd + tl.restDuration * 0.95), tl), 1);
    assert.equal(plotSequence(at(fadeEnd + tl.restDuration * 0.95), tl).head, 0);
    const again = plotSequence(at(fadeEnd + tl.restDuration * 0.38 + cycleDuration(tl)), tl);
    assert.ok(Math.abs(again.sweep - early.sweep) < 1e-9);
  }
});

test("интро раскрывается светом и движением камеры, затем уступает место титрам", () => {
  const tl = WAITING_DEFAULTS.timeline;
  const at = (local) => introCues(computePhase(tl.startDelay + local, tl), tl);
  assert.deepEqual(introCues(computePhase(0, tl), tl), { beams: 0, strike: 0, approach: 0 });
  assert.equal(at(0).beams, 0);
  const drawing = at(tl.drawDuration * 0.6);
  assert.ok(drawing.beams > 0.9 && drawing.approach > 0.9 && drawing.strike === 0);
  const reveal = at(tl.drawDuration + tl.emergeDuration * 0.5);
  assert.ok(reveal.beams > 0.9 && reveal.strike > 0.9 && reveal.approach > 0);
  const held = at(tl.drawDuration + tl.emergeDuration + 2);
  assert.deepEqual(held, { beams: 0, strike: 0, approach: 0 });
  assert.deepEqual(at(cycleDuration(tl) - 1 / 60), held);
  const again = at(tl.drawDuration * 0.6 + cycleDuration(tl));
  for (const key of ["beams", "strike", "approach"]) assert.ok(Math.abs(again[key] - drawing[key]) < 1e-9);
});

test("контурные волны непрерывно расходятся, замедляются и затухают без скачка при перезапуске", () => {
  assert.equal(contourWave(0, 0).opacity, 0);
  // Эхо рождается уже больше знака: копии расходятся вокруг него, а не ложатся по силуэту.
  assert.ok(contourWave(0, 0).scale >= 1.3, "эхо начинается прямо на контуре логотипа");
  const near = contourWave(CONTOUR_WAVE_PERIOD * 0.2, 0);
  const far = contourWave(CONTOUR_WAVE_PERIOD * 0.8, 0);
  assert.ok(far.scale > near.scale);
  assert.ok(near.opacity > far.opacity && far.opacity > 0);
  const step = CONTOUR_WAVE_PERIOD * 0.1;
  assert.ok(contourWave(step, 0).scale - contourWave(0, 0).scale >
    contourWave(CONTOUR_WAVE_PERIOD * 0.9, 0).scale - contourWave(CONTOUR_WAVE_PERIOD * 0.8, 0).scale);
  assert.ok(contourWave(CONTOUR_WAVE_PERIOD - 1e-4, 0).opacity < 1e-6);
  for (let i = 0; i < 100; i++) {
    const time = i * CONTOUR_WAVE_PERIOD / 100;
    const waves = Array.from({ length: CONTOUR_WAVE_COUNT }, (_, index) => contourWave(time, index));
    assert.ok(Math.max(...waves.map((wave) => wave.opacity)) > 0.1);
    const next = contourWave(time + CONTOUR_WAVE_PERIOD, 0);
    assert.ok(Math.abs(next.scale - waves[0].scale) < 1e-9);
    assert.ok(Math.abs(next.opacity - waves[0].opacity) < 1e-9);
  }
});

test("описание сцены копируется для настроек, но эталон не меняется", () => {
  const cfg = cloneDefaults(sceneById("waiting").defaults);
  cfg.timeline.speed = 2;
  assert.equal(DEFAULTS.timeline.speed, 1);
  assert.ok(Math.abs(cycleDuration(cfg.timeline) - 18.6) < 1e-9);
});

test("каждая сцена получает полный независимый конфиг со своей композицией", () => {
  const cfg = cloneDefaults(BRAND_DEFAULTS);
  for (const key of ["background", "colors", "rings", "particles", "lights", "sparks"]) {
    assert.deepEqual(cfg[key], WAITING_DEFAULTS[key], key);
    assert.notEqual(cfg[key], WAITING_DEFAULTS[key], key);
  }
  // Фоновые сцены крупнее и ниже интро, но это их собственные значения.
  assert.equal(cfg.logo.scale, 0.58);
  assert.equal(cfg.logo.offsetY, 0.86);
  assert.equal(WAITING_DEFAULTS.logo.scale, 0.47);
  cfg.rings.radius = 123;
  assert.notEqual(WAITING_DEFAULTS.rings.radius, 123);
  // Настройки трёх фоновых сцен не делят объекты между собой.
  assert.notEqual(BRAND_DEFAULTS.logo, PHOTO_PAUSE_DEFAULTS.logo);
  assert.notEqual(PHOTO_PAUSE_DEFAULTS.logo, FINALE_DEFAULTS.logo);
  assert.notEqual(BRAND_DEFAULTS.timeline, FINALE_DEFAULTS.timeline);
  assert.equal(cycleDuration(BRAND_DEFAULTS.timeline), 24);
});

test("движок сохраняет точный seek, паузу и реальное время без привязки к кадрам", () => {
  const cfg = cloneDefaults();
  const calls = [];
  const scene = {
    update: (time, dt) => calls.push(["update", time, dt]),
    render: (dt) => calls.push(["render", dt]),
  };
  const runtime = new AnimationRuntime(scene, cfg);
  assert.ok(Math.abs(runtime.cycle - 18.6) < 1e-9);
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
