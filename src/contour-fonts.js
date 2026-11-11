const fonts = new Map();
const shapes = new Map();
let ready = false;
let sources = {};

/** Контуры тех же локальных файлов, которые браузер использует для текста. */
export async function loadContourFonts(fontSources, parse) {
  sources = fontSources;
  const urls = [...new Set(Object.values(sources).flatMap((entry) => Object.values(entry).flat()))];
  await Promise.all(urls.map(async (url) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Не удалось загрузить контур шрифта: ${response.status}`);
    fonts.set(url, parse(await response.arrayBuffer()));
  }));
  ready = true;
}

/** Описание глифа в координатах 1000 единиц на em; длина нужна для Canvas. */
export function contourShape(fontId, weight, text) {
  if (!ready || !text || /^\s+$/.test(text)) return null;
  const source = sources[fontId] || sources["cormorant-garamond"];
  const urls = source[weight >= 600 ? 600 : 400];
  const key = `${urls.join('|')}|${text}`;
  if (shapes.has(key)) return shapes.get(key);
  // Для расширенных графем берём один шрифт, содержащий все символы.
  const font = urls.map(url => fonts.get(url)).find(f => [...text].every(c => f.charToGlyph(c).index !== 0));
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
