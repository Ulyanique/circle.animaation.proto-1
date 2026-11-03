import { WAITING_DEFAULTS } from "./waiting.js";
import { BRAND_DEFAULTS } from "./brand.js";

// Единственный технический формат цикла. Других разрешений и пресетов нет.
export const OUTPUT = Object.freeze({ width: 1920, height: 1080, fps: 60 });

/**
 * Каталог — производственный план, а не набор фиктивных готовых заставок.
 * waiting и brand подключены к рендерерам; прочие потребуют отдельного сценария.
 */
export const SCENES = Object.freeze([
  { id: "waiting", title: "Заставка ожидания", status: "ready", defaults: WAITING_DEFAULTS },
  { id: "brand", title: "Фирменный фон для речи, ужина и музыкальных сетов", status: "ready", defaults: BRAND_DEFAULTS },
  { id: "dream-project", title: "Проект мечты", status: "planned" },
  { id: "partners", title: "Партнёры вечера", status: "needs-approval" },
  { id: "archive", title: "Янтарный циркуль: помним всё", status: "needs-assets" },
  { id: "trick-brief", title: "ТЗ с подвохом", status: "needs-host" },
  { id: "architect", title: "Проектировщик объясняет", status: "needs-host" },
  { id: "photo-pause", title: "Фотопауза", status: "planned" },
  { id: "finale", title: "Янтарный циркуль / История продолжается", status: "planned" },
]);

/** @param {string} id */
export function sceneById(id) {
  return SCENES.find((scene) => scene.id === id);
}
