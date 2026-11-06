import { createSceneTimeline } from "./scene-timeline.js";
import { createSharedSceneConfig } from "./shared-visuals.js";

// 24 с: вход как у первой заставки, длительное удержание и обратный уход.
// Настройки полные: каждая сцена редактируется в панели независимо.
export const BRAND_DEFAULTS = createSharedSceneConfig(createSceneTimeline(24));

// Исходная окружность фона сохраняет привязку к знаку; другие сцены стартуют без неё.
BRAND_DEFAULTS.decor.present = true;
BRAND_DEFAULTS.decor.followLogo = true;
