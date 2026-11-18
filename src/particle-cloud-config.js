import { EFFECT_TIMING_DEFAULTS } from './effect-timing.js';

// Первый слот остаётся под прежним именем для старых сохранённых сцен.
export const PARTICLE_CLOUD_IDS = Object.freeze(['particleCloud', 'particleCloud2', 'particleCloud3', 'particleCloud4']);
/** Детерминированный рисунок первого облака совпадает с прежними версиями.
 * @param {string} id */
export function cloudSeedForId(id) {
  const index = Math.max(0, PARTICLE_CLOUD_IDS.indexOf(id));
  return (0x42a19f21 + Math.imul(index, 0x9e3779b9)) >>> 0;
}
export function particleCloudDefaults() {
  return Object.fromEntries(PARTICLE_CLOUD_IDS.map(id => [id, {
    ...EFFECT_TIMING_DEFAULTS, name: '', present: false, enabled: true, offsetX: 0, offsetY: 0,
    seed: cloudSeedForId(id), radius: 1.2, color: '#e8c77e', count: 180, size: 0.035, opacity: 0.65, speed: 0.08,
  }]));
}
