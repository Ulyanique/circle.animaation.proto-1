import { WAITING_DEFAULTS } from "./waiting.js";
import { BRAND_DEFAULTS } from "./brand.js";
import { PHOTO_PAUSE_DEFAULTS } from "./photo-pause.js";
import { PARTNERS_DEFAULTS } from "./partners.js";
import { FINALE_DEFAULTS } from "./finale.js";

// Базовый формат кадра. Это единственный источник числа 1920×1080: остальные
// модули (битрейт, масштаб макета, профили мастера) считают от него, чтобы
// константы не разъезжались при смене базы.
export const BASE_FRAME = Object.freeze({ width: 1920, height: 1080 });
/** Площадь базового кадра в пикселях — база для битрейта и масштабов. */
export const BASE_PIXELS = BASE_FRAME.width * BASE_FRAME.height;
// Единственный технический формат цикла. Других разрешений и пресетов нет.
export const OUTPUT = Object.freeze({ ...BASE_FRAME, fps: 60 });
// Порядок одной полной программы для предпросмотра и записи единым MP4.
export const RECORDING_CHAIN = Object.freeze(["waiting", "brand", "photo-pause", "finale"]);

/**
 * Каталог — производственный план, а не набор фиктивных готовых заставок.
 * Виды 1, 2, 8 и 9 имеют адаптеры; прочие потребуют отдельного сценария.
 */
export const SCENES = Object.freeze([
  // Внутренний id сохранён для старых ссылок и настроек; роль сцены — интро.
  { id: "waiting", title: "Интро — открытие вечера", status: "ready", defaults: WAITING_DEFAULTS },
  { id: "brand", title: "Фирменный фон для речи, ужина и музыкальных сетов", status: "ready", defaults: BRAND_DEFAULTS },
  { id: "dream-project", title: "Проект мечты", status: "planned" },
  { id: "partners", title: "Спонсоры и партнёры (макет)", status: "preview", defaults: PARTNERS_DEFAULTS },
  { id: "archive", title: "Янтарный циркуль: помним всё", status: "needs-assets" },
  { id: "trick-brief", title: "ТЗ с подвохом", status: "needs-host" },
  { id: "architect", title: "Проектировщик объясняет", status: "needs-host" },
  { id: "photo-pause", title: "Фотопауза", status: "ready", defaults: PHOTO_PAUSE_DEFAULTS },
  { id: "finale", title: "Янтарный циркуль / История продолжается", status: "ready", defaults: FINALE_DEFAULTS },
]);

/** @param {string} id */
export function sceneById(id) {
  // Человеческий адрес для первого ролика, без поломки старого ?scene=waiting.
  const canonical = id === "intro" ? "waiting" : id;
  return SCENES.find((scene) => scene.id === canonical);
}
