import { metallicTitleGradient } from './caption-material.js';
import { OUTPUT } from "./scenes/catalog.js";
import { contourShape } from "./contour-fonts.js";
import { glyphReveal } from "./caption.js";

// Размер берём у целевого canvas: титр должен совпадать с мастером кадра,
// а не с единственным форматом 1920×1080.
/** Регистр тот же, что задаёт CSS для каждой графемы в предпросмотре. */
/**
 * Геометрия строки титра на канвасе: ширина каждой графемы с межбуквенным
 * интервалом, полная ширина строки и левый край каждой графемы.
 *
 * Чистый расчёт, общий для экспорта и для замеров: раньше он жил inline в
 * отрисовке, и любая неточность в нём сдвигала текст в видео относительно
 * DOM-предпросмотра незаметно для тестов. Хвостовой интервал после последней
 * графемы в ширину строки не входит — CSS при центрировании его тоже не учитывает.
 *
 * @param {object} shape
 * @param {string[]} shape.glyphs графемы строки (регистр уже применён)
 * @param {(text: string) => number} shape.measure ширина текста в px канваса
 * @param {number} shape.spacing межбуквенный интервал в px канваса
 * @param {number} [shape.centerX] ось строки; по умолчанию 0
 * @param {((glyph: string) => string[]) | null} [shape.split] развод графемы на
 *   части для канваса без letterSpacing; null — графема рисуется целиком
 * @returns {{items: Array<{glyph: string, width: number, runs: Array<{text: string, offset: number}> | null, x: number}>, width: number, startX: number}}
 */
export function captionLineLayout({ glyphs, measure, spacing, centerX = 0, split = null }) {
  const gap = Number.isFinite(spacing) ? spacing : 0;
  const items = (glyphs ?? []).map((glyph) => {
    if (!split) return { glyph, width: measure(glyph), runs: null, x: 0 };
    // Канвас без letterSpacing: части расширенной графемы рисуются отдельно,
    // но измеряются и раскрываются как одно целое.
    let width = 0;
    const runs = split(glyph).map((text) => {
      const offset = width;
      width += measure(text) + gap;
      return { text, offset };
    });
    return { glyph, width, runs, x: 0 };
  });
  const width = items.reduce((sum, item) => sum + item.width, 0) - (items.length ? gap : 0);
  const startX = centerX - width / 2;
  let x = startX;
  for (const item of items) {
    item.x = x;
    x += item.width;
  }
  return { items, width, startX };
}

export function transformGlyph(glyph, transform, language = "ru") {
  const text = glyph === "\u00a0" ? " " : glyph;
  if (transform === "uppercase") return text.toLocaleUpperCase(language);
  if (transform === "lowercase") return text.toLocaleLowerCase(language);
  return text;
}

// Базовая линия шрифта в DOM зависит в том числе от fallback-глифов. Измеряем
// её один раз для текста/стиля, а не заставляем браузер пересчитывать её на каждом кадре.
let baselines = new WeakMap();
// Для частично прозрачной надписи сначала собираем её как группу, иначе
// заливка, обводки и соседние буквы на пересечениях становятся слишком яркими.
let textScratch;
function scratchContext(width, height) {
  if (!textScratch) textScratch = document.createElement('canvas');
  if (textScratch.width !== width) textScratch.width = width;
  if (textScratch.height !== height) textScratch.height = height;
  // Программный растр: полупрозрачная строка должна давать одинаковые пиксели
  // при любом порядке кадров, иначе экспорт перестаёт быть детерминированным.
  return textScratch.getContext('2d', { willReadFrequently: true });
}
if (typeof document !== "undefined") {
  document.fonts?.addEventListener?.("loadingdone", () => { baselines = new WeakMap(); });
}
export function lineBaseline(line, style, language) {
  const signature = [line.textContent, language, style.fontFamily, style.fontSize, style.fontWeight,
    style.fontStyle, style.fontStretch, style.lineHeight, style.letterSpacing, style.textTransform].join("\u0000");
  const cached = baselines.get(line);
  if (cached?.signature === signature) return cached.offset;
  const marker = document.createElement("span");
  marker.setAttribute("aria-hidden", "true");
  marker.style.cssText = "display:inline-block;width:0;height:0;padding:0;margin:0;border:0;vertical-align:baseline;letter-spacing:0";
  line.appendChild(marker);
  let offset;
  try {
    const bounds = line.getBoundingClientRect();
    if (!bounds.height) return 0;
    offset = marker.getBoundingClientRect().top - (bounds.top + bounds.height / 2);
  } finally {
    marker.remove();
  }
  baselines.set(line, { signature, offset });
  return offset;
}

// подпись на канвасе повторяет DOM-макет (--u = 1% ширины кадра) и ту же анимацию:
// прогресс обводки и заливки каждой строки читается из --p / --f на элементах #caption
function capVal(sel, name) {
  const el = document.querySelector(`#caption ${sel}`);
  return el ? parseFloat(getComputedStyle(el).getPropertyValue(name)) || 0 : 0;
}

export function drawCaption(ctx, alpha, sceneId) {
  const W = ctx.canvas?.width || OUTPUT.width;
  const H = ctx.canvas?.height || OUTPUT.height;
  const u = W / 100;
  const cap = document.getElementById("caption");
  const scale = W / (parseFloat(cap?.style.width) || W);
  const drift = parseFloat(cap?.style.getPropertyValue("--drift")) || 0;
  const font = (w, size, family) => `${w} ${size}px ${family}`;
  ctx.save();
  ctx.translate(0, drift * scale);
  ctx.globalAlpha = alpha;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  // Берём именно те графемы и CSS-регистр, которые видны в DOM-предпросмотре.
  // Регистр применяем до измерения ширины, иначе текст в видео смещается.
  const textLine = (sel, o) => {
    const element = cap?.querySelector(sel);
    if (!element) return;
    const line = { outline: capVal(sel, "--p"), fill: capVal(sel, "--f") };
    if (line.outline <= 0.001) return;
    const style = getComputedStyle(element);
    if (style.visibility === "hidden" || style.display === "none") return;
    const language = element.closest("[lang]")?.getAttribute("lang") || "ru";
    const centerY = o.y + capVal(sel, "--lift") * scale;
    const y = centerY + lineBaseline(element, style, language) * scale;
    const glyphElements = [...element.querySelectorAll(".cap-glyph")];
    const glyphs = glyphElements.map((span) => transformGlyph(span.textContent, style.textTransform, language));
    ctx.font = font(o.weight, o.size, style.fontFamily);
    // После uppercase одна графема может содержать несколько букв (например, ß → SS).
    // Межбуквенный интервал внутри неё должен совпадать с CSS, но reveal остаётся общим.
    const nativeSpacing = "letterSpacing" in ctx;
    const computedSpacing = parseFloat(style.letterSpacing);
    const spacing = Number.isFinite(computedSpacing) ? computedSpacing * scale : o.ls;
    if (nativeSpacing) ctx.letterSpacing = `${spacing}px`;
    const segmenter = !nativeSpacing && typeof Intl.Segmenter === "function"
      ? new Intl.Segmenter(language, { granularity: "grapheme" }) : null;
    // Геометрия строки — чистый расчёт captionLineLayout: один и тот же для
    // замеров и отрисовки, поэтому текст в видео не разъезжается с DOM-макетом.
    const layout = captionLineLayout({
      glyphs,
      measure: (text) => ctx.measureText(text).width,
      spacing,
      centerX: o.centerX ?? W / 2,
      split: nativeSpacing ? null : (glyph) => segmenter
        ? [...segmenter.segment(glyph)].map((part) => part.segment)
        : Array.from(glyph),
    });
    const w = layout.width;
    ctx.textAlign = "left";
    ctx.strokeStyle = o.stroke; ctx.lineWidth = o.sw; ctx.lineJoin = "round";
    const pen = capVal(sel, "--pen");
    glyphs.forEach((glyph, i) => {
      const reveal = glyphReveal(line, i, glyphs.length);
      const { width, runs, x } = layout.items[i];
      const paint = (method) => {
        if (runs) runs.forEach((run) => ctx[method](run.text, x + run.offset, y));
        else ctx[method](glyph, x, y);
      };
      if (glyph !== " " && !o.noOutline && reveal.outline > 0.001) {
        const shape = contourShape(element.dataset.font || cap.dataset.font, o.weight, glyph);
        ctx.save();
        if (shape) {
          const unit = o.size / 1000;
          ctx.translate(x, y);
          ctx.scale(unit, unit);
          ctx.setLineDash([shape.length, shape.length]);
          ctx.lineDashOffset = shape.length * (1 - reveal.outline);
          for (const [offset, opacity, width] of [[-10, 0.3, 4], [10, 0.3, 4], [0, 1, 9]]) {
            ctx.save(); ctx.translate(offset, 0); ctx.globalAlpha *= opacity;
            ctx.lineWidth = width; ctx.stroke(shape.path); ctx.restore();
          }
        } else {
          ctx.beginPath(); ctx.rect(x, 0, width * reveal.outline, H); ctx.clip();
          paint("strokeText");
        }
        ctx.restore();
      }
      if (glyph !== " " && reveal.fill > 0.001) {
        ctx.save();
        ctx.beginPath(); ctx.rect(x, 0, width * reveal.fill, H); ctx.clip();
        if (o.shadow) { ctx.shadowColor = "rgba(0,0,0,0.5)"; ctx.shadowBlur = 0.26 * u; ctx.shadowOffsetY = 0.10 * u; }
        ctx.fillStyle = typeof o.fill === "function" ? o.fill(centerY, parseFloat(glyphElements[i].style.getPropertyValue("--title-shine")) || 0) : o.fill;
        paint("fillText");
        ctx.restore();
      }
      const glowPower = pen * Math.sin(Math.PI * reveal.outline);
      if (glyph !== " " && glowPower > 0.001) {
        const head = x + width * reveal.outline, spread = 0.225 * u;
        const glow = ctx.createLinearGradient(head - spread, 0, head + spread, 0);
        glow.addColorStop(0, "rgba(255,231,164,0)");
        glow.addColorStop(0.5, "rgba(255,231,164,0.55)");
        glow.addColorStop(1, "rgba(255,231,164,0)");
        ctx.save(); ctx.globalAlpha *= glowPower;
        ctx.fillStyle = glow;
        ctx.fillRect(head - spread, centerY - o.size * 0.38, spread * 2, o.size * 0.8);
        ctx.restore();
      }
    });
    ctx.textAlign = "center";
  };

  // Непрозрачность применяется к строке целиком, как в DOM, включая её тень.
  const builtinTextLine = (selector, options) => {
    const element = cap?.querySelector(selector);
    if (!element) return;
    const fade = element.dataset.revealStyle === 'fade' || element.dataset.revealStyle === 'fade-up';
    const value = parseFloat(getComputedStyle(element).opacity);
    const opacity = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 1;
    if (opacity <= 0) return;
    const destination = ctx;
    if (opacity < 1) {
      ctx = scratchContext(W, H); ctx.save(); ctx.resetTransform(); ctx.clearRect(0, 0, W, H);
      ctx.setTransform(destination.getTransform()); ctx.globalAlpha = 1;
    }
    textLine(selector, {...options, noOutline: fade});
    if (opacity < 1) {
      ctx.restore(); ctx = destination; ctx.save(); ctx.resetTransform(); ctx.globalAlpha *= opacity;
      ctx.drawImage(textScratch, 0, 0); ctx.restore();
    }
  };

  // разделитель с ромбом: раскрывается от центра (--p), ромб появляется вместе с ним
  const rule = (sel, y) => {
    const p = capVal(sel, "--p");
    if (p <= 0.001) return;
    y += capVal(sel, "--lift") * scale;
    const half = 17 * u, gap = 1 * u, d = 0.9 * u;
    ctx.save();
    ctx.beginPath(); ctx.rect(W / 2 - half * p, 0, 2 * half * p, H); ctx.clip();
    const lg = ctx.createLinearGradient(W / 2 - half, 0, W / 2 + half, 0);
    lg.addColorStop(0, "rgba(217,176,97,0)"); lg.addColorStop(0.5, "#d9b061"); lg.addColorStop(1, "rgba(217,176,97,0)");
    ctx.fillStyle = lg;
    ctx.fillRect(W / 2 - half, y - 0.5, half - d / 2 - gap, 1);
    ctx.fillRect(W / 2 + d / 2 + gap, y - 0.5, half - d / 2 - gap, 1);
    ctx.globalAlpha *= p;
    ctx.save();
    ctx.translate(W / 2, y); ctx.rotate(Math.PI / 4);
    ctx.strokeStyle = "#e0b25a"; ctx.lineWidth = 1;
    ctx.strokeRect(-d / 2, -d / 2, d, d);
    ctx.restore();
    ctx.restore();
  };

  const brand = sceneId === "brand";
  const photo = sceneId === "photo-pause";
  const finale = sceneId === "finale";
  const fontSize = (selector, fallback) => {
    const el = cap?.querySelector(selector);
    const size = el ? parseFloat(getComputedStyle(el).fontSize) * scale : NaN;
    return Number.isFinite(size) && size > 0 ? size : fallback;
  };
  const color = (name) => getComputedStyle(cap).getPropertyValue(`--${name}-color`).trim() || null;
  const titleColor = color("title"), subtitleColor = color("subtitle"), dateColor = color("date");
  const tSize = fontSize(".cap-title", (photo ? 6.7 : finale ? 6.6 : 7.2) * u);
  const subSize = fontSize(".cap-sub", (finale ? 2.55 : 2.6) * u);
  const dateSize = fontSize(".cap-date", 1.95 * u);
  const titleGrad = (y) => {
    const g = ctx.createLinearGradient(0, y - tSize / 2, 0, y + tSize / 2);
    // Те же мягкие стопы, что у CSS-градиента по умолчанию.
    g.addColorStop(0, "#fff4d8"); g.addColorStop(0.22, "#f7e2b4");
    g.addColorStop(0.44, "#e6c184"); g.addColorStop(0.58, "#cfa260");
    g.addColorStop(0.76, "#e9cb8d"); g.addColorStop(0.9, "#d3a65f"); g.addColorStop(1, "#bf8f4c");
    return g;
  };
  // У интро три строки, поэтому название остаётся выше; в фоновых сценах титр
  // опущен в нижнюю треть, чтобы под ним не оставалось пустого поля.
  const linePosition = (selector, fallbackY) => {
    const element = cap?.querySelector(selector);
    const style = element ? getComputedStyle(element) : null;
    return { centerX: style ? parseFloat(style.left) * scale : W / 2,
      y: style ? parseFloat(style.top) * scale : fallbackY };
  };
  const titlePosition = linePosition(".cap-title", (brand || photo || finale) ? 0.65 * H : 0.55 * H);
  if (!photo) builtinTextLine(".cap-title", {
    ...titlePosition,
    weight: 600, size: tSize, ls: 0, stroke: titleColor || "#e0b25a", sw: 0.055 * u, shadow: true,
    fill: titleColor || (cap.dataset.titleMetallic === "true" ? (y, shine) => metallicTitleGradient(ctx, y, tSize, shine) : titleGrad),
  });
  if (finale) {
    const subPosition = linePosition(".cap-sub", 0.79 * H);
    // Финальная строка остаётся одна на чёрном поле: тёплый ореол под ней
    // работает картой света и не даёт строке висеть в пустоте. Альфа берёт
    // прозрачность строки из DOM, поэтому ореол гаснет вместе с ней; на тёплых
    // кадрах с знаком он неразличим. Титр рисует композитор (DOM скрыт),
    // значит и ореол живёт здесь, а не в CSS.
    const subElement = cap?.querySelector(".cap-sub");
    const subAlpha = subElement
      ? Math.max(0, Math.min(1, parseFloat(getComputedStyle(subElement).opacity) || 0))
      : 1;
    if (subAlpha > 0.01) {
      // Эллипс на всю строку с запасом: узкий радиус читался кляксой за
      // серединой текста, а не картой света под строкой.
      const haloRadius = 26 * u;
      ctx.save();
      ctx.globalAlpha *= subAlpha;
      ctx.translate(subPosition.centerX, subPosition.y);
      ctx.scale(1, 0.38);
      const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, haloRadius);
      halo.addColorStop(0, "rgba(236,190,102,.10)");
      halo.addColorStop(0.55, "rgba(214,150,70,.035)");
      halo.addColorStop(1, "rgba(214,150,70,0)");
      ctx.fillStyle = halo;
      ctx.beginPath(); ctx.arc(0, 0, haloRadius, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    builtinTextLine(".cap-sub", {
      ...subPosition, weight: 400, size: subSize, ls: 0.18 * subSize,
      stroke: subtitleColor || "#d9b061", sw: 0.04 * u, fill: subtitleColor || "#ecd08c",
    });
  }
  if (!brand && !photo && !finale) {
    rule(".r1", 0.66 * H);
    rule(".r2", 0.787 * H);
    builtinTextLine(".cap-sub", {
      ...linePosition(".cap-sub", 0.72 * H), weight: 400, size: subSize, ls: 0.22 * subSize, stroke: subtitleColor || "#d9b061", sw: 0.04 * u, fill: subtitleColor || "#ecd08c",
    });
    builtinTextLine(".cap-date", {
      ...linePosition(".cap-date", 0.84 * H), weight: 400, size: dateSize, ls: 0.28 * dateSize, stroke: dateColor || "#d9b061", sw: 0.035 * u, fill: dateColor || "#d9b061",
    });
  }
  for (const el of cap?.querySelectorAll('.cap-custom') ?? []) {
    const selector = `[data-custom="${el.dataset.custom}"]`;
    const size = fontSize(selector, 3.5 * u);
    const fill = getComputedStyle(el).getPropertyValue('--custom-color').trim() || '#ecd08c';
    const opacityValue = parseFloat(getComputedStyle(el).opacity);
    const opacity = Number.isFinite(opacityValue) ? Math.max(0, Math.min(1, opacityValue)) : 1;
    if (opacity <= 0) continue;
    const destination = ctx;
    if (opacity < 1) {
      ctx = scratchContext(W, H);
      ctx.save(); ctx.resetTransform(); ctx.clearRect(0, 0, W, H);
      ctx.setTransform(destination.getTransform()); ctx.globalAlpha = 1;
    }
    ctx.save();
    if (el.dataset.independent === 'true') ctx.translate(0, -drift * scale);
    textLine(selector, { ...linePosition(selector, 0.75 * H), weight: 600, size, ls: 0,
      stroke: fill, sw: 0.04 * u, fill, noOutline: el.dataset.revealStyle === 'fade' || el.dataset.revealStyle === 'fade-up' });
    ctx.restore();
    if (opacity < 1) {
      ctx.restore(); ctx = destination;
      ctx.save(); ctx.resetTransform(); ctx.globalAlpha *= opacity;
      ctx.drawImage(textScratch, 0, 0); ctx.restore();
    }
  }
  ctx.restore();
}

