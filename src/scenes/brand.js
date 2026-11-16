import { createSceneTimeline } from "./scene-timeline.js";
import { createSharedSceneConfig } from "./shared-visuals.js";

// 24 с: вход как у первой заставки, длительное удержание и обратный уход.
// Настройки полные: каждая сцена редактируется в панели независимо.
export const BRAND_DEFAULTS = createSharedSceneConfig(createSceneTimeline(24));

// Исходная окружность фона сохраняет привязку к знаку; другие сцены стартуют без неё.
BRAND_DEFAULTS.decor.present = true;
BRAND_DEFAULTS.decor.followLogo = true;

// Фирменная композиция: знак с круговой надписью в центре.
// Композиция целиком (знак + подпись под ним) должна читаться по центру
// кадра, а не ниже: знак поднят на полшага, подпись встаёт в нижнюю треть.
BRAND_DEFAULTS.logo.offsetY = 0.5;
// Подпись внизу кадра: «ЯНТАРНЫЙ ЦИРКУЛЬ». Раньше фоновый ролик шёл вообще без
// титра, и на записи было непонятно, чей это фон. Титр стоит в нижней трети
// (см. body.scene-brand в styles.css) и не спорит со знаком в центре.
BRAND_DEFAULTS.caption.titleVisible = true;
BRAND_DEFAULTS.caption.titleText = "Янтарный циркуль";
// Подпись крупнее прежней: на фоне она была мелкой и терялась под знаком.
BRAND_DEFAULTS.caption.titleScale = 1.3;
// Кольцо за знаком: окружность чуть больше, чтобы знак в ней дышал.
BRAND_DEFAULTS.decor.radius = 1.34;
BRAND_DEFAULTS.photo = {
  textEnabled: false, offsetX: 0, offsetY: 0, text: "ЯНТАРНЫЙ ЦИРКУЛЬ", repeats: 2,
  radius: 1.75, fontSize: 0.20, rotationSpeed: 0.035, textOpacity: 0.82,
  textColor: null, color: "#e8c77e",
};
