import { finaleTextTiming } from './scenes/finale-timing.js';

// Границы ненулевой маски строки, а не гарантия видимых пикселей.
// Формулы соответствуют captionState/finaleCaptionState и тактам introSequence.
/** @param {string} scene @param {string} id @param {any} cfg */
export function captionMaskRange(scene, id, cfg) {
  if (!['title', 'subtitle', 'date'].includes(id) || !['waiting', 'brand', 'finale'].includes(scene)) return null;
  if (id === 'subtitle' && scene === 'brand' || id === 'date' && scene !== 'waiting') return null;
  const tl = cfg.timeline;
  if (!tl) return null;
  const {drawDuration: D, emergeDuration: E, holdDuration: H, fadeDuration: F, restDuration: R} = tl;
  if (![D,E,H,F,R].every(Number.isFinite) || D <= 0 || E <= 0 || F <= 0 || H < 0 || R < 0) return null;
  const cycle = D + E + H + F + R, fadeStart = D + E + H;
  let on = D + E / 2;
  if (scene === 'waiting' || scene === 'finale') {
    const intro = cfg.intro;
    if (!intro || ![intro.cornerDuration, intro.liftDuration, intro.titleDelay].every(Number.isFinite)) return null;
    on = D + E + Math.max(.05, intro.cornerDuration) + Math.max(.05, intro.liftDuration) + Math.max(0, intro.titleDelay);
  }
  const threshold = {title:0, subtitle:1.04, date:2.04}[id];
  const start = on + threshold;
  // Если линия не начала проявляться к уходу, она останется нулевой и в уходе.
  if (!(start < fadeStart)) return {start:0, end:0, cycle};
  const endFraction = {title:.60, subtitle:.40, date:.20}[id];
  let end = fadeStart + F * (scene === 'waiting' ? .42 : 1) * endFraction;
  if (scene === 'finale') end = fadeStart + (id === 'subtitle' ? finaleTextTiming(tl, cfg.finale).eraseEnd : F * .15);
  return {start, end:Math.min(end, fadeStart + F, cycle), cycle};
}
