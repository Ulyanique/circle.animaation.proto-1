import {customTextAnimation} from './custom-text.js';

// Этот режим опционален: старые сцены остаются целиком сценарными.
export const logoTimingDefaults = () => ({timingMode:'scene', timingStart:25, timingEnd:90, timingFade:15});
/** Собственное время меняет проявление знака, не сценарий камеры, светов или шторки.
 * @param {number} time @param {any} tl @param {any} cfg @param {any} phase */
export function logoTimingPhase(time, tl, cfg, phase) {
  if (cfg?.timingMode !== 'custom') return {draw:phase.draw, outline:phase.outline, fill:phase.fill,
    reveal:phase.reveal, reverse:phase.name === 'fade'};
  const values = {logoStart:cfg.timingStart, logoEnd:cfg.timingEnd, logoFade:cfg.timingFade};
  const mask = customTextAnimation(time, tl, values, 'logo');
  const cycle = tl.drawDuration + tl.emergeDuration + tl.holdDuration + tl.fadeDuration + tl.restDuration;
  const number = (/** @type {any} */ x, /** @type {number} */ fallback) => typeof x === 'number' && Number.isFinite(x) ? x : fallback;
  const start = Math.max(0, Math.min(99, number(cfg.timingStart,25)))/100;
  const end = Math.max(start+.01, Math.max(0,Math.min(100,number(cfg.timingEnd,90)))/100);
  const fade = Math.max(5, Math.min(50,number(cfg.timingFade,15)))/100;
  const local = cycle > 0 && Number.isFinite(time) && time >= tl.startDelay ? ((time-tl.startDelay)%cycle+cycle)%cycle/cycle : -1;
  return {draw:mask.outline, outline:mask.outline, fill:mask.fill, reveal:mask.fill,
    reverse:local >= end-(end-start)*fade && local < end};
}
