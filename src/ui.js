import { SCHEMA, DEFAULTS, cloneDefaults, configToJSON, parseConfigJSON, saveConfig, resetStoredConfig } from "./config.js";

/**
 * Минималистичная панель настроек.
 * Кнопка ⚙ (правый верх) → панель со всеми параметрами, экспорт/импорт JSON.
 */
export function createSettingsUI(cfg, { onChange, onPauseToggle, onToast, onExportVideo, isActive = () => true }) {
  // ─── кнопка ───
  const btn = document.createElement("button");
  btn.className = "cfg-toggle";
  btn.type = "button";
  btn.title = "Настройки (S)";
  btn.setAttribute("aria-label", "Настройки");
  btn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>`;
  document.body.appendChild(btn);

  // ─── панель ───
  const panel = document.createElement("aside");
  panel.className = "cfg-panel";
  panel.setAttribute("aria-hidden", "true");
  panel.innerHTML = `
    <header class="cfg-head">
      <span class="cfg-title">Настройки</span>
      <button type="button" class="cfg-close" aria-label="Закрыть">×</button>
    </header>
    <div class="cfg-tools">
      <button type="button" data-act="pause">Пауза</button>
      <button type="button" data-act="export">Экспорт JSON</button>
      <button type="button" data-act="video">Экспорт видео</button>
      <button type="button" data-act="import">Импорт</button>
      <button type="button" data-act="reset">Сброс</button>
    </div>
    <div class="cfg-io" hidden>
      <textarea spellcheck="false" class="cfg-textarea"></textarea>
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
  const io = panel.querySelector(".cfg-io");
  const ta = panel.querySelector(".cfg-textarea");
  const pauseBtn = panel.querySelector('[data-act="pause"]');
  const inputs = []; // { get, set(v) } для синхронизации

  function commit() {
    saveConfig(cfg);
    onChange?.(cfg);
  }

  function buildBody() {
    body.innerHTML = "";
    inputs.length = 0;
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
        const holder = cfg[section.id];
        if (f.type === "range") {
          const out = document.createElement("output");
          const input = document.createElement("input");
          input.type = "range";
          input.min = f.min; input.max = f.max; input.step = f.step;
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
          // двойной клик — сброс к умолчанию
          row.addEventListener("dblclick", (e) => {
            e.preventDefault();
            holder[f.key] = DEFAULTS[section.id][f.key];
            input.value = holder[f.key];
            out.textContent = fmt(holder[f.key]);
            commit();
          });
        } else if (f.type === "color") {
          const input = document.createElement("input");
          input.type = "color";
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
    inputs.forEach((i) => i.set());
    pauseBtn.classList.toggle("on", !!cfg.playback.paused);
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
  function toggle() {
    panel.classList.contains("open") ? close() : open();
  }

  function showIO(mode) {
    io.hidden = false;
    io.dataset.mode = mode;
    io.querySelector('[data-io="copy"]').hidden = mode !== "export";
    io.querySelector('[data-io="download"]').hidden = mode !== "export";
    io.querySelector('[data-io="apply"]').hidden = mode !== "import";
    if (mode === "export") {
      ta.value = configToJSON(cfg);
      ta.readOnly = true;
    } else {
      ta.value = "";
      ta.readOnly = false;
      ta.placeholder = "Вставьте сюда JSON с настройками…";
      ta.focus();
    }
  }

  function applyConfigObject(next) {
    for (const key of Object.keys(DEFAULTS)) {
      Object.assign(cfg[key], next[key]);
    }
    commit();
    refresh();
  }

  panel.querySelector(".cfg-close").addEventListener("click", close);
  btn.addEventListener("click", toggle);

  panel.addEventListener("click", async (e) => {
    const act = e.target.closest("[data-act]")?.dataset.act;
    const ioAct = e.target.closest("[data-io]")?.dataset.io;
    if (act === "pause") {
      onPauseToggle?.();
      refresh();
    } else if (act === "video") {
      onExportVideo?.();
    } else if (act === "export") {
      showIO("export");
    } else if (act === "import") {
      showIO("import");
    } else if (act === "reset") {
      if (!confirm("Сбросить все настройки к значениям по умолчанию?")) return;
      resetStoredConfig();
      applyConfigObject(cloneDefaults());
      buildBody();
      refresh();
      onToast?.("Сброшено к умолчаниям");
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
      a.download = "logo-anim-settings.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } else if (ioAct === "apply") {
      try {
        const next = parseConfigJSON(ta.value);
        applyConfigObject(next);
        buildBody();
        refresh();
        onToast?.("Настройки применены");
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
    if (!isActive()) return;
    if (e.code === "KeyS") toggle();
    if (e.code === "Space") {
      e.preventDefault();
      onPauseToggle?.();
      refresh();
    }
  });

  buildBody();
  refresh();

  return { open, close, toggle, refresh, rebuild: () => { buildBody(); refresh(); } };
}

function decimals(step) {
  const s = String(step);
  return s.includes(".") ? s.split(".")[1].length : 0;
}
