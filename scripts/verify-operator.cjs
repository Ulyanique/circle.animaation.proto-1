// Пульт, перемотка, изменение длительности и переходы между готовыми видами.
const { launchBrowser } = require("./browser.cjs");
(async () => {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
    await page.goto("http://localhost:5173/?scene=waiting", { waitUntil: "networkidle0", timeout: 120000 });
    await page.waitForFunction(() => document.body.classList.contains("boot-ready"), { timeout: 240000 });
    const first = await page.evaluate(() => ({
      cursor: getComputedStyle(document.body).cursor,
      panel: !!document.querySelector(".operator-panel"),
      settings: getComputedStyle(document.querySelector(".cfg-toggle")).display !== "none",
    }));
    await page.evaluate(() => document.querySelector('[data-scene="brand"]').click());
    await page.waitForFunction(() => window.__logo.activeScene.id === "brand", { timeout: 120000 });
    const crossfade = await page.evaluate(() => ({
      overlay: !!document.querySelector(".transition-frame"),
      canvasCount: document.querySelectorAll("#stage").length,
      samePage: location.search.includes("scene=brand"),
      brandTitle: document.querySelector(".cap-title").textContent.replaceAll("\u00a0", " "),
    }));
    await page.waitForFunction(() => !document.querySelector(".transition-frame"), { timeout: 60000 });
    const edit = await page.evaluate(() => {
      const duration = document.querySelector('[data-action="duration"]');
      duration.value = "30";
      duration.dispatchEvent(new Event("change", { bubbles: true }));
      const range = document.querySelector('[data-action="seek"]');
      range.value = "15";
      range.dispatchEvent(new Event("input", { bubbles: true }));
      return { cycle: window.__logo.runtime.cycle, paused: window.__logo.cfg.playback.paused,
        time: window.__logo.runtime.time };
    });
    const auto = await page.evaluate(() => {
      document.querySelector('[data-action="auto"]').click();
      window.__logo.cfg.playback.paused = false;
      window.__logo.renderAt(window.__logo.runtime.cycle - 0.001);
      return window.__logo.operator.auto;
    });
    await page.waitForFunction(() => window.__logo.activeScene.id === "photo-pause", { timeout: 120000 });
    await page.waitForFunction(() => !document.querySelector(".transition-frame"), { timeout: 60000 });
    await page.evaluate(() => document.querySelector('[data-action="auto"]').click());
    await page.evaluate(() => document.querySelector('[data-scene="finale"]').click());
    await page.waitForFunction(() => window.__logo.activeScene.id === "finale", { timeout: 120000 });
    await page.waitForFunction(() => !document.querySelector(".transition-frame"), { timeout: 60000 });
    const finalState = await page.evaluate(() => ({
      title: document.querySelector(".cap-title").textContent.replaceAll("\u00a0", " "),
      phrase: document.querySelector(".cap-sub").textContent.replaceAll("\u00a0", " "),
      stage: [window.__logo.scene.renderer.domElement.width, window.__logo.scene.renderer.domElement.height],
    }));
    await page.evaluate(() => document.querySelector('[data-scene="waiting"]').click());
    await page.waitForFunction(() => window.__logo.activeScene.id === "waiting", { timeout: 120000 });
    const returnState = await page.evaluate(() => ({
      title: document.querySelector(".cap-title").textContent.replaceAll("\u00a0", " "),
      settings: getComputedStyle(document.querySelector(".cfg-toggle")).display !== "none",
    }));
    await page.waitForFunction(() => document.body.classList.contains("operator-idle") &&
      Number(getComputedStyle(document.querySelector(".cfg-toggle")).opacity) < 0.01,
    { timeout: 15000 });
    const idle = await page.evaluate(() => ({
      cursor: getComputedStyle(document.body).cursor,
      buttonOpacity: getComputedStyle(document.querySelector(".cfg-toggle")).opacity,
      panelOpacity: getComputedStyle(document.querySelector(".operator-panel")).opacity,
    }));
    await page.mouse.move(200, 180);
    await page.waitForFunction(() => !document.body.classList.contains("operator-idle"));
    const awakened = await page.evaluate(() => !document.body.classList.contains("operator-idle"));
    const result = { first, crossfade, edit, auto, finalState, returnState, idle, awakened, errors };
    console.log(result);
    if (errors.length || first.cursor !== "auto" || !first.panel || !first.settings ||
        !crossfade.overlay || crossfade.canvasCount !== 1 || !crossfade.samePage ||
        crossfade.brandTitle !== "Янтарный циркуль" || edit.cycle !== 30 ||
        !edit.paused || Math.abs(edit.time - 15) > 0.01 || !auto ||
        finalState.title !== "Янтарный циркуль" ||
        finalState.phrase !== "История продолжается" ||
        finalState.stage.join("x") !== "1920x1080" ||
        returnState.title !== "Янтарный циркуль" || !returnState.settings ||
        idle.cursor !== "auto" || Number(idle.buttonOpacity) > 0.01 ||
        Number(idle.panelOpacity) > 0.01 || !awakened) process.exitCode = 1;
  } finally { await browser.close(); }
})().catch((e) => { console.error("FAIL", e); process.exitCode = 1; });
