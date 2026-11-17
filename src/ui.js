import {
  SCHEMA, cloneDefaults, configToJSON, parseConfigJSON, parseProjectJSON,
} from "./config.js";
import {
  saveSceneSnapshot, loadSceneSnapshot, hasSceneSnapshot, encodeConfigShareHash,
} from "./scene-snapshots.js";
import { FRAME_SECTIONS, frameSummary, probeDeliveries } from "./output-settings.js";

/** Игнорировать глобальные хоткеи, когда фокус в интерактивном поле или кнопке. */
export function isInteractiveTarget(target) {
  if (!(target instanceof Element)) return false;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement || target instanceof HTMLButtonElement ||
      target.isContentEditable) return true;
  return Boolean(target.closest("button, a[href], select, textarea, input, [contenteditable='true']"));
}

/** Определить по разобранному JSON, является ли он файлом всего проекта (`{ scenes: ... }`). */
export function isProjectPayload(data) {
  return Boolean(data && typeof data === "object" && !Array.isArray(data) &&
    data.scenes && typeof data.scenes === "object" && !Array.isArray(data.scenes));
}

/**
 * Панель настроек: у каждой сцены свой набор параметров.
 * Кнопка ⚙ (правый верх) → вкладки 01/02/04/08/09, экспорт/импорт JSON сцены
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
  getFrameSettings,
  onFrameSetting,
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
      <div class="cfg-heading"><span class="cfg-kicker">КОНСТРУКТОР / СЦЕНА <em class="cfg-scene-name"></em></span><span class="cfg-title">Настройки</span></div>
      <button type="button" class="cfg-close" aria-label="Закрыть">×</button>
    </header>
    <nav class="cfg-tabs" aria-label="Сцены"></nav>
    <div class="cfg-tools">
      <span class="cfg-tools-label">Действия</span>
      <button type="button" data-act="pause">Пауза</button>
      <button type="button" data-act="export">Экспорт сцены</button>
      <button type="button" data-act="export-project">Экспорт проекта</button>
      <button type="button" data-act="video">Экспорт видео</button>
      <button type="button" data-act="import">Импорт</button>
      <button type="button" data-act="share-link" title="Скопировать короткую ссылку на текущие настройки сцены">Ссылка на сцену</button>
      <button type="button" data-act="reset">Сброс сцены</button>
      <div class="cfg-slots" role="group" aria-label="Сравнение вариантов A и B">
        <span class="cfg-slots-label">Варианты A/B:</span>
        <button type="button" data-slot-save="A" title="Сохранить текущие настройки в слот A">Запомнить A</button>
        <button type="button" data-slot-load="A" title="Применить настройки из слота A">A</button>
        <button type="button" data-slot-save="B" title="Сохранить текущие настройки в слот B">Запомнить B</button>
        <button type="button" data-slot-load="B" title="Применить настройки из слота B">B</button>
      </div>
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
    <section class="cfg-frame" aria-label="Кадр и запись">
      <h3 class="cfg-frame-head">Кадр и запись<span class="cfg-frame-summary" data-role="frame-summary"></span></h3>
      <p class="cfg-io-hint">Общие для всех сцен: разрешение мастер-кадра, качество просмотра и кодек файла. Нижний пульт отвечает только за ролики и время.</p>
      <div class="cfg-frame-rows">
        ${FRAME_SECTIONS.map((section) => `
        <label class="cfg-row">
          <span class="cfg-name">${section.label}</span>
          <span class="cfg-ctl">
            <select data-frame="${section.id}" aria-label="${section.label}">
              ${section.options.map((option) => `<option value="${option.value}">${option.label}</option>`).join("")}
            </select>
          </span>
        </label>`).join("")}
      </div>
    </section>
  `;
  document.body.appendChild(panel);

  const body = panel.querySelector(".cfg-body");
  const tabs = panel.querySelector(".cfg-tabs");
  const io = panel.querySelector(".cfg-io");
  const ioHint = panel.querySelector(".cfg-io-hint");
  const ta = panel.querySelector(".cfg-textarea");
  const pauseBtn = panel.querySelector('[data-act="pause"]');
  const sceneName = panel.querySelector(".cfg-scene-name");
  const frameSummaryEl = panel.querySelector('[data-role="frame-summary"]');
  const frameSelects = [...panel.querySelectorAll("[data-frame]")];
  let probeKey = "", probeToken = 0;
  const inputs = []; // { set } для синхронизации значений
  let editing = getSceneId();
  let ioMode = "export";

  const cfg = () => getConfig(editing);
  const defs = () => getDefaults(editing);
  const sceneLabel = (id) => scenes.find((s) => s.id === id)?.label || id.toUpperCase();

  function commit(section, key) {
    onConfigChange?.(editing, section, key);
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
      if (editing === "partners" && !["partners", "typography", "timeline", "playback", "transition"].includes(section.id)) continue;
      if (!current[section.id] || (section.id === "caption" && editing === "photo-pause")) continue;
      const det = document.createElement("details");
      det.className = "cfg-sec";
      det.dataset.section = section.id;
      det.open = false;
      const sum = document.createElement("summary");
      sum.textContent = section.title;
      det.appendChild(sum);
      if (section.id === "partners") {
        const note = document.createElement("p"); note.className = "cfg-io-hint";
        note.textContent = "Исходные названия показывают встроенные золотые логотипы; можно загрузить свой SVG/PNG или ввести произвольный текст.";
        det.appendChild(note);
      }
      if (section.id === "caption") {
        const note = document.createElement("p");
        note.className = "cfg-io-hint";
        note.textContent = "«Вписать в поля» уменьшает строку по ширине до ориентировочных полей 5%; для длинного текста проверьте читаемость и положение вручную.";
        det.appendChild(note);
      }
      if (section.id === "transition") {
        const note = document.createElement("p");
        note.className = "cfg-io-hint";
        note.textContent = "Используется при входе в эту сцену в просмотре и в записи цепочки; на одиночный цикл не влияет. Задавайте короче длительности сцены.";
        det.appendChild(note);
      }
      if (section.id === "finale") {
        const note = document.createElement("p");
        note.className = "cfg-io-hint";
        note.textContent = "Если этапы фразы не помещаются, они сокращаются. Увеличьте удержание или фазу ухода на таймлайне.";
        det.appendChild(note);
      }
      for (const f of section.fields) {
        if (!(f.key in current[section.id])) continue;
        if (section.id === "typography" && ((editing === "brand" && /^(subtitle|date)/.test(f.key)) ||
            ((editing === "photo-pause" || editing === "partners") && !["font", "titleFont", "captionFont"].includes(f.key)) || (editing === "finale" && f.key.startsWith("date")))) continue;
        if (section.id === "logo" && (editing === "waiting" || editing === "photo-pause" || editing === "finale") && (f.key === "swayAmount" || f.key === "swaySpeed")) continue;
        if (section.id === "caption" && ((editing === "brand" && /^(subtitle|date)/.test(f.key)) ||
            (editing === "finale" && f.key.startsWith("date")))) continue;
        const row = document.createElement("label");
        row.className = "cfg-row cfg-" + f.type;
        const name = document.createElement("span");
        name.className = "cfg-name";
        name.textContent = section.id === 'photo' && editing === 'brand' && f.key === 'color' ? 'Исходный цвет надписи' : f.label;
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
            commit(section.id, f.key);
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
            commit(section.id, f.key);
          });
        } else if (f.type === "text") {
          const input = document.createElement("input");
          input.type = "text";
          input.maxLength = f.maxLength || 100;
          input.dataset.key = `${section.id}.${f.key}`;
          input.value = holder[f.key];
          input.addEventListener("input", () => { holder[f.key] = input.value; commit(section.id, f.key); });
          inputs.push({ set: () => { input.value = holder[f.key]; } });
          row.appendChild(input);
        } else if (f.type === "select") {
          const input = document.createElement("select");
          input.dataset.key = `${section.id}.${f.key}`;
          for (const option of f.options) {
            const el = document.createElement("option");
            el.value = option.value; el.textContent = option.label;
            input.appendChild(el);
          }
          input.value = holder[f.key];
          input.addEventListener("change", () => { holder[f.key] = input.value; commit(section.id, f.key); });
          inputs.push({ set: () => { input.value = holder[f.key]; } });
          row.appendChild(input);
        } else if (f.type === "color") {
          const input = document.createElement("input");
          input.type = "color";
          input.dataset.key = `${section.id}.${f.key}`;
          input.value = holder[f.key] ?? f.fallback ?? "#000000";
          input.addEventListener("input", () => {
            holder[f.key] = input.value;
            commit(section.id, f.key);
          });
          inputs.push({ set: () => { input.value = holder[f.key] ?? f.fallback ?? "#000000"; } });
          row.appendChild(input);
          if (f.fallback) {
            const reset = document.createElement("button");
            reset.type = "button"; reset.textContent = "Исходный";
            reset.title = "Вернуть исходное оформление";
            reset.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); holder[f.key] = defaults[section.id][f.key]; input.value = holder[f.key] ?? f.fallback; commit(section.id, f.key); });
            row.appendChild(reset);
          }
        } else if (f.type === "bool") {
          const input = document.createElement("input");
          input.type = "checkbox";
          input.dataset.key = `${section.id}.${f.key}`;
          input.checked = !!holder[f.key];
          input.addEventListener("change", () => {
            holder[f.key] = input.checked;
            commit(section.id, f.key);
          });
          inputs.push({ set: () => { input.checked = !!holder[f.key]; } });
          row.appendChild(input);
        } else if (f.type === "image") {
          const wrap = document.createElement("span");
          wrap.className = "cfg-ctl cfg-image-ctl";
          const fileInput = document.createElement("input");
          fileInput.type = "file";
          fileInput.accept = "image/svg+xml,image/png,image/webp,image/jpeg";
          fileInput.hidden = true;
          fileInput.dataset.key = `${section.id}.${f.key}`;
          const pickBtn = document.createElement("button");
          pickBtn.type = "button";
          const clearBtn = document.createElement("button");
          clearBtn.type = "button";
          clearBtn.textContent = "×";
          clearBtn.title = "Убрать загруженный логотип";
          const syncButtons = () => {
            const hasImage = typeof holder[f.key] === "string" && holder[f.key].startsWith("data:image/");
            pickBtn.textContent = hasImage ? "Заменить…" : "Загрузить…";
            clearBtn.hidden = !hasImage;
          };
          pickBtn.addEventListener("click", (ev) => { ev.preventDefault(); fileInput.click(); });
          fileInput.addEventListener("change", () => {
            const file = fileInput.files?.[0];
            fileInput.value = "";
            if (!file) return;
            if (file.size > 1536 * 1024) {
              onToast?.("Файл логотипа больше 1,5 МБ — используйте компактный SVG или PNG", true);
              return;
            }
            const reader = new FileReader();
            reader.onload = () => {
              if (typeof reader.result === "string" && reader.result.startsWith("data:image/")) {
                holder[f.key] = reader.result;
                syncButtons();
                commit(section.id, f.key);
              }
            };
            reader.readAsDataURL(file);
          });
          clearBtn.addEventListener("click", (ev) => {
            ev.preventDefault();
            holder[f.key] = "";
            syncButtons();
            commit(section.id, f.key);
          });
          syncButtons();
          inputs.push({ set: syncButtons });
          wrap.append(fileInput, pickBtn, clearBtn);
          row.appendChild(wrap);
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
    syncFrame();
    pauseBtn.classList.toggle("on", !!cfg().playback.paused);
    for (const slot of ["A", "B"]) {
      const btnLoad = panel.querySelector(`[data-slot-load="${slot}"]`);
      if (btnLoad) btnLoad.disabled = !hasSceneSnapshot(editing, slot);
    }
  }


  /**
   * Кадр и запись: значения приходят снаружи (они не часть сцены), поэтому
   * селекты не пишут в конфиг, а просят применить значение и показывают
   * фактическое состояние — если браузер откажет, подпись не соврёт.
   */
  function syncFrame() {
    const frame = getFrameSettings?.();
    if (!frame) return;
    for (const select of frameSelects) {
      select.value = frame[select.dataset.frame] ?? "";
    }
    frameSummaryEl.textContent = frameSummary(frame);
    // Проверку кодеков делаем один раз на разрешение: она тянет кодировщик.
    if (frame.master !== probeKey) {
      const key = frame.master;
      probeKey = key;
      const token = ++probeToken;
      probeDeliveries(key).then((results) => {
        if (!results || token !== probeToken) return;
        for (const option of panel.querySelector(`[data-frame="delivery"]`).options) {
          const row = results[option.value];
          if (!row) continue;
          // Подпись кодека не должна «перескакивать»: восстанавливаем из каталога
          // исходный текст и добавляем пометку только когда кодек недоступен.
          const base = FRAME_SECTIONS.find((s) => s.id === "delivery")
            ?.options.find((o) => o.value === option.value)?.label ?? option.textContent;
          option.textContent = row.ok ? base : `${base} · недоступно`;
          option.title = row.ok ? "" : (row.reason || "кодировщик недоступен в этом браузере");
        }
      });
    }
  }
  panel.addEventListener("change", (event) => {
    if (!(event.target instanceof HTMLSelectElement) || !event.target.dataset.frame) return;
    const applied = onFrameSetting?.(event.target.dataset.frame, event.target.value);
    if (applied === false) {
      onToast?.("Во время записи или перехода этот параметр менять нельзя", true);
    }
    syncFrame();
  });

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
    const slotSave = e.target.closest("[data-slot-save]")?.dataset.slotSave;
    const slotLoad = e.target.closest("[data-slot-load]")?.dataset.slotLoad;
    if (slotSave === "A" || slotSave === "B") {
      if (saveSceneSnapshot(editing, slotSave, cfg())) {
        refresh();
        onToast?.(`Вариант ${slotSave} сохранён для сцены ${sceneLabel(editing)}`);
      } else {
        onToast?.(`Не удалось сохранить вариант ${slotSave}`, true);
      }
      return;
    }
    if (slotLoad === "A" || slotLoad === "B") {
      const snap = loadSceneSnapshot(editing, slotLoad);
      if (!snap) return;
      onApplyScene?.(editing, snap);
      rebuild();
      onToast?.(`Применён вариант ${slotLoad} сцены ${sceneLabel(editing)}`);
      return;
    }
    if (act === "pause") {
      onPauseToggle?.();
      refresh();
    } else if (act === "video") {
      onExportVideo?.();
    } else if (act === "share-link") {
      const url = new URL(location.href);
      url.searchParams.set("scene", editing === "waiting" ? "intro" : editing);
      url.hash = `cfg=${encodeConfigShareHash(cfg(), defs())}`;
      try {
        await navigator.clipboard.writeText(url.href);
        onToast?.("Ссылка на сцену скопирована");
      } catch (_) {
        showIO("export", url.href, "Скопируйте ссылку для просмотра этих настроек:");
      }
    } else if (act === "export") {
      showIO("export", configToJSON(cfg()), `Сцена ${sceneLabel(editing)} — эти значения можно прислать как умолчание.`);
    } else if (act === "export-project") {
      showIO("export", getProjectJSON?.() || "", "Все готовые сцены одним файлом.");
    } else if (act === "import") {
      showIO("import");
    } else if (act === "reset") {
      if (!confirm(`Сбросить настройки сцены ${sceneLabel(editing)} к умолчаниям? При необходимости сначала скачайте экспорт проекта.`)) return;
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
      let isProject = false;
      try { isProject = ioMode === "export" && isProjectPayload(JSON.parse(ta.value)); } catch (_) { /* noop */ }
      a.download = isProject ? "circle-scenes.json" : `circle-${editing}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } else if (ioAct === "apply") {
      try {
        const text = ta.value.trim();
        if (!text) throw new Error("пустой JSON");
        const parsed = JSON.parse(text);
        if (isProjectPayload(parsed)) {
          const project = parseProjectJSON(text, scenes.map((s) => s.id));
          if (!confirm("Импорт заменит настройки указанных сцен и очистит их историю. При необходимости сначала скачайте экспорт проекта. Продолжить?")) return;
          onApplyProject?.(project.scenes);
          rebuild();
          onToast?.("Настройки проекта применены");
        } else {
          const next = parseConfigJSON(text, defs());
          if (!confirm(`Импорт заменит настройки сцены ${sceneLabel(editing)} и очистит её историю. При необходимости сначала скачайте экспорт проекта. Продолжить?`)) return;
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

  // горячие клавиши: S открывает/закрывает панель; Space централизованно обрабатывается в operator.js
  window.addEventListener("keydown", (e) => {
    if (isInteractiveTarget(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.code === "KeyS") toggle();
  });

  /** Сцена переключилась из пульта или по ссылке: панель идёт следом. */
  function syncScene() {
    if (!panel.classList.contains("open")) { editing = getSceneId(); return; }
    rebuild();
  }

  buildTabs();
  buildBody();
  refresh();

  function openSection(id) {
    open();
    const section = body.querySelector(`[data-section="${id}"]`);
    if (section) { section.open = true; section.scrollIntoView({ block: "nearest" }); }
  }
  return { open, close, toggle, refresh, rebuild, syncScene, openSection };
}

function decimals(step) {
  const s = String(step);
  return s.includes(".") ? s.split(".")[1].length : 0;
}
