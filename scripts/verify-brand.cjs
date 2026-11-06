// Второй вид: присутствие только символа и названия, экспорт и пиксельный шов.
// npm run dev; npm run verify:brand [OUT=docs/brand-background.jpg]
const { launchBrowser } = require("./browser.cjs");
const { PNG } = require("pngjs");
const URL_ = process.env.URL || "http://localhost:5173/?scene=brand";

(async () => {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    // Каждый verify:* начинается с чистого localStorage: соседний прогон не должен подменять defaults.
    await page.evaluateOnNewDocument(() => { try { localStorage.clear(); } catch (_) {} });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    await page.goto(URL_, { waitUntil: "networkidle0", timeout: 120000 });
    await page.waitForFunction(() => document.body.classList.contains("boot-ready"), { timeout: 240000 });
    const state = await page.evaluate(async () => {
      await document.fonts.ready;
      const L = window.__logo;
      L.cfg.playback.paused = true;
      const middle = L.runtime.cycle / 2;
      const withTitle = L.compositeFrameAt(middle);
      const noTitle = L.compositeFrameAt(middle, 1 / 60, false);
      const sample = (canvas) => canvas.getContext("2d").getImageData(340, 655, 1240, 190).data;
      const a = sample(withTitle), b = sample(noTitle);
      let captionPixels = 0;
      for (let i = 0; i < a.length; i += 4) {
        if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) +
            Math.abs(a[i + 2] - b[i + 2]) > 30) captionPixels++;
      }
      L.renderAt(2.3);
      const drawing = L.scene.logo.outline.visible && L.scene.logo.outlineU.uDraw.value > 0;
      L.renderAt(9);
      const timeA = L.scene.background.uniforms.uTime.value;
      const waves = L.scene.waves.pulses.some(({ material }) => material.opacity > 0.005);
      L.renderAt(10);
      const movingBackground = L.scene.background.uniforms.uTime.value !== timeA;
      L.renderAt(L.runtime.cycle - 1 / 60);
      const cleared = parseFloat(getComputedStyle(document.querySelector(".cap-title")).getPropertyValue("--p")) === 0;
      L.renderAt(middle);
      return {
        drawing, waves, movingBackground, cleared,
        id: L.activeScene.id,
        cycle: L.runtime.cycle,
        format: [withTitle.width, withTitle.height],
        captionPixels,
        onlyTitle: [...document.querySelectorAll(".cap-rule,.cap-sub,.cap-date")]
          .every((el) => getComputedStyle(el).display === "none"),
        ambientField: L.scene.corners.group.visible && L.scene.particles.group.visible &&
          L.scene.background.uniforms.uEnvL.value > 0.3 && !L.scene.plotter.group.visible,
        // №2 намеренно получил логотип ниже, но по-прежнему по центру оси X.
        centeredSymbol: Math.abs(L.scene.logo.root.position.x) < 0.01 &&
          L.scene.logo.root.position.y > 0.3 && L.scene.logo.root.position.y < 0.8,
        logoY: L.scene.logo.root.position.y,
        titleBelow: parseFloat(getComputedStyle(document.querySelector(".cap-title")).top) >
          0.65 * parseFloat(getComputedStyle(document.getElementById("caption")).height),
      };
    });
    await page.addStyleTag({ content: ".brand-controls,.operator-panel,.toast{display:none!important}" });
    await page.evaluate(() => window.__logo.renderAt(window.__logo.runtime.cycle / 2));
    if (process.env.OUT) await page.screenshot({ path: process.env.OUT, type: "jpeg", quality: 90 });
    const capture = async (time) => {
      await page.evaluate((t) => window.__logo.renderAt(t), time);
      return PNG.sync.read(Buffer.from(await page.screenshot({ type: "png" })));
    };
    const first = await capture(0);
    const last = await capture(state.cycle - 1 / 60);
    let seamChangedPixels = 0;
    for (let i = 0; i < first.data.length; i += 4) {
      const d = Math.abs(first.data[i] - last.data[i]) +
        Math.abs(first.data[i + 1] - last.data[i + 1]) +
        Math.abs(first.data[i + 2] - last.data[i + 2]);
      if (d > 3) seamChangedPixels++;
    }
    console.log({ ...state, seamChangedPixels, errors });
    if (errors.length || state.id !== "brand" || state.cycle !== 24 ||
        state.format[0] !== 1920 || state.format[1] !== 1080 ||
        state.captionPixels < 1000 || !state.onlyTitle || !state.ambientField ||
        !state.centeredSymbol || !state.titleBelow || !state.drawing ||
        !state.waves || !state.movingBackground || !state.cleared || seamChangedPixels !== 0) process.exitCode = 1;
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error("FAIL", e); process.exitCode = 1; });
