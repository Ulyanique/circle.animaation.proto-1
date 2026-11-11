/** Длительность входа в сцену в реальных секундах. 0 — монтажная склейка.
 * @param {{transition?:{duration?:number}}} config */
export function transitionDuration(config) {
  const value = config.transition?.duration;
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(5, Math.max(0, value)) : .9;
}

/** CSS ease-in-out: cubic-bezier(.42, 0, .58, 1), совпадает с переходом в DOM.
 * @param {number} progress */
export function transitionEase(progress) {
  const x = Math.min(1, Math.max(0, progress));
  if (x === 0 || x === 1) return x;
  let lo = 0, hi = 1;
  for (let i = 0; i < 24; i++) {
    const t = (lo + hi) / 2, u = 1 - t;
    const bx = 3 * u * u * t * .42 + 3 * u * t * t * .58 + t * t * t;
    if (bx < x) lo = t; else hi = t;
  }
  const t = (lo + hi) / 2;
  return t * t * (3 - 2 * t);
}

/** Прозрачность зафиксированного кадра уходящей сцены на текущем кадре входа.
 * @param {number} frame @param {number} fps @param {number} duration */
export function outgoingOpacity(frame, fps, duration) {
  return duration <= 0 ? 0 : 1 - transitionEase(frame / fps / duration);
}

/** Наложить замороженный исходящий композит на уже нарисованный входящий кадр.
 * Возвращает false после завершения перехода (или для склейки).
 * @param {CanvasRenderingContext2D} ctx @param {CanvasImageSource} outgoing
 * @param {number} frame @param {number} fps @param {number} duration
 * @param {number} width @param {number} height */
export function drawOutgoingFrame(ctx, outgoing, frame, fps, duration, width, height) {
  const opacity = outgoingOpacity(frame, fps, duration);
  if (opacity <= 0) return false;
  ctx.save();
  try {
    ctx.globalAlpha = opacity;
    ctx.drawImage(outgoing, 0, 0, width, height);
  } finally {
    ctx.restore();
  }
  return true;
}
