import "./styles.css";
import "./font-assets.js";
import { loadFabricTexture } from "./fabric-texture.js";
import { fontName, loadFonts } from "./fonts.js";
import { loadContourFonts, ensureContourFont, isContourFontLoaded } from "./contour-fonts.js";
import { parse as parseFont } from "opentype.js";
import { sources as contourSources } from "./contour-font-assets.js";
import { refreshContours } from "./contour-preview.js";
import { syncCaptionContent } from "./caption-content.js";
import { applyCaptionFit } from "./caption-fit.js";
import {
  cloneDefaults, loadSceneConfig, saveSceneConfigDetailed, replaceConfig, mergeConfig, projectToJSON,
} from "./config.js";
import { LogoScene } from "./scene.js";
import { BrandScene } from "./brand-scene.js";
import { PhotoPauseScene } from "./photo-pause-scene.js";
import { PartnersScene, loadPartnersBackground, preloadPartnerCustomLogos } from "./partners-scene.js";
import { SponsorScene } from "./sponsor-scene.js";
import { FinaleScene } from "./finale-scene.js";
import { createSettingsUI } from "./ui.js";
import { AnimationRuntime, cycleDuration } from "./runtime.js";
import { frameCount, estimateVideoBytes, videoBitrateFor } from "./video-math.js";
import { deliveryOption as deliveryOptionLight } from "./delivery-light.js";
import { masterSize, masterId, setMasterPreset, loadMasterPreset } from "./output-profile.js";
import { transitionDuration, drawOutgoingFrame } from "./scene-transition.js";
import { OUTPUT, sceneById } from "./scenes/catalog.js";
import { loadRecordingChain, saveRecordingChain, chainBaseFilename } from "./recording-chain.js";
import { decodeConfigShareHash } from "./scene-snapshots.js";
import { createOperatorControls, crossedBoundary } from "./operator.js";
import { movePhaseBoundary } from "./editor-timeline.js";
import { loadQuality, saveQuality } from "./quality-presets.js";
import { loadDelivery, saveDelivery } from "./delivery-light.js";
import { photoShutterSamples, shutterTimes } from "./photo-shutter.js";
import { layoutEditorPreview } from "./editor-layout.js";

// Профиль мастера читаем до создания сцены: рендерер сразу получает нужный размер.
loadMasterPreset();
const fabricReady = loadFabricTexture();
const partnersReady = loadPartnersBackground();

const requestedScene = new URLSearchParams(location.search).get("scene") || "intro";
let activeScene = sceneById(requestedScene);
if (!activeScene?.defaults || !["ready", "preview"].includes(activeScene.status)) {
  throw new Error(`Сцена «${requestedScene}» пока не подготовлена`);
}
// "waiting" остаётся внутренним идентификатором для старых ссылок и настроек.
let sceneId = activeScene.id;
// Настройки каждой готовой сцены живут отдельно: в браузере свой ключ на сцену.
// Заставки отдельных спонсоров — те же страницы программы, поэтому идут в общем
// списке: у каждой свой конфиг, своя кнопка и своя запись.
const READY_IDS = ["waiting", "brand", "partners", "sponsor-promrukav", "sponsor-keaz", "photo-pause", "finale"];
const configs = new Map();
const storageFailures = new Set();
for (const id of READY_IDS) {
  configs.set(id, loadSceneConfig(id, sceneById(id).defaults, failedId => storageFailures.add(failedId)));
}
// Если открыта ссылка вида ?scene=brand#cfg=<base64url>, накладываем патч на активную сцену
// только для текущего просмотра (без перезаписи localStorage пользователя).
const sharedRaw = new URLSearchParams(location.hash.replace(/^#/, "")).get("cfg") ||
  new URLSearchParams(location.search).get("cfg");
const sharedPatch = decodeConfigShareHash(sharedRaw);
if (sharedPatch) {
  configs.set(sceneId, mergeConfig(sceneById(sceneId).defaults, sharedPatch));
}
function configFor(id) {
  id = sceneById(id)?.id || id;
  if (!configs.has(id)) configs.set(id, cloneDefaults(sceneById(id).defaults));
  return configs.get(id);
}
function saveScene(id = sceneId) {
  id = sceneById(id)?.id || id;
  const result = saveSceneConfigDetailed(id, configFor(id));
  if (result.ok) storageFailures.delete(id);
  else { storageFailures.add(id); storageReason = result.reason; }
  updateStorageWarning();
}
/** Применить присланный JSON к сцене, не ломая ссылку, которую держит рендер. */
function applySceneConfig(id, next) {
  id = sceneById(id)?.id || id;
  // Импорт и сброс заменяют конфиг: старые команды редактора больше к нему неприменимы.
  if (id === sceneId) editor?.cancelDrag();
  editor?.clearHistory(id);
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
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), isError ? 10000 : 2200);
}

// Persistent warning: a toast can be overwritten by a later success message.
// Текст зависит от причины: при переполнении квоты нужно подсказать, что делать,
// а не ограничиваться «настройки не сохранились».
let storageReason = null;
const storageWarning = document.createElement("div");
storageWarning.className = "storage-warning";
storageWarning.setAttribute("role", "alert");
storageWarning.innerHTML = '<span></span> <button type="button">Скачать текущий проект JSON</button>';
const storageWarningText = storageWarning.querySelector("span");
const STORAGE_MESSAGES = {
  quota: "Не хватает места в хранилище браузера: настройки не сохраняются (обычно из-за загруженных логотипов). Уберите логотипы в разделах «Организаторы»/«Партнёры» или скачайте проект JSON — изменения потеряются после перезагрузки.",
  blocked: "Браузер запретил сохранение настроек (приватный режим или запрет хранилища сайта). Изменения потеряются после перезагрузки — скачайте проект JSON.",
  unknown: "Настройки не удалось прочитать или сохранить в браузере. Изменения могут потеряться после перезагрузки.",
};
function storageWarningMessage(reason) {
  return STORAGE_MESSAGES[reason] || STORAGE_MESSAGES.unknown;
}
storageWarning.querySelector("button").addEventListener("click", () => {
  const blob = new Blob([projectToJSON(Object.fromEntries(READY_IDS.map(id => [id, configFor(id)])), READY_IDS)], {type: "application/json"});
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob); link.download = "circle-scenes-backup.json";
  link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000);
});
document.body.appendChild(storageWarning);
function updateStorageWarning() {
  storageWarning.hidden = storageFailures.size === 0;
  if (!storageWarning.hidden) storageWarningText.textContent = storageWarningMessage(storageReason);
}
updateStorageWarning();

function activateClasses(id) {
  for (const name of ["brand", "partners", "photo-pause", "finale", "sponsor-promrukav", "sponsor-keaz"]) {
    document.body.classList.toggle(`scene-${name === "photo-pause" ? "photo" : name}`, id === name);
  }
  document.body.classList.toggle("scene-waiting", id === "waiting");
  // На заставках спонсора текст живёт в кадре: DOM-титр там не нужен.
  document.body.classList.toggle("scene-sponsor", id.startsWith("sponsor-"));
}
activateClasses(sceneId);
function activeFontIds(config = cfg) {
  const ids = [config?.typography?.font || "cormorant-garamond"];
  const tl = config?.textLayers;
  if (tl && typeof tl === "object") {
    for (let i = 1; i <= 8; i++) {
      if (tl[`text${i}Present`] && tl[`text${i}Font`]) ids.push(tl[`text${i}Font`]);
    }
  }
  return [...new Set(ids)];
}
function applyTypography(force = false) {
  const cap = document.getElementById("caption");
  const font = cfg.typography?.font || "cormorant-garamond";
  const sizes = ["title", "subtitle", "date"].map(name => cfg.caption?.[`${name}Scale`] ?? 1);
  const tracking = ["title", "subtitle", "date"].map(name => cfg.typography?.[`${name}Tracking`]);
  const textChanged = syncCaptionContent(cap, cfg.caption, cfg.textLayers);
  for (const [i, name] of ["title", "subtitle", "date"].entries()) {
    cap.style.setProperty(`--${name}-scale`, sizes[i]);
    const value = tracking[i];
    if (Number.isFinite(value)) cap.style.setProperty(`--${name}-tracking`, `${Math.max(0, Math.min(.6, value))}em`);
    else cap.style.removeProperty(`--${name}-tracking`);
  }
  cap.style.fontFamily = `"${fontName(font)}", Georgia, serif`;
  cap.dataset.font = font;
  const fitted = applyCaptionFit(cap, cfg.caption, cfg.textLayers);
  const signature = `${font}:${sizes.join(":")}:${tracking.join(":")}:${fitted.join(":")}`;
  const changed = cap.dataset.fontSignature !== signature;
  cap.dataset.fontSignature = signature;
  const needed = activeFontIds(cfg);
  if (needed.some(id => !isContourFontLoaded(id))) {
    ensureContourFont(needed).then(loaded => {
      if (loaded) {
        refreshContours(cfg.typography?.font || "cormorant-garamond");
        if (!recording) runtime.renderAt(runtime.time, 1 / OUTPUT.fps);
      }
    }).catch(() => {});
  }
  if (textChanged || changed || force || !cap.classList.contains("contours-ready")) refreshContours(font);
}
applyTypography();

const adapters = { waiting: LogoScene, brand: BrandScene,
  "partners": PartnersScene, "photo-pause": PhotoPauseScene, finale: FinaleScene,
  // Заставки спонсоров — один класс, знак берётся из своего конфига.
  "sponsor-promrukav": SponsorScene, "sponsor-keaz": SponsorScene };
let scene = new adapters[sceneId](canvas, cfg);
// Пресет качества запоминаем между запусками: на площадке важно не искать его
// заново. Значение по умолчанию — полный кадр превью.
scene.setQuality(loadQuality());
// Вариант доставки (кодек и глубина) — решение человека, не браузера: он
// влияет на то, что площадка сможет открыть. По умолчанию H.264.
let delivery = loadDelivery();
let activeChain = loadRecordingChain();
let runtime = new AnimationRuntime(scene, cfg, OUTPUT.fps);
scene.setCaptionSource(captionSourceFor(sceneId));
layoutEditorPreview(canvas, document.getElementById("caption"));
applyTypography(true); // теперь известны реальные размеры рамки после resize сцены
let editor;
const settings = createSettingsUI({
  scenes: READY_IDS.map((id) => ({
    id,
    label: ({ waiting: "01", brand: "02", partners: "04", "sponsor-promrukav": "05а", "sponsor-keaz": "05б", "photo-pause": "08", finale: "09" })[id],
    title: sceneById(id).title,
  })),
  getSceneId: () => sceneId,
  getConfig: (id) => configFor(id),
  getDefaults: (id) => sceneById(id).defaults,
  setScene: (id) => switchScene(id),
  onConfigChange: (id, section, key) => {
    editor?.invalidateHistory(id, section, key);
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
  getFrameSettings: () => ({ master: masterId(), quality: scene.quality, delivery }),
  onFrameSetting: (id, value) => {
    if (id === "master") return applyMaster(value);
    if (id === "quality") return applyQuality(value);
    if (id === "delivery") return applyDelivery(value);
    return false;
  },
});

window.addEventListener("resize", () => { layoutEditorPreview(canvas, document.getElementById("caption")); applyTypography(true); });

// презентация: F — полный экран
window.addEventListener("keydown", (e) => {
  if (e.code === "KeyF" && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement || e.target.isContentEditable)) {
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
    recording: !!recording, recordingKind: recording?.kind, master: masterId(), quality: scene.quality,
    delivery, chain: activeChain }),
  seek: (value) => { cfg.playback.paused = true; runtime.renderAt(value, 1 / OUTPUT.fps); },
  setBoundary: (edge, seconds) => {
    const minHold = sceneId === "waiting" ? 1 : 4;
    const next = movePhaseBoundary(cfg.timeline, edge, seconds, minHold);
    if (!next) return false;
    Object.assign(cfg.timeline, next);
    saveScene();
    settings.refresh();
    // Кадр пересобирается сразу: граница — монтажное решение, его надо видеть.
    runtime.renderAt(runtime.time, 1 / OUTPUT.fps);
    return true;
  },
  setDuration: (value) => {
    const tl = cfg.timeline;
    const other = runtime.cycle - tl.holdDuration;
    // Для других видов вход/уход теперь тоже занимают время; сохраняем
    // не менее четырёх секунд фазы удержания и ограничение полного цикла.
    const minHold = sceneId === "waiting" ? 1 : 4;
    editor?.invalidateHistory(sceneId, "timeline", "holdDuration");
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
  setMaster: (id) => applyMaster(id),
  setQuality: (id) => {
    if (recording || transition) { toast("Во время записи или перехода качество менять нельзя", true); return false; }
    scene.setQuality(id);
    saveQuality(scene.quality);
    runtime.renderAt(runtime.time, 1 / OUTPUT.fps);
    operator.refresh();
    return true;
  },
  setDelivery: (id) => {
    if (recording || transition) { toast("Во время записи или перехода вариант файла менять нельзя", true); return false; }
    if (delivery === id) return true;
    if (!saveDelivery(id)) return false;
    delivery = id;
    operator.refresh();
    return true;
  },
  setChain: (list) => {
    if (recording || transition) return false;
    activeChain = saveRecordingChain(list);
    return true;
  },
  record: () => startRecording(),
  recordChain: () => startSequenceRecording(),
});

// Редактор не нужен первому кадру: его модуль раньше разбирался вместе с
// main.js и задерживал старт заставки. Теперь чанк editor.js приходит после
// первого кадра, а все точки обращения до готовности терпят отсутствие
// редактора через editor?.; editorReady() ждёт чанк явно (технический API).
let editorPromise = null;
function editorReady() {
  if (!editorPromise) {
    editorPromise = import("./editor.js").then(({ createFrameEditor }) => {
      editor = createFrameEditor({
        getState: () => ({ id: sceneId, time: runtime.time, scene, canvas, config: cfg, defaults: activeScene.defaults }),
        onEnable: () => {
          if (sceneId === "partners") { toast("Имена в этой сцене меняются в настройках; визуальный редактор слоёв здесь пока недоступен.", true); return false; }
          if (recording || transition) { toast("Во время записи или перехода редактирование недоступно", true); return false; }
          cfg.playback.paused = true;
          const tl = cfg.timeline;
          // Показываем собранную композицию, чтобы элементы можно было взять мышью.
          runtime.renderAt(tl.startDelay + tl.drawDuration + tl.emergeDuration + tl.holdDuration / 2);
          saveScene(); settings.refresh(); operator.refresh();
          return true;
        },
        onChange: () => { applyTypography(); saveScene(); settings.refresh(); },
        onSeek: (time) => {
          if (recording || transition) return;
          const wasPaused = cfg.playback.paused;
          cfg.playback.paused = true; runtime.renderAt(time, 1 / OUTPUT.fps);
          if (!wasPaused) saveScene();
          settings.refresh(); operator.refresh();
        },
        onLayoutChange: (kind) => { layoutEditorPreview(canvas, document.getElementById("caption")); if (kind !== "pan") applyTypography(true); },
        onSettings: (section) => settings.openSection(section),
      onHistoryConflict: () => toast("Настройка изменилась вне редактора; история сцены очищена", true),
      });
      return editor;
    });
  }
  return editorPromise;
}

// Размер мастер-кадра. Композитор титров и экспорт читают его же, а не OUTPUT.
let REC_W = masterSize().width, REC_H = masterSize().height;
function syncMasterSize() {
  const size = masterSize();
  REC_W = size.width; REC_H = size.height;
}

// Титр рисуется внутри сцены (см. CaptionLayer), поэтому композит — это кадр
// WebGL целиком: превью и экспорт совпадают пиксель в пиксель.
function captionSourceFor(id) {
  return () => {
    // «Спонсоры» и заставки спонсоров собирают текст в кадре: DOM-титра нет.
    if (id === "partners" || id.startsWith("sponsor-") || !document.getElementById("caption")) return null;
    return { sceneId: id, alpha: 1 };
  };
}

function drawCompositeFrame(ctx) {
  ctx.drawImage(canvas, 0, 0, ctx.canvas.width, ctx.canvas.height);
}

// Переход в предпросмотре — прозрачный оверлей поверх кадра нового вида.
// Показ считается тем же drawOutgoingFrame, что и экспорт: CSS-растворение
// гасило всё содержимое разом и давало серую муть, а кроме того расход
// времени в CSS и в кадрах видео не совпадал.
let previewTransition = null;
let transitionOverlay = null;
// Оверлей обязан вставать ровно на кадр сцены: те же left/top/размер/обрезка,
// что у #stage. Иначе на изменённом масштабе переход «съезжает» с кадра.
function syncTransitionOverlay() {
  if (!transitionOverlay) return;
  const to = transitionOverlay.style;
  const from = canvas.style;
  if (to.left !== from.left) to.left = from.left;
  if (to.top !== from.top) to.top = from.top;
  if (to.width !== from.width) to.width = from.width;
  if (to.height !== from.height) to.height = from.height;
  if (to.clipPath !== from.clipPath) to.clipPath = from.clipPath;
}
function overlayCtx() {
  return transitionOverlay ? transitionOverlay.getContext("2d") : null;
}
function drawPreviewTransition(ctx) {
  if (!ctx) return;
  if (!previewTransition) return;
  syncTransitionOverlay();
  const elapsed = (performance.now() - previewTransition.startedAt) / 1000;
  const done = elapsed / previewTransition.duration >= 1;
  if (done || !drawOutgoingFrame(ctx, previewTransition.snapshot, elapsed * OUTPUT.fps,
    OUTPUT.fps, previewTransition.duration, ctx.canvas.width, ctx.canvas.height)) {
    previewTransition = null;
    transition = null;
    if (transitionOverlay) { transitionOverlay.hidden = true; transitionOverlay.style.display = "none"; }
  }
}

/** Тот же композит, что записывается в видео; includeCaption=false — эталон для теста. */
function compositeFrameAt(time, dt = 1 / OUTPUT.fps, includeCaption = true) {
  scene.setCaptionVisible(includeCaption);
  // В редакторе DOM-титр остаётся видимым для рамок, но кадр всё равно
  // собирается с запечённым в WebGL текстом — так экспорт не теряет надпись.
  scene.setCaptionOverride(true);
  try {
    runtime.renderAt(time, dt);
    const frame = document.createElement("canvas");
    frame.width = REC_W; frame.height = REC_H;
    drawCompositeFrame(frame.getContext("2d"));
    return frame;
  } finally {
    scene.setCaptionVisible(true);
    scene.setCaptionOverride(false);
  }
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
  editor?.disable();
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
  const duration = transitionDuration(nextCfg);
  let snapshot = null;
  if (duration > 0) {
    // Тот же композит, что уходит в видео, и уже с титром: иначе на переходе
    // подпись старой сцены исчезала бы раньше картинки.
    snapshot = compositeFrameAt(runtime.time, 1 / OUTPUT.fps, true);
  }
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
  scene.setCaptionSource(captionSourceFor(id));
  activateClasses(id);
  layoutEditorPreview(canvas, document.getElementById("caption"));
  applyTypography(true);
  runtime.renderAt(cfg.timeline.startDelay, 1 / OUTPUT.fps);
  oldScene.dispose();
  // Панель настроек остаётся открытой и переключается на настройки новой сцены.
  settings.syncScene();
  const url = new URL(location.href);
  url.searchParams.set("scene", id === "waiting" ? "intro" : id);
  history.replaceState(null, "", url);
  if (source === SEQUENCE_SWITCH) {
    recording.outgoing = snapshot;
  } else if (snapshot) {
    // Оверлей живёт до конца перехода; снимает его сам цикл кадров.
    transition = snapshot;
    if (!transitionOverlay) {
      transitionOverlay = document.createElement("canvas");
      transitionOverlay.className = "transition-overlay";
      transitionOverlay.width = REC_W; transitionOverlay.height = REC_H;
      document.body.appendChild(transitionOverlay);
    }
    if (transitionOverlay.width !== REC_W || transitionOverlay.height !== REC_H) {
      transitionOverlay.width = REC_W; transitionOverlay.height = REC_H;
    }
    transitionOverlay.hidden = false;
    transitionOverlay.style.display = "block";
    syncTransitionOverlay();
    previewTransition = { snapshot, duration, startedAt: performance.now() };
    // Первый кадр перехода рисуем сразу: иначе до следующего тика цикла на
    // экране виден чистый оверлей (прозрачный) и переход «моргает».
    drawPreviewTransition(overlayCtx());
  }
  operator.refresh();
  return true;
}

/**
 * Качество просмотра. Влияет только на сглаживание и дизеринг кадра, поэтому
 * запрещено лишь на время записи и перехода — иначе кадр в файле разъедется.
 */
function applyQuality(id) {
  if (recording || transition) return false;
  scene.setQuality(id);
  saveQuality(scene.quality);
  runtime.renderAt(runtime.time, 1 / OUTPUT.fps);
  return true;
}

/** Кодек и глубина записи: решение человека, оно влияет на совместимость файла. */
function applyDelivery(id) {
  if (recording || transition) return false;
  if (delivery === id) return true;
  if (!saveDelivery(id)) return false;
  delivery = id;
  return true;
}

/**
 * Переключение мастер-разрешения. Композиция задана в долях кадра, поэтому
 * меняется только пиксельная сетка: рендерер, композитор, титры и экспорт.
 */
function applyMaster(id) {
  if (recording || transition) { toast("Во время записи или перехода формат менять нельзя", true); return false; }
  if (!setMasterPreset(id)) return false;
  syncMasterSize();
  scene.resize();
  applyTypography(true);
  runtime.renderAt(runtime.time, 1 / OUTPUT.fps);
  return true;
}

// The export owns the renderer until it has completed or has been cancelled.
function exportOverlay(job, estimatedMiB) {
  const overlay = document.createElement("div");
  overlay.className = "export-overlay";
  overlay.innerHTML = '<div class="export-dialog" role="status" aria-live="polite"><strong>Покадровый экспорт</strong><p>Подготовка…</p><small></small><progress max="100" value="0"></progress><button type="button">Отменить</button></div>';
  const inert = [...document.body.children].filter(el => el !== canvas && el.id !== "caption" && el.id !== "toast").map(el => [el, el.inert]);
  for (const [el] of inert) el.inert = true;
  document.body.appendChild(overlay);
  overlay.querySelector("small").textContent = `Ориентировочный размер MP4: ${estimatedMiB} МиБ. Памяти браузеру потребуется больше; фактический размер может отличаться.`;
  const button = overlay.querySelector("button");
  button.addEventListener("click", () => { job.cancelled = true; button.disabled = true; button.textContent = "Отмена…"; });
  const blockKeys = event => { if (event.key !== "Tab") event.stopImmediatePropagation(); };
  window.addEventListener("keydown", blockKeys, true);
  button.focus();
  return {
    progress(done, total) {
      const percent = Math.floor(done * 100 / total);
      overlay.querySelector("p").textContent = `Кадр ${done} из ${total} · ${percent}%`;
      overlay.querySelector("progress").value = percent;
    },
    remove() {
      window.removeEventListener("keydown", blockKeys, true);
      for (const [el, previous] of inert) el.inert = previous;
      overlay.remove();
    },
  };
}
function saveVideo(blob, filename) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob); link.download = filename;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 60000);
}
function startRecording({ download = true } = {}) {
  return startOfflineRecording("single", download);
}
function startSequenceRecording({ download = true } = {}) {
  return startOfflineRecording("sequence", download);
}
function startOfflineRecording(kind, download) {
  if (recording || transition) return false;
  let estimatedMiB;
  try {
    const ids = kind === "sequence" ? activeChain : [sceneId];
    const frames = ids.reduce((sum, id) => {
      const timeline = configFor(id).timeline;
      return sum + frameCount(cycleDuration(timeline), timeline.speed, OUTPUT.fps);
    }, 0);
    const bitrate = deliveryOptionLight(delivery).bitrateScale * videoBitrateFor(REC_W, REC_H);
    estimatedMiB = Math.ceil(estimateVideoBytes(frames, OUTPUT.fps, bitrate) / 1024 ** 2);
  } catch (error) { toast(`Ошибка экспорта: ${error.message}`, true); return false; }
  if (download && estimatedMiB >= 256 && !confirm(`Ориентировочный размер MP4 — ${estimatedMiB} МиБ. Видео собирается в памяти браузера; потребуется больше памяти, а итоговый размер может отличаться. Продолжить?`)) return false;
  editor?.disable();
  const job = { kind, cancelled:false, outgoing:null };
  recording = job;
  const overlay = exportOverlay(job, estimatedMiB);
  operator.refresh();
  runOfflineRecording(job, overlay, download).catch(error => console.error("Ошибка экспорта", error));
  return true;
}
async function runOfflineRecording(job, overlay, download) {
  const initialTime = runtime.time;
  const initialScene = sceneId;
  let completed = false;
  const option = deliveryOption(delivery);
  const stats = { scenes: [], transitions: [], frames: 0, blendedFrames: 0,
    resolution: [REC_W, REC_H], delivery: option.id, bitDepth: option.bitDepth,
    mime: option.container === "webm" ? "video/webm" : "video/mp4" };
  if (job.kind === "sequence") { window.__sequenceStats = stats; window.__lastSequenceBlob = null; }
  else { window.__recStats = stats; window.__lastVideoBlob = null; }
  try {
    const ids = job.kind === "sequence" ? activeChain : [sceneId];
    const exportFonts = [...new Set(ids.flatMap(id => activeFontIds(configFor(id))))];
    await Promise.all([
      fabricReady,
      partnersReady,
      ensureContourFont(exportFonts),
      ids.includes("partners") ? preloadPartnerCustomLogos(configFor("partners").partners) : null,
    ]); // ассеты не меняются в середине записи
    const segments = ids.map(id => {
      const sceneConfig = configFor(id);
      const timeline = sceneConfig.timeline;
      return { id, start:timeline.startDelay, speed:timeline.speed, transition:transitionDuration(sceneConfig),
        count:frameCount(cycleDuration(timeline), timeline.speed, OUTPUT.fps) };
    });
    const total = segments.reduce((sum, segment) => sum + segment.count, 0);
    const videoCanvas = document.createElement("canvas");
    videoCanvas.width = REC_W; videoCanvas.height = REC_H;
    // 10 бит требуют чтения пикселей в JS: без willReadFrequently каждый кадр
    // заставляет браузер выгружать полотно с GPU, и запись идёт в разы дольше.
    const ctx = videoCanvas.getContext("2d", option.bitDepth === 10 ? { willReadFrequently: true } : undefined);
    if (!ctx) throw new Error("Не удалось создать кадр для экспорта");
    let blurCanvas = null, blurCtx = null;
    let segmentIndex = -1, segmentStart = 0;
    const { encodeOfflineVideo } = await import("./offline-video.js");
    const result = await encodeOfflineVideo({canvas:videoCanvas, fps:OUTPUT.fps, total,
      bitrate:videoBitrateFor(REC_W, REC_H), delivery:option.id,
      cancelled:() => job.cancelled,
      progress:(done, count) => overlay.progress(done, count),
      draw(index) {
        if (segmentIndex < 0 || index >= segmentStart + segments[segmentIndex].count) {
          if (segmentIndex >= 0) segmentStart += segments[segmentIndex].count;
          const from = sceneId;
          segmentIndex++;
          const next = segments[segmentIndex];
          if (sceneId !== next.id && !switchScene(next.id, SEQUENCE_SWITCH))
            throw new Error(`Не удалось открыть сцену ${next.id}`);
          if (segmentIndex === 0) job.outgoing = null;
          else stats.transitions.push({from, to:next.id, duration:next.transition, blendedFrames:0});
          stats.scenes.push(next.id);
        }
        const segment = segments[segmentIndex];
        const localIndex = index - segmentStart;
        const frameTime = segment.start + localIndex * segment.speed / OUTPUT.fps;
        // Затвор: только вращение кольцевой надписи в «Фотопаузе». Один кадр —
        // один рендер в остальных сценах, поэтому стоимость не меняется.
        const shutter = photoShutterSamples(configFor(segment.id), { id: segment.id, fps: OUTPUT.fps, speed: segment.speed });
        if (shutter <= 1) {
          runtime.renderAt(frameTime, 1 / OUTPUT.fps);
          drawCompositeFrame(ctx);
        } else {
          const times = shutterTimes(frameTime, segment.speed / OUTPUT.fps, shutter);
          if (!blurCanvas || blurCanvas.width !== REC_W || blurCanvas.height !== REC_H) {
            blurCanvas = document.createElement("canvas");
            blurCanvas.width = REC_W; blurCanvas.height = REC_H;
            blurCtx = blurCanvas.getContext("2d");
          }
          ctx.clearRect(0, 0, REC_W, REC_H);
          for (let s = 0; s < times.length; s++) {
            runtime.renderAt(times[s], 1 / OUTPUT.fps);
            blurCtx.clearRect(0, 0, REC_W, REC_H);
            blurCtx.drawImage(canvas, 0, 0, REC_W, REC_H);
            ctx.globalAlpha = 1 / (s + 1);
            ctx.drawImage(blurCanvas, 0, 0);
          }
          // Возвращаем время кадра: дальше по циклу время считается заново, но
          // пауза/переходы не должны увидеть последнюю выборку затвора.
          runtime.renderAt(frameTime, 1 / OUTPUT.fps);
          ctx.globalAlpha = 1;
        }
        if (job.outgoing) {
          if (!drawOutgoingFrame(ctx, job.outgoing, localIndex, OUTPUT.fps, segment.transition, REC_W, REC_H)) job.outgoing = null;
          else {
            stats.blendedFrames++; stats.transitions.at(-1).blendedFrames++;
          }
        }
        stats.frames++;
      },
    });
    stats.bytes = result.blob.size; stats.codec = result.codec; stats.expectedFrames = total;
    if (job.kind === "sequence") window.__lastSequenceBlob = result.blob;
    else window.__lastVideoBlob = result.blob;
    // Имя файла берёт фактический размер записи: 4K-мастер не должен
    // сохраняться как «1920x1080».
    if (download) saveVideo(result.blob, deliveryFilename(
      job.kind === "sequence" ? chainBaseFilename(ids) : initialScene === "waiting" ? "intro" : initialScene,
      option, REC_W, REC_H));
    completed = true;
    // Формат называем честно: WebM не откроется там, где ждут MP4.
    const name = option.container === "webm" ? `${option.bitDepth}-битный WebM` : `${option.bitDepth}-битный MP4`;
    toast(job.kind === "sequence" ? `Вся цепочка сохранена (${name})` : `Видео сохранено (${name})`);
  } catch (error) {
    stats.error = error.message;
    toast(error.name === "AbortError" ? "Экспорт отменён" : `Ошибка экспорта: ${error.message}`, error.name !== "AbortError");
    if (error.name !== "AbortError") console.error("Ошибка экспорта", error);
  } finally {
    recording = null;
    try {
      if (job.kind === "single") runtime.renderAt(initialTime, 1 / OUTPUT.fps);
      else if (completed) cfg.playback.paused = true;
    } finally {
      last = performance.now();
      overlay.remove(); settings.refresh(); operator.refresh();
    }
  }
}

let firstFrameRendered = false;
let lastOperatorRefresh = 0;
function frame(now) {
  const elapsed = Math.max(0, (now - last) / 1000);
  const renderDt = Math.min(0.05, elapsed);
  last = now;
  const before = runtime.time;
  if (!recording) {
    runtime.advance(elapsed, renderDt);
    if (previewTransition) drawPreviewTransition(overlayCtx());
    if (operator.auto && !cfg.playback.paused && !transition &&
        crossedBoundary(before, runtime.time, cfg.timeline.startDelay, runtime.cycle)) {
      const idx = activeChain.indexOf(sceneId);
      switchScene(activeChain[(idx + 1) % activeChain.length]);
    }
  }
  // Не снимаем заставку загрузки до реального WebGL-кадра и готовых шрифтов.
  // Это также защищает титр от вспышки системного шрифта при медленном запуске.
  if (!firstFrameRendered) {
    firstFrameRendered = true;
    const initialFonts = [...new Set(READY_IDS.flatMap(id => activeFontIds(configFor(id))))];
    const fonts = Promise.all([loadFonts(), loadContourFonts(contourSources, parseFont, initialFonts)]).catch((error) => console.warn("Не удалось загрузить контуры шрифтов", error));
    Promise.all([fonts, fabricReady, partnersReady]).then(([, fabricLoaded, partnersLoaded]) => {
      applyTypography(true); scene.refreshTextTexture?.();
      if (!recording) runtime.renderAt(runtime.time, 1 / OUTPUT.fps);
      window.__bootReady?.();
      // Панель редактора догружается после первого кадра, не задерживая старт.
      editorReady();
      if (!partnersLoaded && sceneId === "partners") toast("Не все изображения спонсоров загрузились; возможны текстовые замены", true);
      if (!fabricLoaded) toast("Текстура камня не загрузилась; используется упрощённый фон", true);
      // Остальные шрифты подгружаем в простое, чтобы переключение в настройках было мгновенным.
      const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 250));
      idle(() => ensureContourFont(Object.keys(contourSources)).catch(() => {}));
    });
  }
  editor?.refresh();
  if (now - lastOperatorRefresh >= 120) {
    operator.refresh();
    lastOperatorRefresh = now;
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
  get editor() { return editor; },
  editorReady,
  get activeScene() { return activeScene; },
  get runtime() { return runtime; },
  get cfg() { return cfg; },
  get scene() { return scene; },
};
