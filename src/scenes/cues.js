// Чистые такты для фоновых заставок: не зависят от кадров RAF и WebGL.
/** @param {number} x */
const clamp = (x) => Math.max(0, Math.min(1, x));
/** @param {number} a @param {number} b @param {number} x */
const smooth = (a, b, x) => {
  const v = clamp((x - a) / (b - a));
  return v * v * (3 - 2 * v);
};

/** @param {number} t @param {number} cycle */
export function loopLocal(t, cycle) {
  return ((t % cycle) + cycle) % cycle;
}

/** Периодическое «дыхание» с неподвижными отрезками перед стыком и после него.
 * @param {number} t @param {number} cycle */
export function quietBreath(t, cycle) {
  const local = loopLocal(t, cycle);
  const settle = smooth(0.25, 1.5, local) *
    (1 - smooth(cycle - 1.5, cycle - 0.25, local));
  return settle === 0 ? 0 : Math.sin(local * Math.PI * 2 / cycle) * settle;
}

/** Финальная реплика: символ → название → «История продолжается» → тишина.
 * @param {number} t @param {number} cycle */
export function finaleCues(t, cycle) {
  const local = loopLocal(t, cycle);
  const close = 1 - smooth(cycle - 3.0, cycle - 0.55, local);
  return {
    symbol: smooth(0.55, 2.4, local) * close,
    titleOutline: smooth(1.9, 3.45, local) * close,
    titleFill: smooth(3.55, 4.7, local) * close,
    phraseOutline: smooth(4.9, 6.45, local) * close,
    phraseFill: smooth(6.55, 7.45, local) * close,
    light: smooth(1.0, 3.6, local) * (1 - smooth(cycle - 3.3, cycle - 0.55, local)),
  };
}
