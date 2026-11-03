// Проверка видов №8 и №9 в браузере: текст, настоящий экспортный canvas и шов.
// SCENE=photo-pause|finale OUT=docs/photo-pause.jpg npm run verify:priority
const { launchBrowser } = require("./browser.cjs");
const { PNG } = require("pngjs");
const sceneId = process.env.SCENE;
const expected = {
  "photo-pause": { title: "Фотопауза", subtitle: false, cycle: 24 },
  finale: { title: "Янтарный циркуль", subtitle: "История продолжается", cycle: 18 },
}[sceneId];
if (!expected) throw new Error("SCENE должен быть photo-pause или finale");
const URL_ = process.env.URL || `http://localhost:5173/?scene=${sceneId}`;

(async () => {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
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
      const sample = (canvas) => canvas.getContext("2d").getImageData(400, 495, 1120, 360).data;
      const a = sample(withTitle), b = sample(noTitle);
      let captionPixels = 0;
      for (let i = 0; i < a.length; i += 4) {
        if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) +
            Math.abs(a[i + 2] - b[i + 2]) > 30) captionPixels++;
      }
      const title = document.querySelector(".cap-title");
      const subtitle = document.querySelector(".cap-sub");
      const state = {
        id: L.activeScene.id,
        cycle: L.runtime.cycle,
        format: [withTitle.width, withTitle.height],
        captionPixels,
        title: title.textContent.replaceAll("\u00a0", " "),
        subtitle: getComputedStyle(subtitle).display === "none" ? false : subtitle.textContent.replaceAll("\u00a0", " "),
        noCorners: !L.scene.corners.group.visible && !L.scene.plotter.group.visible,
        noDate: getComputedStyle(document.querySelector(".cap-date")).display === "none",
      };
      if (L.activeScene.id === "finale") {
        L.renderAt(6.2);
        state.phraseInProgress = parseFloat(subtitle.style.getPropertyValue("--p")) > 0 &&
          parseFloat(subtitle.style.getPropertyValue("--f")) === 0;
        L.renderAt(middle);
      }
      return state;
    });
    await page.addStyleTag({ content: ".brand-controls,.toast{display:none!important}" });
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
      const delta = Math.abs(first.data[i] - last.data[i]) +
        Math.abs(first.data[i + 1] - last.data[i + 1]) +
        Math.abs(first.data[i + 2] - last.data[i + 2]);
      if (delta > 3) seamChangedPixels++;
    }
    console.log({ ...state, seamChangedPixels, errors });
    if (errors.length || state.id !== sceneId || state.cycle !== expected.cycle ||
        state.title !== expected.title || state.subtitle !== expected.subtitle ||
        state.format[0] !== 1920 || state.format[1] !== 1080 ||
        state.captionPixels < 1000 || !state.noCorners || !state.noDate ||
        (sceneId === "finale" && !state.phraseInProgress) || seamChangedPixels !== 0) process.exitCode = 1;
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error("FAIL", e); process.exitCode = 1; });
