import { FONT_CHOICES } from "./scenes/defaults.js";

const BUILTIN_NAMES = FONT_CHOICES.map((font) => font.value);
/** @type {Map<string, string>} data URL → зарегистрированное семейство */
const loadedCustomFonts = new Map();

/** Регистрирует пользовательский FontFace один раз для каждого data URL. */
async function ensureCustomFont(name, dataUrl) {
  if (!name || !dataUrl) return false;
  const known = loadedCustomFonts.get(dataUrl);
  if (known) return known === name;
  if (typeof FontFace === "undefined" || !document.fonts) return false;
  const face = new FontFace(name, `url("${dataUrl}")`, { weight: "100 900" });
  await face.load();
  document.fonts.add(face);
  loadedCustomFonts.set(dataUrl, name);
  return true;
}

/** Применяет выбранный шрифт к DOM-титру и догружает его для canvas-экспорта.
 * @param {any} cfg
 */
export async function applyCaptionFont(cfg) {
  const cap = document.getElementById("caption");
  const caption = cfg?.caption || {};
  const family = caption.fontFamily || "Cormorant Garamond";
  const weight = String(caption.fontWeight || "600");
  const dataUrl = caption.customFontDataUrl || "";
  const customName = caption.customFontName || "";
  cap?.style.setProperty("--cap-font", `"${family}", Georgia, serif`);
  cap?.style.setProperty("--cap-weight", weight);
  if (cap) cap.dataset.fontFamily = family;
  if (dataUrl && customName && family === customName) {
    try { await ensureCustomFont(customName, dataUrl); }
    catch (e) { console.warn("Не удалось загрузить пользовательский шрифт", e); }
  }
  if (document.fonts?.load) {
    const probe = caption.title || "Янтарный циркуль";
    await Promise.allSettled([
      document.fonts.load(`${weight} 72px "${family}"`, probe),
      document.fonts.load(`400 26px "${family}"`, caption.subtitle || probe),
      ...BUILTIN_NAMES.slice(0, 1).map((name) => document.fonts.load(`600 72px "${name}"`, probe)),
    ]);
  }
  return family;
}

/** Читает .ttf/.woff2/.otf и возвращает имя + data URL для сохранения в JSON.
 * @param {File} file
 */
export async function loadCustomFont(file) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error || new Error("Не удалось прочитать файл"));
    reader.readAsDataURL(file);
  });
  const base = file.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9А-Яа-яЁё_-]+/g, "-");
  const name = `Custom-${base || Date.now()}`;
  await ensureCustomFont(name, dataUrl);
  return { name, dataUrl };
}
