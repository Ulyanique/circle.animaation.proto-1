import {
  SCHEMA, SCENE_IDS, SCENE_LABELS, FONT_CHOICES,
  projectToJSON, saveProject, resetStoredProject, resetProjectScene, projectToURL,
} from "./config.js";
import { createDefaultProject } from "./scenes/defaults.js";
import { loadCustomFont } from "./fonts.js";

/**
 * Панель настроек всего проекта: вкладки сцен, схема полей, JSON,
 * шрифты и запуск рендера с текущими настройками.
 * @param {any} project
 * @param {any} options
 */
export function createSettingsUI(project, options = {}) {
  const {
    getActiveSceneId = () => "waiting",
    onSelectScene = () => {},
    onProjectChange = () => {},
    onImportProject = () => true,
    onRenderWithConfig = () => {},
    onPauseToggle = () => {},
    onToast = () => {},
    onExportVideo = () => {},
  } = options;

  const btn = document.createElement("button");
  btn.className = "cfg-toggle";
  btn.title = "Настройки (S)";
  btn.setAttribute("aria-label", "Настройки");
  btn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>`;
  document.body.appendChild(btn);

  const panel = document.createElement("aside");
  panel.className = "cfg-panel";
  panel.setAttribute("aria-hidden", "true");
  panel.innerHTML = `
    <header class="cfg-head">
      <span class="cfg-title">Настройки</span>
      <button type="button" class="cfg-close" aria-label="Закрыть">×</button>
    </header>
    <nav class="cfg-scenes" aria-label="Сцены"></nav>
    <div class="cfg-tools">
      <button type="button" data-act="pause">Пауза</button>
      <button type="button" data-act="export">Экспорт JSON</button>
      <button type="button" data-act="import">Импорт</button>
      <button type="button" data-act="video">Экспорт видео</button>
      <button type="button" data-act="render">Рендер с настройками</button>
      <button type="button" data-act="reset-scene">Сброс сцены</button>
      <button type="button" data-act="reset-all">Сброс всех</button>
    </div>
    <div class="cfg-io" hidden>
      <textarea spellcheck="false" class="cfg-textarea"></textarea>
      <div class="cfg-io-actions">
        <button type="button" data-io="copy">Копировать JSON</button>
        <button type="button" data-io="download">Скачать .json</button>
        <button type="button" data-io="copy-link">Скопировать ссылку</button>
        <button type="button" data-io="apply">Применить</button>
        <button type="button" data-io="apply-defaults">Как defaults</button>
        <button type="button" data-io="render">Рендер</button>
        <button type="button" data-io="close">Закрыть</button>
      </div>
    </div>
    <div class="cfg-body"></div>
  `;
  document.body.appendChild(panel);

  const tabs = panel.querySelector(".cfg-scenes");
  const body = panel.querySelector(".cfg-body");
  const io = panel.querySelector(".cfg-io");
  const ta = panel.querySelector(".cfg-textarea");
  const pauseBtn = panel.querySelector('[data-act="pause"]');
  /** @type {Array<{set: () => void}>} */
  const inputs = [];
  /** @type {Record<string, boolean>} */
  const openSections = {};
  let currentCfg = project.scenes[getActiveSceneId()] || project.scenes.waiting;
  let currentSceneId = getActiveSceneId();
  let defaults = createDefaultProject().scenes[currentSceneId];

  for (const id of SCENE_IDS) {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.dataset.scene = id;
    tab.textContent = SCENE_LABELS[id] || id;
    tab.addEventListener("click", () => onSelectScene(id));
    tabs.appendChild(tab);
  }

  /** @param {string} value */
  const decimals = (value) => (String(value).split(".")[1] || "").length;
  /** @param {HTMLSelectElement} select @param {string} name */
  const ensureCustomOption = (select, name) => {
    if (!name || [...select.options].some((o) => o.value === name)) return;
    const option = document.createElement("option");
    option.value = name; option.textContent = `Свой: ${name}`;
    select.appendChild(option);
  };

  function defaultFor(sectionId, key) {
    return defaults?.[sectionId]?.[key];
  }

  function commit() {
    saveProject(project);
    onProjectChange();
  }

  function buildBody() {
    body.innerHTML = "";
    inputs.length = 0;
    for (const section of SCHEMA) {
      const holder = currentCfg[section.id];
      if (!holder) continue;
      const det = document.createElement("details");
      det.className = "cfg-sec";
      det.open = openSections[section.id] ?? section.id === "logo";
      det.addEventListener("toggle", () => { openSections[section.id] = det.open; });
      const sum = document.createElement("summary");
      sum.textContent = section.title;
      det.appendChild(sum);
      for (const f of section.fields) {
        const row = document.createElement("label");
        row.className = `cfg-row cfg-${f.type}`;
        const name = document.createElement("span");
        name.className = "cfg-name";
        name.textContent = f.label;
        row.appendChild(name);
        const wrap = document.createElement("span");
        wrap.className = "cfg-ctl";
        if (f.type === "range") {
          const out = document.createElement("output");
          const input = document.createElement("input");
          input.type = "range"; input.dataset.field = f.key;
          input.min = f.min; input.max = f.max; input.step = f.step;
          const fmt = (v) => Number(v).toFixed(decimals(f.step));
          input.value = holder[f.key]; out.textContent = fmt(holder[f.key]);
          input.addEventListener("input", () => {
            holder[f.key] = Number(input.value);
            out.textContent = fmt(holder[f.key]);
            commit();
          });
          inputs.push({ set: () => { input.value = holder[f.key]; out.textContent = fmt(holder[f.key]); } });
          wrap.append(input, out);
          row.addEventListener("dblclick", (e) => {
            e.preventDefault();
            holder[f.key] = defaultFor(section.id, f.key);
            input.value = holder[f.key]; out.textContent = fmt(holder[f.key]);
            commit();
          });
        } else if (f.type === "color") {
          const input = document.createElement("input");
          input.type = "color"; input.dataset.field = f.key; input.value = holder[f.key];
          input.addEventListener("input", () => { holder[f.key] = input.value; commit(); });
          inputs.push({ set: () => { input.value = holder[f.key]; } });
          wrap.append(input);
        } else if (f.type === "bool") {
          const input = document.createElement("input");
          input.type = "checkbox"; input.dataset.field = f.key; input.checked = !!holder[f.key];
          input.addEventListener("change", () => { holder[f.key] = input.checked; commit(); });
          inputs.push({ set: () => { input.checked = !!holder[f.key]; } });
          wrap.append(input);
        } else if (f.type === "select") {
          const select = document.createElement("select");
          select.dataset.field = f.key;
          if (f.key === "fontFamily") {
            for (const font of FONT_CHOICES) {
              const option = document.createElement("option");
              option.value = font.value; option.textContent = font.label;
              select.appendChild(option);
            }
            ensureCustomOption(select, holder.customFontName);
          } else {
            for (const option of f.options || []) {
              const el = document.createElement("option");
              el.value = option.value; el.textContent = option.label;
              select.appendChild(el);
            }
          }
          select.value = holder[f.key];
          select.addEventListener("change", () => { holder[f.key] = select.value; commit(); });
          inputs.push({ set: () => { ensureCustomOption(select, holder.customFontName); select.value = holder[f.key]; } });
          wrap.append(select);
        } else if (f.type === "text") {
          const input = document.createElement("input");
          input.type = "text"; input.dataset.field = f.key; input.value = holder[f.key] ?? "";
          input.addEventListener("input", () => { holder[f.key] = input.value; commit(); });
          inputs.push({ set: () => { input.value = holder[f.key] ?? ""; } });
          wrap.append(input);
        } else if (f.type === "font") {
          const input = document.createElement("input");
          input.type = "file"; input.accept = ".ttf,.woff2,.otf,font/ttf,font/woff2,font/otf";
          const label = document.createElement("output");
          label.textContent = holder.customFontName || "не загружен";
          input.addEventListener("change", async () => {
            const file = input.files?.[0];
            if (!file) return;
            try {
              const { name, dataUrl } = await loadCustomFont(file);
              holder.customFontName = name;
              holder.customFontDataUrl = dataUrl;
              holder.fontFamily = name;
              label.textContent = name;
              const select = body.querySelector('select[data-field="fontFamily"]');
              if (select) { ensureCustomOption(select, name); select.value = name; }
              commit();
              onToast(`Шрифт «${name}» загружен`);
            } catch (err) {
              onToast(`Ошибка шрифта: ${err.message}`, true);
            }
          });
          inputs.push({ set: () => { label.textContent = holder.customFontName || "не загружен"; } });
          wrap.append(input, label);
        }
        row.appendChild(wrap);
        det.appendChild(row);
      }
      body.appendChild(det);
    }
  }

  function refresh() {
    inputs.forEach((i) => i.set());
    pauseBtn.classList.toggle("on", !!currentCfg.playback?.paused);
    for (const tab of tabs.querySelectorAll("button")) {
      tab.classList.toggle("active", tab.dataset.scene === currentSceneId);
      tab.setAttribute("aria-current", tab.dataset.scene === currentSceneId ? "page" : "false");
    }
  }

  /** @param {string} id */
  function bindConfig(id) {
    currentSceneId = id;
    currentCfg = project.scenes[id] || project.scenes.waiting;
    defaults = createDefaultProject().scenes[id];
    buildBody();
    refresh();
  }

  function open() {
    document.body.classList.add("ui-on");
    panel.classList.add("open");
    panel.setAttribute("aria-hidden", "false");
    btn.classList.add("active");
  }
  function close() {
    document.body.classList.remove("ui-on");
    panel.classList.remove("open");
    panel.setAttribute("aria-hidden", "true");
    btn.classList.remove("active");
  }
  function toggle() { panel.classList.contains("open") ? close() : open(); }

  /** @param {"export"|"import"} mode */
  function showIO(mode) {
    io.hidden = false;
    io.dataset.mode = mode;
    for (const action of io.querySelectorAll("[data-io]")) {
      const key = action.dataset.io;
      action.hidden = mode === "export"
        ? !["copy", "download", "copy-link", "close"].includes(key)
        : !["apply", "apply-defaults", "render", "close"].includes(key);
    }
    if (mode === "export") {
      ta.value = projectToJSON(project);
      ta.readOnly = true;
    } else {
      ta.value = ""; ta.readOnly = false;
      ta.placeholder = "Вставьте JSON проекта v2 или старые настройки v1…";
      ta.focus();
    }
  }

  /** @param {HTMLTextAreaElement} textarea */
  async function copyText(textarea) {
    try { await navigator.clipboard.writeText(textarea.value); }
    catch (_) { textarea.select(); document.execCommand("copy"); }
  }

  /** @param {string} text @param {boolean} asDefaults */
  function importText(text, asDefaults) {
    try {
      onImportProject(text, asDefaults);
      saveProject(project);
      bindConfig(getActiveSceneId());
      onProjectChange();
      io.hidden = true;
      onToast(asDefaults ? "JSON применён как defaults" : "Настройки применены");
    } catch (err) {
      onToast(`Ошибка JSON: ${err.message}`, true);
    }
  }

  panel.querySelector(".cfg-close").addEventListener("click", close);
  btn.addEventListener("click", toggle);
  panel.addEventListener("click", async (e) => {
    const act = e.target.closest("[data-act]")?.dataset.act;
    const ioAct = e.target.closest("[data-io]")?.dataset.io;
    if (act === "pause") { onPauseToggle(); refresh(); }
    else if (act === "video") onExportVideo();
    else if (act === "export") showIO("export");
    else if (act === "import") showIO("import");
    else if (act === "render") { onRenderWithConfig(); close(); }
    else if (act === "reset-scene") {
      if (!confirm("Сбросить настройки текущей сцены к умолчанию?")) return;
      resetProjectScene(project, currentSceneId);
      commit(); bindConfig(currentSceneId);
      onToast("Сцена сброшена");
    } else if (act === "reset-all") {
      if (!confirm("Сбросить настройки всех сцен к умолчанию?")) return;
      resetStoredProject();
      const fresh = createDefaultProject();
      for (const id of SCENE_IDS) resetProjectScene(project, id);
      project.activeScene = fresh.activeScene;
      project.editor = fresh.editor;
      commit(); bindConfig(getActiveSceneId());
      onToast("Все настройки сброшены");
    } else if (ioAct === "copy") { await copyText(ta); onToast("JSON скопирован"); }
    else if (ioAct === "download") {
      const blob = new Blob([ta.value], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "circle-animation-project.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } else if (ioAct === "copy-link") {
      try { await navigator.clipboard.writeText(projectToURL(project)); onToast("Ссылка скопирована"); }
      catch (err) { onToast(`Не удалось скопировать ссылку: ${err.message}`, true); }
    } else if (ioAct === "apply") importText(ta.value, false);
    else if (ioAct === "apply-defaults") importText(ta.value, true);
    else if (ioAct === "render") { onRenderWithConfig(); close(); }
    else if (ioAct === "close") io.hidden = true;
  });

  window.addEventListener("keydown", (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.code === "KeyS") toggle();
    if (e.code === "Space") { e.preventDefault(); onPauseToggle(); refresh(); }
  });

  bindConfig(getActiveSceneId());
  return { open, close, toggle, refresh, bindConfig, setActiveScene: bindConfig, panel, button: btn };
}
