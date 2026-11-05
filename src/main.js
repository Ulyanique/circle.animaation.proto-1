import "./styles.css";
import "@fontsource/cormorant-garamond/cyrillic-400.css";
import "@fontsource/cormorant-garamond/cyrillic-600.css";
import { loadConfig, cloneDefaults, saveConfig } from "./config.js";
import { IntroScene } from "./intro-scene.js";
import { BrandScene } from "./brand-scene.js";
import { PhotoPauseScene } from "./photo-pause-scene.js";
import { FinaleScene } from "./finale-scene.js";
import { createSettingsUI } from "./ui.js";
import { AnimationRuntime, cycleDuration } from "./runtime.js";
import { OUTPUT, RECORDING_CHAIN, sceneById } from "./scenes/catalog.js";
import { glyphReveal } from "./caption.js";
import { createOperatorControls, crossedBoundary } from "./operator.js";
import { exportPlan, outgoingOpacity } from "./export-plan.js";

// Публичное имя первого ролика — intro. Старый ?scene=waiting сохраняем как
// совместимый адрес; внутри не переименовываем id настроек и плана экспорта.
const requestedScene = new URLSearchParams(location.search).get("scene") || "intro";
let sceneId = requestedScene === "intro" ? "waiting" : requestedScene;
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

const adapters = { waiting: IntroScene, brand: BrandScene,
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
  onExportVideo: () => { if (sceneId === "waiting") startOfflineExport("single"); },
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
  getState: () => ({ id: sceneId, time: runtime.time, config: cfg, cycle: runtime.cycle,
    recording: !!recording, recordingKind: recording?.kind,
    exportDone: recording?.kind === "offline" ? recording.done : 0,
    exportTotal: recording?.kind === "offline" ? recording.totalFrames : 0 }),
  seek: (value) => { cfg.playback.paused = true; runtime.renderAt(value, 1 / OUTPUT.fps); },
  setDuration: (value) => {
    const tl = cfg.timeline;
    const other = runtime.cycle - tl.holdDuration;
    // У второстепенных видов вход/обводка/обратный выход занимают 8 с.
    // Не даём укоротить цикл так, чтобы титр исчезал до появления.
    const minHold = sceneId === "finale" ? 16 : sceneId === "waiting" ? 1 : 11;
    tl.holdDuration = Math.max(minHold, Math.min(300, value - other));
    if (sceneId === "waiting") { saveConfig(cfg); settings.refresh(); }
    runtime.renderAt(Math.min(runtime.time, tl.startDelay + runtime.cycle - 1 / OUTPUT.fps));
  },
  togglePause: () => {
    cfg.playback.paused = !cfg.playback.paused;
    if (sceneId === "waiting") saveConfig(cfg);
  },
  switchScene: (id) => switchScene(id),
  record: () => startOfflineExport("single"),
  recordChain: () => startOfflineExport("chain"),
  cancelExport: () => recording?.kind === "offline" && recording.controller.abort(),
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
  const tSize = (brand ? 6.2 : photo ? 6.7 : finale ? 6.6 : 7.2) * u;
  const titleGrad = (y) => {
    const g = ctx.createLinearGradient(0, y - tSize / 2, 0, y + tSize / 2);
    g.addColorStop(0, "#fff3cc"); g.addColorStop(0.4, "#f0cc78");
    g.addColorStop(0.75, "#c08c36"); g.addColorStop(1, "#e8c06a");
    return g;
  };
  textLine(".cap-title", photo ? "Фотопауза" : "Янтарный циркуль", {
    y: (brand || photo ? 0.69 : 0.55) * H, centerX: W / 2,
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
const SEQUENCE_SWITCH = Symbol("sequence transition");
const OFFLINE_SWITCH = Symbol("offline render");
function switchScene(id, source) {
  if (id === sceneId) return true;
  const offline = source === OFFLINE_SWITCH && recording?.kind === "offline";
  if (!adapters[id] || (transition && !offline) ||
      (recording && !(offline || (source === SEQUENCE_SWITCH && recording.kind === "sequence")))) return false;
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
  let snapshot = null;
  if (!offline) {
    snapshot = document.createElement("canvas");
    snapshot.width = REC_W; snapshot.height = REC_H;
    snapshot.className = "transition-frame";
    snapshot.style.width = canvas.style.width;
    snapshot.style.height = canvas.style.height;
    drawCompositeFrame(snapshot.getContext("2d"));
    document.body.appendChild(snapshot);
  }
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
  url.searchParams.set("scene", id === "waiting" ? "intro" : id);
  history.replaceState(null, "", url);
  if (snapshot) {
    transition = snapshot;
    requestAnimationFrame(() => snapshot.classList.add("transition-out"));
    setTimeout(() => {
      snapshot.remove();
      if (transition === snapshot) transition = null;
    }, 1050);
  }
  operator.refresh();
  return true;
}

/** Основной экспорт: весь набор кадров k/60 кодируется независимо от RAF.
 * Прежние MediaRecorder-функции оставлены только как явная legacy-альтернатива. */
async function startOfflineExport(mode = "single", { download = true } = {}) {
  if (recording || transition) return false;
  if (mode !== "single" && mode !== "chain") throw new Error("Неизвестный режим экспорта");
  const ids = mode === "chain" ? [...RECORDING_CHAIN] : [sceneId];
  const plan = exportPlan(ids.map((id) => {
    const tl = configFor(id).timeline;
    return { id, cycle: cycleDuration(tl) / Math.max(0.01, tl.speed) };
  }), OUTPUT.fps);
  const original = { id: sceneId, time: runtime.time, paused: cfg.playback.paused };
  const controller = new AbortController();
  const job = { kind: "offline", controller, done: 0, totalFrames: plan.totalFrames };
  recording = job;
  operator.awaken();
  operator.refresh();
  window.__lastOfflineBlob = null;
  window.__offlineError = null;
  const stats = { plan, renderedFrames: 0, transitions: [], format: [REC_W, REC_H],
    fileSize: 0, cancelled: false };
  window.__offlineStats = stats;
  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = REC_W;
  exportCanvas.height = REC_H;
  const ctx = exportCanvas.getContext("2d");
  const outgoing = document.createElement("canvas");
  outgoing.width = REC_W;
  outgoing.height = REC_H;
  let part = 0;
  try {
    const { encodeOffline } = await import("./offline-encoder.js");
    if (sceneId !== ids[0] && !switchScene(ids[0], OFFLINE_SWITCH))
      throw new Error("Не удалось подготовить первый вид");
    const blob = await encodeOffline({
      canvas: exportCanvas, fps: OUTPUT.fps, totalFrames: plan.totalFrames,
      signal: controller.signal,
      renderFrame: (frame) => {
        while (part + 1 < plan.segments.length && frame >= plan.segments[part + 1].start) {
          // Запоминаем реальный последний композит WebGL + титр предыдущего вида.
          outgoing.getContext("2d").drawImage(exportCanvas, 0, 0);
          const from = ids[part];
          part++;
          if (!switchScene(ids[part], OFFLINE_SWITCH)) throw new Error("Не удалось переключить вид при экспорте");
          stats.transitions.push({ from, to: ids[part], startFrame: frame });
        }
        const local = frame - plan.segments[part].start;
        runtime.renderAt(cfg.timeline.startDelay + local * cfg.timeline.speed / OUTPUT.fps, 1 / OUTPUT.fps);
        drawCompositeFrame(ctx);
        if (part > 0 && local < plan.transitionFrames) {
          ctx.save();
          ctx.globalAlpha = outgoingOpacity(local, plan.transitionFrames);
          ctx.drawImage(outgoing, 0, 0, REC_W, REC_H);
          ctx.restore();
        }
        stats.renderedFrames = frame + 1;
      },
      onProgress: (done) => { job.done = done; operator.refresh(); },
    });
    stats.fileSize = blob.size;
    window.__lastOfflineBlob = blob;
    if (download) {
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${mode === "chain" ? "circle-01-02-08-09" : sceneId}-1920x1080-60fps.webm`;
      document.body.appendChild(link);
      link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 60000);
    }
    toast(`Готово: ${plan.totalFrames} кадров, 60 FPS, WebM`);
    return true;
  } catch (error) {
    stats.cancelled = controller.signal.aborted;
    window.__offlineError = error.message;
    toast(stats.cancelled ? "Покадровый экспорт отменён" : `Ошибка экспорта: ${error.message}`, !stats.cancelled);
    return false;
  } finally {
    // Не оставляем сцену в середине программы после отмены/ошибки.
    try {
      if (sceneId !== original.id) switchScene(original.id, OFFLINE_SWITCH);
      runtime.renderAt(original.time, 1 / OUTPUT.fps);
      cfg.playback.paused = original.paused;
    } finally {
      recording = null;
      operator.refresh();
    }
  }
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
  recording = { kind: "single", rec, ctx: rctx, start: tl.startDelay, cycle, t0: performance.now(), prevT: runtime.time };
  rec.start(250);
  toast(`Запись цикла ${cycle.toFixed(1)} с — не переключайте вкладку`);
}

/** Одна непрерывная MediaRecorder-сессия на четыре вида и три перехода. */
function startSequenceRecording({ download = true } = {}) {
  if (recording) return false;
  // Запись всегда начинается с первого кадра 01; с любого другого вида
  // сначала выполняется обычный плавный переход к нему.
  if (sceneId !== RECORDING_CHAIN[0]) {
    if (transition || !switchScene(RECORDING_CHAIN[0])) return false;
    const pending = transition;
    toast("Подготавливаем запись всей цепочки…");
    const waitForTransition = () => {
      if (transition === pending) { setTimeout(waitForTransition, 100); return; }
      if (sceneId === RECORDING_CHAIN[0] && !recording) startSequenceRecording({ download });
    };
    setTimeout(waitForTransition, 1100);
    return true;
  }
  if (transition) return false;
  if (typeof MediaRecorder === "undefined" || !HTMLCanvasElement.prototype.captureStream) {
    toast("Запись не поддерживается в этом браузере", true);
    return false;
  }
  const mime = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"]
    .find((m) => MediaRecorder.isTypeSupported(m)) || "video/webm";
  const canvasForVideo = document.createElement("canvas");
  canvasForVideo.width = REC_W;
  canvasForVideo.height = REC_H;
  const videoCtx = canvasForVideo.getContext("2d");
  const rec = new MediaRecorder(canvasForVideo.captureStream(OUTPUT.fps), {
    mimeType: mime, videoBitsPerSecond: 40000000,
  });
  const chunks = [];
  const stats = { scenes: [sceneId], transitions: [], frames: 0, blendedFrames: 0,
    resolution: [REC_W, REC_H], mime };
  window.__sequenceStats = stats;
  rec.ondataavailable = (e) => { if (e.data?.size) chunks.push(e.data); };
  rec.onstop = () => {
    const blob = new Blob(chunks, { type: mime });
    window.__lastSequenceBlob = blob;
    stats.bytes = blob.size;
    if (!blob.size) { toast("Запись не удалась: пустой файл", true); return; }
    if (download) {
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "circle-01-02-08-09-1920x1080.webm";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 60000);
    }
    toast("Вся цепочка сохранена одним WebM");
  };
  rec.onerror = (event) => {
    toast("Ошибка видеозаписи", true);
    if (recording?.rec === rec) recording = null;
  };
  cfg.playback.paused = false;
  runtime.renderAt(cfg.timeline.startDelay, 1 / OUTPUT.fps);
  recording = { kind: "sequence", rec, ctx: videoCtx, segment: 0,
    stageStarted: performance.now(), outgoing: null, transitionAt: 0, stats };
  rec.start(250);
  toast("Записываем 01 → 02 → 08 → 09; не переключайте вкладку");
  return true;
}

function finishSequenceRecording(seq) {
  if (recording !== seq) return;
  recording = null;
  cfg.playback.paused = true; // оставить финальный кадр для режиссёрской проверки
  if (seq.rec.state === "recording") {
    seq.rec.requestData();
    seq.rec.stop();
  }
  operator.refresh();
}

function renderSequenceFrame(now) {
  const seq = recording;
  const speed = Math.max(0.01, cfg.timeline.speed);
  const elapsed = Math.max(0, (now - seq.stageStarted) / 1000);
  const duration = runtime.cycle / speed;
  if (elapsed >= duration) {
    // Последний кадр сцены фиксируем перед швом; тот же полный композит
    // используется как исходная сторона кроссфейда и в экспортном WebM.
    runtime.renderAt(cfg.timeline.startDelay + runtime.cycle - 1 / OUTPUT.fps);
    if (seq.segment === RECORDING_CHAIN.length - 1) {
      drawCompositeFrame(seq.ctx);
      seq.stats.frames++;
      finishSequenceRecording(seq);
      return;
    }
    const from = sceneId;
    const to = RECORDING_CHAIN[seq.segment + 1];
    if (switchScene(to, SEQUENCE_SWITCH)) {
      seq.segment++;
      seq.stageStarted = performance.now();
      seq.transitionAt = seq.stageStarted;
      seq.outgoing = transition;
      seq.stats.scenes.push(to);
      seq.stats.transitions.push({ from, to, blendedFrames: 0 });
    }
    // Если браузер ещё показывает предыдущий переход, ждём его завершения;
    // переходы никогда не накладываются друг на друга и не пропускают вид.
  } else {
    const local = Math.min(runtime.cycle - 1 / OUTPUT.fps, elapsed * speed);
    runtime.renderAt(cfg.timeline.startDelay + local, 1 / OUTPUT.fps);
  }
  const fadeTime = seq.outgoing ? performance.now() : 0;
  drawCompositeFrame(seq.ctx);
  if (seq.outgoing) {
    const p = Math.min(1, Math.max(0, (fadeTime - seq.transitionAt) / 900));
    if (p >= 1) seq.outgoing = null;
    else {
      const eased = p * p * (3 - 2 * p);
      seq.ctx.save();
      seq.ctx.globalAlpha = 1 - eased;
      seq.ctx.drawImage(seq.outgoing, 0, 0, REC_W, REC_H);
      seq.ctx.restore();
      seq.stats.blendedFrames++;
      seq.stats.transitions.at(-1).blendedFrames++;
    }
  }
  seq.stats.frames++;
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
  if (recording?.kind === "offline") {
    // Покадровый экспорт сам вызывает renderAt(k/60): RAF не должен менять кадр.
  } else if (recording?.kind === "sequence") {
    renderSequenceFrame(now);
  } else if (recording?.kind === "single") {
    runtime.renderAt(recording.start + ((now - recording.t0) / 1000) * cfg.timeline.speed, renderDt);
  } else {
    runtime.advance(elapsed, renderDt);
    if (operator.auto && !cfg.playback.paused && !transition &&
        crossedBoundary(before, runtime.time, cfg.timeline.startDelay, runtime.cycle)) {
      switchScene(RECORDING_CHAIN[(RECORDING_CHAIN.indexOf(sceneId) + 1) % RECORDING_CHAIN.length]);
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
  if (recording?.kind === "single") {
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
  startSequenceRecording,
  startOfflineExport,
  getSceneConfig: configFor, // технический API тестов: изменить тайминги без смены художественных defaults
  switchScene,
  operator,
  get activeScene() { return activeScene; },
  get runtime() { return runtime; },
  get cfg() { return cfg; },
  get scene() { return scene; },
};
