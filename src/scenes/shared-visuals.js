import { WAITING_DEFAULTS } from "./waiting.js";

/** Общая золотая среда остальных видов основана на оформлении первой сцены.
 * @param {typeof WAITING_DEFAULTS.timeline} [timeline] Таймлайн выбранной сцены. */
export function createSharedSceneRenderConfig(timeline) {
  // Своя копия визуальных параметров не изменяет настройки первой сцены.
  const cfg = JSON.parse(JSON.stringify(WAITING_DEFAULTS));
  // Композиция фоновых сцен: знак крупнее и ниже, титр — в нижней трети,
  // чтобы не оставалось пустого поля под названием.
  cfg.logo.scale = 0.58;
  cfg.logo.offsetY = 0.86;
  // Ссылка намеренно общая с runtime: изменение длительности работает без пересоздания сцены.
  if (timeline) cfg.timeline = timeline;
  return cfg;
}
