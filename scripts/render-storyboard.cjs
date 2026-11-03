// Семь контрольных кадров для режиссёрской оценки цикла (не финальный экспорт).
// npm run dev; npm run render:storyboard  [OUT=out/storyboard, CHROME=/path/to/chrome]
const fs = require("node:fs");
const path = require("node:path");
const { launchBrowser } = require("./browser.cjs");

const out = process.env.OUT || "out/storyboard";
const url = process.env.URL || "http://localhost:5173/";

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(url, { waitUntil: "networkidle0", timeout: 120000 });
    const frames = await page.evaluate(async () => {
      await document.fonts.ready;
      if (window.__logo.activeScene.id !== "waiting") throw new Error("Эта раскадровка относится к первой заставке; для фирменного фона используйте verify:brand");
      const t = window.__logo.cfg.timeline;
      window.__logo.cfg.playback.paused = true;
      const D = t.drawDuration, E = t.emergeDuration, H = t.holdDuration, F = t.fadeDuration;
      return [
        ["01-plot", t.startDelay + Math.min(0.5, D * 0.2)],
        ["02-handoff", t.startDelay + D * 0.87],
        ["03-engrave", t.startDelay + D + E * 0.08],
        ["04-gold", t.startDelay + D + E * 0.65],
        ["05-light-pass", t.startDelay + D + E + Math.min(0.58, H * 0.08)],
        ["06-tableau", t.startDelay + D + E + H * 0.55],
        ["07-final-contour", t.startDelay + D + E + H + F * 0.92],
      ];
    });
    await page.addStyleTag({ content: ".cfg-toggle,.cfg-panel,.toast,.review-panel,.operator-panel{display:none!important}" });
    const only = (process.env.FRAMES || "").split(",").map((s) => s.trim()).filter(Boolean);
    const chosen = only.length ? frames.filter(([name]) => only.includes(name)) : frames;
    if (only.length && chosen.length !== new Set(only).size) throw new Error(`Неизвестный кадр в FRAMES: ${only.join(", ")}`);
    for (const [name, time] of chosen) {
      await page.evaluate((t) => window.__logo.renderAt(t), time);
      if (errors.length) throw new Error(errors.join("; "));
      await page.screenshot({ path: path.join(out, `${name}.jpg`), type: "jpeg", quality: 88 });
      console.log(`${name}: ${time.toFixed(2)} с`);
    }
    fs.writeFileSync(path.join(out, "timing.json"), JSON.stringify(Object.fromEntries(frames), null, 2));
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error("FAIL", e); process.exitCode = 1; });
