import {
  SCHEMA, cloneDefaults, configToJSON, parseConfigJSON, parseProjectJSON,
} from "./config.js";

/**
 * Панель настроек: у каждой сцены свой набор параметров.
 * Кнопка ⚙ (правый верх) → вкладки 01/02/08/09, экспорт/импорт JSON сцены
 * и всего проекта. Экспортированный JSON можно прислать как умолчание.
 */
export function createSettingsUI({
  scenes,
  getSceneId,
  getConfig,
  getDefaults,
  setScene,
  onConfigChange,
  onApplyScene,
  onApplyProject,
  getProjectJSON,
  onPauseToggle,
  onToast,
  onExportVideo,
}) {
  // ─── кнопка ───
  const btn = document.createElement("button");
  btn.className = "cfg-toggle";
  btn.type = "button";
  btn.title = "Настройки сцены (S)";
  btn.setAttribute("aria-label", "Настройки сцены");
  btn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>`;
  document.body.appendChild(btn);

  // ─── панель ───
  const panel = document.createElement("aside");
  panel.className = "cfg-panel";
  panel.setAttribute("aria-hidden", "true");
  panel.innerHTML = `
    <header class="cfg-head">
      <span class="cfg-title">Настройки <em class="cfg-scene-name"></em></span>
      <button type="button" class="cfg-close" aria-label="Закрыть">×</button>
    </header>
    <nav class="cfg-tabs" aria-label="Сцены"></nav>
    <div class="cfg-tools">
      <button type="button" data-act="pause">Пауза</button>
      <button type="button" data-act="export">Экспорт сцены</button>
      <button type="button" data-act="export-project">Экспорт проекта</button>
      <button type="button" data-act="video">Экспорт видео</button>
      <button type="button" data-act="import">Импорт</button>
      <button type="button" data-act="reset">Сброс сцены</button>
    </div>
    <div class="cfg-io" hidden>
      <p class="cfg-io-hint"></p>
      <textarea spellcheck="false" class="cfg-textarea" aria-label="JSON настроек"></textarea>
      <div class="cfg-io-actions">
        <button type="button" data-io="copy">Копировать</button>
        <button type="button" data-io="download">Скачать .json</button>
        <button type="button" data-io="apply">Применить</button>
        <button type="button" data-io="close">Закрыть</button>
      </div>
    </div>
    <div class="cfg-body"></div>
  `;
  document.body.appendChild(panel);

  const body = panel.querySelector(".cfg-body");
  const tabs = panel.querySelector(".cfg-tabs");
  const io = panel.querySelector(".cfg-io");
  const ioHint = panel.querySelector(".cfg-io-hint");
  const ta = panel.querySelector(".cfg-textarea");
  const pauseBtn = panel.querySelector('[data-act="pause"]');
  const sceneName = panel.querySelector(".cfg-scene-name");
  const inputs = []; // { set } для синхронизации значений
  let editing = getSceneId();
  let ioMode = "export";

  const cfg = () => getConfig(editing);
  const defs = () => getDefaults(editing);
  const sceneLabel = (id) => scenes.find((s) => s.id === id)?.label || id.toUpperCase();

  function commit() {
    onConfigChange?.(editing);
  }

  function buildTabs() {
    tabs.replaceChildren(...scenes.map((scene) => {
      const tab = document.createElement("button");
      tab.type = "button";
      tab.className = "cfg-tab";
      tab.dataset.cfgScene = scene.id;
      tab.textContent = scene.label;
      tab.title = scene.title;
      tab.setAttribute("aria-pressed", String(scene.id === editing));
      if (scene.id === editing) tab.classList.add("active");
      return tab;
    }));
  }

  function buildBody() {
    body.replaceChildren();
    inputs.length = 0;
    const current = cfg();
    const defaults = defs();
    for (const section of SCHEMA) {
      const det = document.createElement("details");
      det.className = "cfg-sec";
      det.open = section.id === "logo";
      const sum = document.createElement("summary");
      sum.textContent = section.title;
      det.appendChild(sum);
      for (const f of section.fields) {
        const row = document.createElement("label");
        row.className = "cfg-row cfg-" + f.type;
        const name = document.createElement("span");
        name.className = "cfg-name";
        name.textContent = f.label;
        row.appendChild(name);
        const holder = current[section.id];
        if (f.type === "range") {
          const out = document.createElement("output");
          const input = document.createElement("input");
          input.type = "range";
          input.min = f.min; input.max = f.max; input.step = f.step;
          input.dataset.key = `${section.id}.${f.key}`;
          const fmt = (v) => (Number(v).toFixed(decimals(f.step)));
          input.value = holder[f.key];
          out.textContent = fmt(holder[f.key]);
          input.addEventListener("input", () => {
            holder[f.key] = Number(input.value);
            out.textContent = fmt(holder[f.key]);
            commit();
          });
          inputs.push({ set: () => { input.value = holder[f.key]; out.textContent = fmt(holder[f.key]); } });
          const wrap = document.createElement("span");
          wrap.className = "cfg-ctl";
          wrap.append(input, out);
          row.appendChild(wrap);
          // двойной клик — сброс к умолчанию сцены
          row.addEventListener("dblclick", (e) => {
            e.preventDefault();
            holder[f.key] = defaults[section.id][f.key];
            input.value = holder[f.key];
            out.textContent = fmt(holder[f.key]);
            commit();
          });
        } else if (f.type === "color") {
          const input = document.createElement("input");
          input.type = "color";
          input.dataset.key = `${section.id}.${f.key}`;
          input.value = holder[f.key];
          input.addEventListener("input", () => {
            holder[f.key] = input.value;
            commit();
          });
          inputs.push({ set: () => { input.value = holder[f.key]; } });
          row.appendChild(input);
        } else if (f.type === "bool") {
          const input = document.createElement("input");
          input.type = "checkbox";
          input.dataset.key = `${section.id}.${f.key}`;
          input.checked = !!holder[f.key];
          input.addEventListener("change", () => {
            holder[f.key] = input.checked;
            commit();
          });
          inputs.push({ set: () => { input.checked = !!holder[f.key]; } });
          row.appendChild(input);
        }
        det.appendChild(row);
      }
      body.appendChild(det);
    }
  }

  function refresh() {
    editing = getSceneId();
    sceneName.textContent = sceneLabel(editing);
    for (const tab of tabs.querySelectorAll(".cfg-tab")) {
      const active = tab.dataset.cfgScene === editing;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-pressed", String(active));
    }
    inputs.forEach((i) => i.set());
    pauseBtn.classList.toggle("on", !!cfg().playback.paused);
  }

  /** Полная перестройка: смена сцены или применённый JSON. */
  function rebuild() {
    buildTabs();
    buildBody();
    refresh();
  }

  function open() {
    document.body.classList.add("ui-on");
    panel.classList.add("open");
    panel.setAttribute("aria-hidden", "false");
    btn.classList.add("active");
    // вкладка всегда соответствует текущей сцене
    if (editing !== getSceneId()) rebuild();
  }
  function close() {
    document.body.classList.remove("ui-on");
    panel.classList.remove("open");
    panel.setAttribute("aria-hidden", "true");
    btn.classList.remove("active");
  }
  function toggle() {
    panel.classList.contains("open") ? close() : open();
  }

  function showIO(mode, content = "", hint = "") {
    ioMode = mode;
    io.hidden = false;
    io.dataset.mode = mode;
    io.querySelector('[data-io="copy"]').hidden = mode !== "export";
    io.querySelector('[data-io="download"]').hidden = mode !== "export";
    io.querySelector('[data-io="apply"]').hidden = mode !== "import";
    ioHint.textContent = hint;
    if (mode === "export") {
      ta.value = content;
      ta.readOnly = true;
    } else {
      ta.value = "";
      ta.readOnly = false;
      ta.placeholder = "Вставьте JSON сцены или всего проекта…";
      ta.focus();
    }
  }

  panel.querySelector(".cfg-close").addEventListener("click", close);
  btn.addEventListener("click", toggle);

  tabs.addEventListener("click", (e) => {
    const id = e.target.closest(".cfg-tab")?.dataset.cfgScene;
    if (!id || id === editing) return;
    if (setScene?.(id) === false) return;
    editing = id;
    rebuild();
    // держим панель открытой: правки следующей сцены сразу видны в кадре
  });

  panel.addEventListener("click", async (e) => {
    const act = e.target.closest("[data-act]")?.dataset.act;
    const ioAct = e.target.closest("[data-io]")?.dataset.io;
    if (act === "pause") {
      onPauseToggle?.();
      refresh();
    } else if (act === "video") {
      onExportVideo?.();
    } else if (act === "export") {
      showIO("export", configToJSON(cfg()), `Сцена ${sceneLabel(editing)} — эти значения можно прислать как умолчание.`);
    } else if (act === "export-project") {
      showIO("export", getProjectJSON?.() || "", "Все четыре сцены одним файлом.");
    } else if (act === "import") {
      showIO("import");
    } else if (act === "reset") {
      if (!confirm(`Сбросить настройки сцены ${sceneLabel(editing)} к умолчаниям?`)) return;
      const defaults = cloneDefaults(defs());
      onApplyScene?.(editing, defaults);
      rebuild();
      onToast?.(`Сцена ${sceneLabel(editing)} сброшена`);
    } else if (ioAct === "copy") {
      try {
        await navigator.clipboard.writeText(ta.value);
      } catch (_) {
        ta.select();
        document.execCommand("copy");
      }
      onToast?.("JSON скопирован");
    } else if (ioAct === "download") {
      const blob = new Blob([ta.value], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = ioMode === "export" && ta.value.includes('"scenes"')
        ? "circle-scenes.json" : `circle-${editing}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } else if (ioAct === "apply") {
      try {
        const text = ta.value.trim();
        if (!text) throw new Error("пустой JSON");
        if (text.includes('"scenes"')) {
          const project = parseProjectJSON(text, scenes.map((s) => s.id));
          onApplyProject?.(project.scenes);
          rebuild();
          onToast?.("Настройки проекта применены");
        } else {
          const next = parseConfigJSON(text, defs());
          onApplyScene?.(editing, next);
          rebuild();
          onToast?.(`Настройки сцены ${sceneLabel(editing)} применены`);
        }
        io.hidden = true;
      } catch (err) {
        onToast?.("Ошибка JSON: " + err.message, true);
      }
    } else if (ioAct === "close") {
      io.hidden = true;
    }
  });

  // горячие клавиши
  window.addEventListener("keydown", (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.code === "KeyS") toggle();
    if (e.code === "Space") {
      e.preventDefault();
      onPauseToggle?.();
      refresh();
    }
  });

  /** Сцена переключилась из пульта или по ссылке: панель идёт следом. */
  function syncScene() {
    if (!panel.classList.contains("open")) { editing = getSceneId(); return; }
    rebuild();
  }

  buildTabs();
  buildBody();
  refresh();

  return { open, close, toggle, refresh, rebuild, syncScene };
}

function decimals(step) {
  const s = String(step);
  return s.includes(".") ? s.split(".")[1].length : 0;
}
