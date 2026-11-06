// Запуск: npm run dev (в другом терминале), затем npm run render:frames
// Настройки: CHROME=/путь/к/chrome, URL, FPS=60, OUT=out/frames.
// Время цикла и startDelay всегда берутся из текущих настроек сцены.
const fs = require("node:fs");
const path = require("node:path");
const { launchBrowser } = require("./browser.cjs");

const URL_ = process.env.URL || "http://localhost:5173/";
const FPS = Number(process.env.FPS || 60);
const OUT = process.env.OUT || "out/frames";
if (!Number.isInteger(FPS) || FPS < 1 || FPS > 120) throw new Error("FPS должен быть целым числом от 1 до 120");

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(URL_, { waitUntil: "networkidle0", timeout: 120000 });
    await page.waitForFunction(() => document.body.classList.contains("boot-ready"), { timeout: 240000 });
    if (errors.length) throw new Error("Ошибка сцены: " + errors.join("; "));
    const { start, cycle } = await page.evaluate(async () => {
      await document.fonts.ready;
      const { cfg } = window.__logo;
      cfg.playback.paused = true;
      const tl = cfg.timeline;
      return {
        start: tl.startDelay,
        cycle: window.__logo.runtime.cycle,
      };
    });
    const total = Math.round(cycle * FPS);
    if (!(cycle > 0) || !Number.isFinite(total)) throw new Error("Некорректная длительность цикла");
    await page.addStyleTag({ content: ".cfg-toggle,.cfg-panel,.toast,.review-panel,.brand-controls,.operator-panel{display:none!important} body{cursor:none!important}" });
    console.log(`Рендер ${total} кадров, ${FPS} FPS, ${cycle.toFixed(3)} с, 1920×1080 → ${OUT}`);
    for (let k = 0; k < total; k++) {
      // Каждый кадр рисуется прямо по абсолютному времени, без ожидания/накопления dt.
      await page.evaluate(({ t, dt }) => window.__logo.renderAt(t, dt), { t: start + k / FPS, dt: 1 / FPS });
      if (errors.length) throw new Error("Ошибка сцены: " + errors.join("; "));
      await page.screenshot({ path: path.join(OUT, `f${String(k).padStart(5, "0")}.png`) });
      if ((k + 1) % FPS === 0 || k + 1 === total) console.log(`${k + 1}/${total}`);
    }
    console.log("DONE");
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error("FAIL", e); process.exitCode = 1; });
