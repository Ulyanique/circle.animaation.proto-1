import { saveProject, SCENE_IDS } from "./config.js";
import {
  ANIMATION_PRESETS, OUT_PRESETS, LOOP_PRESETS, KEYFRAME_EASINGS, SETTINGS_VERSION,
} from "./scenes/defaults.js";
import {
  createElementDefaults, elementIdsForScene, elementBox, elementLabel,
  setElementTransform, snapValue, elementKeyframeState, upsertKeyframe,
  removeKeyframe, copyElementAnimation,
} from "./element-registry.js";

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const num = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};
const clone = (value) => JSON.parse(JSON.stringify(value));

/** Конструктор фазы 3a: DOM-оверлей поверх кадра, но вне compositeFrameAt/WebM.
 * @param {any} options
 */
export function createEditor({
  project,
  getActiveSceneId = () => "waiting",
  getTime = () => 0,
  getCycle = () => 15.3,
  onSeek = () => {},
  onProjectChange = () => {},
  onToast = () => {},
  enabled = false,
} = {}) {
  project.editor = project.editor || {
    enabled: false, snap: 0.01, grid: false, selection: null, inspectorOpen: false,
  };
  if (project.editor.inspectorOpen === undefined) project.editor.inspectorOpen = false;
  let isEnabled = Boolean(enabled || project.editor.enabled);
  let activeId = getActiveSceneId();
  let selected = project.editor.selection || null;
  /** @type {string[]} */
  let history = [];
  let historyIndex = -1;
  /** @type {any} */
  let drag = null;

  const layer = document.createElement("div");
  layer.className = "editor-layer";
  layer.setAttribute("aria-label", "Конструктор заставки");
  layer.innerHTML = `
    <div class="editor-grid" data-ed="grid"></div>
    <div class="editor-boxes" data-ed="boxes"></div>
    <div class="editor-toolbar" data-ed="toolbar">
      <strong>Конструктор</strong>
      <button type="button" data-ed-act="undo" title="Отменить (Ctrl+Z)">↶</button>
      <button type="button" data-ed-act="redo" title="Повторить (Ctrl+Y)">↷</button>
      <button type="button" data-ed-act="grid" aria-pressed="false" title="Сетка">Сетка</button>
      <button type="button" data-ed-act="inspector" aria-pressed="false" title="Инспектор (I)">Инспектор</button>
      <label>Шаг <input type="number" data-ed="snap" min="0" max="0.1" step="0.001" value="0.01"></label>
      <button type="button" data-ed-act="close" title="Закрыть конструктор">×</button>
    </div>
    <aside class="editor-inspector" data-ed="inspector"></aside>
    <div class="editor-context" data-ed="context" hidden></div>
  `;
  document.body.appendChild(layer);
  const boxes = layer.querySelector('[data-ed="boxes"]');
  const grid = layer.querySelector('[data-ed="grid"]');
  const toolbar = layer.querySelector('[data-ed="toolbar"]');
  const inspector = layer.querySelector('[data-ed="inspector"]');
  const context = layer.querySelector('[data-ed="context"]');
  const undoBtn = toolbar.querySelector('[data-ed-act="undo"]');
  const redoBtn = toolbar.querySelector('[data-ed-act="redo"]');
  const gridBtn = toolbar.querySelector('[data-ed-act="grid"]');
  const inspectorBtn = toolbar.querySelector('[data-ed-act="inspector"]');
  const snapInput = toolbar.querySelector('[data-ed="snap"]');

  const scene = () => project.scenes[activeId] || project.scenes.waiting;
  const elements = () => {
    const cfg = scene();
    if (!cfg.elements) cfg.elements = createElementDefaults(activeId);
    return cfg.elements;
  };
  const canvasRect = () => {
    const canvas = document.getElementById("stage");
    const rect = canvas?.getBoundingClientRect();
    return rect && rect.width > 0 ? rect : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
  };
  const snapshot = () => JSON.stringify(elements());

  function pushHistory() {
    const snap = snapshot();
    if (history[historyIndex] === snap) return;
    history = history.slice(0, historyIndex + 1);
    history.push(snap);
    if (history.length > 40) history.shift();
    historyIndex = history.length - 1;
  }
  function restore(snap) {
    scene().elements = JSON.parse(snap);
    commit(false);
  }
  function commit(historyPush = true) {
    if (historyPush) pushHistory();
    project.settingsVersion = SETTINGS_VERSION;
    project.editor.selection = selected;
    saveProject(project);
    onProjectChange();
    refresh();
  }
  function undo() {
    if (historyIndex <= 0) return;
    historyIndex--;
    restore(history[historyIndex]);
  }
  function redo() {
    if (historyIndex >= history.length - 1) return;
    historyIndex++;
    restore(history[historyIndex]);
  }
  function setInspectorOpen(open) {
    project.editor.inspectorOpen = Boolean(open);
    saveProject(project);
    refresh();
  }

  function select(id) {
    selected = id;
    project.editor.selection = id;
    // Выбор элемента раскрывает инспектор; в остальное время кадр остаётся чистым.
    project.editor.inspectorOpen = true;
    saveProject(project);
    refresh();
  }

  function hideContext() {
    context.hidden = true;
  }
  function showContext(x, y, id) {
    selected = id;
    project.editor.selection = id;
    context.innerHTML = `
      <strong>${elementLabel(id)}</strong>
      <button type="button" data-ed-menu="inspector">Инспектор</button>
      <button type="button" data-ed-menu="front">На передний план</button>
      <button type="button" data-ed-menu="back">На задний план</button>
      <button type="button" data-ed-menu="lock">Заблокировать / разблокировать</button>
      <button type="button" data-ed-menu="reset">Сбросить элемент</button>
    `;
    context.style.left = `${Math.min(x, window.innerWidth - 210)}px`;
    context.style.top = `${Math.min(y, window.innerHeight - 170)}px`;
    context.hidden = false;
    refresh();
  }

  function fieldValue(el, field) {
    if (field.startsWith("timing.")) return el.timing?.[field.slice(7)] ?? 0;
    return el[field] ?? "";
  }
  function setField(field, raw) {
    if (!selected) return;
    const el = elements()[selected] || {};
    if (field === "keyEasing") {
      const c = Math.max(0.1, getCycle());
      const local = ((Number(getTime()) % c) + c) % c;
      const frames = Array.isArray(el.keyframes) ? el.keyframes.map((k) => ({ ...k })) : [];
      const idx = frames.findIndex((k) => Math.abs(((Number(k.t) % c) + c) % c - local) < 0.05);
      if (idx >= 0) frames[idx].easing = String(raw);
      setElementTransform(scene(), selected, { keyframes: frames });
      commit(true);
      return;
    }
    let value = raw;
    if (["x", "y", "scale", "rotation", "zIndex", "timing.start", "timing.duration"].includes(field)) {
      value = num(raw, 0);
    } else if (field === "locked") value = Boolean(raw);
    if (field.startsWith("timing.")) {
      setElementTransform(scene(), selected, { timing: { [field.slice(7)]: value } });
    } else {
      setElementTransform(scene(), selected, { [field]: value });
    }
    commit(true);
  }

  function buildInspector() {
    const ids = elementIdsForScene(activeId);
    const list = ids.map((id) =>
      `<option value="${id}" ${id === selected ? "selected" : ""}>${elementLabel(id)}</option>`).join("");
    inspector.innerHTML = `<div class="editor-inspector-tab" data-ed="inspector-tab">Инспектор</div>`;
    if (!selected) {
      inspector.insertAdjacentHTML("beforeend", `
        <div class="editor-inspector-content">
          <header><strong>Элемент</strong><small>${activeId}</small></header>
          <label class="editor-element-picker"><span>Список элементов</span>
            <select data-ed="element-select"><option value="">— выберите —</option>${list}</select></label>
          <p class="editor-hint">Выберите элемент рамкой, правым кликом или из списка.</p>
        </div>`);
      return;
    }
    const el = elements()[selected] || {};
    const options = (items, value) => items.map((o) =>
      `<option value="${o.value}" ${o.value === value ? "selected" : ""}>${o.label}</option>`).join("");
    const row = (label, field, type, attrs = "") => `
      <label><span>${label}</span><input data-ed-field="${field}" type="${type}" value="${fieldValue(el, field)}" ${attrs}></label>`;
    const c = Math.max(0.1, getCycle());
    const local = ((Number(getTime()) % c) + c) % c;
    const frames = Array.isArray(el.keyframes) ? el.keyframes : [];
    const markers = frames.map((k) =>
      `<button type="button" class="editor-key" data-ed-key="${Number(k.t) || 0}"
        style="left:${(Number(k.t) || 0) / c * 100}%" title="t=${Number(k.t || 0).toFixed(2)}"></button>`).join("");
    const currentEasing = frames.find((k) =>
      Math.abs(((Number(k.t) % c) + c) % c - local) < 0.05)?.easing || "smooth";
    const keySection = `
      <div class="editor-keys">
        <header><span>Ключи</span><small class="editor-time">${local.toFixed(2)} / ${c.toFixed(1)} с</small></header>
        <div class="editor-track">${markers}<span class="editor-playhead" style="left:${local / c * 100}%"></span></div>
        <div class="editor-key-actions">
          <button type="button" data-ed-keyaction="add">+ Ключ</button>
          <button type="button" data-ed-keyaction="remove">− Ключ</button>
          <button type="button" data-ed-keyaction="copy">В др. сцены</button>
        </div>
        <label class="editor-key-easing"><span>Сглаживание</span>
          <select data-ed-field="keyEasing">${options(KEYFRAME_EASINGS, currentEasing)}</select></label>
      </div>`;
    inspector.insertAdjacentHTML("beforeend", `
      <div class="editor-inspector-content">
        <header><strong>${elementLabel(selected)}</strong><small>${activeId}</small></header>
        <label class="editor-element-picker"><span>Элемент</span>
          <select data-ed="element-select">${list}</select></label>
        <div class="editor-fields">
          ${row("X", "x", "number", "min='0' max='1' step='0.001'")}
          ${row("Y", "y", "number", "min='0' max='1' step='0.001'")}
          ${row("Масштаб", "scale", "number", "min='0.1' max='4' step='0.01'")}
          ${row("Поворот", "rotation", "number", "min='-3.14' max='3.14' step='0.01'")}
          ${row("Слой", "zIndex", "number", "min='-10' max='20' step='1'")}
          <label><span>Цвет</span><input data-ed-field="color" type="color" value="${el.color || "#d9b061"}"></label>
          <label><span>Появление</span><select data-ed-field="inPreset">${options(ANIMATION_PRESETS, el.inPreset)}</select></label>
          <label><span>Исчезновение</span><select data-ed-field="outPreset">${options(OUT_PRESETS, el.outPreset)}</select></label>
          <label><span>Движение</span><select data-ed-field="loopPreset">${options(LOOP_PRESETS, el.loopPreset)}</select></label>
          ${row("Старт, с", "timing.start", "number", "min='0' max='60' step='0.1'")}
          ${row("Длительность, с", "timing.duration", "number", "min='0.1' max='60' step='0.1'")}
          <label class="editor-check"><span>Блокировка</span><input data-ed-field="locked" type="checkbox" ${el.locked ? "checked" : ""}></label>
        </div>
        <div class="editor-actions">
          <button type="button" data-ed-action="front">Вперёд</button>
          <button type="button" data-ed-action="back">Назад</button>
          <button type="button" data-ed-action="reset">Сброс</button>
        </div>
        ${keySection}
      </div>
    `);
  }

  function refresh() {
    if (!isEnabled) return;
    const rect = canvasRect();
    const els = elements();
    const ids = elementIdsForScene(activeId);
    boxes.innerHTML = ids.map((id) => {
      const el = els[id] || {};
      const box = elementBox(id);
      const scale = num(el.scale, 1);
      const w = box.w * scale * rect.width;
      const h = box.h * scale * rect.height;
      const left = rect.left + (num(el.x, 0.5) * rect.width - w / 2);
      const top = rect.top + (num(el.y, 0.5) * rect.height - h / 2);
      return `<div class="editor-box${selected === id ? " selected" : ""}${el.locked ? " locked" : ""}"
        data-ed-id="${id}" style="left:${left}px;top:${top}px;width:${w}px;height:${h}px;z-index:${100 + num(el.zIndex, 0)}">
        <span>${elementLabel(id)}</span></div>`;
    }).join("");
    grid.style.display = project.editor.grid ? "block" : "none";
    grid.style.left = `${rect.left}px`;
    grid.style.top = `${rect.top}px`;
    grid.style.width = `${rect.width}px`;
    grid.style.height = `${rect.height}px`;
    snapInput.value = String(project.editor.snap ?? 0.01);
    gridBtn.setAttribute("aria-pressed", String(!!project.editor.grid));
    inspectorBtn.setAttribute("aria-pressed", String(!!project.editor.inspectorOpen));
    inspector.classList.toggle("collapsed", !project.editor.inspectorOpen);
    undoBtn.disabled = historyIndex <= 0;
    redoBtn.disabled = historyIndex >= history.length - 1;
    buildInspector();
  }

  function setEnabled(value) {
    isEnabled = Boolean(value);
    project.editor.enabled = isEnabled;
    document.body.classList.toggle("editor-on", isEnabled);
    layer.style.display = isEnabled ? "block" : "none";
    if (isEnabled) {
      activeId = getActiveSceneId();
      history = [snapshot()];
      historyIndex = 0;
      refresh();
    } else hideContext();
    saveProject(project);
    onProjectChange();
    return isEnabled;
  }
  function toggle() { return setEnabled(!isEnabled); }
  function setActiveScene(id) {
    activeId = id;
    selected = null;
    project.editor.selection = null;
    if (isEnabled) {
      history = [snapshot()];
      historyIndex = 0;
      refresh();
    }
  }

  // ── Drag-and-drop ────────────────────────────────────────────────────────
  boxes.addEventListener("pointerdown", (e) => {
    const box = e.target.closest("[data-ed-id]");
    if (!box) return;
    const id = box.dataset.edId;
    const el = elements()[id];
    if (!el || el.locked) return;
    e.preventDefault();
    select(id);
    drag = { id, startX: e.clientX, startY: e.clientY, x: num(el.x, 0.5), y: num(el.y, 0.5) };
  });
  window.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const rect = canvasRect();
    const nx = clamp01(drag.x + (e.clientX - drag.startX) / rect.width);
    const ny = clamp01(drag.y + (e.clientY - drag.startY) / rect.height);
    const snap = num(project.editor.snap, 0);
    setElementTransform(scene(), drag.id, { x: snapValue(nx, snap), y: snapValue(ny, snap) });
    project.settingsVersion = SETTINGS_VERSION;
    saveProject(project);
    onProjectChange();
    refresh();
  });
  const endDrag = () => {
    if (!drag) return;
    drag = null;
    commit(true);
  };
  window.addEventListener("pointerup", endDrag);
  window.addEventListener("pointercancel", endDrag);

  boxes.addEventListener("click", (e) => {
    const box = e.target.closest("[data-ed-id]");
    if (box) select(box.dataset.edId);
  });
  boxes.addEventListener("contextmenu", (e) => {
    const box = e.target.closest("[data-ed-id]");
    if (!box) return;
    e.preventDefault();
    showContext(e.clientX, e.clientY, box.dataset.edId);
  });

  // ── Инспектор и контекстное меню ────────────────────────────────────────
  const handleField = (e) => {
    const field = e.target.dataset?.edField;
    if (!field) return;
    const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setField(field, value);
  };
  inspector.addEventListener("input", handleField);
  inspector.addEventListener("change", (e) => {
    if (e.target.dataset?.ed === "element-select") {
      if (e.target.value) select(e.target.value);
      return;
    }
    if (e.target.dataset?.edField && e.target.tagName === "SELECT") handleField(e);
  });
  inspector.addEventListener("click", (e) => {
    if (e.target.closest('[data-ed="inspector-tab"]')) { setInspectorOpen(true); return; }
    const keyTime = e.target.closest("[data-ed-key]")?.dataset.edKey;
    if (keyTime !== undefined) { onSeek(Number(keyTime)); return; }
    const keyAction = e.target.closest("[data-ed-keyaction]")?.dataset.edKeyaction;
    if (keyAction && selected) {
      const el = elements()[selected] || {};
      const t = Math.max(0, getTime());
      const c = Math.max(0.1, getCycle());
      if (keyAction === "add") {
        const kf = elementKeyframeState(el, t, c) || {};
        setElementTransform(scene(), selected, {
          keyframes: upsertKeyframe(el, t, c, {
            x: kf.x ?? el.x ?? 0.5, y: kf.y ?? el.y ?? 0.5,
            scale: kf.scale ?? el.scale ?? 1, rotation: kf.rotation ?? el.rotation ?? 0,
            opacity: kf.opacity ?? 1,
          }),
        });
      } else if (keyAction === "remove") {
        setElementTransform(scene(), selected, { keyframes: removeKeyframe(el, t, c) });
      } else if (keyAction === "copy") {
        const targets = SCENE_IDS.filter((id) => id !== activeId && project.scenes[id]?.elements?.[selected]);
        copyElementAnimation(project, activeId, selected, targets);
        onToast(`Анимация «${elementLabel(selected)}» скопирована в ${targets.length} сцен(ы)`);
      } else return;
      commit(true);
      return;
    }
    const action = e.target.closest("[data-ed-action]")?.dataset.edAction;
    if (!action || !selected) return;
    const el = elements()[selected] || {};
    if (action === "front") setElementTransform(scene(), selected, { zIndex: num(el.zIndex, 0) + 1 });
    else if (action === "back") setElementTransform(scene(), selected, { zIndex: num(el.zIndex, 0) - 1 });
    else if (action === "reset") scene().elements[selected] = clone(createElementDefaults(activeId)[selected]);
    else return;
    commit(true);
  });

  context.addEventListener("click", (e) => {
    const action = e.target.closest("[data-ed-menu]")?.dataset.edMenu;
    if (!action || !selected) return;
    const el = elements()[selected] || {};
    if (action === "front") setElementTransform(scene(), selected, { zIndex: num(el.zIndex, 0) + 1 });
    else if (action === "back") setElementTransform(scene(), selected, { zIndex: num(el.zIndex, 0) - 1 });
    else if (action === "lock") setElementTransform(scene(), selected, { locked: !el.locked });
    else if (action === "reset") scene().elements[selected] = clone(createElementDefaults(activeId)[selected]);
    else if (action === "inspector") {
      setInspectorOpen(true);
      hideContext();
      return;
    } else return;
    commit(true);
    hideContext();
  });

  toolbar.addEventListener("click", (e) => {
    const action = e.target.closest("[data-ed-act]")?.dataset.edAct;
    if (action === "undo") undo();
    else if (action === "redo") redo();
    else if (action === "grid") {
      project.editor.grid = !project.editor.grid;
      saveProject(project);
      refresh();
    } else if (action === "inspector") setInspectorOpen(!project.editor.inspectorOpen);
    else if (action === "close") setEnabled(false);
  });
  toolbar.addEventListener("input", (e) => {
    if (e.target.dataset?.ed !== "snap") return;
    project.editor.snap = Math.max(0, num(e.target.value, 0.01));
    saveProject(project);
  });

  document.addEventListener("click", (e) => {
    if (!context.hidden && !e.target.closest(".editor-context") && !e.target.closest(".editor-box")) hideContext();
  });
  window.addEventListener("resize", () => { if (isEnabled) refresh(); });
  window.addEventListener("keydown", (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
    if (e.code === "KeyE") toggle();
    else if (e.code === "KeyI" && isEnabled) setInspectorOpen(!project.editor.inspectorOpen);
    else if (e.code === "Escape") hideContext();
    else if ((e.ctrlKey || e.metaKey) && e.code === "KeyZ") { e.preventDefault(); e.shiftKey ? redo() : undo(); }
    else if ((e.ctrlKey || e.metaKey) && e.code === "KeyY") { e.preventDefault(); redo(); }
  });

  function updatePlayhead() {
    if (!isEnabled || !project.editor.inspectorOpen || !selected) return;
    const c = Math.max(0.1, getCycle());
    const local = ((Math.max(0, getTime()) % c) + c) % c;
    const head = inspector.querySelector(".editor-playhead");
    if (head) head.style.left = `${local / c * 100}%`;
    const label = inspector.querySelector(".editor-time");
    if (label) label.textContent = `${local.toFixed(2)} / ${c.toFixed(1)} с`;
  }

  setEnabled(isEnabled);
  return {
    layer, setEnabled, toggle, setActiveScene, refresh, undo, redo, updatePlayhead,
    get enabled() { return isEnabled; },
    get activeScene() { return activeId; },
    get selection() { return selected; },
    // Зарезервировано для фазы 3b: мини-таймлайн читает время и длительность цикла.
    getTime, getCycle, onSeek, onToast,
  };
}
