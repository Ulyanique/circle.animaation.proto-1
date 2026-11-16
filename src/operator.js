import { OUTPUT, RECORDING_CHAIN } from "./scenes/catalog.js";
import { CHAIN_CANDIDATES } from "./recording-chain.js";
import { beatDuration, beatInBar, beatEvents, nearestBeat } from "./beat-grid.js";
import { isInteractiveTarget } from "./ui.js";
import { timelinePhases, timelineCursorPct, phaseTimeLabel, phaseTicks } from "./operator-timeline.js";

/** Не реагировать на обычную перемотку; автопереход только при пересечении шва воспроизведением. */
export function crossedBoundary(before, after, delay, cycle) {
  return cycle > 0 && after >= delay + cycle &&
    Math.floor((after - delay) / cycle) > Math.floor((Math.max(before, delay) - delay) / cycle);
}

/**
 * Единый пульт для всех готовых видов. В кадр и MP4 не входит.
 *
 * Пульт отвечает только за ролики и время: выбор сцены, перемотка, границы
 * входа и выхода, запись. Разрешение, качество превью и кодек переехали в
 * общие настройки (кнопка ⚙) — это технические параметры кадра, а не часть
 * монтажа, и в пульте они занимали всю вторую строку.
 */
export function createOperatorControls({ getState, seek, setDuration, setBoundary, togglePause, switchScene,
  record, recordChain, setChain }) {
  const panel = document.createElement("section");
  panel.className = "operator-panel";
  panel.setAttribute("aria-label", "Пульт заставок");
  panel.innerHTML = `
    <div class="operator-row operator-head">
      <span class="operator-label">РОЛИКИ</span>
      <nav class="operator-scenes" aria-label="Выбор ролика">
        <button type="button" data-scene="waiting" title="Интро — открытие вечера">01 <small>Интро</small></button>
        <button type="button" data-scene="brand" title="Фирменный фон">02 <small>Фон</small></button>
        <button type="button" data-scene="partners" title="Спонсоры и партнёры">04 <small>Спонсоры</small></button>
        <button type="button" data-scene="sponsor-promrukav" title="Заставка Промрукава: знак крупно по центру">05а <small>Промрукав</small></button>
        <button type="button" data-scene="sponsor-keaz" title="Заставка КЭАЗ: знак крупно по центру">05б <small>КЭАЗ</small></button>
        <button type="button" data-scene="photo-pause" title="Фотопауза">08 <small>Фотопауза</small></button>
        <button type="button" data-scene="finale" title="Финал">09 <small>Финал</small></button>
        <a class="operator-archive" href="./archive.html" title="Открыть отдельный 3D-прототип архива">Архив ↗</a>
      </nav>
      <button type="button" data-action="auto" aria-pressed="false" title="Автоматическая цепочка 01 → 02 → 08 → 09">Авто: выкл.</button>
      <button type="button" data-action="pin" aria-pressed="false" title="Не скрывать пульт">◇</button>
    </div>
    <div class="operator-timeline">
      <div class="operator-phases" data-role="phases" aria-hidden="true"></div>
      <div class="operator-track">
        <div class="operator-phase-band" data-role="band" aria-hidden="true"></div>
        <div class="operator-cursor" data-role="cursor" aria-hidden="true"></div>
        <input type="range" data-action="seek" min="0" step="0.0166666667" aria-label="Перемотка текущего ролика">
        <button type="button" class="operator-grip operator-grip-entry" data-edge="entry"
          role="slider" aria-label="Граница входа" title="Потяните, чтобы сдвинуть конец входа"></button>
        <button type="button" class="operator-grip operator-grip-exit" data-edge="exit"
          role="slider" aria-label="Граница выхода" title="Потяните, чтобы сдвинуть начало выхода"></button>
      </div>
      <div class="operator-marks" data-role="marks"></div>
    </div>
    <div class="operator-row operator-transport">
      <button type="button" data-action="play" title="Пауза или воспроизведение">Ⅱ</button>
      <button type="button" data-action="prev" title="Назад на кадр">−1</button>
      <button type="button" data-action="next" title="Вперёд на кадр">+1</button>
      <output data-role="time" aria-live="off"></output>
      <output data-role="beat" class="operator-beat" aria-live="off" title="Сетка такта: доля и такт"></output>
      <label class="operator-duration" title="Длительность полного цикла ролика">Цикл <input type="number" data-action="duration" min="1" max="300" step="0.1" aria-label="Длительность цикла в секундах"> с</label>
      <button type="button" data-action="record" title="Записать один цикл текущего ролика">● Ролик</button>
      <button type="button" data-action="record-chain" title="Записать выбранную цепочку сцен с переходами одним файлом">● Все ролики</button>
      <details class="operator-chain-picker">
        <summary title="Выбрать состав сцен для автопоказа и записи цепочки">Состав</summary>
        <div class="operator-chain-menu" role="group" aria-label="Сцены в цепочке">
          ${CHAIN_CANDIDATES.map((c) => `<label><input type="checkbox" data-chain-scene="${c.id}"> ${c.code} ${c.label}</label>`).join("")}
        </div>
      </details>
    </div>`;
  document.body.appendChild(panel);
  const range = panel.querySelector('[data-action="seek"]');
  const phasesEl = panel.querySelector('[data-role="phases"]');
  const bandEl = panel.querySelector('[data-role="band"]');
  const cursorEl = panel.querySelector('[data-role="cursor"]');
  const marksEl = panel.querySelector('[data-role="marks"]');
  const trackEl = panel.querySelector(".operator-track");
  const grips = [...panel.querySelectorAll(".operator-grip")];
  const duration = panel.querySelector('[data-action="duration"]');
  const autoButton = panel.querySelector('[data-action="auto"]');
  const pinButton = panel.querySelector('[data-action="pin"]');
  const beatEl = panel.querySelector('[data-role="beat"]');
  const timeEl = panel.querySelector('[data-role="time"]');
  let auto = false, pinned = false, dragging = false, editing = false;
  let grabbing = null; // { edge, pointerId } — тянем границу фазы

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

  // Ключ последней нарисованной полосы: пересобирать разметку фаз каждый кадр
  // (60 раз в секунду) незачем — она меняется только со сменой ролика или
  // длительностей цикла.
  let phasesKey = "";
  /**
   * Полоса фаз: вход / удержание / выход с метками времени. Ширины берутся из
   * конфига таймлайна, то есть полоса всегда совпадает с тем, что играет сцена.
   */
  function renderPhases(timeline) {
    const phases = timelinePhases(timeline);
    const key = phases.map((p) => `${p.key}:${p.startPct.toFixed(2)}:${p.endPct.toFixed(2)}`).join("|");
    if (key === phasesKey) return;
    phasesKey = key;
    if (!phases.length) {
      phasesEl.replaceChildren();
      marksEl.replaceChildren();
      bandEl.style.background = "none";
      return;
    }
    // Фон полосы: каждая фаза своей заливкой, чтобы границы читались без подписей.
    const stops = [];
    for (const phase of phases) {
      const tint = phase.key === "entry" ? "rgba(217,176,97,.16)"
        : phase.key === "hold" ? "rgba(217,176,97,.07)" : "rgba(122,86,48,.12)";
      stops.push(`${tint} ${phase.startPct}%`, `${tint} ${phase.endPct}%`);
    }
    bandEl.style.background = `linear-gradient(90deg, ${stops.join(", ")})`;
    // Метки над полосой: имя фазы и время её начала.
    phasesEl.replaceChildren(...phases.map((phase) => {
      const cell = document.createElement("span");
      cell.className = `operator-phase operator-phase-${phase.key}`;
      cell.style.left = `${phase.startPct}%`;
      cell.style.width = `${phase.widthPct}%`;
      cell.dataset.phase = phase.key;
      cell.innerHTML = `<b>${phase.label}</b><i>${phaseTimeLabel(phase.start)}</i>`;
      cell.title = `${phase.label}: ${phaseTimeLabel(phase.start)} — ${phaseTimeLabel(phase.end)}`;
      return cell;
    }));
    // Засечки внутренних стадий: где кончается прорисовка и начинается уход.
    marksEl.replaceChildren();
    for (const phase of phases) {
      for (const tick of phaseTicks(phase)) {
        const total = phases[phases.length - 1].end;
        const mark = document.createElement("span");
        mark.className = "operator-mark";
        mark.style.left = `${tick / total * 100}%`;
        mark.title = `${phase.label}: ${phaseTimeLabel(tick)}`;
        marksEl.appendChild(mark);
      }
    }
    // Ручки границ: конец входа и начало выхода.
    const entry = phases.find((p) => p.key === "entry");
    const exit = phases.find((p) => p.key === "exit");
    for (const grip of grips) {
      const phase = grip.dataset.edge === "entry" ? entry : exit;
      if (!phase) continue;
      grip.style.left = `${grip.dataset.edge === "entry" ? phase.endPct : phase.startPct}%`;
      grip.title = `${phase.label}: ${grip.dataset.edge === "entry" ? phaseTimeLabel(phase.end) : phaseTimeLabel(phase.start)} — потяните, чтобы сдвинуть границу`;
    }
  }

  function refresh() {
    const state = getState();
    const max = Math.max(0, state.cycle - 1 / OUTPUT.fps);
    range.max = String(max);
    const local = localTime(state);
    if (!dragging) range.value = String(Math.min(local, max));
    renderPhases(state.config.timeline);
    // Курсор ставится по той же сумме фаз, что и полоса, поэтому не съезжает.
    cursorEl.style.left = `${timelineCursorPct(local, state.config.timeline)}%`;
    timeEl.textContent = `${local.toFixed(2)} / ${state.cycle.toFixed(2)} с`;
    // Сетка такта: при 0 BPM подпись пустая, чтобы не занимать место.
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
    panel.querySelector('[data-action="play"]').textContent = state.config.playback.paused ? "▶" : "Ⅱ";
    for (const button of panel.querySelectorAll("[data-scene]")) {
      if (button.dataset.scene === state.id) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    }
    panel.classList.toggle("operator-busy", state.recording);
    for (const grip of grips) grip.disabled = state.recording;
    panel.querySelector('[data-action="record"]').textContent = state.recordingKind === "single" ? "◉ Ролик…" : "● Ролик";
    const activeChain = state.chain || RECORDING_CHAIN;
    const chainCodes = activeChain.map((id) => CHAIN_CANDIDATES.find((c) => c.id === id)?.code || id).join(" → ");
    for (const cb of panel.querySelectorAll("[data-chain-scene]")) {
      cb.checked = activeChain.includes(cb.dataset.chainScene);
      cb.disabled = state.recording || (cb.checked && activeChain.length <= 1);
    }
    const chainBtn = panel.querySelector('[data-action="record-chain"]');
    chainBtn.textContent = state.recordingKind === "sequence" ? "◉ Все ролики…" : "● Все ролики";
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

  /**
   * Тянуть границу фазы. Секунды берутся из положения указателя по ширине
   * дорожки: 100 % — полный цикл. Метка идёт за пальцем, а не «прыгает» к
   * ближайшему шагу, потому что границы задаются в секундах с точностью до
   * кадра.
   */
  function grab(edge, event) {
    if (getState().recording) return;
    const box = trackEl.getBoundingClientRect();
    if (box.width <= 0) return;
    const total = Math.max(0.001, getState().cycle);
    const seconds = Math.min(total, Math.max(0, (event.clientX - box.left) / box.width * total));
    if (setBoundary?.(edge, seconds) === false) return;
    refresh();
  }
  for (const grip of grips) {
    grip.addEventListener("pointerdown", (event) => {
      if (getState().recording) return;
      event.preventDefault();
      event.stopPropagation();
      grabbing = { edge: grip.dataset.edge, pointerId: event.pointerId };
      grip.classList.add("drag");
      // Захват указателя — удобство (тянуть за краем ручки), а не условие:
      // без активного указателя браузер бросает исключение, и это не ошибка.
      try { grip.setPointerCapture?.(event.pointerId); } catch (_) { /* нет захвата — тянем как есть */ }
      grab(grabbing.edge, event);
    });
    grip.addEventListener("pointermove", (event) => {
      if (!grabbing || grabbing.pointerId !== event.pointerId) return;
      event.preventDefault();
      grab(grabbing.edge, event);
    });
    const release = (event) => {
      if (!grabbing || grabbing.pointerId !== event.pointerId) return;
      grabbing = null;
      grip.classList.remove("drag");
      try { grip.releasePointerCapture?.(event.pointerId); } catch (_) { /* захвата не было */ }
    };
    grip.addEventListener("pointerup", release);
    grip.addEventListener("pointercancel", release);
    // Клавиатура: шаг одной камерой (1/60 с) и 0.5 с с Shift.
    grip.addEventListener("keydown", (event) => {
      const state = getState();
      if (state.recording) return;
      const edge = grip.dataset.edge;
      const current = edge === "entry"
        ? state.config.timeline.drawDuration + state.config.timeline.emergeDuration
        : state.cycle - (state.config.timeline.fadeDuration + state.config.timeline.restDuration);
      const step = event.shiftKey ? 0.5 : 1 / OUTPUT.fps;
      if (event.code === "ArrowLeft" || event.code === "ArrowRight") {
        event.preventDefault();
        const sign = event.code === "ArrowRight" ? 1 : -1;
        if (setBoundary?.(edge, current + sign * step) !== false) refresh();
      }
    });
  }

  panel.addEventListener("pointerdown", (event) => {
    if (event.target === range) dragging = true;
  });
  window.addEventListener("pointerup", () => { dragging = false; });
  range.addEventListener("input", () => jump(Number(range.value)));
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
