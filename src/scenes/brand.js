import { WAITING_DEFAULTS } from "./waiting.js";
import { createSceneTimeline } from "./scene-timeline.js";
import { createSharedSceneConfig } from "./shared-visuals.js";

// 24 с: вход как у первой заставки, длительное удержание и обратный уход.
// Настройки полные: каждая сцена редактируется в панели независимо.
export const BRAND_DEFAULTS = createSharedSceneConfig(createSceneTimeline(24));

// Исходная окружность фона сохраняет привязку к знаку; другие сцены стартуют без неё.
BRAND_DEFAULTS.decor.present = true;
BRAND_DEFAULTS.decor.followLogo = true;

// Визуальный язык интро с самостоятельным 24-секундным циклом и вращающейся окружностью.
Object.assign(BRAND_DEFAULTS.logo, {
  scale: WAITING_DEFAULTS.logo.scale, offsetY: 0.62,
  cinematic: WAITING_DEFAULTS.logo.cinematic, facetPolish: WAITING_DEFAULTS.logo.facetPolish,
  studioRelief: WAITING_DEFAULTS.logo.studioRelief,
});
BRAND_DEFAULTS.background.fabricTexture = WAITING_DEFAULTS.background.fabricTexture;
BRAND_DEFAULTS.caption.titleVisible = true;
BRAND_DEFAULTS.caption.titleY = 0.10;
BRAND_DEFAULTS.caption.titleMetallic = WAITING_DEFAULTS.caption.titleMetallic;
BRAND_DEFAULTS.photo = {
  textEnabled: false, offsetX: 0, offsetY: 0, text: "ЯНТАРНЫЙ ЦИРКУЛЬ", repeats: 2,
  radius: 1.75, fontSize: 0.20, rotationSpeed: 0.035, textOpacity: 0.82,
  textColor: null, color: "#e8c77e",
};
