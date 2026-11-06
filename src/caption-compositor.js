import { OUTPUT } from "./scenes/catalog.js";
import { glyphReveal } from "./caption.js";

const REC_W = OUTPUT.width, REC_H = OUTPUT.height;

/** Регистр тот же, что задаёт CSS для каждой графемы в предпросмотре. */
export function transformGlyph(glyph, transform, language = "ru") {
  const text = glyph === "\u00a0" ? " " : glyph;
  if (transform === "uppercase") return text.toLocaleUpperCase(language);
  if (transform === "lowercase") return text.toLocaleLowerCase(language);
  return text;
}

// Базовая линия шрифта в DOM зависит в том числе от fallback-глифов. Измеряем
// её один раз для текста/стиля, а не заставляем браузер пересчитывать её на каждом кадре.
let baselines = new WeakMap();
if (typeof document !== "undefined") {
  document.fonts?.addEventListener?.("loadingdone", () => { baselines = new WeakMap(); });
}
function lineBaseline(line, style, language) {
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
  const W = REC_W, H = REC_H, u = W / 100;
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
    const language = element.closest("[lang]")?.getAttribute("lang") || "ru";
    const centerY = o.y + capVal(sel, "--lift") * scale;
    const y = centerY + lineBaseline(element, style, language) * scale;
    const glyphs = [...element.querySelectorAll(".cap-glyph")]
      .map((span) => transformGlyph(span.textContent, style.textTransform, language));
    ctx.font = font(o.weight, o.size, style.fontFamily);
    // После uppercase одна графема может содержать несколько букв (например, ß → SS).
    // Межбуквенный интервал внутри неё должен совпадать с CSS, но reveal остаётся общим.
    const nativeSpacing = "letterSpacing" in ctx;
    if (nativeSpacing) ctx.letterSpacing = `${o.ls}px`;
    const segmenter = !nativeSpacing && typeof Intl.Segmenter === "function"
      ? new Intl.Segmenter(language, { granularity: "grapheme" }) : null;
    const metrics = glyphs.map((glyph) => {
      if (nativeSpacing) return { width: ctx.measureText(glyph).width, runs: null };
      // Старый canvas без letterSpacing: рисуем части расширенной графемы отдельно,
      // но измеряем и раскрываем всю исходную графему как одно целое.
      const parts = segmenter ? [...segmenter.segment(glyph)].map((part) => part.segment) : Array.from(glyph);
      let width = 0;
      const runs = parts.map((text) => {
        const offset = width;
        width += ctx.measureText(text).width + o.ls;
        return { text, offset };
      });
      return { width, runs };
    });
    const w = metrics.reduce((sum, item) => sum + item.width, 0) - (glyphs.length ? o.ls : 0);
    let x = (o.centerX ?? W / 2) - w / 2; // отступ DOM уже учитывается центрированием строки
    ctx.textAlign = "left";
    ctx.strokeStyle = o.stroke; ctx.lineWidth = o.sw; ctx.lineJoin = "round";
    const pen = capVal(sel, "--pen");
    glyphs.forEach((glyph, i) => {
      const reveal = glyphReveal(line, i, glyphs.length);
      const { width, runs } = metrics[i];
      const paint = (method) => {
        if (runs) runs.forEach((run) => ctx[method](run.text, x + run.offset, y));
        else ctx[method](glyph, x, y);
      };
      if (glyph !== " " && reveal.outline > 0.001) {
        ctx.save();
        ctx.beginPath(); ctx.rect(x, 0, width * reveal.outline, H); ctx.clip();
        paint("strokeText");
        ctx.restore();
      }
      if (glyph !== " " && reveal.fill > 0.001) {
        ctx.save();
        ctx.beginPath(); ctx.rect(x, 0, width * reveal.fill, H); ctx.clip();
        if (o.shadow) { ctx.shadowColor = "rgba(0,0,0,0.7)"; ctx.shadowBlur = 0.5 * u; ctx.shadowOffsetY = 0.2 * u; }
        ctx.fillStyle = typeof o.fill === "function" ? o.fill(centerY) : o.fill;
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
      x += width;
    });
    ctx.textAlign = "center";
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
  const tSize = (photo ? 6.7 : finale ? 6.6 : 7.2) * u;
  const titleGrad = (y) => {
    const g = ctx.createLinearGradient(0, y - tSize / 2, 0, y + tSize / 2);
    g.addColorStop(0, "#fff3cc"); g.addColorStop(0.4, "#f0cc78");
    g.addColorStop(0.75, "#c08c36"); g.addColorStop(1, "#e8c06a");
    return g;
  };
  // У интро три строки, поэтому название остаётся выше; в фоновых сценах титр
  // опущен в нижнюю треть, чтобы под ним не оставалось пустого поля.
  const titleY = (brand || photo || finale) ? 0.65 * H : 0.55 * H;
  textLine(".cap-title", {
    y: titleY, centerX: W / 2,
    weight: 600, size: tSize, ls: 0, stroke: "#e0b25a", sw: 0.08 * u, shadow: true, fill: titleGrad,
  });
  if (finale) {
    textLine(".cap-sub", {
      y: 0.79 * H, weight: 400, size: 2.55 * u, ls: 0.18 * 2.55 * u,
      stroke: "#d9b061", sw: 0.04 * u, fill: "#ecd08c",
    });
  }
  if (!brand && !photo && !finale) {
    rule(".r1", 0.66 * H);
    rule(".r2", 0.79 * H);
    textLine(".cap-sub", {
      y: 0.72 * H, weight: 400, size: 2.4 * u, ls: 0.32 * 2.4 * u, stroke: "#d9b061", sw: 0.04 * u, fill: "#ecd08c",
    });
    textLine(".cap-date", {
      y: 0.84 * H, weight: 400, size: 1.5 * u, ls: 0.28 * 1.5 * u, stroke: "#d9b061", sw: 0.035 * u, fill: "#d9b061",
    });
  }
  ctx.restore();
}

