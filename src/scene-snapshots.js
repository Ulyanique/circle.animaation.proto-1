/**
 * Быстрые слоты A/B для сравнения вариантов настроек текущей сцены на площадке
 * и кодирование/декодирование компактного фрагмента ссылки `#cfg=<base64url>`.
 */

export const SNAPSHOT_SLOTS = Object.freeze(['A', 'B']);
export const SNAPSHOT_PREFIX = 'circle-anim-slot-v1';

function storage() {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch (_) { return null; }
}

/** @param {string} sceneId @param {'A'|'B'} slot */
export function snapshotStorageKey(sceneId, slot) {
  return `${SNAPSHOT_PREFIX}:${sceneId}:${slot}`;
}

/** @param {string} sceneId @param {'A'|'B'} slot @param {any} config @param {any} [store] */
export function saveSceneSnapshot(sceneId, slot, config, store = storage()) {
  if (!SNAPSHOT_SLOTS.includes(slot) || !sceneId || !config) return false;
  try {
    store?.setItem(snapshotStorageKey(sceneId, slot), JSON.stringify(config));
    return true;
  } catch (_) {
    return false;
  }
}

/** @param {string} sceneId @param {'A'|'B'} slot @param {any} [store] @returns {Record<string, any> | null} */
export function loadSceneSnapshot(sceneId, slot, store = storage()) {
  if (!SNAPSHOT_SLOTS.includes(slot) || !sceneId) return null;
  try {
    const raw = store?.getItem(snapshotStorageKey(sceneId, slot));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch (_) {
    return null;
  }
}

/** @param {string} sceneId @param {'A'|'B'} slot @param {any} [store] */
export function hasSceneSnapshot(sceneId, slot, store = storage()) {
  return loadSceneSnapshot(sceneId, slot, store) !== null;
}

/**
 * Оставляет в объекте только поля, отличающиеся от `defaults`, чтобы ссылка
 * `#cfg=...` содержала только реальные правки (десятки байт вместо десятков КБ).
 * @param {any} current @param {any} defaults @returns {any}
 */
export function diffFromDefaults(current, defaults) {
  if (Object.is(current, defaults)) return undefined;
  if (!current || typeof current !== 'object' || Array.isArray(current) ||
      !defaults || typeof defaults !== 'object' || Array.isArray(defaults)) {
    // data:image пропускаем в URL, чтобы ссылка оставалась короткой и транспортабельной.
    if (typeof current === 'string' && current.startsWith('data:image/')) return undefined;
    return current;
  }
  /** @type {Record<string, any>} */
  const out = {};
  let hasKeys = false;
  for (const key of Object.keys(current)) {
    if (key === 'playback') continue;
    const sub = diffFromDefaults(current[key], defaults[key]);
    if (sub !== undefined) {
      out[key] = sub;
      hasKeys = true;
    }
  }
  return hasKeys ? out : undefined;
}

/** @param {Uint8Array} bytes */
function toBase64Url(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** @param {string} str */
function fromBase64Url(str) {
  const normalized = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Кодирует патч настроек сцены для URL-хэша `#cfg=...`.
 * @param {any} config @param {any} defaults */
export function encodeConfigShareHash(config, defaults) {
  const patch = diffFromDefaults(config, defaults) || {};
  const json = JSON.stringify(patch);
  return toBase64Url(new TextEncoder().encode(json));
}

/** Декодирует патч настроек из строки `cfg` (из `#cfg=...` или `?cfg=...`).
 * @param {string | null | undefined} encoded @returns {Record<string, any> | null} */
export function decodeConfigShareHash(encoded) {
  if (typeof encoded !== 'string' || !encoded.trim()) return null;
  try {
    const json = new TextDecoder().decode(fromBase64Url(encoded.trim()));
    const parsed = JSON.parse(json);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch (_) {
    return null;
  }
}
