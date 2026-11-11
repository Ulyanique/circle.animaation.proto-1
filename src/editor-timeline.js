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

/** Таймкод локального времени сцены, без учёта скорости экспорта; целая частота кадров. */
/** @param {number} seconds @param {number} fps */
export function timelineTimecode(seconds, fps = 60) {
  if (!Number.isFinite(fps) || fps < 1 || !Number.isInteger(fps)) return '—';
  const time = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const frames = Math.floor(time * fps + 1e-7);
  /** @param {number} value */
  const pad = (value) => String(value).padStart(2, '0');
  return `${pad(Math.floor(frames / (fps * 3600)))}:${pad(Math.floor(frames / (fps * 60)) % 60)}:${pad(Math.floor(frames / fps) % 60)}:${pad(frames % fps)}`;
}

/** Соседний кадр сетки локального цикла; за границы цикла не переходит.
 * Если курсор между кадрами, переход к ближайшему кадру в выбранном направлении.
 * @param {number} time @param {Timeline} tl @param {number} fps @param {-1|1} direction */
export function timelineStepFrame(time, tl, fps, direction) {
  const cycle = timelineCycle(tl);
  if (!cycle || !Number.isInteger(fps) || fps < 1 || !Number.isFinite(tl.startDelay)) return null;
  const last = Math.max(0, Math.ceil(cycle * fps - 1e-9) - 1);
  const local = cycle * timelineCursor(time, tl) / 100;
  const position = local * fps;
  const index = direction > 0 ? Math.floor(position + 1e-7) + 1 : Math.ceil(position - 1e-7) - 1;
  return tl.startDelay + Math.max(0, Math.min(last, index)) / fps;
}

/** Разбор локального таймкода; граница цикла не входит в него.
 * @param {string} text @param {number} fps @param {number} cycle */
export function parseTimelineTimecode(text, fps, cycle) {
  if (!Number.isInteger(fps) || fps < 1 || fps > 99 || !Number.isFinite(cycle) || cycle <= 0) return null;
  const match = /^(\d{2,}):([0-5]\d):([0-5]\d):(\d{2})$/.exec(text.trim());
  if (!match) return null;
  const [, hours, minutes, seconds, frames] = match.map(Number);
  if (frames >= fps) return null;
  const totalFrames = ((hours * 60 + minutes) * 60 + seconds) * fps + frames;
  if (!Number.isSafeInteger(totalFrames)) return null;
  const local = totalFrames / fps;
  return local < cycle ? local : null;
}

/** Сдвиг интервала целиком; длина сохраняется и границы не выходят из цикла.
 * @param {number | undefined} start @param {number | undefined} end @param {number} delta */
export function moveTimelineRange(start, end, delta) {
  const range = timelineRange(start, end), width = range.end - range.start;
  const step = Number.isFinite(delta) ? Math.round(delta) : 0;
  const next = Math.max(0, Math.min(100 - width, range.start + step));
  return {start:next, end:next + width};
}

/** Точное время в секундах переводится в проценты цикла; некорректные границы отклоняются.
 * @param {number | undefined} start @param {number | undefined} end @param {'start'|'end'} edge @param {number} seconds @param {number} cycle */
export function timelineEdgeSeconds(start, end, edge, seconds, cycle) {
  if (!Number.isFinite(cycle) || cycle <= 0 || !Number.isFinite(seconds) || seconds < 0 || seconds > cycle) return null;
  const range = timelineRange(start, end), value = seconds * 100 / cycle;
  if (edge === 'start') {
    if (value > range.end - 1 + 1e-9) return null;
    return {start:value, end:range.end};
  }
  if (value < range.start + 1 - 1e-9) return null;
  return {start:range.start, end:value};
}

/** Локальное положение курсора, привязанное к ближайшему кадру внутри цикла.
 * @param {number} time @param {Timeline} tl @param {number} fps */
export function timelineCursorFrame(time, tl, fps) {
  const cycle = timelineCycle(tl);
  if (!cycle || !Number.isInteger(fps) || fps < 1 || !Number.isFinite(tl.startDelay)) return null;
  const last = Math.max(0, Math.ceil(cycle * fps - 1e-9) - 1);
  const local = cycle * timelineCursor(time, tl) / 100;
  return Math.max(0, Math.min(last, Math.round(local * fps))) / fps;
}
