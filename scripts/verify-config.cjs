// Проверка фазы 0: видимая ⚙ во всех сценах, per-scene project v2,
// JSON/шрифты/постобработка и рендер с настройками через ?config=.
const { launchBrowser } = require("./browser.cjs");
const BASE = process.env.URL || "http://localhost:5173";
const SCENES = [
  ["intro", "waiting"],
  ["brand", "brand"],
  ["photo-pause", "photo-pause"],
  ["finale", "finale"],
];

(async () => {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    const messages = [];
    page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") messages.push(m.text()); });
    page.on("pageerror", (e) => messages.push(e.message));
    const sceneChecks = [];
    for (const [urlId, internalId] of SCENES) {
      await page.goto(`${BASE}/?scene=${urlId}`, { waitUntil: "networkidle0", timeout: 120000 });
      await page.waitForFunction(() => document.body.classList.contains("boot-ready"), { timeout: 240000 });
      sceneChecks.push(await page.evaluate(async (expected) => {
        await document.fonts.ready;
        document.body.classList.add("operator-idle");
        const L = window.__logo;
        const btn = document.querySelector(".cfg-toggle");
        const active = document.querySelector(".cfg-scenes button.active");
        return {
          expected,
          version: L.project.version,
          scenes: Object.keys(L.project.scenes).sort(),
          buttonVisible: btn && getComputedStyle(btn).display !== "none" &&
            Number(getComputedStyle(btn).opacity) >= 0.9,
          panelAvailable: !!document.querySelector(".cfg-panel"),
          tabs: document.querySelectorAll(".cfg-scenes button").length,
          activeTab: active?.dataset.scene || null,
          activeScene: L.activeScene?.id || null,
        };
      }, internalId));
    }
    // Панель, постобработка, экспорт JSON и шрифт на примере №2.
    await page.goto(`${BASE}/?scene=brand`, { waitUntil: "networkidle0", timeout: 120000 });
    await page.waitForFunction(() => document.body.classList.contains("boot-ready"), { timeout: 240000 });
    const panel = await page.evaluate(async () => {
      await document.fonts.ready;
      const L = window.__logo;
      document.querySelector(".cfg-toggle").click();
      const input = document.querySelector('input[data-field="bloomIntensity"]');
      input.value = "0.77";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      const postChanged = Math.abs(L.cfg.post.bloomIntensity - 0.77) < 1e-6;
      document.querySelector('[data-act="export"]').click();
      const json = document.querySelector(".cfg-textarea").value;
      const parsed = JSON.parse(json);
      const fontFile = !!document.querySelector('.cfg-font input[type="file"]');
      const before = L.cfg.caption.fontFamily;
      L.setCaptionFont("Montserrat", "600");
      await document.fonts.ready;
      const fontFamily = getComputedStyle(document.getElementById("caption")).fontFamily;
      return {
        panelOpen: document.querySelector(".cfg-panel").classList.contains("open"),
        postChanged, fontFile,
        jsonVersion: parsed.version,
        jsonScenes: Object.keys(parsed.scenes || {}).sort(),
        fontBefore: before,
        fontAfter: L.cfg.caption.fontFamily,
        fontFamily,
      };
    });
    // Импорт JSON как defaults и детерминированный рендер после смены текста.
    await page.goto(`${BASE}/?scene=intro`, { waitUntil: "networkidle0", timeout: 120000 });
    await page.waitForFunction(() => document.body.classList.contains("boot-ready"), { timeout: 240000 });
    const importCheck = await page.evaluate(async () => {
      await document.fonts.ready;
      const L = window.__logo;
      const parsed = JSON.parse(L.getProjectJSON());
      parsed.scenes.waiting.caption.title = "Новый заголовок";
      L.applyProjectJSON(JSON.stringify(parsed), true);
      const t = L.cfg.timeline.startDelay + 8.4;
      L.renderAt(t);
      const first = L.compositeFrameAt(t).toDataURL();
      L.renderAt(t);
      const second = L.compositeFrameAt(t).toDataURL();
      return {
        title: L.project.scenes.waiting.caption.title,
        domTitle: document.querySelector(".cap-title").textContent.replaceAll("\u00a0", " "),
        seekStable: first === second,
      };
    });
    // Произвольные настройки через ссылку ?config=.
    const partial = {
      version: 2,
      scenes: { brand: { post: { bloomIntensity: 0.99 }, caption: { title: "Тест бренда" }, layout: { logoY: 0.3 } } },
    };
    await page.goto(`${BASE}/?scene=brand&config=${encodeURIComponent(JSON.stringify(partial))}`,
      { waitUntil: "networkidle0", timeout: 120000 });
    await page.waitForFunction(() => document.body.classList.contains("boot-ready"), { timeout: 240000 });
    const linkCheck = await page.evaluate(async () => {
      await document.fonts.ready;
      const L = window.__logo;
      return {
        version: L.project.version,
        bloom: L.cfg.post.bloomIntensity,
        title: L.cfg.caption.title,
        logoY: L.cfg.layout.logoY,
        domTitle: document.querySelector(".cap-title").textContent.replaceAll("\u00a0", " "),
      };
    });
    const result = { sceneChecks, panel, importCheck, linkCheck, messages };
    const scenesOk = sceneChecks.every((s) => s.version === 2 && s.scenes.length === 4 &&
      s.buttonVisible && s.panelAvailable && s.tabs === 4 && s.activeTab === s.expected &&
      s.activeScene === s.expected);
    const ok = scenesOk && panel.panelOpen && panel.postChanged && panel.fontFile &&
      panel.jsonVersion === 2 && panel.jsonScenes.length === 4 &&
      panel.fontAfter === "Montserrat" && panel.fontFamily.includes("Montserrat") &&
      importCheck.title === "Новый заголовок" && importCheck.domTitle === "Новый заголовок" &&
      importCheck.seekStable && linkCheck.version === 2 &&
      Math.abs(linkCheck.bloom - 0.99) < 1e-6 && linkCheck.title === "Тест бренда" &&
      Math.abs(linkCheck.logoY - 0.3) < 1e-6 && linkCheck.domTitle === "Тест бренда" &&
      messages.length === 0;
    console.log(JSON.stringify({ ...result, scenesOk, ok }, null, 2));
    if (!ok) process.exitCode = 1;
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error("FAIL", e); process.exitCode = 1; });
