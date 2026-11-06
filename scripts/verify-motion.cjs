// Реальные WebGL-пиксели: движущийся фон и расходящиеся контуры логотипа.
// npm run dev; npm run verify:motion [OUT=out/motion]
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { launchBrowser } = require("./browser.cjs");
const sceneId = process.env.SCENE || "brand";
const url = new URL(process.env.URL || "http://localhost:5173/");
url.searchParams.set("scene", sceneId);

(async () => {
  const browser = await launchBrowser({ width: 960, height: 540, deviceScaleFactor: 1 });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    await page.goto(url.href, { waitUntil: "networkidle0", timeout: 120000 });
    await page.waitForFunction(() => document.body.classList.contains("boot-ready"), { timeout: 240000 });
    await page.waitForSelector("#boot-screen", { hidden: true, timeout: 10000 });
    const result = await page.evaluate(async () => {
      await document.fonts.ready;
      const L = window.__logo;
      L.cfg.playback.paused = true;
      window.requestAnimationFrame = () => 0;
      const tl = L.cfg.timeline;
      const start = (tl.startDelay || 0) + tl.drawDuration + tl.emergeDuration + 2.8;
      const grab = (x, y, width, height) => {
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(document.querySelector("#stage"), x, y, width, height, 0, 0, width, height);
        return ctx.getImageData(0, 0, width, height).data;
      };
      const changed = (a, b, threshold = 6) => {
        let count = 0;
        for (let i = 0; i < a.length; i += 4) {
          if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) +
              Math.abs(a[i + 2] - b[i + 2]) > threshold) count++;
        }
        return count;
      };
      L.renderAt(start);
      const stage = document.querySelector("#stage");
      const stageRect = stage.getBoundingClientRect();
      const titleRect = document.querySelector("#caption .cap-title").getBoundingClientRect();
      const captionY = Math.max(0, Math.min(stage.height - 1,
        Math.floor((titleRect.top - stageRect.top) * stage.height / stageRect.height)));
      const withWaves = grab(320, 0, 1280, 620);
      const withWavesUnderTitle = grab(0, captionY, stage.width, stage.height - captionY);
      const backgroundA = grab(0, 0, 500, 360);
      // Волны есть только в фотопаузе.
      let withoutWaves = withWaves, withoutWavesUnderTitle = withWavesUnderTitle;
      if (L.scene.contourWaves) {
        L.scene.contourWaves.group.visible = false;
        L.scene.render(1 / 60);
        withoutWaves = grab(320, 0, 1280, 620);
        withoutWavesUnderTitle = grab(0, captionY, stage.width, stage.height - captionY);
      }
      L.renderAt(start + 2);
      const backgroundB = grab(0, 0, 500, 360);
      L.renderAt(start + 4);
      const backgroundC = grab(0, 0, 500, 360);
      const fadeStart = tl.drawDuration + tl.emergeDuration + tl.holdDuration;
      const fadeEnd = fadeStart + tl.fadeDuration;
      const delay = tl.startDelay || 0;
      const span = Math.min(tl.restDuration, 1.2);
      const exitTime = delay + fadeStart + tl.fadeDuration * 0.92;
      const returnTime = delay + fadeEnd + span * 0.12;
      const orbitTime = delay + fadeEnd + span * 0.50;
      const probePlot = (time, followsOutline = false) => {
        L.renderAt(time);
        const { plotter, logo, seamCurtain } = L.scene;
        const withPlot = grab(320, 0, 1280, 620);
        const tip = plotter.head.getWorldPosition(plotter.head.position.clone());
        let distance = null;
        if (followsOutline) {
          const retire = logo.outlineU.uRetire.value;
          const u = Math.max(0, Math.min(1, (retire - 0.27) / 0.73));
          const pathTime = 1 - u * u * (3 - 2 * u);
          const p = logo.parsed.subPaths[0].getPointAt(pathTime);
          const target = logo.outline.localToWorld(tip.clone().set(p.x - logo.parsed.cx, p.y - logo.parsed.cy, 0));
          distance = tip.distanceTo(target);
        }
        const result = { visible: plotter.group.visible, head: plotter.head.material.opacity,
          sweep: plotter.uniforms.uSweep.value, opacity: plotter.uniforms.uOpacity.value,
          curtain: seamCurtain.material.opacity, distance };
        plotter.group.visible = false;
        L.scene.render(1 / 60);
        result.changedPixels = changed(withPlot, grab(320, 0, 1280, 620), 3);
        return result;
      };
      const trace = probePlot(exitTime, true);
      const orbit = probePlot(orbitTime);
      L.scene.update(returnTime, 1 / 60);
      const transferVisible = L.scene.plotter.group.visible && L.scene.plotter.head.material.opacity > 0 &&
        L.scene.plotter.uniforms.uTransfer.value > 0 && L.scene.plotter.uniforms.uTransfer.value < 1;
      return {
        id: L.activeScene.id,
        isIntro: L.scene.isIntro,
        hasWaves: Boolean(L.scene.contourWaves),
        wavePixels: changed(withWaves, withoutWaves),
        wavePixelsUnderTitle: changed(withWavesUnderTitle, withoutWavesUnderTitle),
        captionY, trace, orbit, transferVisible,
        backgroundChanges: [changed(backgroundA, backgroundB, 12), changed(backgroundB, backgroundC, 12)],
        introTime: delay + tl.drawDuration * 0.45,
        exitTime, returnTime, orbitTime,
        holdTime: start,
      };
    });
    if (process.env.OUT) {
      fs.mkdirSync(process.env.OUT, { recursive: true });
      await page.addStyleTag({ content: ".cfg-toggle,.cfg-panel,.operator-panel,.toast,.review-panel{display:none!important}" });
      for (const [name, time] of [["intro", result.introTime], ["hold", result.holdTime],
        ["reverse", result.exitTime], ["return", result.returnTime], ["orbit", result.orbitTime]]) {
        await page.evaluate((value) => window.__logo.renderAt(value), time);
        await page.screenshot({ path: path.join(process.env.OUT, `${sceneId}-${name}.jpg`), type: "jpeg", quality: 90 });
      }
    }
    console.log({ ...result, errors });
    assert.equal(result.id, sceneId === "intro" ? "waiting" : sceneId);
    assert.deepEqual(errors, []);
    if (result.id === "photo-pause") {
      assert.ok(result.hasWaves && result.wavePixels > 30, `волны не видны в WebGL: ${result.wavePixels}`);
    } else {
      assert.equal(result.hasWaves, false, "волны от логотипа должны быть только в фотопаузе");
      assert.equal(result.wavePixels, 0);
    }
    assert.ok(result.backgroundChanges.every((pixels) => pixels > 1000),
      `фон не движется в двух последовательных интервалах: ${result.backgroundChanges}`);
    assert.ok(result.trace.visible && result.trace.head > 0 && result.trace.distance < 0.001 &&
      result.trace.changedPixels > 20, `точка не следует контуру в WebGL: ${JSON.stringify(result.trace)}`);
    assert.ok(result.transferVisible, "точка не возвращается с контура на орбиту");
    assert.ok(result.orbit.visible && result.orbit.head > 0 && result.orbit.opacity > 0 &&
      result.orbit.sweep > 0 && result.orbit.sweep < 1 && result.orbit.curtain === 0 &&
      result.orbit.changedPixels > 20, `обратная орбита не видна в WebGL: ${JSON.stringify(result.orbit)}`);
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error("FAIL", error); process.exitCode = 1; });
