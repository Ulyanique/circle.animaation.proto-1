/** @typedef {{startDelay:number, drawDuration:number, emergeDuration:number, holdDuration:number, fadeDuration:number, restDuration:number}} Timeline */
/** Чистая математика таймлайна: проценты от цикла после стартовой задержки. @param {Timeline} tl */
export function timelineCycle(tl) {
  const value = tl.drawDuration + tl.emergeDuration + tl.holdDuration + tl.fadeDuration + tl.restDuration;
  return Number.isFinite(value) && value > 0 ? value : 0;
}
/** @param {number} time @param {Timeline} tl */
export function timelineCursor(time, tl) {
  const cycle = timelineCycle(tl);
  if (!cycle || !Number.isFinite(time) || time < tl.startDelay) return 0;
  return (((time - tl.startDelay) % cycle) + cycle) % cycle / cycle * 100;
}
/** @param {number | undefined} start @param {number | undefined} end */
export function timelineRange(start, end) {
  const s = Math.min(99, Math.max(0, typeof start === 'number' && Number.isFinite(start) ? start : 25));
  const e = Math.max(s + 1, Math.min(100, Math.max(1, typeof end === 'number' && Number.isFinite(end) ? end : 90)));
  return { start: s, end: e };
}
/** Один край не может пересечь другой, минимальная длительность — 1% цикла.
 * @param {number | undefined} start @param {number | undefined} end @param {"start" | "end"} edge @param {number} percent */
export function moveTimelineEdge(start, end, edge, percent) {
  const range = timelineRange(start, end);
  const value = Number.isFinite(percent) ? Math.round(percent) : edge === 'start' ? range.start : range.end;
  if (edge === 'start') return { start: Math.max(0, Math.min(range.end - 1, value)), end: range.end };
  return { start: range.start, end: Math.min(100, Math.max(range.start + 1, value)) };
}

/** Изменение базовой границы фаз без изменения общей длительности и противоположного края.
 * Внутренние стадии входа/ухода масштабируются пропорционально.
 * @param {Timeline} tl @param {'entry' | 'exit'} edge @param {number} seconds @param {number} minHold */
export function movePhaseBoundary(tl, edge, seconds, minHold = 1) {
  const cycle = timelineCycle(tl), entry = tl.drawDuration + tl.emergeDuration;
  const exit = entry + tl.holdDuration, tail = tl.fadeDuration + tl.restDuration;
  if (!(cycle > 0 && entry > 0 && tail > 0 && tl.holdDuration >= 0) || !Number.isFinite(seconds)) return null;
  if (edge === 'entry') {
    const boundary = Math.max(.1, Math.min(exit - minHold, seconds));
    if (boundary < .1 || exit - minHold < .1) return null;
    const draw = boundary * tl.drawDuration / entry;
    return {drawDuration: draw, emergeDuration: boundary - draw, holdDuration: exit - boundary,
      fadeDuration: tl.fadeDuration, restDuration: tl.restDuration};
  }
  const boundary = Math.max(entry + minHold, Math.min(cycle - .1, seconds));
  if (boundary > cycle - .1) return null;
  const remaining = cycle - boundary, fade = remaining * tl.fadeDuration / tail;
  return {drawDuration: tl.drawDuration, emergeDuration: tl.emergeDuration, holdDuration: boundary - entry,
    fadeDuration: fade, restDuration: remaining - fade};
}
