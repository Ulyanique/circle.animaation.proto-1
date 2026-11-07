import { createSceneTimeline } from "./scene-timeline.js";
import { createSharedSceneConfig } from "./shared-visuals.js";

// 24 с: вход как у первой заставки, длительное удержание и обратный уход.
// Настройки полные: каждая сцена редактируется в панели независимо.
export const BRAND_DEFAULTS = createSharedSceneConfig(createSceneTimeline(24));

// Исходная окружность фона сохраняет привязку к знаку; другие сцены стартуют без неё.
BRAND_DEFAULTS.decor.present = true;
BRAND_DEFAULTS.decor.followLogo = true;

// Фирменная композиция: знак с круговой надписью в центре, без отдельного титра по умолчанию.
BRAND_DEFAULTS.logo.offsetY = 0;
BRAND_DEFAULTS.caption.titleVisible = false;
BRAND_DEFAULTS.photo = {
  textEnabled: true, offsetX: 0, offsetY: 0, text: "ЯНТАРНЫЙ ЦИРКУЛЬ", repeats: 2,
  radius: 1.75, fontSize: 0.20, rotationSpeed: 0.035, textOpacity: 0.82,
  textColor: null, color: "#e8c77e",
};
