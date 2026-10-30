import "./styles.css";
import { loadConfig, saveConfig } from "./config.js";
import { LogoScene } from "./scene.js";
import { createSettingsUI } from "./ui.js";

const cfg = loadConfig();
const canvas = document.getElementById("stage");
const toastEl = document.getElementById("toast");
let toastTimer = 0;
function toast(msg, isError = false) {
  toastEl.textContent = msg;
  toastEl.classList.toggle("error", isError);
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2200);
}

const scene = new LogoScene(canvas, cfg);

createSettingsUI(cfg, {
  onChange: () => {},
  onPauseToggle: () => {
    cfg.playback.paused = !cfg.playback.paused;
    saveConfig(cfg);
  },
  onToast: toast,
});

window.addEventListener("resize", () => scene.resize());

let t = 0;
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!cfg.playback.paused) t += dt * cfg.timeline.speed;
  scene.update(t, dt);
  scene.render(dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// для отладки из консоли: window.__logo.setTime(7.5)
window.__logo = {
  get time() { return t; },
  setTime(v) { t = v; },
  cfg,
  scene,
};
