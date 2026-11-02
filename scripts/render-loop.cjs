// Рендер одного зацикленного цикла логотипа в PNG-кадры (для MP4 см. scripts/encode-loop.sh).
// Шов: кадры берутся от локальной фазы 0 до cycle (12.7 с) — конец переходит в начало через тёмную паузу.
// Запуск (dev-сервер уже запущен на 5173):
//   RW=1920 RH=1080 FPS=60 OUT=out/frames node scripts/render-loop.cjs
// Переменные: URL, RW, RH, FPS, OUT, START (startDelay из конфига, по умолчанию 0.6), CYCLE (12.7), CHROME (путь к Chrome/Chromium).
const puppeteer = require("puppeteer-core");
const fs = require("fs");
const path = require("path");

const URL_ = process.env.URL || "http://localhost:5173/";
const RW = +(process.env.RW || 1920), RH = +(process.env.RH || 1080);
const FPS = +(process.env.FPS || 24);
const CYCLE = +(process.env.CYCLE || 12.7);
const START = +(process.env.START || 0.6);
const OUT = process.env.OUT || "out/frames";
const N = Math.round(CYCLE * FPS);

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME || undefined,
    headless: "shader",
    args: ["--use-gl=angle", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
    defaultViewport: { width: RW, height: RH },
  });
  const page = await browser.newPage();
  await page.goto(URL_, { waitUntil: "networkidle0", timeout: 120000 });
  await page.evaluate(() => { window.__logo.cfg.playback.paused = true; });
  for (let k = 0; k < N; k++) {
    const t = START + k / FPS;
    await page.evaluate((t) => window.__logo.setTime(t), t);
    await new Promise((r) => setTimeout(r, 500));
    await page.screenshot({ path: path.join(OUT, `f${String(k).padStart(4, "0")}.png`) });
    console.log(`frame ${k + 1}/${N}`);
  }
  await browser.close();
  console.log("DONE");
})().catch((e) => { console.error("FAIL", e.message); process.exit(1); });
