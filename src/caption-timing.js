import {customTextAnimation} from './custom-text.js';

// По умолчанию сценарий не меняется; самостоятельный интервал включается явно.
export function captionTimingDefaults() {
  return Object.fromEntries(['title','subtitle','date'].flatMap(id => [
    [`${id}TimingMode`, 'scene'], [`${id}Start`, 25], [`${id}End`, 90],
    [`${id}Fade`, 15], [`${id}TimingInitialized`, false], [`${id}RevealStyle`, 'fade'],
  ]));
}
/** @param {number} time @param {any} timeline @param {any} timing @param {string} id @param {{outline:number,fill?:number}} sceneLine */
export function captionTimedLine(time, timeline, timing, id, sceneLine) {
  return timing?.[`${id}TimingMode`] === 'custom'
    ? customTextAnimation(time, timeline, timing, id) : sceneLine;
}
