// Проверка браузерного рендера, перемотки и пиксельного шва: npm run dev; npm run verify:render
// CHROME=/путь/к/chrome или scripts/setup-headless.sh; URL — адрес dev-сервера.
const { launchBrowser } = require("./browser.cjs");
const { inspectSceneDesign } = require("./scene-probe.cjs");
const { PNG } = require("pngjs");
const URL_ = process.env.URL || "http://localhost:5173/";

(async () => {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errors.push(m.text()); });
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(URL_, { waitUntil: "networkidle0", timeout: 120000 });
    await page.waitForFunction(() => document.body.classList.contains("boot-ready"), { timeout: 240000 });
    await page.waitForSelector("#boot-screen", { hidden: true, timeout: 10000 });
    const result = await page.evaluate(async () => {
      await document.fonts.ready;
      const L = window.__logo;
      L.cfg.playback.paused = true;
      window.requestAnimationFrame = () => 0;
      const tl = L.cfg.timeline;
      const cycle = tl.drawDuration + tl.emergeDuration + tl.holdDuration + tl.fadeDuration + tl.restDuration;
      const state = (time) => {
        // Здесь проверяем параметры сцены, а реальные пиксели — отдельно ниже.
        L.scene.update(time, 1 / 60);
        const root = L.scene.logo.root;
        const caption = [...document.querySelectorAll("#caption > *")].map((el) => [
          el.style.getPropertyValue("--p"), el.style.getPropertyValue("--f"),
          [...el.querySelectorAll(".cap-glyph")].map((glyph) => [
            glyph.style.getPropertyValue("--o"), glyph.style.getPropertyValue("--f"),
          ]),
        ]);
        return { caption, logo: [root.scale.x, root.position.z, root.rotation.x, root.rotation.y,
          L.scene.logo.outlineMat.uniforms.uOpacity.value] };
      };
      const times = [tl.startDelay + 1.8, tl.startDelay + tl.drawDuration + tl.emergeDuration + 1,
        tl.startDelay + cycle - 0.5];
      const forward = times.map(state);
      const reverse = [...times].reverse().map(state).reverse();
      const periodic = times.map((time) => state(time + cycle));
      state(tl.startDelay + tl.drawDuration * 0.45);
      const plotLeads = L.scene.plotter.group.visible && L.scene.plotter.uniforms.uSweep.value > 0 &&
        L.scene.logo.outlineU.uDraw.value === 0;
      const ribbonReady = L.scene.plotter.line.isMesh &&
        L.scene.plotter.line.geometry.getAttribute("aSide")?.count === 514 &&
        L.scene.plotter.line.geometry.index?.count === 1536 &&
        L.scene.plotter.uniforms.uRes.value.x === 1920;
      state(0);
      const startupHidden = L.scene.seamCurtain.material.opacity === 1 && !L.scene.plotter.group.visible;
      state(tl.startDelay + tl.drawDuration + tl.emergeDuration + 0.55);
      const lightPassVisible = L.scene.glintLight.intensity > 0.1;
      state(tl.startDelay + tl.drawDuration + tl.emergeDuration + tl.holdDuration / 2);
      const plotHandsOff = !L.scene.plotter.group.visible;
      const glintGoneOnHold = L.scene.glintLight.intensity === 0;
      const cornersSettled = L.scene.corners.sides.left.layers[0].mesh.material.opacity < 0.7;
      state(tl.startDelay + tl.drawDuration * 0.83);
      const anchor = L.scene.logo.outline.localToWorld(L.scene.logo.root.position.clone().set(
        L.scene.logo.outlineAnchors[0], L.scene.logo.outlineAnchors[1], 0));
      const tip = L.scene.plotter.head.getWorldPosition(anchor.clone());
      const plotTouchesOutline = tip.distanceTo(anchor) < 0.001 && L.scene.plotter.head.material.opacity > 0;
      state(tl.startDelay + tl.drawDuration + tl.emergeDuration + tl.holdDuration + tl.fadeDuration * (L.scene.isIntro ? 0.73 : 0.92));
      const lastArc = L.scene.logo.outline.visible && L.scene.logo.outlineU.uReverse.value === 1 &&
        L.scene.logo.outlineU.uRetire.value > 0.5;
      state(tl.startDelay + tl.drawDuration + tl.emergeDuration / 2 + 0.45);
      const title = document.querySelector(".cap-title");
      const pen = parseFloat(title.style.getPropertyValue("--pen"));
      const lift = parseFloat(title.style.getPropertyValue("--lift"));
      const movingGlyph = [...title.querySelectorAll(".cap-glyph")].find((g) =>
        parseFloat(g.style.getPropertyValue("--gpen")) > 0.001);
      const captionMotionOk = pen > 0 && lift > 0 && movingGlyph &&
        Math.abs(parseFloat(getComputedStyle(movingGlyph, "::before").opacity) -
          parseFloat(movingGlyph.style.getPropertyValue("--gpen"))) < 0.001;
      // Интро раскрывает угловой свет быстрее, поэтому дуги проверяем в начале,
      // а к моменту передачи света они уже замкнуты.
      state(tl.startDelay + 0.32);
      const ringsPartlyDrawn = L.scene.corners.sides.left.layers[0].u.value > 0 &&
        L.scene.corners.sides.left.layers[0].u.value < 1 &&
        L.scene.corners.sides.left.ticks.count < 96;
      state(tl.startDelay + 1.8);
      const ringsSettled = L.scene.corners.sides.left.layers
        .every((layer) => layer.u.value > 0.99);
      // Проверка именно экспортного canvas: буквы должны попадать в видео-композит,
      // а не существовать только как DOM-подпись поверх WebGL.
      const exportTime = tl.startDelay + tl.drawDuration + tl.emergeDuration + tl.holdDuration * 0.55;
      const withTitle = L.compositeFrameAt(exportTime);
      const noTitle = document.createElement("canvas");
      noTitle.width = withTitle.width; noTitle.height = withTitle.height;
      noTitle.getContext("2d").drawImage(document.querySelector("#stage"), 0, 0);
      const area = (canvas) => canvas.getContext("2d").getImageData(340, 525, 1240, 120).data;
      const a = area(withTitle), b = area(noTitle);
      let titlePixels = 0;
      for (let i = 0; i < a.length; i += 4) {
        if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) +
            Math.abs(a[i + 2] - b[i + 2]) > 30) titlePixels++;
      }
      const compositeExport = withTitle.width === 1920 && withTitle.height === 1080 && titlePixels > 1000;
      return { cycle, plotLeads, ribbonReady, startupHidden, plotTouchesOutline, plotHandsOff, lastArc,
        lightPassVisible, glintGoneOnHold, cornersSettled, captionMotionOk, ringsPartlyDrawn, ringsSettled,
        compositeExport, titlePixels,
        seekStable: JSON.stringify(forward) === JSON.stringify(reverse),
        captionPeriodic: forward.every((v, i) => JSON.stringify(v.caption) === JSON.stringify(periodic[i].caption)),
        logoPeriodic: forward.every((v, i) => v.logo.every((x, j) => Math.abs(x - periodic[i].logo[j]) < 1e-8)),
        resolution: [L.scene.renderer.domElement.width, L.scene.renderer.domElement.height],
      };
    });
    // Проецируем границы 3D-знака и сравниваем их с каждой видимой строкой.
    // Измерения охватывают цикл, включая появление и уход титров.
    const design = await page.evaluate(inspectSceneDesign);
    result.layout = design.layout;
    result.motion = design.motion;
    result.exit = design.exit;
    result.rewind = design.rewind;
    // Сравниваем реальные пиксели первого и последнего PNG-кадра (60 FPS).
    // Состояние логотипа само по себе не гарантирует незаметный шов фона.
    await page.addStyleTag({ content: ".cfg-toggle,.cfg-panel,.operator-panel,.toast,.review-panel{display:none!important}" });
    const capture = async (offset) => {
      await page.evaluate((offset) => {
        const { cfg } = window.__logo;
        window.__logo.renderAt(cfg.timeline.startDelay + offset);
      }, offset);
      return PNG.sync.read(Buffer.from(await page.screenshot({ type: "png" })));
    };
    const first = await capture(0);
    const last = await capture(result.cycle - 1 / 60);
    if (first.width !== last.width || first.height !== last.height) throw new Error("Размеры кадров шва различаются");
    let changedPixels = 0;
    for (let i = 0; i < first.data.length; i += 4) {
      const delta = Math.abs(first.data[i] - last.data[i]) +
        Math.abs(first.data[i + 1] - last.data[i + 1]) +
        Math.abs(first.data[i + 2] - last.data[i + 2]);
      if (delta > 3) changedPixels++;
    }
    result.seamChangedPixels = changedPixels;
    console.log(result);
    if (errors.length) console.error("Ошибки браузера:", errors);
    if (errors.length || !result.plotLeads || !result.ribbonReady || !result.startupHidden || !result.plotTouchesOutline || !result.plotHandsOff || !result.lastArc ||
        !result.lightPassVisible || !result.glintGoneOnHold || !result.cornersSettled || !result.captionMotionOk || !result.ringsPartlyDrawn || !result.ringsSettled || !result.compositeExport || !result.seekStable || !result.captionPeriodic || !result.logoPeriodic ||
        result.layout.visibleLines < 10 || result.layout.minGap <= 0 || result.layout.maxCenterOffset >= 0.02 ||
        !result.motion.every((sample) => !sample.waveVisible && sample.waves.length === 0 && !sample.centerRing) ||
        !result.exit.pointOnContour || !result.rewind.seekStable || !result.rewind.transfer.visible ||
        result.rewind.transfer.transfer <= 0 || result.rewind.transfer.transfer >= 1 ||
        !result.rewind.early.visible || result.rewind.early.opacity <= 0 ||
        result.rewind.early.sweep <= result.rewind.late.sweep || result.rewind.late.sweep <= 0 ||
        result.rewind.early.curtain !== 0 || result.rewind.closed.curtain !== 1 ||
        changedPixels > first.width * first.height * 0.001 ||
        result.resolution[0] !== 1920 || result.resolution[1] !== 1080) {
      process.exitCode = 1;
    }
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error("FAIL", e); process.exitCode = 1; });
