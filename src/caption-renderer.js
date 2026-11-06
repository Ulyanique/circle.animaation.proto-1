import { captionAccent, captionState, glyphReveal } from "./caption.js";
import { computePhase, introCaptionDelay } from "./timeline.js";
import { fieldCues, finaleCues } from "./scenes/cues.js";
import { finaleSequence } from "./finale-sequence.js";
import { cycleDuration } from "./runtime.js";
import { elementAnimation } from "./element-registry.js";

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const smooth = (a, b, x) => {
  const k = clamp01((x - a) / (b - a));
  return k * k * (3 - 2 * k);
};

/** Задержка заливки: контур успевает обрисоваться, затем буква заполняется. */
export function delayedFill(fill, delay) {
  const d = clamp01(delay ?? 0);
  return d > 0 ? smooth(d, 1, fill) : fill;
}

/** Те же графемы, что и в DOM; пробел остаётся пробелом. */
function segmentText(text) {
  const Segmenter = /** @type {any} */ (Intl).Segmenter;
  if (typeof Segmenter === "function") {
    return [...new Segmenter("ru", { granularity: "grapheme" }).segment(text)]
      .map((/** @type {any} */ part) => part.segment);
  }
  return Array.from(text);
}

/**
 * Чистое состояние титра для абсолютного времени: без DOM и без истории кадров.
 * @param {number} t
 * @param {any} cfg
 * @param {string} sceneId
 * @param {any} [options]
 */
export function captionFrameState(t, cfg, sceneId, options = {}) {
  const cap = cfg.caption || {};
  const W = options.width ?? 1920;
  const H = options.height ?? 1080;
  const u = W / 100;
  const displayWidth = options.displayWidth || W;
  const viewportHeight = options.viewportHeight || H;
  const scale = W / displayWidth;
  const family = cap.fontFamily || "Cormorant Garamond";
  const titleWeight = String(cap.fontWeight || "600");
  const strokeScale = (cap.outlineWidth ?? 0.08) / 0.08;
  const layers = Math.max(1, Math.round(cap.outlineLayers ?? 1));
  const offsetPx = (cap.outlineOffset ?? 0) * u;
  const fillDelay = clamp01(cap.fillDelay ?? 0);
  const penGlow = cap.penGlow ?? 1;
  const titleStroke = cfg.colors?.ringColor || "#e0b25a";
  const subStroke = "#d9b061";
  /** @type {any[]} */
  const lines = [];
  /** @type {any[]} */
  let rules = [];
  let drift = 0;

  if (sceneId === "waiting") {
    const state = captionState(t, cfg.timeline, introCaptionDelay(cfg));
    const k = smooth(0, 0.8, state.progress);
    drift = (1 - k) * viewportHeight * 0.008 * scale;
    const exiting = computePhase(t, cfg.timeline).name === "fade" ||
      computePhase(t, cfg.timeline).name === "rest";
    const defs = {
      title: {
        key: "title", text: cap.title || "Янтарный циркуль", y: 0.55 * H,
        size: 7.2 * u, weight: titleWeight, ls: 0, stroke: titleStroke,
        sw: 0.08 * u * strokeScale, paint: { type: "title" }, shadow: true,
      },
      subtitle: {
        key: "subtitle", text: (cap.subtitle || "").toUpperCase(), y: 0.72 * H,
        size: 2.4 * u, weight: "400", ls: 0.32 * 2.4 * u, stroke: subStroke,
        sw: 0.04 * u * strokeScale, paint: "#ecd08c", shadow: false,
      },
      date: {
        key: "date", text: (cap.date || "").toUpperCase(), y: 0.84 * H,
        size: 1.5 * u, weight: "400", ls: 0.28 * 1.5 * u, stroke: subStroke,
        sw: 0.035 * u * strokeScale, paint: "#d9b061", shadow: false,
      },
    };
    for (const key of ["title", "subtitle", "date"]) {
      const line = state.lines[key];
      if (!line) continue;
      const accent = captionAccent(key, line, exiting);
      lines.push({
        ...defs[key],
        outline: line.outline,
        fill: delayedFill(line.fill ?? 0, fillDelay),
        lift: accent.rise * u,
        pen: accent.pen * penGlow,
      });
    }
    const rule1 = state.lines.rule1 || { outline: 0 };
    const rule2 = state.lines.rule2 || { outline: 0 };
    rules = [
      { p: rule1.outline, y: 0.66 * H, lift: captionAccent("rule1", rule1, exiting).rise * u },
      { p: rule2.outline, y: 0.79 * H, lift: captionAccent("rule2", rule2, exiting).rise * u },
    ];
  } else if (sceneId === "brand" || sceneId === "photo-pause") {
    const cue = fieldCues(t, cfg.timeline.holdDuration);
    const outline = cue.titleOutline;
    lines.push({
      key: "title",
      text: cap.title || (sceneId === "brand" ? "Янтарный циркуль" : "Фотопауза"),
      y: 0.69 * H, size: (sceneId === "brand" ? 6.2 : 6.7) * u,
      weight: titleWeight, ls: 0, stroke: titleStroke, sw: 0.08 * u * strokeScale,
      paint: { type: "title" }, shadow: true,
      outline, fill: delayedFill(cue.titleFill, fillDelay),
      lift: (1 - outline) ** 2 * 0.72 * u,
      pen: 0.24 * Math.sin(Math.PI * outline) * penGlow,
    });
  } else if (sceneId === "finale") {
    const cue = finaleCues(t, cfg.timeline.holdDuration);
    const seq = finaleSequence(t, cfg);
    const erase = seq.captionErase;
    const titleOutline = cue.titleOutline;
    const phraseOutline = cue.phraseOutline;
    lines.push({
      key: "title", text: cap.title || "Янтарный циркуль", y: 0.55 * H,
      size: 6.6 * u, weight: titleWeight, ls: 0, stroke: titleStroke,
      sw: 0.08 * u * strokeScale, paint: { type: "title" }, shadow: true,
      outline: titleOutline, fill: delayedFill(cue.titleFill, fillDelay) * (1 - erase),
      erase, lift: (1 - titleOutline) ** 2 * 0.72 * u,
      pen: 0.24 * Math.sin(Math.PI * titleOutline) * penGlow * (1 - erase),
    });
    lines.push({
      key: "phrase", text: (cap.phrase || cap.subtitle || "").toUpperCase(), y: 0.71 * H,
      size: 2.55 * u, weight: "400", ls: 0.18 * 2.55 * u, stroke: subStroke,
      sw: 0.04 * u * strokeScale, paint: "#ecd08c", shadow: false,
      outline: phraseOutline, fill: delayedFill(cue.phraseFill, fillDelay) * (1 - erase),
      erase, lift: (1 - phraseOutline) ** 2 * 0.48 * u,
      pen: 0.24 * Math.sin(Math.PI * phraseOutline) * penGlow * (1 - erase),
    });
  }

  // Фаза 3a: строки титра читают тот же ElementRegistry, что и WebGL-объекты.
  const elements = cfg.elements || {};
  const cycle = sceneId === "waiting"
    ? Math.max(0.1, cycleDuration(cfg.timeline))
    : Math.max(0.1, cfg.timeline.holdDuration || cycleDuration(cfg.timeline));
  for (const line of lines) {
    const el = elements[line.key];
    if (!el) continue;
    const anim = elementAnimation(el, t, cycle);
    line.x = clamp01((el.x ?? 0.5) + anim.x);
    line.y = clamp01((el.y ?? line.y / H) + anim.y) * H;
    line.scale = (el.scale ?? 1) * anim.scale;
    line.rotation = (el.rotation ?? 0) + anim.rotation;
    line.opacity = anim.opacity;
    line.zIndex = el.zIndex ?? 0;
    line.color = el.color || "";
  }
  lines.sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));

  return { W, H, u, family, titleWeight, layers, offsetPx, strokeScale, penGlow, fillDelay, drift, lines, rules };
}

/** @param {CanvasRenderingContext2D} ctx @param {any} fill @param {number} y @param {number} size */
function makeFill(ctx, fill, y, size) {
  if (fill && typeof fill === "object" && fill.type === "title") {
    const g = ctx.createLinearGradient(0, y - size / 2, 0, y + size / 2);
    g.addColorStop(0, "#fff3cc");
    g.addColorStop(0.4, "#f0cc78");
    g.addColorStop(0.75, "#c08c36");
    g.addColorStop(1, "#e8c06a");
    return g;
  }
  return fill;
}

export class CaptionRenderer {
  /** @param {{width?: number, height?: number}} [options] */
  constructor(options = {}) {
    this.width = options.width ?? 1920;
    this.height = options.height ?? 1080;
  }

  /**
   * Рисует титр в любой 2D-контекст: live-оверлей или покадровый композит.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} t
   * @param {any} cfg
   * @param {string} sceneId
   * @param {number} [alpha]
   * @param {any} [options]
   */
  render(ctx, t, cfg, sceneId, alpha = 1, options = {}) {
    if (alpha <= 0.001) return;
    const state = captionFrameState(t, cfg, sceneId, {
      ...options, width: this.width, height: this.height,
    });
    const W = state.W, H = state.H, u = state.u;
    const font = (w, size) => `${w} ${size}px "${state.family}", Georgia, serif`;
    ctx.save();
    ctx.translate(0, state.drift);
    ctx.globalAlpha = alpha;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    /** @type {any} */ (ctx).letterSpacing = "0px";

    const drawRule = (rule) => {
      const p = rule.p;
      if (p <= 0.001) return;
      const y = rule.y + rule.lift;
      const half = 17 * u, gap = 1 * u, d = 0.9 * u;
      ctx.save();
      ctx.beginPath(); ctx.rect(W / 2 - half * p, 0, 2 * half * p, H); ctx.clip();
      const lg = ctx.createLinearGradient(W / 2 - half, 0, W / 2 + half, 0);
      lg.addColorStop(0, "rgba(217,176,97,0)");
      lg.addColorStop(0.5, "#d9b061");
      lg.addColorStop(1, "rgba(217,176,97,0)");
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

    const drawLine = (line) => {
      if (line.outline <= 0.001 && line.fill <= 0.001) return;
      const glyphs = segmentText(line.text);
      if (!glyphs.length) return;
      const y = line.y + line.lift;
      const cx = (line.x ?? 0.5) * W;
      ctx.save();
      ctx.globalAlpha *= line.opacity ?? 1;
      ctx.translate(cx, y);
      ctx.rotate(line.rotation ?? 0);
      ctx.scale(line.scale ?? 1, line.scale ?? 1);
      ctx.translate(-cx, -y);
      ctx.font = font(line.weight, line.size);
      /** @type {any} */ (ctx).letterSpacing = "0px";
      const widths = glyphs.map((glyph) => ctx.measureText(glyph).width);
      const total = widths.reduce((a, b) => a + b, 0) + line.ls * Math.max(0, glyphs.length - 1);
      let x = cx - total / 2 + line.ls / 2;
      ctx.textAlign = "left";
      ctx.strokeStyle = line.color || line.stroke;
      ctx.lineWidth = line.sw / (state.layers > 1 ? Math.sqrt(state.layers) : 1);
      ctx.lineJoin = "round";
      // №9: надписи стираются справа налево обратным контуром, а не просто гаснут.
      const erase = clamp01(line.erase ?? 0);
      const eraseClip = erase > 0.001;
      if (eraseClip) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, Math.max(0, W / 2 + total / 2 - erase * total), H);
        ctx.clip();
      }
      glyphs.forEach((glyph, i) => {
        const reveal = glyphReveal({ outline: line.outline, fill: line.fill }, i, glyphs.length);
        const width = widths[i];
        if (glyph !== " " && reveal.outline > 0.001) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(x - line.sw, 0, (width + line.sw * 2) * reveal.outline, H);
          ctx.clip();
          for (let layer = 0; layer < state.layers; layer++) {
            const shift = (layer - (state.layers - 1) / 2) * state.offsetPx;
            ctx.strokeText(glyph, x + shift, y + shift);
          }
          ctx.restore();
        }
        if (glyph !== " " && reveal.fill > 0.001) {
          ctx.save();
          ctx.beginPath(); ctx.rect(x, 0, width * reveal.fill, H); ctx.clip();
          if (line.shadow) {
            ctx.shadowColor = "rgba(0,0,0,0.7)";
            ctx.shadowBlur = 0.5 * u;
            ctx.shadowOffsetY = 0.2 * u;
          }
          const paint = line.color && typeof line.paint === "string" ? line.color : line.paint;
          ctx.fillStyle = makeFill(ctx, paint, y, line.size);
          ctx.fillText(glyph, x, y);
          ctx.restore();
        }
        const glowPower = Math.min(1, line.pen * Math.sin(Math.PI * reveal.outline));
        if (glyph !== " " && glowPower > 0.001) {
          const head = x + width * reveal.outline, spread = 0.225 * u;
          const glow = ctx.createLinearGradient(head - spread, 0, head + spread, 0);
          glow.addColorStop(0, "rgba(255,231,164,0)");
          glow.addColorStop(0.5, "rgba(255,231,164,0.55)");
          glow.addColorStop(1, "rgba(255,231,164,0)");
          ctx.save();
          ctx.globalAlpha *= glowPower;
          ctx.fillStyle = glow;
          ctx.fillRect(head - spread, y - line.size * 0.38, spread * 2, line.size * 0.8);
          ctx.restore();
        }
        x += width + line.ls;
      });
      if (eraseClip) ctx.restore();
      ctx.textAlign = "center";
      ctx.restore();
    };

    let rulesDrawn = false;
    for (const line of state.lines) {
      if (!rulesDrawn && line.key !== "title") {
        state.rules.forEach(drawRule);
        rulesDrawn = true;
      }
      drawLine(line);
    }
    if (!rulesDrawn) state.rules.forEach(drawRule);
    ctx.restore();
  }
}
