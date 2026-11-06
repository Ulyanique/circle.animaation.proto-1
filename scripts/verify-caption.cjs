// Проверка фазы 1/3a: единый CaptionRenderer в live-превью и покадровом кадре.
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

    await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.evaluate(() => localStorage.clear());
    const introURL = new URL("/?scene=intro", BASE).toString();
    await page.goto(introURL, { waitUntil: "networkidle0", timeout: 120000 });
    await page.waitForFunction(() => document.body.classList.contains("boot-ready"), { timeout: 240000 });

    const check = await page.evaluate(async () => {
      await document.fonts.ready;
      const L = window.__logo;
      const t = L.cfg.timeline.startDelay + 8.4;
      L.renderAt(t);
      const firstCanvas = L.compositeFrameAt(t);
      const ctx = firstCanvas.getContext("2d");
      const data = ctx.getImageData(0, 0, firstCanvas.width, firstCanvas.height).data;
      let opaque = 0;
      for (let i = 3; i < data.length; i += 4) if (data[i] > 0) opaque++;
      const first = firstCanvas.toDataURL();
      L.renderAt(t);
      const second = L.compositeFrameAt(t).toDataURL();
      const live = document.getElementById("caption-layer");
      return {
        renderer: !!L.captionRenderer,
        liveCanvas: !!live && live.width === 1920 && live.height === 1080,
        outlineLayers: L.cfg.caption.outlineLayers,
        fillDelay: L.cfg.caption.fillDelay,
        width: firstCanvas.width,
        height: firstCanvas.height,
        opaquePixels: opaque,
        seekStable: first === second,
        domMirror: !!document.querySelector("#caption .cap-title"),
        title: L.cfg.caption.title,
      };
    });

    const result = { check, messages };
    const ok = check.renderer && check.liveCanvas && check.outlineLayers >= 1 &&
      check.width === 1920 && check.height === 1080 && check.opaquePixels > 1000 &&
      check.seekStable && check.domMirror && check.title.length > 0 && messages.length === 0;
    console.log(JSON.stringify({ ...result, ok }, null, 2));
    if (!ok) process.exitCode = 1;
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error("FAIL", e); process.exitCode = 1; });
