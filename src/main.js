import "./styles.css";
import "@fontsource/cormorant-garamond/cyrillic-400.css";
import "@fontsource/cormorant-garamond/cyrillic-600.css";
import "@fontsource/pt-serif/cyrillic-400.css";
import "@fontsource/pt-serif/cyrillic-700.css";
import "@fontsource/playfair-display/cyrillic-400.css";
import "@fontsource/playfair-display/cyrillic-600.css";
import "@fontsource/playfair-display/cyrillic-700.css";
import "@fontsource/montserrat/cyrillic-400.css";
import "@fontsource/montserrat/cyrillic-600.css";
import "@fontsource/montserrat/cyrillic-700.css";
import {
  loadProject, saveProject, mergeProject, projectToJSON, projectToURL,
  migrateLegacyProject, SETTINGS_VERSION,
} from "./config.js";
import { createEditor } from "./editor.js";
import { applyCaptionFont } from "./fonts.js";
import { CaptionRenderer } from "./caption-renderer.js";
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
const urlParams = new URLSearchParams(location.search);
const requestedScene = urlParams.get("scene") || "intro";
const editorRequested = urlParams.get("editor") === "1";
let sceneId = requestedScene === "intro" ? "waiting" : requestedScene;
let activeScene = sceneById(sceneId);
if (!activeScene?.defaults || activeScene.status !== "ready") {
  throw new Error(`Сцена «${sceneId}» пока не подготовлена`);
}
const project = loadProject();
project.activeScene = sceneId;
project.editor.enabled = Boolean(project.editor.enabled || editorRequested);
function configFor(id) { return project.scenes[id]; }
let cfg = configFor(sceneId);
let canvas = document.getElementById("stage");
let scene = null;
let runtime = null;
let settings = null;
let operator = null;
let editor = null;
let captionLayer = null;
let captionLayerCtx = null;
let captionRenderer = null;
const toastEl = document.getElementById("toast");
let toastTimer = 0;
function toast(msg, isError = false) {
  toastEl.textContent = msg;
  toastEl.classList.toggle("error", isError);
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2200);
}

function activateText(id) {
  const copy = project.scenes[id]?.caption;
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
  scene?.invalidateCaptionCache?.();
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
scene = new adapters[sceneId](canvas, cfg);
runtime = new AnimationRuntime(scene, cfg, OUTPUT.fps);

let lastFontKey = "";
function applyCaptionConfig() {
  const capEl = document.getElementById("caption");
  const caption = cfg.caption || {};
  const family = caption.fontFamily || "Cormorant Garamond";
  const weight = String(caption.fontWeight || "600");
  const stroke = caption.outlineWidth ?? 0.08;
  const strokeColor = cfg.colors?.ringColor || "#e0b25a";
  capEl?.style.setProperty("--cap-font", `"${family}", Georgia, serif`);
  capEl?.style.setProperty("--cap-weight", weight);
  capEl?.style.setProperty("--cap-stroke", String(stroke));
  capEl?.style.setProperty("--cap-stroke-color", strokeColor);
  capEl?.style.setProperty("--cap-pen", String(caption.penGlow ?? 1));
  if (capEl) capEl.dataset.fontFamily = family;
  activateText(sceneId);
  // Несколько линий контура в DOM: дополнительные тени без размытия.
  const layers = Math.max(1, Math.round(caption.outlineLayers ?? 1));
  const offset = caption.outlineOffset ?? 0;
  const u = parseFloat(capEl?.style.getPropertyValue("--u")) || 19.2;
  const shadows = [];
  if (layers > 1 && offset > 0) {
    for (let i = 0; i < layers; i++) {
      const shift = (i - (layers - 1) / 2) * offset * u;
      shadows.push(`${shift.toFixed(2)}px ${shift.toFixed(2)}px 0 ${strokeColor}`);
    }
  }
  const shadow = shadows.length ? shadows.join(", ") : "none";
  for (const el of document.querySelectorAll("#caption .cap-glyph")) el.style.textShadow = shadow;
  const key = [family, weight, caption.customFontName || "", caption.customFontDataUrl || ""].join("|");
  if (key !== lastFontKey) {
    lastFontKey = key;
    applyCaptionFont(cfg).catch((e) => console.warn("Не удалось применить шрифт", e));
  }
  drawLiveCaption();
}

/** Импорт JSON проекта без замены объектов сцен: ссылки scene.cfg остаются живыми. */
function applyProjectText(text, asDefaults = false) {
  const parsed = JSON.parse(text);
  if (parsed?.scenes && !(Number(parsed.settingsVersion) >= SETTINGS_VERSION)) {
    migrateLegacyProject(parsed, { force: true, preserve: true });
  }
  mergeProject(project, parsed);
  project.settingsVersion = SETTINGS_VERSION;
  cfg = project.scenes[sceneId];
  project.activeScene = sceneId;
  saveProject(project);
  scene?.setExternalConfig?.(cfg);
  applyCaptionConfig();
  scene?.applyStatic?.();
  runtime?.renderAt?.(runtime.time, 1 / OUTPUT.fps);
  drawLiveCaption();
  settings?.refresh?.();
  operator?.refresh?.();
  return asDefaults;
}

settings = createSettingsUI(project, {
  getActiveSceneId: () => sceneId,
  onSelectScene: (id) => switchScene(id),
  onProjectChange: () => {
    saveProject(project);
    applyCaptionConfig();
    scene?.applyStatic?.();
    runtime?.renderAt?.(runtime.time, 1 / OUTPUT.fps);
    drawLiveCaption();
    operator?.refresh?.();
    editor?.refresh?.();
  },
  onToggleEditor: () => editor?.toggle?.(),
  onImportProject: (text, asDefaults) => applyProjectText(text, asDefaults),
  onRenderWithConfig: () => startOfflineExport("single"),
  onPauseToggle: () => {
    cfg.playback.paused = !cfg.playback.paused;
    saveProject(project);
    operator?.refresh?.();
  },
  onToast: toast,
  onExportVideo: () => startOfflineExport("single"),
});

// Фаза 3a: DOM-оверлей конструктора живёт только в браузере и не попадает
// в покадровый compositeFrameAt / WebM. ?editor=1 открывает его сразу.
editor = createEditor({
  project,
  getActiveSceneId: () => sceneId,
  onProjectChange: () => {
    applyCaptionConfig();
    scene?.applyStatic?.();
    runtime?.renderAt?.(runtime.time, 1 / OUTPUT.fps);
    drawLiveCaption();
    operator?.refresh?.();
  },
  onToast: toast,
  enabled: editorRequested,
});
applyCaptionConfig();
scene.invalidateCaptionCache();
saveProject(project);

window.addEventListener("resize", () => { scene?.resize?.(); resizeCaptionLayer(); drawLiveCaption(); });

// презентация: F — полный экран
window.addEventListener("keydown", (e) => {
  if (e.code === "KeyF" && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.();
  }
});

let last = performance.now();
let recording = null; // один цикл текущей сцены, переключение на время записи заблокировано
operator = createOperatorControls({
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
    saveProject(project);
    settings?.refresh?.();
    runtime.renderAt(Math.min(runtime.time, tl.startDelay + runtime.cycle - 1 / OUTPUT.fps));
  },
  togglePause: () => {
    cfg.playback.paused = !cfg.playback.paused;
    saveProject(project);
  },
  switchScene: (id) => switchScene(id),
  record: () => startOfflineExport("single"),
  recordChain: () => startOfflineExport("chain"),
  cancelExport: () => recording?.kind === "offline" && recording.controller.abort(),
});

const REC_W = OUTPUT.width, REC_H = OUTPUT.height;
setupCaptionLayer();

// Типографика теперь рисуется одним CaptionRenderer для live-превью и WebM.
// DOM #caption остаётся скрытым семантическим зеркалом для проверок и доступности.
function captionOptions() {
  const capEl = document.getElementById("caption");
  return {
    displayWidth: parseFloat(capEl?.style.width) || REC_W,
    viewportHeight: window.innerHeight || REC_H,
  };
}

function setupCaptionLayer() {
  captionLayer = document.getElementById("caption-layer");
  if (!captionLayer) return;
  captionLayer.width = REC_W;
  captionLayer.height = REC_H;
  captionLayerCtx = captionLayer.getContext("2d");
  captionRenderer = new CaptionRenderer({ width: REC_W, height: REC_H });
  resizeCaptionLayer();
  drawLiveCaption();
}

function resizeCaptionLayer() {
  if (!captionLayer) return;
  const capEl = document.getElementById("caption");
  captionLayer.style.width = canvas.style.width || capEl?.style.width || `${REC_W}px`;
  captionLayer.style.height = canvas.style.height || capEl?.style.height || `${REC_H}px`;
}

function drawLiveCaption(t = runtime.time) {
  if (!captionLayerCtx || !captionRenderer) return;
  captionLayerCtx.clearRect(0, 0, REC_W, REC_H);
  captionRenderer.render(captionLayerCtx, t, cfg, sceneId, 1, captionOptions());
}

function drawCaption(ctx, alpha, t = runtime.time) {
  captionRenderer?.render(ctx, t, cfg, sceneId, alpha, captionOptions());
}

// Одна и та же сборка WebGL + типографики для MediaRecorder и контроля PNG.
function drawCompositeFrame(ctx, includeCaption = true, t = runtime.time) {
  ctx.drawImage(canvas, 0, 0, REC_W, REC_H);
  if (includeCaption) drawCaption(ctx, 1, t);
}

/** Тот же композит, что записывает MediaRecorder; includeCaption=false — эталон для теста. */
function compositeFrameAt(time, dt = 1 / OUTPUT.fps, includeCaption = true) {
  runtime.renderAt(time, dt);
  drawLiveCaption(time);
  const frame = document.createElement("canvas");
  frame.width = REC_W; frame.height = REC_H;
  drawCompositeFrame(frame.getContext("2d"), includeCaption, time);
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
  settings?.close?.();
  nextCanvas.id = "stage";
  oldCanvas.replaceWith(nextCanvas);
  canvas = nextCanvas;
  sceneId = id;
  activeScene = sceneById(id);
  cfg = nextCfg;
  project.activeScene = id;
  scene = nextScene;
  runtime = new AnimationRuntime(scene, cfg, OUTPUT.fps);
  activateClasses(id);
  activateText(id);
  applyCaptionConfig();
  settings?.setActiveScene?.(id);
  editor?.setActiveScene?.(id);
  saveProject(project);
  runtime.renderAt(cfg.timeline.startDelay, 1 / OUTPUT.fps);
  resizeCaptionLayer();
  drawLiveCaption();
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
  drawLiveCaption();
  // Не снимаем заставку загрузки до реального WebGL-кадра и готовых шрифтов.
  // Это также защищает титр от вспышки системного шрифта при медленном запуске.
  if (!firstFrameRendered) {
    firstFrameRendered = true;
    applyCaptionFont(cfg).catch(() => {}).then(() => { drawLiveCaption(); window.__bootReady?.(); });
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
  renderAt(v, dt = 1 / OUTPUT.fps) { runtime.renderAt(v, dt); drawLiveCaption(v); },
  compositeFrameAt,
  startRecording,
  startSequenceRecording,
  startOfflineExport,
  getSceneConfig: configFor, // технический API тестов: изменить тайминги без смены художественных defaults
  switchScene,
  operator,
  settings,
  editor,
  get project() { return project; },
  getProjectJSON: () => projectToJSON(project),
  applyProjectJSON: (text, asDefaults = false) => applyProjectText(text, asDefaults),
  getConfigURL: () => projectToURL(project),
  setCaptionFont: (family, weight = cfg.caption?.fontWeight || "600") => {
    cfg.caption.fontFamily = family;
    cfg.caption.fontWeight = String(weight);
    applyCaptionConfig();
    saveProject(project);
    runtime.renderAt(runtime.time, 1 / OUTPUT.fps);
    drawLiveCaption();
  },
  get activeScene() { return activeScene; },
  get runtime() { return runtime; },
  get cfg() { return cfg; },
  get scene() { return scene; },
  get captionRenderer() { return captionRenderer; },
};
