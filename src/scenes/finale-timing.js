/** Время финальной реплики внутри фазы ухода. При нехватке места три этапа
 * пропорционально сокращаются, не меняя длину ролика или порядок событий.
 * @param {{fadeDuration:number}} tl
 * @param {{subtitleMoveDuration?:number,subtitleHoldDuration?:number,subtitleEraseDuration?:number}} [cfg] */
export function finaleTextTiming(tl, cfg = {}) {
  const fade = Math.max(.0001, tl.fadeDuration);
  const moveStart = fade * .43, end = fade * .995;
  const finite = (/** @type {unknown} */ v, /** @type {number} */ fallback, /** @type {number} */ minimum) =>
    typeof v === 'number' && Number.isFinite(v) ? Math.max(minimum, Math.min(30, v)) : fallback;
  const move = finite(cfg.subtitleMoveDuration, 1.25, .05);
  const hold = finite(cfg.subtitleHoldDuration, 1, 0);
  const erase = finite(cfg.subtitleEraseDuration, .8, .05);
  const factor = Math.min(1, (end - moveStart) / (move + hold + erase));
  const moveEnd = moveStart + move * factor;
  const eraseStart = moveEnd + hold * factor;
  return { moveStart, moveEnd, eraseStart, eraseEnd: eraseStart + erase * factor, factor };
}
