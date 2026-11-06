// Чистые такты фоновых эффектов: зависят от времени, а не от частоты кадров.
/** @param {number} x */
const clamp = (x) => Math.max(0, Math.min(1, x));
/** @param {number} a @param {number} b @param {number} x */
const smooth = (a, b, x) => {
  const v = clamp((x - a) / (b - a));
  return v * v * v * (v * (v * 6 - 15) + 10);
};

/** Световой акцент стартового интро: лучи, раскрытие и подъезд камеры.
 * Все огибающие вычисляются по времени цикла и не затрагивают другие сцены.
 * @param {{local: number, beforeStart: boolean}} phase
 * @param {{drawDuration: number, emergeDuration: number}} timeline */
export function introCues(phase, timeline) {
  if (phase.beforeStart) return { beams: 0, strike: 0, approach: 0 };
  const D = Math.max(0.05, timeline.drawDuration);
  const E = Math.max(0.05, timeline.emergeDuration);
  const t = phase.local;
  const beams = smooth(D * 0.10, D * 0.55, t) *
    (1 - smooth(D + E * 0.50, D + E * 1.15, t));
  const strike = smooth(D + E * 0.22, D + E * 0.47, t) *
    (1 - smooth(D + E * 0.50, D + E * 0.78, t));
  const approach = 1 - smooth(D * 0.65, D + E * 0.90, t);
  return { beams, strike, approach };
}


/** Такты интро: знак остаётся по центру, затем идут боковые круги, подъём и титр.
 * @param {{local:number, beforeStart:boolean, rings:number}} phase
 * @param {{drawDuration:number, emergeDuration:number}} timeline
 * @param {{cornerDuration:number, liftDuration:number, titleDelay:number}} config */
export function introSequence(phase, timeline, config) {
  const cornerStart = timeline.drawDuration + timeline.emergeDuration;
  const cornerEnd = cornerStart + Math.max(0.05, config.cornerDuration);
  const liftEnd = cornerEnd + Math.max(0.05, config.liftDuration);
  const captionStart = liftEnd + Math.max(0, config.titleDelay);
  if (phase.beforeStart) return { corners: 0, lift: 0, settled: 0, captionStart, cornerStart, cornerEnd, liftEnd };
  return {
    corners: phase.rings * smooth(cornerStart, cornerEnd, phase.local),
    // Плавный S-образный подъём: скорость нулевая на обоих концах.
    lift: smooth(cornerEnd, liftEnd, phase.local),
    // Лёгкое покачивание включается уже после остановки, без толчка в конце.
    settled: smooth(liftEnd, liftEnd + 0.8, phase.local),
    captionStart, cornerStart, cornerEnd, liftEnd,
  };
}

export const CONTOUR_WAVE_COUNT = 3;
export const CONTOUR_WAVE_PERIOD = 5.4;

/** Расходящийся контур: рождается у символа и гаснет до перезапуска.
 * @param {number} time @param {number} index */
export function contourWave(time, index) {
  const phase = ((time / CONTOUR_WAVE_PERIOD - index / CONTOUR_WAVE_COUNT) % 1 + 1) % 1;
  // Волна движется быстрее у знака, затем постепенно замедляется и растворяется.
  const expansion = 1 - (1 - phase) * (1 - phase);
  return {
    phase,
    // Эхо рождается уже больше знака: тонкие копии расходятся вокруг него,
    // а не ложатся двойным контуром прямо по силуэту.
    scale: 1.32 + 0.66 * expansion,
    opacity: 0.15 * smooth(0.04, 0.22, phase) * (1 - smooth(0.38, 1, phase)),
  };
}
