/**
 * Затвор для вращения (P1-7).
 *
 * На штатных 30 fps кольцевая надпись в «Фотопаузе» за один кадр поворачи-
 * вается на 0,035 · 360° / 30 ≈ 0,42° — на 1080p это около двух пикселей
 * дуги, поэтому затвор усредняет две выборки и движение остаётся пленочным.
 * На 60 fps шага почти нет и выборка одна, но на 4K-мастере и на медленной
 * скорости оборота буква начинает «прыгать» с кадра на кадр. Здесь — усреднение нескольких выборок
 * по абсолютному времени, как у настоящего затвора: движение размазывается
 * ровно настолько, насколько оно прошло за выдержку.
 *
 * Функция чистая: результат зависит только от аргументов, поэтому
 * покадровый экспорт остаётся детерминированным, а шов цикла — нетронутым.
 */

/** Половина углового шага между выборками, при котором включается затвор. */
export const SHUTTER_THRESHOLD_DEG = 0.35;

/**
 * Сколько выборок достаточно, чтобы шаг между ними был не больше 0,35°.
 * Ограничение сверху — 9: дальше усреднение не улучшает картинку, но стоит
 * времени рендера.
 * @param {number} degreesPerFrame ход надписи за один кадр, в градусах
 */
export function shutterSamples(degreesPerFrame) {
  const step = Math.abs(Number(degreesPerFrame));
  if (!Number.isFinite(step) || step <= SHUTTER_THRESHOLD_DEG) return 1;
  return Math.min(9, Math.ceil(step / SHUTTER_THRESHOLD_DEG));
}

/**
 * Настройка сцены «Фотопауза» → сколько выборок нужно для текущего кадра.
 * Если вращение выключено или кадр не фотопауза, выборка одна.
 * @param {any} config
 * @param {{id?: string, fps?: number, speed?: number}} [context]
 */
export function photoShutterSamples(config, { id = 'photo-pause', fps = 60, speed = 1 } = {}) {
  if (id !== 'photo-pause') return 1;
  const photo = config?.photo;
  if (!photo?.textEnabled) return 1;
  const rotation = Number(photo.rotationSpeed) || 0;
  if (rotation === 0) return 1;
  const perFrame = Math.abs(rotation) * 360 / (fps * (speed > 0 ? speed : 1));
  return shutterSamples(perFrame);
}

/**
 * Выборки внутри кадра: плотно в начале выдержки, потому что так устроен
 * настоящий затвор, и так же их взвешивает браузер-рендер.
 * @param {number} time абсолютное время кадра
 * @param {number} dt длительность кадра
 * @param {number} count сколько выборок
 * @param {number} [shutter] доля кадра, которую держим открытым (0..1)
 */
export function shutterTimes(time, dt, count, shutter = 0.5) {
  if (!Number.isFinite(time) || !Number.isFinite(dt) || count <= 1) return [time];
  const span = dt * Math.min(1, Math.max(0.05, shutter));
  const times = [];
  // Окно симметрично вокруг момента кадра: иначе усреднение давало бы
  // систематический сдвиг фазы на полвыдержки.
  for (let i = 0; i < count; i++) times.push(time + span * ((i + 0.5) / count - 0.5));
  return times;
}
