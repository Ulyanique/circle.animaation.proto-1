// Проверка рендера: ошибки консоли, кадры фаз цикла и периодичность состояния логотипа на шве цикла.
// (Фон, кольца и частицы движутся непрерывно, поэтому полный кадр на шве не совпадает — это ожидаемо.)
// Запуск: npm run dev (в другом терминале), затем: node scripts/verify-render.cjs
const path = require("path");
const DIR = process.env.HEADLESS_DIR || path.join(process.env.HOME, ".cache/headless");
const chromium = require(path.join(DIR, "node_modules/@sparticuz/chromium"));
const puppeteer = require(path.join(DIR, "node_modules/puppeteer-core"));
const URL = process.env.URL || "http://localhost:5173/";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  process.env.LD_LIBRARY_PATH = path.join(DIR, "libs/lib") + ":" + (process.env.LD_LIBRARY_PATH || "");
  const browser = await puppeteer.launch({
    executablePath: await chromium.executablePath(),
    args: [...chromium.args, "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
    defaultViewport: { width: 960, height: 540 },
    headless: "shell",
  });
  const page = await browser.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errors.push(m.text().slice(0, 300)); });
  page.on("pageerror", (e) => errors.push("PAGEERR " + e.message.slice(0, 300)));
  await page.goto(URL, { waitUntil: "networkidle0", timeout: 120000 });
  await sleep(2000);

  // шов цикла: при t и t+cycle кадры должны совпасть
  const cycle = await page.evaluate(() => {
    const tl = window.__logo.cfg.timeline;
    window.__logo.cfg.playback.paused = true;
    return tl.drawDuration + tl.emergeDuration + tl.holdDuration + tl.fadeDuration + tl.restDuration;
  });
  const shots = [["draw", 1.8], ["hold", 7]];
  for (const [name, t] of shots) {
    await page.evaluate((t) => window.__logo.setTime(t), t);
    await sleep(1200);
    await page.screenshot({ path: path.join(DIR, `verify_${name}.png`) });
  }
  const seamOk = await page.evaluate((cycle) => {
    const L = window.__logo, s = L.scene;
    const state = (t) => {
      s.update(t, 0.016);
      const r = s.logo.root;
      return [r.scale.x, r.position.z, r.rotation.x, r.rotation.y, s.logo.outlineMat.opacity];
    };
    return [3, 8.5, 11].every((t) => {
      const a = state(t), b = state(t + cycle);
      return a.every((v, i) => Math.abs(v - b[i]) < 1e-9);
    });
  }, cycle);
  await browser.close();

  console.log("cycle:", cycle.toFixed(2), "s");
  console.log("screenshots:", path.join(DIR, "verify_*.png"));
  console.log("logo state periodic across loop seam:", seamOk ? "YES" : "NO");
  console.log("console errors:", errors.length);
  errors.slice(0, 10).forEach((e) => console.log("  ", e));
  process.exit(errors.length || !seamOk ? 1 : 0);
})().catch((e) => { console.error("FAIL", e.message); process.exit(1); });
