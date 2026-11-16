import { WAITING_DEFAULTS } from "./waiting.js";

/**
 * Полный набор настроек фоновой сцены: та же среда и физика, что у интро,
 * но своя композиция и собственный таймлайн. Настройки каждой сцены
 * независимы: правка в панели не меняет остальные ролики.
 * @param {typeof WAITING_DEFAULTS.timeline} [timeline] Таймлайн выбранной сцены.
 */
export function createSharedSceneConfig(timeline) {
  const cfg = JSON.parse(JSON.stringify(WAITING_DEFAULTS));
  cfg.constructionGuides.enabled = false;
  cfg.background.fabricTexture = 0; // другие сцены сохраняют свой фон
  delete cfg.intro; // Эти движения относятся только к первому ролику.
  // Композиция фоновых сцен: знак крупнее и ниже, титр — в нижней трети,
  // чтобы не оставалось пустого поля под названием.
  cfg.caption.titleMetallic = false; // только интро получает новый титр по умолчанию
  cfg.logo.studioRelief = 0; // не меняем утверждённый вид других сцен
  cfg.logo.directedMotion = false; // новый ритм только для интро
  cfg.logo.cinematic = false; // новый свет сначала только в интро
  cfg.logo.facetPolish = 0; // утверждённые фоновые сцены сохраняют прежний материал
  cfg.logo.scale = 0.58;
  cfg.logo.offsetY = 0.86;
  cfg.playback.paused = false;
  // Ссылка намеренно общая с runtime: изменение длительности работает без пересоздания сцены.
  if (timeline) cfg.timeline = timeline;
  return cfg;
}
