import { WAITING_DEFAULTS } from "./waiting.js";

/** Общая золотая среда остальных видов основана на оформлении первой сцены.
 * @param {typeof WAITING_DEFAULTS.timeline} [timeline] Таймлайн выбранной сцены. */
export function createSharedSceneRenderConfig(timeline) {
  // Своя копия визуальных параметров не изменяет настройки первой сцены.
  const cfg = JSON.parse(JSON.stringify(WAITING_DEFAULTS));
  // Ссылка намеренно общая с runtime: изменение длительности работает без пересоздания сцены.
  if (timeline) cfg.timeline = timeline;
  return cfg;
}
