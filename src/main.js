import "./styles.css";
import "@fontsource/cormorant-garamond/cyrillic-400.css";
import "@fontsource/cormorant-garamond/cyrillic-600.css";
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
  onExportVideo: startRecording,
});

window.addEventListener("resize", () => scene.resize());

// презентация: F — полный экран
window.addEventListener("keydown", (e) => {
  if (e.code === "KeyF" && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.();
  }
});

let t = 0;
let last = performance.now();
let recording = null; // запись одного цикла в реальном времени

const REC_W = 1920, REC_H = 1080;

// подпись на канвасе повторяет DOM-макет (--u = 1% ширины кадра) и ту же анимацию:
// прогресс обводки и заливки каждой строки читается из --p / --f на элементах #caption
function capVal(sel, name) {
  const el = document.querySelector(`#caption ${sel}`);
  return el ? parseFloat(getComputedStyle(el).getPropertyValue(name)) || 0 : 0;
}

function drawCaption(ctx, alpha) {
  const W = REC_W, H = REC_H, u = W / 100;
  const font = (w, size) => `${w} ${size}px "Cormorant Garamond", Georgia, serif`;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // строка: обводка проявляется слева направо (--p), затем заливка (--f)
  const textLine = (sel, text, o) => {
    const p = capVal(sel, "--p"), f = capVal(sel, "--f");
    if (p <= 0.001) return;
    ctx.font = font(o.weight, o.size);
    ctx.letterSpacing = `${o.ls}px`;
    const w = ctx.measureText(text).width - o.ls; // ширина без хвостового интервала
    const cx = W / 2 + o.ls / 2;                  // как padding-left в DOM
    const x0 = cx - w / 2;
    ctx.save();
    ctx.beginPath(); ctx.rect(x0, 0, w * p, H); ctx.clip();
    ctx.strokeStyle = o.stroke; ctx.lineWidth = o.sw; ctx.lineJoin = "round";
    ctx.strokeText(text, cx, o.y);
    ctx.restore();
    if (f > 0.001) {
      ctx.save();
      ctx.beginPath(); ctx.rect(x0, 0, w * f, H); ctx.clip();
      if (o.shadow) { ctx.shadowColor = "rgba(0,0,0,0.7)"; ctx.shadowBlur = 0.5 * u; ctx.shadowOffsetY = 0.2 * u; }
      ctx.fillStyle = typeof o.fill === "function" ? o.fill() : o.fill;
      ctx.fillText(text, cx, o.y);
      ctx.restore();
    }
  };

  // разделитель с ромбом: раскрывается от центра (--p), ромб появляется вместе с ним
  const rule = (sel, y) => {
    const p = capVal(sel, "--p");
    if (p <= 0.001) return;
    const half = 17 * u, gap = 1 * u, d = 0.9 * u;
    ctx.save();
    ctx.beginPath(); ctx.rect(W / 2 - half * p, 0, 2 * half * p, H); ctx.clip();
    const lg = ctx.createLinearGradient(W / 2 - half, 0, W / 2 + half, 0);
    lg.addColorStop(0, "rgba(217,176,97,0)"); lg.addColorStop(0.5, "#d9b061"); lg.addColorStop(1, "rgba(217,176,97,0)");
    ctx.fillStyle = lg;
    ctx.fillRect(W / 2 - half, y - 0.5, half - d / 2 - gap, 1);
    ctx.fillRect(W / 2 + d / 2 + gap, y - 0.5, half - d / 2 - gap, 1);
    ctx.globalAlpha *= p;
    ctx.save();
    ctx.translate(W / 2, y); ctx.rotate(Math.PI / 4);
    ctx.strokeStyle = "#e0b25a"; ctx.lineWidth = 1;
    ctx.strokeRect(-d / 2, -d / 2, d, d);
    ctx.restore();
    ctx.restore();
  };

  const tSize = 7.2 * u;
  const titleGrad = () => {
    const g = ctx.createLinearGradient(0, 0.55 * H - tSize / 2, 0, 0.55 * H + tSize / 2);
    g.addColorStop(0, "#fff3cc"); g.addColorStop(0.4, "#f0cc78");
    g.addColorStop(0.75, "#c08c36"); g.addColorStop(1, "#e8c06a");
    return g;
  };
  textLine(".cap-title", "Янтарный циркуль", {
    y: 0.55 * H, weight: 600, size: tSize, ls: 0, stroke: "#e0b25a", sw: 0.08 * u, shadow: true, fill: titleGrad,
  });
  rule(".r1", 0.66 * H);
  rule(".r2", 0.79 * H);
  textLine(".cap-sub", "ВЕЧЕР РЕТРОСПЕКТИВА", {
    y: 0.72 * H, weight: 400, size: 2.4 * u, ls: 0.32 * 2.4 * u, stroke: "#d9b061", sw: 0.04 * u, fill: "#ecd08c",
  });
  textLine(".cap-date", "20 НОЯБРЯ 2026 ГОДА", {
    y: 0.84 * H, weight: 400, size: 1.5 * u, ls: 0.28 * 1.5 * u, stroke: "#d9b061", sw: 0.035 * u, fill: "#d9b061",
  });
  ctx.restore();
}

function drawRecordingFrame() {
  const r = recording;
  r.ctx.drawImage(canvas, 0, 0, REC_W, REC_H);
  const cap = document.getElementById("caption");
  const op = cap ? parseFloat(getComputedStyle(cap).opacity) : 0;
  if (op > 0.001) drawCaption(r.ctx, op);
}

function startRecording() {
  if (recording) return;
  if (typeof MediaRecorder === "undefined" || !HTMLCanvasElement.prototype.captureStream) {
    toast("Запись не поддерживается в этом браузере", true);
    return;
  }
  const tl = cfg.timeline;
  const cycle = tl.drawDuration + tl.emergeDuration + tl.holdDuration + tl.fadeDuration + tl.restDuration;
  const mime = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"]
    .find((m) => MediaRecorder.isTypeSupported(m)) || "video/webm";
  const rc = document.createElement("canvas");
  rc.width = REC_W; rc.height = REC_H;
  const rctx = rc.getContext("2d");
  const chunks = [];
  const rec = new MediaRecorder(rc.captureStream(60), { mimeType: mime, videoBitsPerSecond: 40000000 });
  rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
  window.__recStats = { chunks };
  rec.onstop = () => {
    const blob = new Blob(chunks, { type: "video/webm" });
    window.__lastVideoBlob = blob;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "logo-loop-1920x1080.webm";
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast("Видео сохранено (WebM)");
  };
  recording = { rec, ctx: rctx, start: tl.startDelay, cycle, t0: performance.now(), prevT: t };
  rec.start(250);
  toast(`Запись цикла ${cycle.toFixed(1)} с — не переключайте вкладку`);
}

function stopRecording() {
  const r = recording;
  recording = null;
  if (r.rec.state === "recording") r.rec.requestData();
  r.rec.stop();
  t = r.prevT;
}

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (recording) {
    t = recording.start + ((now - recording.t0) / 1000) * cfg.timeline.speed;
  } else if (!cfg.playback.paused) {
    t += dt * cfg.timeline.speed;
  }
  scene.update(t, dt);
  scene.render(dt);
  if (recording) {
    drawRecordingFrame();
    if (t >= recording.start + recording.cycle) stopRecording();
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// для отладки из консоли: window.__logo.setTime(7.5)
window.__logo = {
  get time() { return t; },
  setTime(v) { t = v; },
  startRecording,
  cfg,
  scene,
};
