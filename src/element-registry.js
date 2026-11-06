import { loopLocal } from "./scenes/cues.js";

const TAU = Math.PI * 2;
const HALF_H = Math.tan(Math.PI / 12) * 9;
const HALF_W = HALF_H * 16 / 9;
/** @param {number} x */
const clamp01 = (x) => Math.max(0, Math.min(1, x));
/** @param {number} a @param {number} b @param {number} x */
const smooth = (a, b, x) => {
  const k = clamp01((x - a) / Math.max(b - a, 1e-4));
  return k * k * (3 - 2 * k);
};
/** @param {any} value */
const clone = (value) => JSON.parse(JSON.stringify(value));

/** @param {number} x @param {number} y */
export function worldToNormalized(x, y) {
  return { x: 0.5 + x / (2 * HALF_W), y: 0.5 - y / (2 * HALF_H) };
}
/** @param {number} x @param {number} y */
export function normalizedToWorld(x, y) {
  return { x: (x - 0.5) * 2 * HALF_W, y: (0.5 - y) * 2 * HALF_H };
}
/** @param {number} value @param {number} [snap] */
export function snapValue(value, snap = 0) {
  const step = Number(snap) || 0;
  return step > 0 ? Math.round(clamp01(value) / step) * step : clamp01(value);
}

/** @type {Record<string, any>} */
export const ELEMENT_SPECS = Object.freeze({
  logo: { label: "Логотип", box: { w: 0.17, h: 0.33 } },
  corners: { label: "Угловые кольца", box: { w: 0.9, h: 0.9 } },
  plotter: { label: "Построительная окружность", box: { w: 0.3, h: 0.3 } },
  title: { label: "Название", box: { w: 0.52, h: 0.09 } },
  subtitle: { label: "Подзаголовок", box: { w: 0.42, h: 0.05 } },
  date: { label: "Дата", box: { w: 0.3, h: 0.035 } },
  phrase: { label: "Финальная фраза", box: { w: 0.44, h: 0.05 } },
  decor: { label: "Декор фона", box: { w: 0.85, h: 0.85 } },
  circularText: { label: "Круговая строка", box: { w: 0.38, h: 0.38 } },
  edgeCorners: { label: "Уголки по краям", box: { w: 0.94, h: 0.92 } },
  finalCircle: { label: "Финальный круг", box: { w: 0.3, h: 0.3 } },
});

/** @type {Record<string, string[]>} */
const SCENE_ELEMENTS = Object.freeze({
  waiting: ["logo", "corners", "plotter", "title", "subtitle", "date"],
  brand: ["logo", "corners", "plotter", "title", "decor"],
  "photo-pause": ["logo", "corners", "plotter", "title", "circularText", "edgeCorners"],
  finale: ["logo", "corners", "plotter", "title", "phrase", "finalCircle"],
});

/** @type {Record<string, number>} */
const LOGO_WORLD_Y = Object.freeze({ waiting: 1.1, brand: 0.55, "photo-pause": 0, finale: 1.0 });

/** @param {string} id @param {number} x @param {number} y @param {number} [zIndex] */
function base(id, x, y, zIndex = 0) {
  return {
    id, x, y, scale: 1, rotation: 0, zIndex, color: "",
    inPreset: "contour-to-fill", outPreset: "reverse-contour", loopPreset: "none",
    timing: { start: 0, duration: 1 }, locked: false,
  };
}

/** Полные трансформы элементов сцены; координаты — доли кадра 1920×1080.
 * @param {string} sceneId
 */
export function createElementDefaults(sceneId) {
  const logo = worldToNormalized(0, LOGO_WORLD_Y[sceneId] ?? 0);
  const ids = SCENE_ELEMENTS[sceneId] || SCENE_ELEMENTS.waiting;
  /** @type {Record<string, any>} */
  const out = {};
  for (const id of ids) {
    if (id === "logo") out[id] = base(id, logo.x, logo.y, 1);
    else if (id === "corners") out[id] = base(id, 0.5, 0.5, -2);
    else if (id === "plotter") out[id] = base(id, 0.5, logo.y, -1);
    else if (id === "title") out[id] = base(id, 0.5, sceneId === "waiting" || sceneId === "finale" ? 0.55 : 0.69, 2);
    else if (id === "subtitle") out[id] = base(id, 0.5, 0.72, 3);
    else if (id === "date") out[id] = base(id, 0.5, 0.84, 3);
    else if (id === "phrase") out[id] = base(id, 0.5, 0.71, 3);
    else if (id === "decor") out[id] = base(id, 0.5, 0.5, -3);
    else if (id === "circularText") out[id] = base(id, 0.5, 0.5, -1);
    else if (id === "edgeCorners") out[id] = base(id, 0.5, 0.5, 5);
    else if (id === "finalCircle") out[id] = base(id, 0.5, 0.5, 6);
  }
  return out;
}

/** @param {string} sceneId */
export function elementIdsForScene(sceneId) {
  return [...(SCENE_ELEMENTS[sceneId] || SCENE_ELEMENTS.waiting)];
}
/** @param {string} id */
export function elementLabel(id) {
  return ELEMENT_SPECS[id]?.label || id;
}
/** @param {string} id */
export function elementBox(id) {
  return ELEMENT_SPECS[id]?.box || { w: 0.2, h: 0.2 };
}

/** Чистая анимация элемента от абсолютного времени: без DOM и истории кадров.
 * @param {any} el @param {number} t @param {number} cycle
 */
export function elementAnimation(el, t, cycle) {
  const e = el || {};
  const local = loopLocal(t, Math.max(0.1, cycle));
  const start = Math.max(0, Number(e.timing?.start ?? 0) || 0);
  const duration = Math.max(0.01, Number(e.timing?.duration ?? 1) || 1);
  const inK = smooth(start, start + duration, local);
  const outStart = Math.max(0, cycle - duration);
  const outK = 1 - smooth(outStart, outStart + duration, local);
  const presetIn = e.inPreset || "contour-to-fill";
  const presetOut = e.outPreset || "reverse-contour";
  const opacity = (presetIn === "fade" || presetIn === "scale-in" || presetIn === "draw-on" ? inK : 1) *
    (presetOut === "fade" || presetOut === "scale-out" || presetOut === "reverse-contour" ? outK : 1);
  const loop = e.loopPreset || "none";
  const breath = loop === "none" ? 0 : Math.sin(TAU * local / cycle);
  const scale = (presetIn === "scale-in" ? 0.82 + 0.18 * inK : 1) *
    (presetOut === "scale-out" ? 1 - 0.32 * (1 - outK) : 1) *
    (loop === "quiet-breath" ? 1 + 0.012 * breath : 1);
  return {
    opacity, scale,
    rotation: loop === "slow-drift" ? 0.025 * breath : 0,
    x: loop === "slow-drift" ? 0.008 * Math.cos(TAU * local / cycle) : 0,
    y: loop === "slow-drift" ? 0.006 * breath : 0,
  };
}

/** @param {any} el @param {number} t @param {number} cycle
 * @param {number} halfW @param {number} halfH */
export function elementWorldTransform(el, t, cycle, halfW, halfH) {
  const anim = elementAnimation(el, t, cycle);
  const p = normalizedToWorld((el?.x ?? 0.5) + anim.x, (el?.y ?? 0.5) + anim.y);
  return {
    x: p.x * (halfW / HALF_W),
    y: p.y * (halfH / HALF_H),
    scale: (el?.scale ?? 1) * anim.scale,
    rotation: (el?.rotation ?? 0) + anim.rotation,
    opacity: anim.opacity,
    zIndex: el?.zIndex ?? 0,
    color: el?.color || "",
  };
}

/** Мягко умножает прозрачность всех материалов объекта, сохраняя базу.
 * @param {any} object @param {number} opacity */
export function applyElementOpacity(object, opacity) {
  if (!object) return;
  object.traverse(/** @param {any} child */ (child) => {
    const material = child.material;
    const list = Array.isArray(material) ? material : material ? [material] : [];
    for (const m of list) {
      if (!m || !("opacity" in m)) continue;
      if (m.userData._editorBaseOpacity === undefined) m.userData._editorBaseOpacity = m.opacity ?? 1;
      m.transparent = true;
      m.opacity = m.userData._editorBaseOpacity * opacity;
    }
  });
}

/** @param {any} object @param {string} color */
export function applyElementColor(object, color) {
  if (!object || !color) return;
  object.traverse(/** @param {any} child */ (child) => {
    const material = child.material;
    const list = Array.isArray(material) ? material : material ? [material] : [];
    for (const m of list) {
      if (m?.color?.set) m.color.set(color);
    }
  });
}

/** @param {any} cfg @param {string} id @param {Record<string, any>} patch */
export function setElementTransform(cfg, id, patch) {
  const elements = cfg.elements || (cfg.elements = {});
  const current = elements[id] || createElementDefaults("waiting")[id] || base(id, 0.5, 0.5);
  elements[id] = { ...current, ...patch, timing: { ...current.timing, ...(patch.timing || {}) } };
  return elements[id];
}

/** @param {string} sceneId */
export function cloneElements(sceneId) {
  return clone(createElementDefaults(sceneId));
}
