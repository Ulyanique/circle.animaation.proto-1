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

// Время первого плана одинаковое у №2 и №8: кольца чертятся, знак выходит
// из контура, потом надпись гравируется и заливается; уход идёт обратно.
export const FIELD_TIMING = Object.freeze({
  drawDuration: 2.6, emergeDuration: 2.4, fadeDuration: 2.5,
  restDuration: 0.5, ringsIntro: 4.0,
});

/** @param {number} t @param {number} cycle */
export function fieldCues(t, cycle) {
  const local = loopLocal(t, cycle);
  const exit = cycle - FIELD_TIMING.restDuration - FIELD_TIMING.fadeDuration;
  // 0..1 сначала для контура, затем для заливки; на выходе заливка
  // возвращается в контур, который отматывается к первой букве.
  const outline = smooth(3.25, 4.95, local) * (1 - smooth(exit + 1.25, exit + 2.20, local));
  const fill = smooth(5.05, 6.15, local) * (1 - smooth(exit + 0.05, exit + 1.22, local));
  return { titleOutline: outline, titleFill: fill };
}

/** Финальная реплика: символ → название → фраза; уход фраза → название → знак.
 * @param {number} t @param {number} cycle */
export function finaleCues(t, cycle) {
  const local = loopLocal(t, cycle);
  const exit = cycle - FIELD_TIMING.restDuration - FIELD_TIMING.fadeDuration;
  const title = 1 - smooth(exit + 1.18, exit + 2.22, local);
  const phrase = 1 - smooth(exit + 0.02, exit + 0.98, local);
  return {
    symbol: smooth(0.55, 2.4, local) * (1 - smooth(exit + 2.02, cycle - 0.55, local)),
    titleOutline: smooth(1.9, 3.45, local) * title,
    titleFill: smooth(3.55, 4.7, local) * (1 - smooth(exit + 0.75, exit + 1.65, local)),
    phraseOutline: smooth(4.9, 6.45, local) * phrase,
    phraseFill: smooth(6.55, 7.45, local) * (1 - smooth(exit, exit + 0.72, local)),
    light: smooth(0.7, 3.6, local) * (1 - smooth(exit, cycle - 0.55, local)),
  };
}
