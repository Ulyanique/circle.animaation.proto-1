import { cycleDuration } from "./runtime.js";
import { OUTPUT } from "./scenes/catalog.js";

// Режиссёрский просмотр: необязательная DOM-панель поверх превью.
// Не попадает в WebGL-кадр и не меняет настройки рендера.
export function reviewMarkers(tl) {
  const D = tl.drawDuration, E = tl.emergeDuration, H = tl.holdDuration, F = tl.fadeDuration;
  return [
    { label: "Точка", time: Math.min(0.5, D * 0.2) },
    { label: "Передача", time: D * 0.87 },
    { label: "Контур", time: D + E * 0.08 },
    { label: "Золото", time: D + E * 0.65 },
    { label: "Блик", time: D + E + Math.min(0.58, H * 0.08) },
    { label: "Композиция", time: D + E + H * 0.55 },
    { label: "Уход", time: D + E + H + F * 0.92 },
  ];
}

export function createReviewControls(cfg, { getTime, seek, onPause, isRecording }) {
  const panel = document.createElement("section");
  panel.className = "review-panel";
  panel.setAttribute("aria-label", "Режиссёрский просмотр");
  panel.hidden = true;
  panel.innerHTML = `
    <div class="review-header"><span>ПРОСМОТР · ИНТРО</span><button type="button" class="review-close" aria-label="Скрыть панель">×</button></div>
    <div class="review-actions">
      <button type="button" class="review-play" aria-label="Пауза или воспроизведение"></button>
      <button type="button" class="review-step" data-step="-1" aria-label="Предыдущий кадр">−1 кадр</button>
      <button type="button" class="review-step" data-step="1" aria-label="Следующий кадр">+1 кадр</button>
      <output class="review-time" aria-live="off"></output>
    </div>
    <input class="review-range" type="range" min="0" step="0.0166666667" aria-label="Позиция в цикле, секунды">
    <div class="review-markers"></div>
    <p class="review-hint">60 FPS · без звука · R — панель · ← / → — один кадр</p>`;
  document.body.appendChild(panel);
  const range = panel.querySelector(".review-range");
  const time = panel.querySelector(".review-time");
  const play = panel.querySelector(".review-play");
  const markers = panel.querySelector(".review-markers");
  let dragging = false;
  let signature = "";
  const getCycle = () => cycleDuration(cfg.timeline);
  const position = () => {
    const cycle = getCycle();
    return ((getTime() - cfg.timeline.startDelay) % cycle + cycle) % cycle;
  };
  function refresh() {
    if (panel.hidden) return;
    const cycle = getCycle();
    if (!Number.isFinite(cycle) || cycle <= 0) return;
    const sig = [cfg.timeline.drawDuration, cfg.timeline.emergeDuration,
      cfg.timeline.holdDuration, cfg.timeline.fadeDuration, cfg.timeline.restDuration].join("|");
    if (sig !== signature) {
      signature = sig;
      range.max = String(Math.max(0, cycle - 1 / OUTPUT.fps));
      markers.replaceChildren();
      for (const mark of reviewMarkers(cfg.timeline)) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = mark.label;
        btn.addEventListener("click", () => jump(mark.time));
        markers.appendChild(btn);
      }
    }
    const p = position();
    if (!dragging) range.value = String(Math.min(p, Number(range.max)));
    time.textContent = `${p.toFixed(2)} / ${cycle.toFixed(2)} с`;
    play.textContent = cfg.playback.paused ? "▶ Воспроизвести" : "Ⅱ Пауза";
    panel.classList.toggle("review-busy", isRecording());
  }
  function jump(local) {
    if (isRecording()) return;
    const cycle = getCycle();
    if (!(cycle > 0)) return;
    cfg.playback.paused = true;
    seek(cfg.timeline.startDelay + Math.max(0, Math.min(cycle - 1 / OUTPUT.fps, local)));
    refresh();
  }
  range.addEventListener("pointerdown", () => { dragging = true; });
  window.addEventListener("pointerup", () => { dragging = false; });
  range.addEventListener("input", () => jump(Number(range.value)));
  play.addEventListener("click", () => {
    if (isRecording()) return;
    onPause();
    refresh();
  });
  panel.querySelectorAll(".review-step").forEach((button) => button.addEventListener("click", () => {
    jump(position() + Number(button.dataset.step) / OUTPUT.fps);
  }));
  function show(visible) {
    panel.hidden = !visible;
    document.body.classList.toggle("review-on", visible);
    if (visible) refresh();
  }
  panel.querySelector(".review-close").addEventListener("click", () => show(false));
  window.addEventListener("keydown", (event) => {
    const typing = event.target instanceof HTMLTextAreaElement ||
      (event.target instanceof HTMLInputElement && event.target.type !== "range");
    if (typing) return;
    if (event.code === "KeyR") show(panel.hidden);
    if (!panel.hidden && (event.code === "ArrowLeft" || event.code === "ArrowRight")) {
      event.preventDefault();
      jump(position() + (event.code === "ArrowRight" ? 1 : -1) / 60);
    }
  });
  if (new URLSearchParams(window.location.search).has("review")) show(true);
  return { refresh, panel };
}
