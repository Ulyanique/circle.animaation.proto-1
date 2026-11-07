import { finaleTextTiming } from './scenes/finale-timing.js';

// Подпись зависит только от абсолютного времени, а не от количества кадров RAF.
const clamp = (x, min, max) => Math.min(max, Math.max(min, x));
const smooth = (a, b, x) => {
  const k = clamp((x - a) / (b - a), 0, 1);
  return k * k * (3 - 2 * k);
};
const CAP_MAX = 2.9;

/** Общая для DOM и записи в canvas маска: каждая буква обводится, затем заполняется. */
export function glyphReveal(line, index, count) {
  const n = Math.max(1, count);
  // Несколько соседних букв пишутся одновременно: отдельный контур больше
  // не должен укладываться в один-два кадра на длинной строке.
  const window = Math.max(1 / n, 0.24);
  const start = n === 1 ? 0 : clamp(index / (n - 1), 0, 1) * (1 - window);
  return {
    outline: smooth(start, start + window, line.outline),
    fill: smooth(start, start + window, line.fill ?? 0),
  };
}

function clock(t, tl, start) {
  if (t < tl.startDelay) return { local: -1, fadeStart: 0, on: 0, fade: 0 };
  const { drawDuration: D, emergeDuration: E, holdDuration: H, fadeDuration: F, restDuration: R } = tl;
  const cycle = D + E + H + F + R;
  return {
    local: ((t - tl.startDelay) % cycle + cycle) % cycle,
    on: start ?? D + E / 2,
    fadeStart: D + E + H,
    fade: F,
  };
}

/** Положение подписи: движение вниз при появлении, вверх при уходе названия. */
export function captionProgress(t, tl, start, exitFraction = 1) {
  const { local, on, fadeStart, fade } = clock(t, tl, start);
  if (local < 0) return 0;
  if (local < fadeStart) return clamp(local - on, 0, CAP_MAX);
  if (local >= fadeStart + fade) return 0;
  const p = (local - fadeStart) / Math.max(fade * exitFraction, 1e-4);
  return clamp(fadeStart - on, 0, CAP_MAX) * (1 - smooth(0.35, 0.62, p));
}

const RISE = { title: 1.0, rule1: 0.25, subtitle: 0.55, rule2: 0.25, date: 0.35 };
const PEN = { title: 0.32, subtitle: 0.22, date: 0.15 };

/** Единицы --u для подъёма строки и сила скользящего блика на кромке контура. */
export function captionAccent(name, line, exiting = false) {
  const hidden = 1 - line.outline;
  return {
    rise: (RISE[name] || 0) * hidden * hidden,
    pen: exiting ? 0 : (PEN[name] || 0) * Math.sin(Math.PI * line.outline),
  };
}

export function captionLines(v) {
  // Плавный разгон/торможение каждого штриха: нет резкой остановки клип-маски.
  const progress = (start, duration) => smooth(start, start + duration, v);
  return {
    title: { outline: progress(0, 0.88), fill: progress(0.90, 0.62) },
    rule1: { outline: progress(0.80, 0.45) },
    subtitle: { outline: progress(1.04, 0.66), fill: progress(1.72, 0.48) },
    rule2: { outline: progress(1.70, 0.42) },
    date: { outline: progress(2.04, 0.48), fill: progress(2.54, 0.34) },
  };
}

/** При уходе строки закрываются в порядке: дата → подзаголовок → название. */
export function captionState(t, tl, start, exitFraction = 1) {
  const progress = captionProgress(t, tl, start, exitFraction);
  const { local, on, fadeStart, fade } = clock(t, tl, start);
  if (local < fadeStart) return { progress, lines: captionLines(progress) };
  if (local >= fadeStart + fade) return { progress: 0, lines: captionLines(0) };

  const p = (local - fadeStart) / Math.max(fade * exitFraction, 1e-4);
  const lines = captionLines(clamp(fadeStart - on, 0, CAP_MAX));
  for (const [name, from, to] of [
    ["date", 0.03, 0.20], ["rule2", 0.11, 0.29],
    ["subtitle", 0.17, 0.40], ["rule1", 0.28, 0.47],
    ["title", 0.35, 0.60],
  ]) {
    const visibility = 1 - smooth(from, to, p);
    lines[name].outline *= visibility;
    if (lines[name].fill !== undefined) lines[name].fill *= visibility;
  }
  return { progress, lines };
}

/** Финальный подзаголовок остаётся после названия, удерживается в центре и стирается последним. */
export function finaleCaptionState(t, tl, start, cfg = {}) {
  const base = captionState(t, tl, start);
  const { local, on, fadeStart, fade } = clock(t, tl, start);
  const requestedDraw = typeof cfg.subtitleDrawDuration === 'number' && Number.isFinite(cfg.subtitleDrawDuration)
    ? clamp(cfg.subtitleDrawDuration, .2, 30) : 1.15;
  const drawDuration = Math.min(requestedDraw, Math.max(.0001, fadeStart - on - 1.04));
  const drawSubtitle = (lines, elapsed) => {
    lines.subtitle.outline = smooth(1.04, 1.04 + drawDuration * .57, elapsed);
    lines.subtitle.fill = smooth(1.04 + drawDuration * .586, 1.04 + drawDuration, elapsed);
  };
  if (local < fadeStart) {
    drawSubtitle(base.lines, Math.max(0, local - on));
    return base;
  }
  if (local >= fadeStart + fade) return { progress: 0, lines: captionLines(0) };
  const p = (local - fadeStart) / Math.max(fade, 1e-4);
  const lines = captionLines(clamp(fadeStart - on, 0, CAP_MAX));
  drawSubtitle(lines, Math.max(0, fadeStart - on));
  const titleVisibility = 1 - smooth(0, .15, p);
  for (const name of ['title', 'rule1', 'rule2', 'date']) {
    lines[name].outline *= titleVisibility;
    if (lines[name].fill !== undefined) lines[name].fill *= titleVisibility;
  }
  const timing = finaleTextTiming(tl, cfg);
  const lastVisibility = 1 - smooth(timing.eraseStart, timing.eraseEnd, local - fadeStart);
  lines.subtitle.outline *= lastVisibility;
  lines.subtitle.fill *= lastVisibility;
  return { progress: Math.max(base.progress, lines.subtitle.outline), lines };
}
