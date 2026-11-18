import { BASE_FRAME, OUTPUT } from "./scenes/catalog.js";

/**
 * Профиль мастер-кадра. Композиция сцен задана в долях кадра, поэтому смена
 * профиля меняет только пиксельную сетку, а не расположение элементов.
 * Умолчание — прежние 1920×1080, чтобы старые настройки и проверки не менялись.
 */
export const MASTER_PRESETS = Object.freeze({
  "1080p": Object.freeze({ id: "1080p", width: BASE_FRAME.width, height: BASE_FRAME.height,
    label: `${BASE_FRAME.width}×${BASE_FRAME.height}` }),
  "2160p": Object.freeze({ id: "2160p", width: 3840, height: 2160, label: "3840×2160 · 4K UHD" }),
});

export const DEFAULT_MASTER = "1080p";
export const MASTER_STORAGE_KEY = "circle-anim-master-v1";

let active = DEFAULT_MASTER;

function storage() {
  try { return typeof localStorage === "undefined" ? null : localStorage; } catch (e) { return null; }
}

/**
 * @param {unknown} id
 * @returns {id is keyof typeof MASTER_PRESETS}
 */
export function isMasterPreset(id) {
  return typeof id === "string" && Object.prototype.hasOwnProperty.call(MASTER_PRESETS, id);
}

/** Идентификатор активного профиля. */
export function masterId() {
  return active;
}

/** @param {string} [id] */
export function masterPreset(id = active) {
  return isMasterPreset(id) ? MASTER_PRESETS[id] : MASTER_PRESETS[DEFAULT_MASTER];
}

/** Размер мастер-кадра и частота кадров проекта. */
export function masterSize() {
  const preset = masterPreset();
  return { width: preset.width, height: preset.height, fps: OUTPUT.fps };
}

/** Во сколько раз мастер шире базовых 1920 px. */
export function masterScale() {
  return masterPreset().width / BASE_FRAME.width;
}

/** @param {string} id */
export function setMasterPreset(id) {
  if (!isMasterPreset(id)) return false;
  active = id;
  try { storage()?.setItem(MASTER_STORAGE_KEY, id); } catch (e) { /* приватный режим — просто не запоминаем */ }
  return true;
}

/** Читает сохранённый профиль один раз при запуске. */
export function loadMasterPreset() {
  /** @type {string | null} */
  let saved = null;
  try { saved = storage()?.getItem(MASTER_STORAGE_KEY) ?? null; } catch (e) { saved = null; }
  if (isMasterPreset(saved)) active = saved;
  return active;
}

/** Для тестов и сброса: возврат к базовому профилю без записи в браузер. */
export function resetMasterPreset() {
  active = DEFAULT_MASTER;
  return active;
}
