import { createSceneTimeline } from "./scene-timeline.js";
import { createSharedSceneConfig } from "./shared-visuals.js";

// 24 с: вход как у первой заставки, длительное удержание и обратный уход.
// Настройки полные: каждая сцена редактируется в панели независимо.
export const BRAND_DEFAULTS = createSharedSceneConfig(createSceneTimeline(24));

// Декор только фирменного фона; не наследуется фотопаузой и финалом.
BRAND_DEFAULTS.decor = {
  enabled: true, radius: 1.2, opacity: 0.22, color: "#d9b268",
  speed: 0.055, dustOpacity: 0.38, dustSize: 0.018,
};
