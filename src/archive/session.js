import { ARCHIVE_SLOTS } from './slots.js';
import { SLOT_COUNT, SLOT_DURATION, FINALE_DURATION } from './motion.js';

export const ARCHIVE_SESSION_KEY = 'circle-archive-session-v1';
export const MIN_SLOT_DURATION = 3;
export const MAX_SLOT_DURATION = 20;

/**
 * @typedef {Object} ArchiveSlotConfig
 * @property {string} name
 * @property {string} source
 * @property {'cover'|'contain'} fit
 * @property {number} focusX 0..100
 * @property {number} focusY 0..100
 * @property {number} duration секунды эпизода (3..20)
 * @property {{start:number,end:number}|null} range границы фрагмента видео
 */

/** @returns {ArchiveSlotConfig[]} */
export function defaultArchiveLayout() {
  return ARCHIVE_SLOTS.map((slot) => ({
    name: slot.name,
    source: slot.source,
    fit: 'cover',
    focusX: 50,
    focusY: 50,
    duration: SLOT_DURATION,
    range: null,
  }));
}

/** @param {unknown} v */
export function clampSlotDuration(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return SLOT_DURATION;
  return Math.max(MIN_SLOT_DURATION, Math.min(MAX_SLOT_DURATION, Math.round(n * 10) / 10));
}

/**
 * Нормализует сохранённый массив слотов, гарантируя длину `SLOT_COUNT`.
 * @param {unknown} raw
 * @returns {ArchiveSlotConfig[]}
 */
export function normalizeArchiveLayout(raw) {
  const defaults = defaultArchiveLayout();
  if (!Array.isArray(raw)) return defaults;
  return defaults.map((def, i) => {
    const item = raw[i];
    if (!item || typeof item !== 'object') return def;
    const fit = item.fit === 'contain' ? 'contain' : 'cover';
    const focusX = Number.isFinite(Number(item.focusX)) ? Math.max(0, Math.min(100, Math.round(Number(item.focusX)))) : 50;
    const focusY = Number.isFinite(Number(item.focusY)) ? Math.max(0, Math.min(100, Math.round(Number(item.focusY)))) : 50;
    const range = item.range && Number.isFinite(item.range.start) && Number.isFinite(item.range.end) && item.range.end > item.range.start
      ? { start: Math.max(0, Number(item.range.start)), end: Number(item.range.end) }
      : null;
    return {
      name: typeof item.name === 'string' && item.name.trim() ? item.name.trim().slice(0, 60) : def.name,
      source: typeof item.source === 'string' ? item.source.slice(0, 40) : def.source,
      fit,
      focusX,
      focusY,
      duration: clampSlotDuration(item.duration),
      range,
    };
  });
}

function storage() {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch (_) { return null; }
}

/** @param {any} [store] @returns {ArchiveSlotConfig[]} */
export function loadArchiveSession(store = storage()) {
  try {
    const raw = store?.getItem(ARCHIVE_SESSION_KEY);
    if (!raw) return defaultArchiveLayout();
    const parsed = JSON.parse(raw);
    return normalizeArchiveLayout(parsed?.slots ?? parsed);
  } catch (_) {
    return defaultArchiveLayout();
  }
}

/** @param {ArchiveSlotConfig[]} slots @param {any} [store] */
export function saveArchiveSession(slots, store = storage()) {
  try {
    store?.setItem(ARCHIVE_SESSION_KEY, JSON.stringify({ version: 1, slots: normalizeArchiveLayout(slots) }));
    return true;
  } catch (_) {
    return false;
  }
}

/** Переставить два соседних или произвольных слота местами (иммутабельно для массива).
 * @template T
 * @param {T[]} list @param {number} from @param {number} to @returns {T[]} */
export function swapArchiveItems(list, from, to) {
  const next = list.slice();
  if (from < 0 || to < 0 || from >= next.length || to >= next.length || from === to) return next;
  const tmp = next[from];
  next[from] = next[to];
  next[to] = tmp;
  return next;
}

/**
 * Переводит реальное время раскладки с произвольными длительностями слотов
 * в каноническое время 3D-траектории (`0 .. SLOT_COUNT * 8 + FINALE_DURATION`),
 * а также возвращает локальное время внутри каждого слота в реальных секундах.
 * При стандартных 8 с на каждый слот отображение тождественно `t -> t`.
 * @param {readonly {duration:number}[]} slots
 * @param {number} realTime
 */
export function mapArchiveTime(slots, realTime) {
  const durations = slots.length === SLOT_COUNT
    ? slots.map((s) => clampSlotDuration(s.duration))
    : Array(SLOT_COUNT).fill(SLOT_DURATION);
  const finaleStart = durations.reduce((sum, d) => sum + d, 0);
  const totalDuration = finaleStart + FINALE_DURATION;
  const t = ((Math.max(0, Number.isFinite(realTime) ? realTime : 0) % totalDuration) + totalDuration) % totalDuration;

  if (t >= finaleStart) {
    return {
      totalDuration,
      finaleStart,
      realTime: t,
      canonicalTime: SLOT_COUNT * SLOT_DURATION + (t - finaleStart),
      activeSlot: SLOT_COUNT,
      slotStarts: computeSlotStarts(durations),
    };
  }

  let acc = 0;
  for (let i = 0; i < SLOT_COUNT; i++) {
    const d = durations[i];
    if (t < acc + d || i === SLOT_COUNT - 1) {
      const progress = Math.max(0, Math.min(1, (t - acc) / d));
      return {
        totalDuration,
        finaleStart,
        realTime: t,
        canonicalTime: (i + progress) * SLOT_DURATION,
        activeSlot: i,
        slotStarts: computeSlotStarts(durations),
      };
    }
    acc += d;
  }
  return {
    totalDuration,
    finaleStart,
    realTime: t,
    canonicalTime: 0,
    activeSlot: 0,
    slotStarts: computeSlotStarts(durations),
  };
}

/** @param {readonly number[]} durations */
function computeSlotStarts(durations) {
  const starts = [];
  let acc = 0;
  for (const d of durations) {
    starts.push(acc);
    acc += d;
  }
  return starts;
}

/** Полная длительность архивной композиции с учётом индивидуальных длительностей слотов.
 * @param {readonly {duration:number}[]} slots */
export function archiveTotalDuration(slots) {
  return mapArchiveTime(slots, 0).totalDuration;
}

/** Реальное время, прошедшее с начала слота `index`.
 * @param {readonly {duration:number}[]} slots @param {number} realTime @param {number} index */
export function realElapsedForSlot(slots, realTime, index) {
  const mapped = mapArchiveTime(slots, realTime);
  const start = mapped.slotStarts[index] ?? index * SLOT_DURATION;
  return Math.max(0, mapped.realTime - start);
}
