import "./styles.css";
import "@fontsource/cormorant-garamond/cyrillic-400.css";
import "@fontsource/cormorant-garamond/cyrillic-600.css";
import { loadConfig, cloneDefaults, saveConfig } from "./config.js";
import { LogoScene } from "./scene.js";
import { BrandScene } from "./brand-scene.js";
import { PhotoPauseScene } from "./photo-pause-scene.js";
import { FinaleScene } from "./finale-scene.js";
import { createSettingsUI } from "./ui.js";
import { AnimationRuntime } from "./runtime.js";
import { OUTPUT, sceneById } from "./scenes/catalog.js";
import { glyphReveal } from "./caption.js";
import { createOperatorControls, crossedBoundary } from "./operator.js";

let sceneId = new URLSearchParams(location.search).get("scene") || "waiting";
let activeScene = sceneById(sceneId);
if (!activeScene?.defaults || activeScene.status !== "ready") {
  throw new Error(`Сцена «${sceneId}» пока не подготовлена`);
}
const configs = new Map();
configs.set("waiting", loadConfig(sceneById("waiting").defaults));
function configFor(id) {
  if (!configs.has(id)) configs.set(id, cloneDefaults(sceneById(id).defaults));
  return configs.get(id);
}
let cfg = configFor(sceneId);
let canvas = document.getElementById("stage");
const toastEl = document.getElementById("toast");
let toastTimer = 0;
function toast(msg, isError = false) {
  toastEl.textContent = msg;
  toastEl.classList.toggle("error", isError);
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2200);
}

const sceneCopy = {
  "photo-pause": { title: "Фотопауза" },
  finale: { title: "Янтарный циркуль", subtitle: "История продолжается" },
};
function activateText(id) {
  const copy = sceneCopy[id];
  for (const el of document.querySelectorAll("#caption [data-text]")) {
    const name = el.classList.contains("cap-title") ? "title" : el.classList.contains("cap-sub") ? "subtitle" : "date";
    const text = copy?.[name] ?? el.dataset.original;
    el.dataset.text = text;
    const letters = typeof Intl.Segmenter === "function"
      ? [...new Intl.Segmenter("ru", { granularity: "grapheme" }).segment(text)].map((part) => part.segment)
      : Array.from(text);
    el.replaceChildren(...letters.map((letter) => {
      const span = document.createElement("span");
      span.className = "cap-glyph";
      span.textContent = letter === " " ? "\u00a0" : letter;
      span.dataset.glyph = span.textContent;
      return span;
    }));
  }
}
for (const el of document.querySelectorAll("#caption [data-text]")) el.dataset.original = el.textContent;
function activateClasses(id) {
  for (const name of ["brand", "photo-pause", "finale"]) {
    document.body.classList.toggle(`scene-${name === "photo-pause" ? "photo" : name}`, id === name);
  }
  document.body.classList.toggle("scene-waiting", id === "waiting");
}
activateClasses(sceneId);
activateText(sceneId);

const adapters = { waiting: LogoScene, brand: BrandScene,
  "photo-pause": PhotoPauseScene, finale: FinaleScene };
let scene = new adapters[sceneId](canvas, cfg);
let runtime = new AnimationRuntime(scene, cfg, OUTPUT.fps);
const settings = createSettingsUI(configFor("waiting"), {
  onChange: () => {},
  onPauseToggle: () => {
    if (sceneId !== "waiting") return;
    cfg.playback.paused = !cfg.playback.paused;
    saveConfig(cfg);
  },
  onToast: toast,
  onExportVideo: () => { if (sceneId === "waiting") startRecording(); },
  isActive: () => sceneId === "waiting",
});

window.addEventListener("resize", () => scene.resize());

// презентация: F — полный экран
window.addEventListener("keydown", (e) => {
  if (e.code === "KeyF" && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.();
  }
});

let last = performance.now();
let recording = null; // один цикл текущей сцены, переключение на время записи заблокировано
const operator = createOperatorControls({
  getState: () => ({ id: sceneId, time: runtime.time, config: cfg, cycle: runtime.cycle, recording: !!recording }),
  seek: (value) => { cfg.playback.paused = true; runtime.renderAt(value, 1 / OUTPUT.fps); },
  setDuration: (value) => {
    const tl = cfg.timeline;
    const other = runtime.cycle - tl.holdDuration;
    const minHold = sceneId === "finale" ? 12 : sceneId === "waiting" ? 1 : 4;
    tl.holdDuration = Math.max(minHold, Math.min(300, value - other));
    if (sceneId === "waiting") { saveConfig(cfg); settings.refresh(); }
    runtime.renderAt(Math.min(runtime.time, tl.startDelay + runtime.cycle - 1 / OUTPUT.fps));
  },
  togglePause: () => {
    cfg.playback.paused = !cfg.playback.paused;
    if (sceneId === "waiting") saveConfig(cfg);
  },
  switchScene: (id) => switchScene(id),
  record: () => startRecording(),
});

const REC_W = OUTPUT.width, REC_H = OUTPUT.height;

// подпись на канвасе повторяет DOM-макет (--u = 1% ширины кадра) и ту же анимацию:
// прогресс обводки и заливки каждой строки читается из --p / --f на элементах #caption
function capVal(sel, name) {
  const el = document.querySelector(`#caption ${sel}`);
  return el ? parseFloat(getComputedStyle(el).getPropertyValue(name)) || 0 : 0;
}

function drawCaption(ctx, alpha) {
  const W = REC_W, H = REC_H, u = W / 100;
  const cap = document.getElementById("caption");
  const scale = W / (parseFloat(cap?.style.width) || W);
  const drift = parseFloat(cap?.style.getPropertyValue("--drift")) || 0;
  const font = (w, size) => `${w} ${size}px "Cormorant Garamond", Georgia, serif`;
  ctx.save();
  ctx.translate(0, drift * scale);
  ctx.globalAlpha = alpha;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Рендерим те же отдельные графемы, что и DOM: запись WebM не теряет
  // посимвольную обводку/заливку (HTML-оверлей в captureStream не попадает).
  const textLine = (sel, text, o) => {
    const line = { outline: capVal(sel, "--p"), fill: capVal(sel, "--f") };
    if (line.outline <= 0.001) return;
    const y = o.y + capVal(sel, "--lift") * scale;
    const glyphs = [...document.querySelectorAll(`#caption ${sel} .cap-glyph`)]
      .map((span) => span.textContent === "\u00a0" ? " " : span.textContent);
    ctx.font = font(o.weight, o.size);
    ctx.letterSpacing = "0px";
    const widths = glyphs.map((glyph) => ctx.measureText(glyph).width);
    const w = widths.reduce((a, b) => a + b, 0) + o.ls * Math.max(0, glyphs.length - 1);
    let x = (o.centerX ?? W / 2) - w / 2 + o.ls / 2; // то же центрирование, что padding-left в DOM
    ctx.textAlign = "left";
    ctx.strokeStyle = o.stroke; ctx.lineWidth = o.sw; ctx.lineJoin = "round";
    const pen = capVal(sel, "--pen");
    glyphs.forEach((glyph, i) => {
      const reveal = glyphReveal(line, i, glyphs.length);
      const width = widths[i];
      if (glyph !== " " && reveal.outline > 0.001) {
        ctx.save();
        ctx.beginPath(); ctx.rect(x - o.sw, 0, (width + o.sw * 2) * reveal.outline, H); ctx.clip();
        ctx.strokeText(glyph, x, y);
        ctx.restore();
      }
      if (glyph !== " " && reveal.fill > 0.001) {
        ctx.save();
        ctx.beginPath(); ctx.rect(x, 0, width * reveal.fill, H); ctx.clip();
        if (o.shadow) { ctx.shadowColor = "rgba(0,0,0,0.7)"; ctx.shadowBlur = 0.5 * u; ctx.shadowOffsetY = 0.2 * u; }
        ctx.fillStyle = typeof o.fill === "function" ? o.fill(y) : o.fill;
        ctx.fillText(glyph, x, y);
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
        ctx.fillRect(head - spread, y - o.size * 0.38, spread * 2, o.size * 0.8);
        ctx.restore();
      }
      x += width + o.ls;
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

  const brand = activeScene.id === "brand";
  const photo = activeScene.id === "photo-pause";
  const finale = activeScene.id === "finale";
  const tSize = (brand ? 5.7 : photo ? 6.7 : finale ? 6.6 : 7.2) * u;
  const titleGrad = (y) => {
    const g = ctx.createLinearGradient(0, y - tSize / 2, 0, y + tSize / 2);
    g.addColorStop(0, "#fff3cc"); g.addColorStop(0.4, "#f0cc78");
    g.addColorStop(0.75, "#c08c36"); g.addColorStop(1, "#e8c06a");
    return g;
  };
  textLine(".cap-title", photo ? "Фотопауза" : "Янтарный циркуль", {
    y: (brand ? 0.50 : photo ? 0.69 : 0.55) * H, centerX: brand ? 0.62 * W : W / 2,
    weight: 600, size: tSize, ls: 0, stroke: "#e0b25a", sw: 0.08 * u, shadow: true, fill: titleGrad,
  });
  if (finale) {
    textLine(".cap-sub", "ИСТОРИЯ ПРОДОЛЖАЕТСЯ", {
      y: 0.71 * H, weight: 400, size: 2.55 * u, ls: 0.18 * 2.55 * u,
      stroke: "#d9b061", sw: 0.04 * u, fill: "#ecd08c",
    });
  }
  if (!brand && !photo && !finale) {
    rule(".r1", 0.66 * H);
    rule(".r2", 0.79 * H);
    textLine(".cap-sub", "ВЕЧЕР РЕТРОСПЕКТИВА", {
      y: 0.72 * H, weight: 400, size: 2.4 * u, ls: 0.32 * 2.4 * u, stroke: "#d9b061", sw: 0.04 * u, fill: "#ecd08c",
    });
    textLine(".cap-date", "20 НОЯБРЯ 2026 ГОДА", {
      y: 0.84 * H, weight: 400, size: 1.5 * u, ls: 0.28 * 1.5 * u, stroke: "#d9b061", sw: 0.035 * u, fill: "#d9b061",
    });
  }
  ctx.restore();
}

// Одна и та же сборка WebGL + типографики для MediaRecorder и контроля PNG.
function drawCompositeFrame(ctx, includeCaption = true) {
  ctx.drawImage(canvas, 0, 0, REC_W, REC_H);
  const cap = document.getElementById("caption");
  const op = includeCaption && cap ? parseFloat(getComputedStyle(cap).opacity) : 0;
  if (op > 0.001) drawCaption(ctx, op);
}

/** Тот же композит, что записывает MediaRecorder; includeCaption=false — эталон для теста. */
function compositeFrameAt(time, dt = 1 / OUTPUT.fps, includeCaption = true) {
  runtime.renderAt(time, dt);
  const frame = document.createElement("canvas");
  frame.width = REC_W; frame.height = REC_H;
  drawCompositeFrame(frame.getContext("2d"), includeCaption);
  return frame;
}

// Склейка без перезагрузки: последний композит старого вида (WebGL + DOM-титры)
// мягко растворяется поверх первого кадра нового. Запись одного цикла не
// прерывается случайным переключением, а пульт не попадает в экспорт.
let transition = null;
function switchScene(id) {
  if (id === sceneId) return true;
  if (!adapters[id] || recording || transition) return false;
  const nextCfg = configFor(id);
  const nextCanvas = document.createElement("canvas");
  nextCanvas.setAttribute("aria-label", "Анимация логотипа");
  let nextScene;
  try {
    nextScene = new adapters[id](nextCanvas, nextCfg);
  } catch (error) {
    toast(`Не удалось открыть сцену: ${error.message}`, true);
    return false;
  }
  const snapshot = document.createElement("canvas");
  snapshot.width = REC_W; snapshot.height = REC_H;
  snapshot.className = "transition-frame";
  snapshot.style.width = canvas.style.width;
  snapshot.style.height = canvas.style.height;
  drawCompositeFrame(snapshot.getContext("2d"));
  document.body.appendChild(snapshot);
  const oldCanvas = canvas;
  const oldScene = scene;
  settings.close();
  nextCanvas.id = "stage";
  oldCanvas.replaceWith(nextCanvas);
  canvas = nextCanvas;
  sceneId = id;
  activeScene = sceneById(id);
  cfg = nextCfg;
  scene = nextScene;
  runtime = new AnimationRuntime(scene, cfg, OUTPUT.fps);
  activateClasses(id);
  activateText(id);
  runtime.renderAt(cfg.timeline.startDelay, 1 / OUTPUT.fps);
  oldScene.dispose();
  const url = new URL(location.href);
  url.searchParams.set("scene", id);
  history.replaceState(null, "", url);
  transition = snapshot;
  requestAnimationFrame(() => snapshot.classList.add("transition-out"));
  setTimeout(() => {
    snapshot.remove();
    if (transition === snapshot) transition = null;
  }, 1050);
  operator.refresh();
  return true;
}

function startRecording() {
  if (recording || transition) return;
  if (typeof MediaRecorder === "undefined" || !HTMLCanvasElement.prototype.captureStream) {
    toast("Запись не поддерживается в этом браузере", true);
    return;
  }
  const tl = cfg.timeline;
  const cycle = runtime.cycle;
  const mime = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"]
    .find((m) => MediaRecorder.isTypeSupported(m)) || "video/webm";
  const rc = document.createElement("canvas");
  rc.width = REC_W; rc.height = REC_H;
  const rctx = rc.getContext("2d");
  const chunks = [];
  const rec = new MediaRecorder(rc.captureStream(OUTPUT.fps), { mimeType: mime, videoBitsPerSecond: 40000000 });
  rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
  window.__recStats = { chunks };
  rec.onstop = () => {
    const blob = new Blob(chunks, { type: "video/webm" });
    window.__lastVideoBlob = blob;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${activeScene.id}-1920x1080.webm`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast("Видео сохранено (WebM)");
  };
  recording = { rec, ctx: rctx, start: tl.startDelay, cycle, t0: performance.now(), prevT: runtime.time };
  rec.start(250);
  toast(`Запись цикла ${cycle.toFixed(1)} с — не переключайте вкладку`);
}

function stopRecording() {
  const r = recording;
  recording = null;
  if (r.rec.state === "recording") r.rec.requestData();
  r.rec.stop();
  runtime.time = r.prevT;
}

let firstFrameRendered = false;
function frame(now) {
  const elapsed = Math.max(0, (now - last) / 1000);
  const renderDt = Math.min(0.05, elapsed);
  last = now;
  const before = runtime.time;
  if (recording) {
    runtime.renderAt(recording.start + ((now - recording.t0) / 1000) * cfg.timeline.speed, renderDt);
  } else {
    runtime.advance(elapsed, renderDt);
    if (operator.auto && !cfg.playback.paused && !transition &&
        crossedBoundary(before, runtime.time, cfg.timeline.startDelay, runtime.cycle)) {
      const order = ["waiting", "brand", "photo-pause", "finale"];
      switchScene(order[(order.indexOf(sceneId) + 1) % order.length]);
    }
  }
  // Не снимаем заставку загрузки до реального WebGL-кадра и готовых шрифтов.
  // Это также защищает титр от вспышки системного шрифта при медленном запуске.
  if (!firstFrameRendered) {
    firstFrameRendered = true;
    const fonts = document.fonts ? Promise.allSettled([
      document.fonts.load('600 72px "Cormorant Garamond"', 'Янтарный циркуль'),
      document.fonts.load('400 26px "Cormorant Garamond"', 'Вечер ретроспектива'),
    ]) : Promise.resolve();
    fonts.then(() => window.__bootReady?.());
  }
  operator.refresh();
  if (recording) {
    drawCompositeFrame(recording.ctx);
    if (runtime.time >= recording.start + recording.cycle) stopRecording();
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// для отладки из консоли: window.__logo.setTime(7.5)
window.__logo = {
  get time() { return runtime.time; },
  setTime(v) { runtime.time = v; },
  renderAt(v, dt = 1 / OUTPUT.fps) { runtime.renderAt(v, dt); },
  compositeFrameAt,
  startRecording,
  switchScene,
  operator,
  get activeScene() { return activeScene; },
  get runtime() { return runtime; },
  get cfg() { return cfg; },
  get scene() { return scene; },
};
