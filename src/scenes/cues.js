import { finaleTextTiming } from './finale-timing.js';

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
 * @param {{drawDuration: number, emergeDuration: number, holdDuration:number, fadeDuration:number}} timeline */
export function introCues(phase, timeline) {
  if (phase.beforeStart) return { beams: 0, strike: 0, approach: 0 };
  const D = Math.max(0.05, timeline.drawDuration);
  const E = Math.max(0.05, timeline.emergeDuration);
  const t = phase.local;
  const exitStart = D + E + timeline.holdDuration;
  if (t >= exitStart) {
    const p = (t - exitStart) / Math.max(.0001, timeline.fadeDuration);
    return { beams: 0, strike: 0, approach: smooth(.52, .94, p) };
  }
  const beams = smooth(D * 0.55, D * 0.90, t) *
    (1 - smooth(D + E * 0.50, D + E * 1.15, t));
  const strike = smooth(D + E * 0.22, D + E * 0.47, t) *
    (1 - smooth(D + E * 0.50, D + E * 0.78, t));
  const approach = 1 - smooth(D * 0.65, D + E * 0.90, t);
  return { beams, strike, approach };
}


/** Такты интро: знак остаётся по центру, затем идут боковые круги, подъём и титр.
 * @param {{local:number, beforeStart:boolean, rings:number}} phase
 * @param {{drawDuration:number, emergeDuration:number, holdDuration:number, fadeDuration:number, ringsIntro?:number}} timeline
 * @param {{cornerDuration:number, liftDuration:number, titleDelay:number}} config */
export function introSequence(phase, timeline, config) {
  const cornerStart = timeline.drawDuration + timeline.emergeDuration;
  const cornerEnd = cornerStart + Math.max(0.05, config.cornerDuration);
  const liftEnd = cornerEnd + Math.max(0.05, config.liftDuration);
  // Нахлёст: титр начинает появляться за `titleDelay` до окончания подъёма
  // знака. Фазы не стыкуются «встык» — движение знака и первая буква идут
  // одновременно, и кадр перестаёт выглядеть склейкой двух клипов.
  const captionStart = liftEnd - Math.max(0, config.titleDelay);
  if (phase.beforeStart) return { corners: 0, lift: 0, settled: 0, captionStart, cornerStart, cornerEnd, liftEnd };
  const exitStart = timeline.drawDuration + timeline.emergeDuration + timeline.holdDuration;
  if (phase.local >= exitStart) {
    const p = (phase.local - exitStart) / Math.max(.0001, timeline.fadeDuration);
    const liftAtExit = smooth(cornerEnd, liftEnd, exitStart);
    const rise = Math.max(.05, timeline.ringsIntro ?? 2.4);
    const ringProgress = clamp(exitStart / rise);
    const ringsAtExit = ringProgress * ringProgress * (3 - 2 * ringProgress);
    const cornersAtExit = ringsAtExit * smooth(cornerStart, cornerEnd, exitStart);
    return { corners: cornersAtExit * (1 - smooth(.44, .54, p)),
      lift: liftAtExit * (1 - smooth(.25, .44, p)),
      settled: smooth(liftEnd, liftEnd + .8, exitStart) * (1 - smooth(.25, .44, p)),
      captionStart, cornerStart, cornerEnd, liftEnd };
  }
  return {
    corners: phase.rings * smooth(cornerStart, cornerEnd, phase.local),
    // Плавный S-образный подъём: скорость нулевая на обоих концах.
    lift: smooth(cornerEnd, liftEnd, phase.local),
    // Лёгкое покачивание включается уже после остановки, без толчка в конце.
    settled: smooth(liftEnd, liftEnd + 0.8, phase.local),
    captionStart, cornerStart, cornerEnd, liftEnd,
  };
}

/** Два круга реагируют не синхронно: правый мягко подхватывает левый.
 * Огибающая остаётся ограниченной и следует любому пользовательскому таймингу.
 * @param {number} env @param {boolean} enabled */
export function introCornerEnvelopes(env, enabled) {
  const left = clamp(env);
  return { left, right: enabled ? left * smooth(.08, .92, left) : left };
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
    // Расстояние от края силуэта: волна не масштабирует внутренние детали.
    distance: 0.02 + 0.44 * expansion,
    opacity: 0.075 * smooth(0.04, 0.22, phase) * (1 - smooth(0.38, 1, phase)),
  };
}

/** Финальный уход: знаком уступаем место последней центральной строке.
 * @param {{local:number, name:string, beforeStart:boolean}} phase
 * @param {{drawDuration:number, emergeDuration:number, holdDuration:number, fadeDuration:number}} tl
 * @param {{subtitleMoveDuration?:number,subtitleHoldDuration?:number,subtitleEraseDuration?:number}} [cfg] */
export function finaleCues(phase, tl, cfg = {}) {
  if (phase.beforeStart || phase.name !== 'fade' && phase.name !== 'rest') {
    return { active:false, center:0, retreat:0, reveal:1, outline:0, draw:1, corners:1, subtitleCenter:0, blackout:0 };
  }
  if (phase.name === 'rest') return { active:true, center:1, retreat:1, reveal:0, outline:0, draw:0, corners:0, subtitleCenter:1, blackout:1 };
  const start = tl.drawDuration + tl.emergeDuration + tl.holdDuration;
  const elapsed = Math.max(0, phase.local - start);
  const p = clamp(elapsed / Math.max(0.0001, tl.fadeDuration));
  const timing = finaleTextTiming(tl, cfg);
  return {
    active:true,
    center: smooth(.12, .25, p),
    retreat: smooth(.25, .42, p),
    reveal: 1 - smooth(.27, .39, p),
    outline: smooth(.32, .40, p) * (1 - smooth(.47, .51, p)),
    draw: 1 - smooth(.36, .50, p),
    corners: 1 - smooth(.12, .30, p),
    subtitleCenter: smooth(timing.moveStart, timing.moveEnd, elapsed),
    blackout: smooth(Math.min(tl.fadeDuration * .53, timing.moveEnd - .001), timing.moveEnd, elapsed),
  };
}

/** Верхние лучи остаются во всех сценах на удержании и исчезают перед швом.
 * @param {{local:number,beforeStart:boolean}} phase
 * @param {{drawDuration:number,emergeDuration:number,holdDuration:number,fadeDuration:number}} timeline
 * @param {boolean} intro @param {number} opening */
export function upperRaysCue(phase, timeline, intro, opening) {
  if (phase.beforeStart) return 0;
  const d = Math.max(.05, timeline.drawDuration);
  const entrance = intro ? smooth(d * .55, d * .90, phase.local) : smooth(d * .12, d * .75, phase.local);
  const exitStart = d + timeline.emergeDuration + timeline.holdDuration;
  const exit = 1 - smooth(exitStart, exitStart + Math.max(.05, timeline.fadeDuration) * .9, phase.local);
  return Math.max(.48 * entrance * exit, intro ? opening : 0);
}

/** Обратный выход интро после титров, опускания знака и исчезновения боковых колец.
 * @param {{local:number,beforeStart:boolean}} phase
 * @param {{drawDuration:number,emergeDuration:number,holdDuration:number,fadeDuration:number}} tl */
export function introOutro(phase, tl) {
  const start = tl.drawDuration + tl.emergeDuration + tl.holdDuration;
  if (phase.beforeStart || phase.local < start) return null;
  const p = clamp((phase.local - start) / Math.max(.0001, tl.fadeDuration));
  const reveal = 1 - smooth(.54, .67, p);
  return { reveal, fill: reveal,
    outline: smooth(.58, .67, p) * (1 - smooth(.77, .81, p)),
    draw: 1 - smooth(.67, .80, p) };
}
