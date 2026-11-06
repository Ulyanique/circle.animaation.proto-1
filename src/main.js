import "./styles.css";
import "./font-assets.js";
import { fontName, loadFonts } from "./fonts.js";
import { loadContourFonts } from "./contour-fonts.js";
import { parse as parseFont } from "opentype.js";
import { sources as contourSources } from "./contour-font-assets.js";
import { refreshContours } from "./contour-preview.js";
import {
  cloneDefaults, loadSceneConfig, saveSceneConfig, replaceConfig, mergeConfig, projectToJSON,
} from "./config.js";
import { LogoScene } from "./scene.js";
import { BrandScene } from "./brand-scene.js";
import { PhotoPauseScene } from "./photo-pause-scene.js";
import { FinaleScene } from "./finale-scene.js";
import { createSettingsUI } from "./ui.js";
import { AnimationRuntime } from "./runtime.js";
import { OUTPUT, RECORDING_CHAIN, sceneById } from "./scenes/catalog.js";
import { drawCaption } from "./caption-compositor.js";
import { createOperatorControls, crossedBoundary } from "./operator.js";

const requestedScene = new URLSearchParams(location.search).get("scene") || "intro";
let activeScene = sceneById(requestedScene);
if (!activeScene?.defaults || activeScene.status !== "ready") {
  throw new Error(`Сцена «${requestedScene}» пока не подготовлена`);
}
// "waiting" остаётся внутренним идентификатором для старых ссылок и настроек.
let sceneId = activeScene.id;
// Настройки каждой готовой сцены живут отдельно: в браузере свой ключ на сцену.
const READY_IDS = ["waiting", "brand", "photo-pause", "finale"];
const configs = new Map();
for (const id of READY_IDS) {
  configs.set(id, loadSceneConfig(id, sceneById(id).defaults));
}
function configFor(id) {
  id = sceneById(id)?.id || id;
  if (!configs.has(id)) configs.set(id, cloneDefaults(sceneById(id).defaults));
  return configs.get(id);
}
function saveScene(id = sceneId) {
  saveSceneConfig(sceneById(id)?.id || id, configFor(id));
}
/** Применить присланный JSON к сцене, не ломая ссылку, которую держит рендер. */
function applySceneConfig(id, next) {
  id = sceneById(id)?.id || id;
  // Присланный фрагмент накладывается на умолчания сцены: частичный JSON не ломает рендер.
  replaceConfig(configFor(id), mergeConfig(sceneById(id).defaults, next));
  saveScene(id);
  if (id === sceneId) { applyTypography(); runtime.renderAt(runtime.time, 1 / OUTPUT.fps); }
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
function applyTypography(force = false) {
  const cap = document.getElementById("caption");
  const font = cfg.typography?.font || "cormorant-garamond";
  const changed = cap.dataset.font !== font;
  cap.style.fontFamily = `"${fontName(font)}", Georgia, serif`;
  cap.dataset.font = font;
  if (changed || force || !cap.classList.contains("contours-ready")) refreshContours(font);
}
applyTypography();

const adapters = { waiting: LogoScene, brand: BrandScene,
  "photo-pause": PhotoPauseScene, finale: FinaleScene };
let scene = new adapters[sceneId](canvas, cfg);
let runtime = new AnimationRuntime(scene, cfg, OUTPUT.fps);
const settings = createSettingsUI({
  scenes: READY_IDS.map((id) => ({
    id,
    label: ({ waiting: "01", brand: "02", "photo-pause": "08", finale: "09" })[id],
    title: sceneById(id).title,
  })),
  getSceneId: () => sceneId,
  getConfig: (id) => configFor(id),
  getDefaults: (id) => sceneById(id).defaults,
  setScene: (id) => switchScene(id),
  onConfigChange: (id) => {
    saveScene(id);
    if (id === sceneId) { applyTypography(); runtime.renderAt(runtime.time, 1 / OUTPUT.fps); }
  },
  onApplyScene: (id, next) => applySceneConfig(id, next),
  onApplyProject: (scenes) => {
    for (const [id, next] of Object.entries(scenes)) applySceneConfig(id, next);
    settings.rebuild();
  },
  getProjectJSON: () => projectToJSON(
    Object.fromEntries(READY_IDS.map((id) => [id, configFor(id)])), READY_IDS),
  onPauseToggle: () => {
    cfg.playback.paused = !cfg.playback.paused;
    saveScene();
  },
  onToast: toast,
  onExportVideo: () => startRecording(),
});

window.addEventListener("resize", () => { scene.resize(); applyTypography(true); });

// презентация: F — полный экран
window.addEventListener("keydown", (e) => {
  if (e.code === "KeyF" && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.();
  }
});

let last = performance.now();
// Возврат из фоновой вкладки не должен перематывать анимацию на минуты вперёд.
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && !recording) last = performance.now();
});
let recording = null; // один цикл текущей сцены, переключение на время записи заблокировано
const operator = createOperatorControls({
  getState: () => ({ id: sceneId, time: runtime.time, config: cfg, cycle: runtime.cycle,
    recording: !!recording, recordingKind: recording?.kind }),
  seek: (value) => { cfg.playback.paused = true; runtime.renderAt(value, 1 / OUTPUT.fps); },
  setDuration: (value) => {
    const tl = cfg.timeline;
    const other = runtime.cycle - tl.holdDuration;
    // Для других видов вход/уход теперь тоже занимают время; сохраняем
    // не менее четырёх секунд фазы удержания и ограничение полного цикла.
    const minHold = sceneId === "waiting" ? 1 : 4;
    tl.holdDuration = Math.max(minHold, Math.min(300 - other, value - other));
    saveScene();
    settings.refresh();
    runtime.renderAt(Math.min(runtime.time, tl.startDelay + runtime.cycle - 1 / OUTPUT.fps));
  },
  togglePause: () => {
    cfg.playback.paused = !cfg.playback.paused;
    saveScene();
    settings.refresh();
  },
  switchScene: (id) => switchScene(id),
  record: () => startRecording(),
  recordChain: () => startSequenceRecording(),
});

const REC_W = OUTPUT.width, REC_H = OUTPUT.height;

// Одна и та же сборка WebGL + типографики для MediaRecorder и контроля PNG.
function drawCompositeFrame(ctx, includeCaption = true) {
  ctx.drawImage(canvas, 0, 0, REC_W, REC_H);
  const cap = document.getElementById("caption");
  const op = includeCaption && cap ? parseFloat(getComputedStyle(cap).opacity) : 0;
  if (op > 0.001) drawCaption(ctx, op, activeScene.id);
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
function switchScene(id, source) {
  id = sceneById(id)?.id || id;
  if (id === sceneId) return true;
  if (!adapters[id] || transition || (recording && !(source === SEQUENCE_SWITCH && recording.kind === "sequence"))) return false;
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
  applyTypography(true);
  runtime.renderAt(cfg.timeline.startDelay, 1 / OUTPUT.fps);
  oldScene.dispose();
  // Панель настроек остаётся открытой и переключается на настройки новой сцены.
  settings.syncScene();
  const url = new URL(location.href);
  url.searchParams.set("scene", id === "waiting" ? "intro" : id);
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
    a.download = `${activeScene.id === "waiting" ? "intro" : activeScene.id}-1920x1080.webm`;
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
let lastOperatorRefresh = 0;
function frame(now) {
  const elapsed = Math.max(0, (now - last) / 1000);
  const renderDt = Math.min(0.05, elapsed);
  last = now;
  const before = runtime.time;
  if (recording?.kind === "sequence") {
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
    const fonts = Promise.all([loadFonts(), loadContourFonts(contourSources, parseFont)]).catch((error) => console.warn("Не удалось загрузить контуры шрифтов", error));
    fonts.then(() => { applyTypography(true); window.__bootReady?.(); });
  }
  if (now - lastOperatorRefresh >= 120) {
    operator.refresh();
    lastOperatorRefresh = now;
  }
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
  getSceneConfig: configFor,
  saveScene,
  settings, // технический API тестов: изменить тайминги без смены художественных defaults
  switchScene,
  operator,
  get activeScene() { return activeScene; },
  get runtime() { return runtime; },
  get cfg() { return cfg; },
  get scene() { return scene; },
};
