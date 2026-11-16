const fonts = new Map();
const pending = new Map();
const shapes = new Map();
let ready = false;
let sources = {};
let parser = null;

function urlsForFont(fontId) {
  const entry = sources[fontId] || sources["cormorant-garamond"];
  return entry ? [...new Set(Object.values(entry).flat())] : [];
}

async function ensureUrlLoaded(url, parseFn) {
  if (fonts.has(url)) return fonts.get(url);
  if (pending.has(url)) return pending.get(url);
  const promise = (async () => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Не удалось загрузить контур шрифта: ${response.status}`);
    const parsed = parseFn(await response.arrayBuffer());
    fonts.set(url, parsed);
    return parsed;
  })();
  pending.set(url, promise);
  try {
    return await promise;
  } finally {
    pending.delete(url);
  }
}

/**
 * Контуры тех же локальных файлов, которые браузер использует для текста.
 * Если передать `onlyIds`, загружает только указанные семейства шрифтов,
 * а остальные можно догрузить по требованию через `ensureContourFont`.
 */
export async function loadContourFonts(fontSources, parse, onlyIds = null) {
  sources = fontSources;
  parser = parse;
  const targetIds = Array.isArray(onlyIds) && onlyIds.length
    ? [...new Set(["cormorant-garamond", ...onlyIds])]
    : Object.keys(sources);
  const urls = [...new Set(targetIds.flatMap(urlsForFont))];
  await Promise.all(urls.map((url) => ensureUrlLoaded(url, parse)));
  ready = true;
}

/** Догружает контуры конкретного шрифта (или списка), если они ещё не в кэше. */
export async function ensureContourFont(fontIds) {
  if (!parser || !Object.keys(sources).length) return false;
  const list = Array.isArray(fontIds) ? fontIds : [fontIds];
  const urls = [...new Set(list.filter(Boolean).flatMap(urlsForFont))].filter((url) => !fonts.has(url));
  if (!urls.length) return false;
  await Promise.all(urls.map((url) => ensureUrlLoaded(url, parser)));
  ready = true;
  return true;
}

/** Проверить, загружены ли уже файлы контуров для данного шрифта. */
export function isContourFontLoaded(fontId) {
  const urls = urlsForFont(fontId);
  return urls.length > 0 && urls.every((url) => fonts.has(url));
}

/** Описание глифа в координатах 1000 единиц на em; длина нужна для Canvas. */
export function contourShape(fontId, weight, text) {
  if (!ready || !text || /^\s+$/.test(text)) return null;
  const source = sources[fontId] || sources["cormorant-garamond"];
  if (!source) return null;
  const urls = source[weight >= 600 ? 600 : 400];
  const loadedFonts = urls.map((url) => fonts.get(url));
  if (loadedFonts.some((f) => !f)) return null;
  const key = `${urls.join("|")}|${text}`;
  if (shapes.has(key)) return shapes.get(key);
  // Для расширенных графем берём один шрифт, содержащий все символы.
  const font = loadedFonts.find((f) => [...text].every((c) => f.charToGlyph(c).index !== 0));
  if (!font) { shapes.set(key, null); return null; }
  const d = font.getPath(text, 0, 0, 1000, { kerning: false }).toPathData(2);
  if (!d) { shapes.set(key, null); return null; }
  const el = document.createElementNS("http://www.w3.org/2000/svg", "path");
  el.setAttribute("d", d);
  const length = el.getTotalLength();
  const shape = length > 0 ? { d, length, path: new Path2D(d) } : null;
  shapes.set(key, shape);
  return shape;
}

export function contoursReady() { return ready; }
