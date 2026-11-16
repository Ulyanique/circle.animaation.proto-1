import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULTS } from "../src/config.js";
import { computePhase, ringsEnvelope, compositionFocus, heroGlint, plotSequence, ringSweep, seamCurtainOpacity } from "../src/timeline.js";
import { captionLines, captionProgress, captionState, captionAccent, glyphReveal } from "../src/caption.js";
import { introSequence } from "../src/scenes/cues.js";
import { seededRandom } from "../src/random.js";
import { advanceTimeline } from "../src/playback.js";
import { reviewMarkers } from "../src/review.js";

const tl = DEFAULTS.timeline;
const cycle = tl.drawDuration + tl.emergeDuration + tl.holdDuration + tl.fadeDuration + tl.restDuration;
const at = (local) => computePhase(tl.startDelay + local, tl);

test("фазы и границы цикла", () => {
  const D = tl.drawDuration, E = tl.emergeDuration, H = tl.holdDuration, F = tl.fadeDuration;
  assert.equal(at(0).name, "draw");
  assert.equal(at(D).name, "emerge");
  assert.equal(at(D + E).name, "hold");
  assert.equal(at(D + E + H).name, "fade");
  assert.equal(at(D + E + H + F).name, "rest");
  assert.equal(at(cycle).name, "draw");
  assert.equal(at(D + E).reveal, 1);
  assert.equal(at(D + E + H + F).reveal, 0);
});

test("интро: центральная орбита, знак, боковые круги, подъём, титры", () => {
  const intro = DEFAULTS.intro;
  const cue = (local) => introSequence(at(local), tl, intro);
  const middle = cue(tl.drawDuration + tl.emergeDuration / 2);
  assert.equal(middle.corners, 0);
  assert.equal(middle.lift, 0);
  const { cornerStart, cornerEnd, liftEnd, captionStart } = middle;
  assert.equal(at(cornerStart).reveal, 1);
  assert.equal(cue(cornerStart).corners, 0);
  assert.ok(cue((cornerStart + cornerEnd) / 2).corners > 0);
  assert.equal(cue(cornerEnd).lift, 0);
  assert.ok(cue((cornerEnd + liftEnd) / 2).lift > 0);
  assert.equal(cue(liftEnd).lift, 1);
  // Титр стартует с нахлёстом ДО конца подъёма знака: в момент liftEnd первая
  // буква уже чуть прорисована, но не залита.
  assert.ok(captionStart < liftEnd, "нахлёст должен начинаться до конца подъёма");
  assert.ok(liftEnd - captionStart <= 0.2, "нахлёст не больше 0,2 с");
  const atLiftEnd = captionState(tl.startDelay + liftEnd, tl, captionStart).lines.title.outline;
  assert.ok(atLiftEnd > 0 && atLiftEnd < 0.35, `в конце подъёма название едва начато: ${atLiftEnd}`);
  assert.equal(captionState(tl.startDelay + captionStart, tl, captionStart).lines.title.outline, 0);
  assert.ok(captionState(tl.startDelay + captionStart + 0.5, tl, captionStart).lines.title.outline > 0);
  const fadeStart = tl.drawDuration + tl.emergeDuration + tl.holdDuration;
  assert.ok(fadeStart - (captionStart + 2.9) >= 5);
  assert.equal(cue(cycle - 1 / 60).corners, 0);
  const next = cue(cornerStart + cycle + 0.3);
  assert.ok(Math.abs(next.corners - cue(cornerStart + 0.3).corners) < 1e-9);
});

test("фазы и подпись периодичны на любом кадре", () => {
  for (let i = 0; i < 200; i++) {
    const t = tl.startDelay + i * cycle / 200;
    const a = computePhase(t, tl), b = computePhase(t + cycle, tl);
    for (const key of ["draw", "reveal", "outline", "fill", "rings", "grow"]) {
      assert.ok(Math.abs(a[key] - b[key]) < 1e-9, `${key} @ ${t}`);
    }
    assert.ok(Math.abs(captionProgress(t, tl) - captionProgress(t + cycle, tl)) < 1e-9);
    const aLines = captionState(t, tl).lines, bLines = captionState(t + cycle, tl).lines;
    for (const name of Object.keys(aLines)) {
      assert.ok(Math.abs(aLines[name].outline - bLines[name].outline) < 1e-9, `${name} @ ${t}`);
      if (aLines[name].fill !== undefined) {
        assert.ok(Math.abs(aLines[name].fill - bLines[name].fill) < 1e-9);
      }
    }
  }
});

test("метки просмотра следуют фазам при изменении длительностей", () => {
  const marks = reviewMarkers(tl);
  assert.deepEqual(marks.map((m) => m.label), ["Точка", "Передача", "Контур", "Золото", "Блик", "Композиция", "Уход"]);
  assert.ok(marks.every((m, i) => i === 0 || m.time > marks[i - 1].time));
  const shorter = reviewMarkers({ ...tl, drawDuration: 1.5, holdDuration: 3 });
  assert.notEqual(shorter[2].time, marks[2].time);
  assert.notEqual(shorter[5].time, marks[5].time);
  assert.ok(shorter[6].time < 1.5 + tl.emergeDuration + 3 + tl.fadeDuration + tl.restDuration);
});

test("построительная точка начинает раньше логотипа и уступает ему место", () => {
  const before = at(0.5);
  const plot = plotSequence(before, tl);
  assert.equal(before.draw, 0);
  assert.ok(plot.sweep > 0 && plot.opacity > 0 && plot.head > 0);
  const finishedCircle = plotSequence(at(tl.drawDuration * 0.60), tl);
  assert.equal(finishedCircle.sweep, 1);
  assert.equal(finishedCircle.transfer, 0);
  assert.equal(at(tl.drawDuration * 0.60).draw, 0);
  assert.ok(plotSequence(at(tl.drawDuration * 0.70), tl).transfer > 0);
  assert.equal(at(tl.drawDuration * 0.70).draw, 0);
  const handedOff = plotSequence(at(tl.drawDuration * 0.83), tl);
  assert.equal(handedOff.transfer, 1);
  assert.ok(handedOff.head > 0 && at(tl.drawDuration * 0.83).draw > 0);
  assert.ok(at(tl.drawDuration).draw < 1);
  assert.equal(at(tl.drawDuration + tl.emergeDuration * 0.12).draw, 1);
  assert.equal(plotSequence(at(tl.drawDuration), tl).head, 0);
  assert.equal(plotSequence(at(tl.drawDuration + tl.emergeDuration), tl).opacity, 0);
  assert.equal(plotSequence(at(cycle), tl).opacity, 0);
});

test("блик проходит один раз во время сборки названия и не тревожит удержание", () => {
  const settle = tl.drawDuration + tl.emergeDuration;
  assert.equal(heroGlint(at(settle - 0.2), tl).intensity, 0);
  const passage = heroGlint(at(settle + 1.0), tl);
  assert.ok(passage.intensity > 0.8);
  assert.ok(passage.position > -1 && passage.position < 1);
  assert.ok(heroGlint(at(settle + 0.2), tl).intensity < passage.intensity * .2);
  assert.equal(heroGlint(at(settle + 2.2), tl).intensity, 0);
  assert.equal(heroGlint(at(settle + tl.holdDuration / 2), tl).intensity, 0);
  assert.equal(heroGlint(at(cycle - 1 / 60), tl).intensity, 0);
});

test("угловой свет плавно уступает место собранной композиции", () => {
  const beginning = tl.drawDuration + tl.emergeDuration * 0.92;
  const end = tl.drawDuration + tl.emergeDuration + 1.4;
  assert.equal(compositionFocus(at(beginning), tl), 0);
  assert.equal(compositionFocus(at(end), tl), 1);
  for (let i = 0; i <= 20; i++) {
    const p = at(beginning + i * (end - beginning) / 20);
    assert.ok(compositionFocus(p, tl) >= 0 && compositionFocus(p, tl) <= 1);
  }
  assert.equal(compositionFocus(at(cycle), tl), 0);
});

test("подпись не зависит от истории переходов по времени", () => {
  const t = tl.startDelay + tl.drawDuration + tl.emergeDuration + 2;
  const expected = captionProgress(t, tl);
  captionProgress(t + 6, tl);
  captionProgress(t - 3, tl);
  assert.equal(captionProgress(t, tl), expected);
  assert.ok(expected > 0);
  assert.equal(captionProgress(0, tl), 0);
  assert.equal(captionProgress(tl.startDelay, tl), 0);
});

test("время не замедляется при просадке FPS, пауза удерживает кадр", () => {
  assert.equal(advanceTimeline(2, 0.2, 1, false), 2.2);
  assert.equal(advanceTimeline(2, 0.5, 2, false), 3);
  assert.equal(advanceTimeline(2, 0.5, 2, true), 2);
  assert.equal(advanceTimeline(2, -0.01, 1, false), 2);
});

test("строки рисуются последовательно: сначала контур, затем заливка", () => {
  const early = captionLines(0.5);
  assert.ok(early.title.outline > 0 && early.title.fill === 0);
  assert.equal(early.subtitle.outline, 0);
  // У краёв интервала скорость прорисовки близка к нулю, а не обрывается.
  assert.ok(captionLines(0.01).title.outline < 0.001);
  assert.ok(1 - captionLines(0.89).title.outline < 0.001);
  const late = captionLines(2.9);
  for (const line of Object.values(late)) {
    assert.equal(line.outline, 1);
    if ("fill" in line) assert.equal(line.fill, 1);
  }
});

test("контур каждой графемы завершён прежде её заливки, буквы идут по очереди", () => {
  const n = 17;
  for (const v of [0, 0.15, 0.5, 0.85, 1]) {
    const line = captionLines(v);
    for (let i = 0; i < n; i++) {
      const glyph = glyphReveal(line.title, i, n);
      assert.ok(glyph.fill <= glyph.outline + 1e-9, `графема ${i} @ ${v}`);
      if (i > 0) assert.ok(glyph.outline <= glyphReveal(line.title, i - 1, n).outline);
    }
  }
  assert.equal(glyphReveal(captionLines(0).title, 0, n).outline, 0);
  assert.equal(glyphReveal(captionLines(2.9).title, n - 1, n).fill, 1);
  assert.equal(glyphReveal(captionLines(1.2).subtitle, 6, 20).fill, 0);
  assert.equal(glyphReveal(captionLines(2.9).date, 19, 20).fill, 1);
});

test("световой след и подъём строки исчезают при остановке", () => {
  const hidden = captionAccent("title", { outline: 0 });
  const drawing = captionAccent("title", { outline: 0.5 });
  const complete = captionAccent("title", { outline: 1 });
  assert.equal(hidden.pen, 0);
  assert.equal(hidden.rise, 1);
  assert.ok(drawing.pen > 0.3);
  assert.ok(drawing.rise > 0 && drawing.rise < hidden.rise);
  assert.equal(complete.rise, 0);
  assert.ok(Math.abs(complete.pen) < 1e-10);
  assert.equal(captionAccent("title", { outline: 0.5 }, true).pen, 0);
});

test("готовая заставка остаётся читаемой не менее пяти секунд", () => {
  const on = tl.drawDuration + tl.emergeDuration / 2;
  const fullyDrawn = on + 2.9;
  const fadeStart = tl.drawDuration + tl.emergeDuration + tl.holdDuration;
  assert.ok(fadeStart - fullyDrawn > 5);
  assert.equal(captionState(tl.startDelay + fullyDrawn, tl).lines.date.fill, 1);
  assert.equal(captionState(tl.startDelay + fadeStart - 0.01, tl).lines.date.fill, 1);
});

test("при уходе дата и название гаснут раньше последнего контура логотипа", () => {
  const fadeStart = tl.drawDuration + tl.emergeDuration + tl.holdDuration;
  const atFade = (p) => tl.startDelay + fadeStart + p * tl.fadeDuration;
  const early = captionState(atFade(0.22), tl).lines;
  assert.equal(early.date.fill, 0);
  assert.ok(early.subtitle.fill > 0 && early.title.fill > 0);
  const middle = captionState(atFade(0.42), tl).lines;
  assert.equal(middle.subtitle.fill, 0);
  assert.ok(middle.title.fill > 0);
  assert.equal(computePhase(atFade(0.42), tl).reveal, 1);
  assert.equal(captionState(atFade(0.62), tl).lines.title.fill, 0);
  const peak = computePhase(atFade(0.76), tl);
  assert.equal(peak.draw, 1);
  const reversing = computePhase(atFade(0.85), tl);
  assert.ok(reversing.outline > 0 && reversing.draw > 0 && reversing.draw < 1);
  const late = computePhase(atFade(0.96), tl);
  assert.equal(late.reveal, 0);
  assert.ok(late.outline > 0 && late.draw < reversing.draw);
  assert.equal(computePhase(atFade(1), tl).outline, 0);
  assert.equal(computePhase(atFade(1), tl).draw, 0);
  assert.equal(captionState(atFade(1), tl).lines.title.outline, 0);
});

test("темнота замыкает цикл, но не скрывает собранную заставку и финальный контур", () => {
  assert.equal(seamCurtainOpacity(at(0), tl), 1);
  assert.equal(seamCurtainOpacity(at(cycle - 1 / 60), tl), 1);
  assert.equal(seamCurtainOpacity(at(tl.drawDuration + tl.emergeDuration + 1), tl), 0);
  const fadeStart = tl.drawDuration + tl.emergeDuration + tl.holdDuration;
  assert.equal(seamCurtainOpacity(at(fadeStart + tl.fadeDuration * 0.85), tl), 0);
  const noRest = { ...tl, restDuration: 0 };
  const end = noRest.drawDuration + noRest.emergeDuration + noRest.holdDuration + noRest.fadeDuration;
  const phase = computePhase(noRest.startDelay + end - 1 / 60, noRest);
  assert.equal(seamCurtainOpacity(phase, noRest), 1);
});

test("первая задержка и короткая пауза не показывают обратный жест до старта или на шве", () => {
  const delayed = { ...tl, startDelay: 5 };
  for (const time of [0, 0.5, 2.5, 4.99]) {
    const phase = computePhase(time, delayed);
    assert.equal(seamCurtainOpacity(phase, delayed), 1);
    assert.equal(plotSequence(phase, delayed).head, 0);
  }
  for (const restDuration of [0, 0.2, 0.4]) {
    const short = { ...tl, restDuration };
    const duration = short.drawDuration + short.emergeDuration + short.holdDuration + short.fadeDuration + restDuration;
    const phase = computePhase(short.startDelay + duration - 1 / 60, short);
    assert.equal(seamCurtainOpacity(phase, short), 1);
    assert.equal(plotSequence(phase, short).head, 0);
  }
  const long = { ...tl, restDuration: 6 };
  const fadeEnd = long.drawDuration + long.emergeDuration + long.holdDuration + long.fadeDuration;
  const phase = computePhase(long.startDelay + fadeEnd + 1.2, long);
  assert.equal(seamCurtainOpacity(phase, long), 1, "длинная пауза после жеста остаётся тёмной");
  assert.equal(plotSequence(phase, long).head, 0);
});

test("все кольца мягко замыкаются даже при максимальном числе слоёв", () => {
  for (let layer = 0; layer < 6; layer++) {
    assert.equal(ringSweep(0, layer), 0);
    assert.equal(ringSweep(1, layer), 1);
    assert.ok(ringSweep(0.05, layer) < ringSweep(0.5, layer));
    assert.ok(ringSweep(0.99, layer) <= 1);
  }
  assert.ok(ringSweep(0.5, 5) < ringSweep(0.5, 0));
});

test("частицы воспроизводимы при повторном запуске", () => {
  const a = seededRandom(42), b = seededRandom(42), other = seededRandom(43);
  const first = Array.from({ length: 20 }, () => a());
  assert.deepEqual(first, Array.from({ length: 20 }, () => b()));
  assert.notDeepEqual(first, Array.from({ length: 20 }, () => other()));
});

test("короткие фазы не дают скачка подписи на шве", () => {
  const short = { ...tl, drawDuration: 0.5, emergeDuration: 0.5,
    holdDuration: 4, fadeDuration: 0.5, restDuration: 0 };
  const c = short.drawDuration + short.emergeDuration + short.holdDuration + short.fadeDuration;
  assert.ok(Math.abs(captionProgress(short.startDelay, short) -
    captionProgress(short.startDelay + c, short)) < 1e-9);
  assert.ok(Math.abs(captionProgress(short.startDelay + c - 1e-6, short) -
    captionProgress(short.startDelay + c, short)) < 1e-4);
});

test("буквы раскрываются с перекрытием, а не вспыхивают по одной за кадр", () => {
  const n = 17;
  const line = { outline: 0.5, fill: 0 };
  const visible = Array.from({ length: n }, (_, i) => glyphReveal(line, i, n).outline);
  assert.ok(visible.filter(p => p > 0 && p < 1).length >= 3);
  assert.ok(visible.every((v, i) => i === 0 || v <= visible[i - 1]));
  let maxStep = 0;
  for (let frame = 1; frame <= 120; frame++) {
    for (let i = 0; i < n; i++) {
      const a = glyphReveal(captionLines((frame - 1) / 120 * 0.88).title, i, n).outline;
      const b = glyphReveal(captionLines(frame / 120 * 0.88).title, i, n).outline;
      maxStep = Math.max(maxStep, Math.abs(b - a));
    }
  }
  assert.ok(maxStep < 0.12, `рывок контура: ${maxStep}`);
});

test("масштаб и заливка логотипа непрерывны на границах фаз", () => {
  const start = tl.drawDuration;
  const fade = tl.drawDuration + tl.emergeDuration + tl.holdDuration;
  const epsilon = 1e-4;
  assert.ok(Math.abs(at(start + epsilon).grow - at(start - epsilon).grow) < 1e-6);
  assert.ok(Math.abs(at(fade + epsilon).fill - at(fade - epsilon).fill) < 1e-6);
  assert.ok(Math.abs(at(fade + epsilon).reveal - at(fade - epsilon).reveal) < 1e-6);
  for (const boundary of [start, start + tl.emergeDuration, fade, fade + tl.fadeDuration]) {
    assert.ok(Math.abs(at(boundary + epsilon).draw - at(boundary - epsilon).draw) < 1e-3);
  }
});

test("подъём логотипа разгоняется, затем замедляется до полной остановки", () => {
  const cfg = DEFAULTS.intro;
  const cue = (local) => introSequence(at(local), tl, cfg);
  const start = cue(0).cornerEnd;
  const end = start + cfg.liftDuration;
  const step = cfg.liftDuration / 20;
  const delta = (i) => cue(start + (i + 1) * step).lift - cue(start + i * step).lift;
  assert.equal(cue(start).lift, 0);
  assert.equal(cue(end).lift, 1);
  assert.ok(delta(0) < delta(3) && delta(3) < delta(7), 'плавный разгон');
  assert.ok(delta(12) > delta(16) && delta(16) > delta(19), 'плавное торможение');
  assert.equal(cue(end).settled, 0);
  assert.equal(cue(end + 0.8).settled, 1);
});

test("титр стартует с нахлёстом на подъём знака, а не после него", () => {
  const intro = DEFAULTS.intro;
  const seq = introSequence(at(0), tl, intro);
  const overlap = seq.liftEnd - seq.captionStart;
  assert.ok(Math.abs(overlap - intro.titleDelay) < 1e-9, "нахлёст равен titleDelay");
  assert.ok(overlap > 0.08 && overlap <= 0.2, `нахлёст в разумных пределах: ${overlap}`);
  // В момент подъёма титр уже начат, но заливки ещё нет.
  const atLift = captionState(tl.startDelay + seq.liftEnd, tl, seq.captionStart).lines.title;
  assert.ok(atLift.outline > 0 && atLift.outline < .35);
  assert.ok(atLift.fill < .01);
  // Нулевой нахлёст возвращает прежнее поведение «встык».
  const flush = introSequence(at(0), tl, { ...intro, titleDelay: 0 });
  assert.ok(Math.abs(flush.captionStart - flush.liftEnd) < 1e-9);
});
