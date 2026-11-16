import { OUTPUT, RECORDING_CHAIN } from "./scenes/catalog.js";
import { MASTER_PRESETS, masterPreset } from "./output-profile.js";
import { QUALITY_PRESETS } from "./quality-presets.js";
import { DELIVERY_OPTIONS, probeAllDeliveries } from "./delivery.js";
import { CHAIN_CANDIDATES } from "./recording-chain.js";
import { videoBitrateFor } from "./offline-video.js";
import { beatDuration, beatInBar, beatEvents, nearestBeat } from "./beat-grid.js";
import { isInteractiveTarget } from "./ui.js";

/** Не реагировать на обычную перемотку; автопереход только при пересечении шва воспроизведением. */
export function crossedBoundary(before, after, delay, cycle) {
  return cycle > 0 && after >= delay + cycle &&
    Math.floor((after - delay) / cycle) > Math.floor((Math.max(before, delay) - delay) / cycle);
}

/** Единый пульт для всех готовых видов. В кадр и MP4 не входит. */
export function createOperatorControls({ getState, seek, setDuration, togglePause, switchScene, setMaster, setQuality,
  setDelivery, setChain, record, recordChain }) {
  const panel = document.createElement("section");
  panel.className = "operator-panel";
  panel.setAttribute("aria-label", "Пульт заставок");
  panel.innerHTML = `
    <div class="operator-row">
      <span class="operator-label">РОЛИКИ</span>
      <nav class="operator-scenes" aria-label="Выбор ролика">
        <button type="button" data-scene="waiting" title="Интро — открытие вечера">01 <small>Интро</small></button>
        <button type="button" data-scene="brand" title="Фирменный фон">02 <small>Фон</small></button>
        <button type="button" data-scene="partners" title="Спонсоры и партнёры">04 <small>Спонсоры</small></button>
        <button type="button" data-scene="photo-pause" title="Фотопауза">08 <small>Фотопауза</small></button>
        <button type="button" data-scene="finale" title="Финал">09 <small>Финал</small></button>
        <a class="operator-archive" href="./archive.html" title="Открыть отдельный 3D-прототип архива">Архив ↗</a>
      </nav>
      <button type="button" data-action="auto" aria-pressed="false" title="Автоматическая цепочка 01 → 02 → 08 → 09">Авто: выкл.</button>
      <button type="button" data-action="pin" aria-pressed="false" title="Не скрывать пульт">◇</button>
    </div>
    <div class="operator-row operator-transport">
      <button type="button" data-action="play" title="Пауза или воспроизведение">Ⅱ</button>
      <button type="button" data-action="prev" title="Назад на кадр">−1</button>
      <input type="range" data-action="seek" min="0" step="0.0166666667" aria-label="Перемотка текущего ролика">
      <button type="button" data-action="next" title="Вперёд на кадр">+1</button>
      <output data-role="time" aria-live="off"></output>
      <output data-role="beat" class="operator-beat" aria-live="off" title="Сетка такта: доля и такт"></output>
      <label class="operator-duration">Цикл <input type="number" data-action="duration" min="1" max="300" step="0.1" aria-label="Длительность цикла в секундах"> с</label>
      <label class="operator-master">Мастер
        <select data-action="master" aria-label="Разрешение мастер-кадра">
          ${Object.values(MASTER_PRESETS).map((preset) => `<option value="${preset.id}">${preset.label}</option>`).join("")}
        </select>
      </label>
      <label class="operator-master">Качество
        <select data-action="quality" aria-label="Пресет качества кадра">
          ${Object.values(QUALITY_PRESETS).map((preset) => `<option value="${preset.id}" title="${preset.description}">${preset.label}</option>`).join("")}
        </select>
      </label>
      <label class="operator-master">Файл
        <select data-action="delivery" aria-label="Кодек и глубина цвета записи">
          ${Object.values(DELIVERY_OPTIONS).map((option) => `<option value="${option.id}" title="${option.description}">${option.label}</option>`).join("")}
        </select>
      </label>
      <button type="button" data-action="record" title="Записать один цикл текущей заставки">● Цикл</button>
      <button type="button" data-action="record-chain" title="Записать выбранную цепочку сцен с переходами одним файлом">● Вся цепочка</button>
      <details class="operator-chain-picker">
        <summary title="Выбрать состав сцен для автопоказа и записи цепочки">Состав</summary>
        <div class="operator-chain-menu" role="group" aria-label="Сцены в цепочке">
          ${CHAIN_CANDIDATES.map((c) => `<label><input type="checkbox" data-chain-scene="${c.id}"> ${c.code} ${c.label}</label>`).join("")}
        </div>
      </details>
    </div>`;
  document.body.appendChild(panel);
  const range = panel.querySelector('[data-action="seek"]');
  const duration = panel.querySelector('[data-action="duration"]');
  const masterSelect = panel.querySelector('[data-action="master"]');
  const qualitySelect = panel.querySelector('[data-action="quality"]');
  const deliverySelect = panel.querySelector('[data-action="delivery"]');
  const autoButton = panel.querySelector('[data-action="auto"]');
  const pinButton = panel.querySelector('[data-action="pin"]');
  let auto = false, pinned = false, dragging = false, editing = false;
  let probeToken = 0, lastProbedMaster = null;

  /** Подсветить в селекторе «Файл», какие варианты доставки браузер реально кодирует в текущем разрешении. */
  async function refreshDeliveryProbe(masterKey) {
    if (masterKey === lastProbedMaster) return;
    lastProbedMaster = masterKey;
    const token = ++probeToken;
    const size = masterPreset(masterKey);
    try {
      const results = await probeAllDeliveries({
        width: size.width, height: size.height,
        bitrate: videoBitrateFor(size.width, size.height), fps: OUTPUT.fps,
      });
      if (token !== probeToken) return;
      for (const optionEl of deliverySelect.options) {
        const option = DELIVERY_OPTIONS[optionEl.value];
        const status = results[optionEl.value];
        if (!option || !status) continue;
        optionEl.textContent = status.ok ? option.label : `${option.label} · недоступно`;
        optionEl.title = status.ok ? option.description : `${option.description}\nПричина: ${status.reason}`;
      }
    } catch (_) { /* в окружении без WebCodecs оставляем исходные подписи */ }
  }
  let idleTimer;
  function awaken() {
    document.body.classList.remove("operator-idle");
    clearTimeout(idleTimer);
    if (!pinned) idleTimer = setTimeout(() => {
      if (!panel.contains(document.activeElement) && !document.body.classList.contains("ui-on"))
        document.body.classList.add("operator-idle");
    }, 3200);
  }
  document.addEventListener("pointermove", awaken, { passive: true });
  document.addEventListener("pointerdown", awaken, { passive: true });
  document.addEventListener("keydown", (event) => { if (event.code === "Tab") awaken(); });
  panel.addEventListener("focusin", awaken);
  panel.addEventListener("focusout", awaken);
  panel.addEventListener("pointerup", (event) => {
    if (event.target.closest("button, input[type=range]")) event.target.blur();
  });
  awaken();
  function localTime(state) {
    const elapsed = state.time - state.config.timeline.startDelay;
    return elapsed < 0 ? 0 : ((elapsed % state.cycle) + state.cycle) % state.cycle;
  }
  function refresh() {
    const state = getState();
    const max = Math.max(0, state.cycle - 1 / OUTPUT.fps);
    range.max = String(max);
    const local = localTime(state);
    if (!dragging) range.value = String(Math.min(local, max));
    panel.querySelector('[data-role="time"]').textContent = `${local.toFixed(2)} / ${state.cycle.toFixed(2)} с`;
    // Сетка такта: при 0 BPM подпись пустая, чтобы не занимать место.
    const beatEl = panel.querySelector('[data-role="beat"]');
    const beat = beatDuration(state.config.timeline);
    if (beat > 0) {
      const index = nearestBeat(local, state.config.timeline) + 1;
      // Ближайшее событие: по нему видно, что показ идёт «в долю», а не мимо.
      const events = beatEvents(state.config.timeline, state.config.timeline);
      const next = Object.entries(events.snapped)
        .map(([key, value]) => ({ key, value, delta: value - local }))
        .filter(({ delta }) => delta >= -1e-9)
        .sort((a, b) => a.delta - b.delta)[0];
      const labels = { emerge: "знак", caption: "титр", exit: "уход" };
      const tail = next && next.delta < 3
        ? ` → ${labels[next.key] || next.key} через ${next.delta.toFixed(2)} с`
        : "";
      beatEl.textContent = `такт ${Math.floor((index - 1) / 4) + 1} · доля ${beatInBar(local, state.config.timeline)}${tail}`;
      beatEl.hidden = false;
    } else {
      beatEl.textContent = "";
      beatEl.hidden = true;
    }
    if (!editing) duration.value = state.cycle.toFixed(1);
    masterSelect.value = state.master;
    masterSelect.disabled = state.recording;
    refreshDeliveryProbe(state.master);
    qualitySelect.value = state.quality;
    qualitySelect.disabled = state.recording;
    deliverySelect.value = state.delivery;
    deliverySelect.disabled = state.recording;
    panel.querySelector('[data-action="play"]').textContent = state.config.playback.paused ? "▶" : "Ⅱ";
    for (const button of panel.querySelectorAll("[data-scene]")) {
      if (button.dataset.scene === state.id) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    }
    panel.classList.toggle("operator-busy", state.recording);
    panel.querySelector('[data-action="record"]').textContent = state.recordingKind === "single" ? "◉ Запись…" : "● Цикл";
    const activeChain = state.chain || RECORDING_CHAIN;
    const chainCodes = activeChain.map((id) => CHAIN_CANDIDATES.find((c) => c.id === id)?.code || id).join(" → ");
    for (const cb of panel.querySelectorAll("[data-chain-scene]")) {
      cb.checked = activeChain.includes(cb.dataset.chainScene);
      cb.disabled = state.recording || (cb.checked && activeChain.length <= 1);
    }
    const chainBtn = panel.querySelector('[data-action="record-chain"]');
    chainBtn.textContent = state.recordingKind === "sequence" ? "◉ Цепочка…" : "● Вся цепочка";
    chainBtn.title = `Записать ${chainCodes} с переходами одним файлом`;
    autoButton.title = `Автоматическая цепочка ${chainCodes}`;
  }
  function jump(value) {
    const state = getState();
    if (state.recording) return;
    const max = Math.max(0, state.cycle - 1 / OUTPUT.fps);
    seek(state.config.timeline.startDelay + Math.min(max, Math.max(0, value)));
    refresh();
  }
  range.addEventListener("pointerdown", () => { dragging = true; });
  window.addEventListener("pointerup", () => { dragging = false; });
  range.addEventListener("input", () => jump(Number(range.value)));
  masterSelect.addEventListener("change", () => { if (!setMaster(masterSelect.value)) refresh(); });
  qualitySelect.addEventListener("change", () => { if (!setQuality(qualitySelect.value)) refresh(); });
  deliverySelect.addEventListener("change", () => { if (!setDelivery(deliverySelect.value)) refresh(); });
  panel.addEventListener("change", (event) => {
    if (!(event.target instanceof HTMLInputElement) || !event.target.dataset.chainScene) return;
    if (getState().recording) { refresh(); return; }
    const next = [...panel.querySelectorAll("[data-chain-scene]")]
      .filter((cb) => cb.checked)
      .map((cb) => cb.dataset.chainScene);
    setChain?.(next);
    refresh();
  });
  duration.addEventListener("focus", () => { editing = true; });
  duration.addEventListener("blur", () => { editing = false; refresh(); });
  duration.addEventListener("change", () => {
    if (getState().recording) return;
    const seconds = Number(duration.value);
    if (Number.isFinite(seconds) && seconds > 0) setDuration(seconds);
    editing = false; refresh();
  });
  panel.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    const state = getState();
    if (button.dataset.scene) {
      if (!state.recording) switchScene(button.dataset.scene);
      return;
    }
    const action = button.dataset.action;
    if (action === "auto") {
      auto = !auto;
      autoButton.textContent = auto ? "Авто: вкл." : "Авто: выкл.";
      autoButton.setAttribute("aria-pressed", String(auto));
    } else if (action === "pin") {
      pinned = !pinned;
      pinButton.textContent = pinned ? "◆" : "◇";
      pinButton.setAttribute("aria-pressed", String(pinned));
      awaken();
    } else if (!state.recording && action === "play") {
      togglePause(); refresh();
    } else if (!state.recording && (action === "prev" || action === "next")) {
      jump(localTime(state) + (action === "next" ? 1 : -1) / OUTPUT.fps);
    } else if (action === "record") record();
    else if (action === "record-chain") recordChain();
  });
  window.addEventListener("keydown", (event) => {
    if (isInteractiveTarget(event.target) || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.code === "Space" && !getState().recording) {
      event.preventDefault(); togglePause(); refresh();
    }
    if (event.code === "KeyR") {
      pinned = !pinned;
      pinButton.textContent = pinned ? "◆" : "◇";
      pinButton.setAttribute("aria-pressed", String(pinned));
      awaken();
    }
    if (event.code === "ArrowLeft" || event.code === "ArrowRight") {
      event.preventDefault();
      const state = getState();
      jump(localTime(state) + (event.code === "ArrowRight" ? 1 : -1) / OUTPUT.fps);
    }
  });
  refresh();
  return { get auto() { return auto; }, refresh, panel, awaken };
}
