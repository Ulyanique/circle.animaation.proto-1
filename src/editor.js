import { saveProject } from "./config.js";
import { ANIMATION_PRESETS, OUT_PRESETS, LOOP_PRESETS, SETTINGS_VERSION } from "./scenes/defaults.js";
import {
  createElementDefaults, elementIdsForScene, elementBox, elementLabel,
  setElementTransform, snapValue,
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
  onProjectChange = () => {},
  onToast = () => {},
  enabled = false,
} = {}) {
  project.editor = project.editor || { enabled: false, snap: 0.01, grid: false, selection: null };
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

  function select(id) {
    selected = id;
    project.editor.selection = id;
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
    if (!selected) {
      inspector.innerHTML = `<p class="editor-hint">Выберите элемент рамкой или правым кликом.</p>`;
      return;
    }
    const el = elements()[selected] || {};
    const options = (list, value) => list.map((o) =>
      `<option value="${o.value}" ${o.value === value ? "selected" : ""}>${o.label}</option>`).join("");
    const row = (label, field, type, attrs = "") => `
      <label><span>${label}</span><input data-ed-field="${field}" type="${type}" value="${fieldValue(el, field)}" ${attrs}></label>`;
    inspector.innerHTML = `
      <header><strong>${elementLabel(selected)}</strong><small>${activeId}</small></header>
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
    `;
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
  // select дублируется change в старых браузерах; input/checkbox уже обработаны выше.
  inspector.addEventListener("change", (e) => {
    if (e.target.dataset?.edField && e.target.tagName === "SELECT") handleField(e);
  });
  inspector.addEventListener("click", (e) => {
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
    else if (action === "inspector") { hideContext(); buildInspector(); return; }
    else return;
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
    } else if (action === "close") setEnabled(false);
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
    else if (e.code === "Escape") hideContext();
    else if ((e.ctrlKey || e.metaKey) && e.code === "KeyZ") { e.preventDefault(); e.shiftKey ? redo() : undo(); }
    else if ((e.ctrlKey || e.metaKey) && e.code === "KeyY") { e.preventDefault(); redo(); }
  });

  setEnabled(isEnabled);
  return {
    layer, setEnabled, toggle, setActiveScene, refresh, undo, redo,
    get enabled() { return isEnabled; },
    get activeScene() { return activeId; },
    get selection() { return selected; },
  };
}
