import { OUTPUT } from "./scenes/catalog.js";

/** Не реагировать на обычную перемотку; автопереход только при пересечении шва воспроизведением. */
export function crossedBoundary(before, after, delay, cycle) {
  return cycle > 0 && after >= delay + cycle &&
    Math.floor((after - delay) / cycle) > Math.floor((Math.max(before, delay) - delay) / cycle);
}

/** Единый пульт для всех готовых видов. В кадр и WebM не входит. */
export function createOperatorControls({ getState, seek, setDuration, togglePause, switchScene, record, recordChain }) {
  const panel = document.createElement("section");
  panel.className = "operator-panel";
  panel.setAttribute("aria-label", "Пульт заставок");
  panel.innerHTML = `
    <div class="operator-row">
      <span class="operator-label">ЗАСТАВКИ</span>
      <nav class="operator-scenes" aria-label="Выбор заставки">
        <button type="button" data-scene="waiting" title="Заставка ожидания">01 <small>Ожидание</small></button>
        <button type="button" data-scene="brand" title="Фирменный фон">02 <small>Фон</small></button>
        <button type="button" data-scene="photo-pause" title="Фотопауза">08 <small>Фотопауза</small></button>
        <button type="button" data-scene="finale" title="Финал">09 <small>Финал</small></button>
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
      <label class="operator-duration">Цикл <input type="number" data-action="duration" min="1" max="300" step="0.1" aria-label="Длительность цикла в секундах"> с</label>
      <button type="button" data-action="record" title="Записать один цикл текущей заставки">● Цикл</button>
      <button type="button" data-action="record-chain" title="Записать 01 → 02 → 08 → 09 с переходами одним WebM">● Вся цепочка</button>
    </div>`;
  document.body.appendChild(panel);
  const range = panel.querySelector('[data-action="seek"]');
  const duration = panel.querySelector('[data-action="duration"]');
  const autoButton = panel.querySelector('[data-action="auto"]');
  const pinButton = panel.querySelector('[data-action="pin"]');
  let auto = false, pinned = false, dragging = false, editing = false;
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
    if (!editing) duration.value = state.cycle.toFixed(1);
    panel.querySelector('[data-action="play"]').textContent = state.config.playback.paused ? "▶" : "Ⅱ";
    for (const button of panel.querySelectorAll("[data-scene]")) {
      if (button.dataset.scene === state.id) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    }
    panel.classList.toggle("operator-busy", state.recording);
    panel.querySelector('[data-action="record"]').textContent = state.recordingKind === "single" ? "◉ Запись…" : "● Цикл";
    panel.querySelector('[data-action="record-chain"]').textContent = state.recordingKind === "sequence" ? "◉ Цепочка…" : "● Вся цепочка";
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
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
    if (event.code === "Space" && getState().id !== "waiting" && !getState().recording) {
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
