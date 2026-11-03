// Проверка первого экрана и понятной ошибки при отказе загрузки JS.
// OUT=docs/loader-preview.jpg npm run verify:loader — сохранить контрольный кадр загрузки.
const fs = require("node:fs");
const path = require("node:path");
const { launchBrowser } = require("./browser.cjs");
const URL_ = process.env.URL || "http://localhost:5173/";

(async () => {
  const browser = await launchBrowser({ width: 1336, height: 815 });
  try {
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    let blockModule;
    const moduleRequested = new Promise((resolve) => {
      page.on("request", (request) => {
        const entry = new URL(request.url()).pathname;
        if (entry === "/src/main.js" || /^\/assets\/index-[^/]+\.js$/.test(entry)) {
          blockModule = request;
          resolve();
        } else request.continue();
      });
    });
    const navigation = page.goto(URL_, { waitUntil: "domcontentloaded", timeout: 120000 });
    await moduleRequested;
    await page.waitForFunction(() => document.getElementById("boot-screen")?.dataset.state === "loading");
    const loading = await page.evaluate(() => ({
      captionHidden: getComputedStyle(document.getElementById("caption")).visibility === "hidden",
      screenVisible: getComputedStyle(document.getElementById("boot-screen")).display !== "none",
      background: getComputedStyle(document.body).backgroundColor,
    }));
    if (process.env.OUT) {
      fs.mkdirSync(path.dirname(process.env.OUT), { recursive: true });
      await page.screenshot({ path: process.env.OUT, type: "jpeg", quality: 88 });
    }
    await blockModule.abort();
    await navigation;
    await page.waitForFunction(() => document.getElementById("boot-screen")?.dataset.state === "error", { timeout: 5000 });
    const failure = await page.evaluate(() => ({
      state: document.getElementById("boot-screen").dataset.state,
      text: document.getElementById("boot-detail").textContent,
      retryVisible: getComputedStyle(document.getElementById("boot-retry")).display !== "none",
      captionHidden: getComputedStyle(document.getElementById("caption")).visibility === "hidden",
    }));
    console.log({ loading, failure });
    if (!loading.captionHidden || !loading.screenVisible ||
        !["rgb(5, 4, 3)", "rgb(0, 0, 0)"].includes(loading.background) ||
        failure.state !== "error" || !failure.retryVisible || !failure.captionHidden ||
        !failure.text.includes("файлы приложения")) process.exitCode = 1;
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error("FAIL", error); process.exitCode = 1; });
