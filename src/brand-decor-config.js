import { EFFECT_TIMING_DEFAULTS } from './effect-timing.js';

// Первый слот использует прежние id и ключ JSON для совместимости.
export const DECOR_SLOTS = Object.freeze([
  {id: 'brandDecor', section: 'decor'}, {id: 'brandDecor2', section: 'decor2'},
  {id: 'brandDecor3', section: 'decor3'}, {id: 'brandDecor4', section: 'decor4'},
]);
export const DECOR_IDS = Object.freeze(DECOR_SLOTS.map(slot => slot.id));
/** @param {string} id */
export const decorSection = id => DECOR_SLOTS.find(slot => slot.id === id)?.section;
export function brandDecorDefaults() {
  return Object.fromEntries(DECOR_SLOTS.map(({section}) => [section, {
    ...EFFECT_TIMING_DEFAULTS, name: '', present: false, enabled: true, followLogo: false,
    radius: 1.2, offsetX: 0, offsetY: 0, opacity: 0.22, color: '#d9b268',
    speed: 0.055, dustOpacity: 0.38, dustSize: 0.018,
  }]));
}
