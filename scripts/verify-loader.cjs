// Проверка экрана загрузки, критичных файлов и отказов сторонних ресурсов.
// OUT=docs/loader-preview.jpg npm run verify:loader — сохранить контрольный кадр загрузки.
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { launchBrowser } = require("./browser.cjs");
const URL_ = process.env.URL || "http://localhost:5173/";

function isEntry(pathname) {
  return pathname.endsWith("/src/main.js") || /\/assets\/index-[^/]+\.js$/.test(pathname);
}
function isOptional(pathname) {
  return pathname.startsWith("/beacon.min.js/") || pathname.startsWith("/optional-boot-test/");
}

// Сторонний beacon, необязательный модуль и CSS могут упасть независимо от сцены.
async function failOptionalResources(page) {
  return page.evaluate(async () => {
    const cases = [
      { tag: "script", url: "https://analytics.example.invalid/beacon.min.js/v-test" },
      { tag: "script", url: "/optional-boot-test/module.js", type: "module" },
      { tag: "link", url: "/optional-boot-test/style.css", rel: "stylesheet" },
    ];
    return Promise.all(cases.map(({ tag, url, type, rel }) => new Promise((resolve) => {
      const el = document.createElement(tag);
      const timer = setTimeout(() => resolve("timeout"), 8000);
      el.onerror = () => { clearTimeout(timer); resolve("error"); };
      el.onload = () => { clearTimeout(timer); resolve("loaded"); };
      if (tag === "script") { el.src = url; if (type) el.type = type; }
      else { el.rel = rel; el.href = url; }
      document.head.appendChild(el);
    })));
  });
}

(async () => {
  const browser = await launchBrowser({ width: 1336, height: 815 });
  try {
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    let blockModule;
    const moduleRequested = new Promise((resolve) => {
      page.on("request", (request) => {
        const entry = new URL(request.url()).pathname;
        if (isEntry(entry)) {
          blockModule = request;
          resolve();
        } else if (isOptional(entry)) request.abort();
        else request.continue();
      });
    });
    const navigation = page.goto(URL_, { waitUntil: "domcontentloaded", timeout: 120000 });
    await moduleRequested;
    await page.waitForFunction(() => document.getElementById("boot-screen")?.dataset.state === "loading");
    const loading = await page.evaluate(() => ({
      captionHidden: getComputedStyle(document.getElementById("caption")).visibility === "hidden",
      screenVisible: getComputedStyle(document.getElementById("boot-screen")).display !== "none",
      background: getComputedStyle(document.body).backgroundColor,
      criticalStyles: [...document.querySelectorAll('link[rel="stylesheet"][data-boot-critical]')]
        .map((link) => new URL(link.href).pathname),
    }));
    if (process.env.OUT) {
      fs.mkdirSync(path.dirname(process.env.OUT), { recursive: true });
      await page.screenshot({ path: process.env.OUT, type: "jpeg", quality: 88 });
    }
    const optionalBefore = await failOptionalResources(page);
    const loadingAfterOptional = await page.$eval("#boot-screen", (el) => el.dataset.state);
    const failedPath = new URL(blockModule.url()).pathname;
    await blockModule.abort();
    await navigation;
    await page.waitForFunction(() => document.getElementById("boot-screen")?.dataset.state === "error", { timeout: 5000 });
    const failure = await page.evaluate(() => ({
      state: document.getElementById("boot-screen").dataset.state,
      text: document.getElementById("boot-detail").textContent,
      retryVisible: getComputedStyle(document.getElementById("boot-retry")).display !== "none",
      captionHidden: getComputedStyle(document.getElementById("caption")).visibility === "hidden",
    }));
    if (!loading.captionHidden || !loading.screenVisible ||
        !["rgb(5, 4, 3)", "rgb(0, 0, 0)"].includes(loading.background) ||
        optionalBefore.some((result) => result !== "error") || loadingAfterOptional !== "loading" ||
        failure.state !== "error" || !failure.retryVisible || !failure.captionHidden ||
        !failure.text.includes("файлы приложения") || !failure.text.includes(failedPath)) {
      throw new Error(`Ошибка проверки загрузки: ${JSON.stringify({ loading, optionalBefore, loadingAfterOptional, failure })}`);
    }

    // После готовности необязательная аналитика также не должна прятать сцену.
    // Подменяем только главный модуль, чтобы проверить загрузчик без дорогого WebGL.
    const readyPage = await browser.newPage();
    await readyPage.setRequestInterception(true);
    readyPage.on("request", (request) => {
      const pathname = new URL(request.url()).pathname;
      if (isEntry(pathname)) request.respond({ status: 200, contentType: "application/javascript", body: "window.__bootReady();" });
      else if (isOptional(pathname)) request.abort();
      else request.continue();
    });
    await readyPage.goto(URL_, { waitUntil: "domcontentloaded", timeout: 120000 });
    await readyPage.waitForFunction(() => document.body.classList.contains("boot-ready"), { timeout: 5000 });
    const optionalAfter = await failOptionalResources(readyPage);
    const readyAfterOptional = await readyPage.evaluate(() => document.body.classList.contains("boot-ready"));
    const contextFailure = await readyPage.evaluate(() => {
      document.getElementById("stage").dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
      return { state: document.getElementById("boot-screen").dataset.state,
        text: document.getElementById("boot-detail").textContent };
    });
    if (optionalAfter.some((result) => result !== "error") || !readyAfterOptional ||
        contextFailure.state !== "error" || !contextFailure.text.includes("WebGL")) {
      throw new Error(`Ошибка проверки готовой сцены: ${JSON.stringify({ optionalAfter, readyAfterOptional, contextFailure })}`);
    }
    await readyPage.close();

    // Production CSS находится в head и может сломаться до создания boot-screen.
    let cssFailure = "no compiled stylesheet (dev mode)";
    if (loading.criticalStyles.length) {
      const cssPage = await browser.newPage();
      await cssPage.setRequestInterception(true);
      cssPage.on("request", (request) => {
        const pathname = new URL(request.url()).pathname;
        if (loading.criticalStyles.includes(pathname)) request.abort();
        else if (isEntry(pathname)) request.respond({ status: 200, contentType: "application/javascript", body: "window.__bootReady();" });
        else request.continue();
      });
      await cssPage.goto(URL_, { waitUntil: "domcontentloaded", timeout: 120000 });
      await cssPage.waitForFunction(() => document.getElementById("boot-screen")?.dataset.state === "error", { timeout: 5000 });
      cssFailure = await cssPage.$eval("#boot-detail", (el) => el.textContent);
      if (!loading.criticalStyles.some((file) => cssFailure.includes(file))) throw new Error(`Не показан отказ CSS: ${cssFailure}`);
      await cssPage.close();
    }

    // Для прямого открытия исходного HTML подсказка должна направлять к Vite.
    const filePage = await browser.newPage();
    await filePage.goto(pathToFileURL(path.resolve(__dirname, "../index.html")).href, { waitUntil: "load", timeout: 30000 });
    await filePage.waitForFunction(() => document.getElementById("boot-screen")?.dataset.state === "error", { timeout: 5000 });
    const fileFailure = await filePage.$eval("#boot-detail", (el) => el.textContent);
    if (!fileFailure.includes("npm run dev")) throw new Error(`Не показана подсказка для file://: ${fileFailure}`);
    await filePage.close();
    console.log({ loading, optionalBefore, loadingAfterOptional, failure, optionalAfter, readyAfterOptional,
      contextFailure, cssFailure, fileFailure });
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error("FAIL", error); process.exitCode = 1; });
