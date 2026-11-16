/**
 * Сетка такта (P1-8). На площадке заставки показывают под музыку, и вручную
 * подгонять длительности фаз под трек — самая частая правка. Сетка задаёт BPM
 * и фазу, а ключевые события (начало проявления, посадка титра, уход) можно
 * привязать к ближайшей доле.

 * Важно: сетка не меняет длительность цикла и не двигает шов. Она только
 * подсказывает, к какому времени привязать событие, и считает ближайшую долю
 * от абсолютного времени — поэтому `renderAt(t)` остаётся детерминированным.
 */

/**
 * Настройки сетки. Понимает и «чистый» вид (`bpm` / `offset`), и таймлайн
 * сцены (`beatBpm` / `beatOffset`): в конфиге ключи с префиксом, чтобы не
 * спорить с прежними полями.
 * @typedef {{bpm?:number, offset?:number, beatsPerBar?:number, beatBpm?:number, beatOffset?:number}} BeatGrid
 */

export const DEFAULT_BEAT_GRID = Object.freeze({ bpm: 0, offset: 0, beatsPerBar: 4 });

/** Значение BPM из сетки любого вида.
 * @param {BeatGrid | null | undefined} grid */
function gridBpm(grid) {
  const value = grid?.bpm ?? grid?.beatBpm;
  return Number(value);
}

/** Фаза сетки (секунды) из сетки любого вида.
 * @param {BeatGrid | null | undefined} grid */
function gridOffset(grid) {
  return Number(grid?.offset ?? grid?.beatOffset) || 0;
}

/** Длина доли в секундах; 0 при выключенной сетке.
 * @param {BeatGrid | null | undefined} grid */
export function beatDuration(grid) {
  const bpm = gridBpm(grid);
  if (!Number.isFinite(bpm) || bpm <= 0) return 0;
  return 60 / Math.min(300, Math.max(20, bpm));
}

/** Индекс ближайшей доли к моменту `t` (может быть отрицательным до offset).
 * @param {number} t @param {BeatGrid | null | undefined} grid */
export function nearestBeat(t, grid) {
  const beat = beatDuration(grid);
  if (!beat) return 0;
  const offset = gridOffset(grid);
  return Math.round((t - offset) / beat);
}

/** Время ближайшей доли, секунды. При выключенной сетке — само время.
 * @param {number} t @param {BeatGrid | null | undefined} grid */
export function snapToBeat(t, grid) {
  const beat = beatDuration(grid);
  if (!beat) return t;
  const offset = gridOffset(grid);
  return offset + nearestBeat(t, grid) * beat;
}

/** Номер доли в такте (1..beatsPerBar) для подписи в пульте.
 * @param {number} t @param {BeatGrid | null | undefined} grid */
export function beatInBar(t, grid) {
  const beat = beatDuration(grid);
  const perBar = Math.max(1, Math.round(Number(grid?.beatsPerBar) || 4));
  if (!beat) return 0;
  const index = nearestBeat(t, grid);
  return ((index % perBar) + perBar) % perBar + 1;
}

/**
 * Подгоняет удержание под целое число тактов. Вход, уход и пауза не меняются:
 * длительность цикла сдвигается ровно настолько, насколько нужно, и никогда
 * больше чем на один такт. Если округление нарушило бы минимум удержания,
 * возвращается исходное значение — лучше «не по такту», чем сломанный ритм.
 * @param {{holdDuration:number}} tl
 * @param {BeatGrid} grid
 * @param {number} [minHold]
 */
export function holdToBars(tl, grid, minHold = 1) {
  const beat = beatDuration(grid);
  const current = Number(tl.holdDuration);
  if (!beat || !Number.isFinite(current) || current <= 0) return current;
  const perBar = Math.max(1, Math.round(Number(grid?.beatsPerBar) || 4));
  const bar = beat * perBar;
  // Подгонка — это сдвиг в пределах половины такта. Если ближайший целый такт
  // дальше (медленный BPM, короткое удержание), это уже другая режиссура:
  // оставляем как было.
  const bars = Math.max(1, Math.round(current / bar));
  const next = bars * bar;
  if (next < minHold) return current;
  if (Math.abs(next - current) > bar / 2 + 1e-9) return current;
  return +next.toFixed(6);
}

/** Список ближайших долей для подсказки в пульте.
 * @param {number} duration @param {BeatGrid | null | undefined} grid */
export function beatMarkers(duration, grid, limit = 64) {
  const beat = beatDuration(grid);
  if (!beat || !(duration > 0)) return [];
  const offset = gridOffset(grid);
  const marks = [];
  for (let t = offset; t <= duration && marks.length < limit; t += beat) {
    if (t >= 0) marks.push(+t.toFixed(4));
  }
  return marks;
}

/**
 * Подгонка ключевых событий под сетку. Длительности фаз остаются прежними
 * (инвариант экспорта), меняется только точка, к которой привязано событие:
 * «проявление знака», «посадка титра», «начало ухода». Событие сдвигается к
 * ближайшей доле, но не дальше половины доли — иначе тайминг «уезжает» от
 * режиссуры.
 * @param {{drawDuration:number, emergeDuration:number, holdDuration:number, fadeDuration:number, restDuration:number}} tl
 * @param {BeatGrid} grid
 */
export function beatEvents(tl, grid) {
  const beat = beatDuration(grid);
  const D = tl.drawDuration, E = tl.emergeDuration, H = tl.holdDuration;
  const exit = D + E + H;
  const raw = {
    emerge: D + E / 2,      // середина появления знака
    caption: D + E,         // посадка титра
    exit,                   // начало ухода
  };
  if (!beat) return { enabled: false, raw, snapped: { ...raw }, shifts: { emerge: 0, caption: 0, exit: 0 } };
  /** @type {Record<string, number>} */
  const snapped = {};
  /** @type {Record<string, number>} */
  const shifts = {};
  for (const [key, value] of Object.entries(raw)) {
    const target = snapToBeat(value, grid);
    const delta = target - value;
    // Полдоли — предел: лучше оставить событие на месте, чем ломать ритм.
    const applied = Math.abs(delta) <= beat / 2 + 1e-9 ? target : value;
    snapped[key] = +applied.toFixed(6);
    shifts[key] = +(applied - value).toFixed(6);
  }
  return { enabled: true, raw, snapped, shifts };
}
