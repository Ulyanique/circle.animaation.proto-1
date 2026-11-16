/** Центральное перекрестие интро в единицах радиуса построительной окружности. */
export function introCrossSegments() {
  return [[-2.25, 0], [2.25, 0], [0, -1.55], [0, 1.55]];
}
/** Парные параллельные направляющие вдоль каждой ножки (координаты логотипа). */
export function constructionSegments() {
  const upper = 5, lower = -5;
  /** @param {number} sign @param {number} x @param {number} y @param {number} slope */
  const leg = (sign, x, y, slope) => [
    [sign * (x + slope * (upper - y)), upper], [sign * (x + slope * (lower - y)), lower],
  ];
  return [ ...leg(1, .42, .453, -.28), ...leg(1, .091, .316, -.28),
    ...leg(-1, .42, .453, -.28), ...leg(-1, .091, .316, -.28),
    [-3.2, -.556], [3.2, -.556], [-3.2, -.775], [3.2, -.775] ];
}
/** Ранний этап интро — разметка до начала прорисовки знака.
 * @param {{local:number,beforeStart:boolean}} phase @param {{drawDuration:number,emergeDuration:number,holdDuration:number,fadeDuration:number}} timeline */
export function introGuidesVisibility(phase, timeline) {
  if (phase.beforeStart) return 0;
  /** @param {number} a @param {number} b @param {number} v */
  const smooth = (a, b, v) => { const x = Math.max(0, Math.min(1, (v - a) / (b - a))); return x * x * (3 - 2 * x); };
  const d = Math.max(.1, timeline.drawDuration), e = Math.max(.1, timeline.emergeDuration);
  const exit = d + e + timeline.holdDuration;
  if (phase.local >= exit) {
    const p = (phase.local - exit) / Math.max(.0001, timeline.fadeDuration);
    return smooth(.58, .72, p) * (1 - smooth(.94, 1, p));
  }
  return smooth(0, d * .22, phase.local) * (1 - smooth(d + e * .1, d + e * .8, phase.local));
}
/** Ход прорисовки разметки; завершается до включения стартового света.
 * @param {{local:number,beforeStart:boolean}} phase @param {{drawDuration:number,emergeDuration:number,holdDuration:number,fadeDuration:number}} timeline */
export function introGuidesProgress(phase, timeline) {
  if (phase.beforeStart) return 0;
  const exit = timeline.drawDuration + timeline.emergeDuration + timeline.holdDuration;
  const x = Math.max(0, Math.min(1, phase.local >= exit
    ? (1 - (phase.local - exit) / Math.max(.0001, timeline.fadeDuration)) / .13
    : phase.local / Math.max(.055, timeline.drawDuration * .55)));
  return x * x * (3 - 2 * x);
}
