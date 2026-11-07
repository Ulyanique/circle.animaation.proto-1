import { customTextAnimation } from './custom-text.js';

// Старые сцены продолжают использовать исходные фазы, пока пользователь не выберет свой интервал.
export const EFFECT_TIMING_DEFAULTS = Object.freeze({ timingMode: 'scene', timingStart: 25, timingEnd: 90, timingFade: 15 });

/** Независимая огибающая эффекта; абсолютный кадр даёт одинаковый результат при перемотке и экспорте.
 * @param {number} time
 * @param {{beforeStart: boolean, reveal: number, rings: number}} phase
 * @param {{startDelay:number, drawDuration:number, emergeDuration:number, holdDuration:number, fadeDuration:number, restDuration:number}} timeline
 * @param {{timingMode?:string, timingStart?:number, timingEnd?:number, timingFade?:number}} effect
 */
export function effectVisibility(time, phase, timeline, effect) {
  if (effect?.timingMode !== 'custom') return phase.beforeStart ? 0 : phase.reveal * phase.rings;
  return customTextAnimation(time, timeline, {
    effectStart: effect.timingStart, effectEnd: effect.timingEnd, effectFade: effect.timingFade,
  }, 'effect').fill;
}
