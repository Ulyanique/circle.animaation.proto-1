import { EFFECT_TIMING_DEFAULTS } from "./effect-timing.js";

// Первый слот оставлен под прежним именем для совместимости сохранённых JSON.
export const BACKGROUND_GLOW_IDS = Object.freeze(['backgroundGlow', 'backgroundGlow2', 'backgroundGlow3', 'backgroundGlow4']);
export function backgroundGlowDefaults() {
  return Object.fromEntries(BACKGROUND_GLOW_IDS.map(id => [id, {
    ...EFFECT_TIMING_DEFAULTS, name: '', present: false, enabled: true, offsetX: 0, offsetY: 0,
    radius: 1.6, color: '#ffbd68', intensity: 0.45, pulse: 0.15, speed: 0.15,
  }]));
}
