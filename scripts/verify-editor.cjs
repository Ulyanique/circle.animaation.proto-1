// Проверка фаз 3a/3b: ?editor=1, ElementRegistry, инспектор и keyframes.
const { launchBrowser } = require("./browser.cjs");
const BASE = process.env.URL || "http://localhost:5173";

(async () => {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    // Каждый verify:* начинается с чистого localStorage: соседний прогон не должен подменять defaults.
    await page.evaluateOnNewDocument(() => { try { localStorage.clear(); } catch (_) {} });
    const messages = [];
    page.on("console", (m) => { if (m.type() === "error") messages.push(m.text()); });
    page.on("pageerror", (e) => messages.push(e.message));

    // Чистый localStorage, чтобы миграция и состояние конструктора были предсказуемыми.
    await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.evaluate(() => localStorage.clear());
    const editorURL = new URL("/?scene=intro&editor=1", BASE).toString();
    await page.goto(editorURL, { waitUntil: "networkidle0", timeout: 120000 });
    await page.waitForFunction(() => document.body.classList.contains("boot-ready"), { timeout: 240000 });

    const initial = await page.evaluate(async () => {
      await document.fonts.ready;
      const L = window.__logo;
      const layer = document.querySelector(".editor-layer");
      const inspector = document.querySelector(".editor-inspector");
      return {
        enabled: L.editor?.enabled === true,
        layerVisible: !!layer && getComputedStyle(layer).display !== "none",
        boxes: document.querySelectorAll(".editor-box").length,
        settingsVersion: L.project.settingsVersion,
        inspectorCollapsed: inspector?.classList.contains("collapsed") === true,
        defaultKeyframes: L.project.scenes.waiting.elements.logo.keyframes.length,
        playheadApi: typeof L.editor?.updatePlayhead === "function",
      };
    });

    const edited = await page.evaluate(async () => {
      await document.fonts.ready;
      const L = window.__logo;
      document.querySelector('[data-ed-id="logo"]').click();
      const inspectorOpen = !document.querySelector(".editor-inspector").classList.contains("collapsed");
      const xInput = document.querySelector('[data-ed-field="x"]');
      xInput.value = "0.42";
      xInput.dispatchEvent(new Event("input", { bubbles: true }));
      const xChanged = Math.abs(L.project.scenes.waiting.elements.logo.x - 0.42) < 1e-6;
      document.querySelector('[data-ed-keyaction="add"]').click();
      const keyframes = L.project.scenes.waiting.elements.logo.keyframes.length;
      const markers = document.querySelectorAll(".editor-key").length;
      const canvas = L.compositeFrameAt(L.cfg.timeline.startDelay + 8.4);
      return {
        inspectorOpen, xChanged, keyframes, markers,
        compositeWidth: canvas.width, compositeHeight: canvas.height,
        selection: L.editor?.selection || null,
        settingsVersion: L.project.settingsVersion,
      };
    });

    const result = { initial, edited, messages };
    const ok = initial.enabled && initial.layerVisible && initial.boxes >= 5 &&
      initial.settingsVersion === 4 && initial.inspectorCollapsed &&
      initial.defaultKeyframes === 0 && initial.playheadApi &&
      edited.inspectorOpen && edited.xChanged && edited.keyframes === 1 &&
      edited.markers === 1 && edited.compositeWidth === 1920 &&
      edited.compositeHeight === 1080 && edited.selection === "logo" &&
      edited.settingsVersion === 4 && messages.length === 0;
    console.log(JSON.stringify({ ...result, ok }, null, 2));
    if (!ok) process.exitCode = 1;
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error("FAIL", e); process.exitCode = 1; });
