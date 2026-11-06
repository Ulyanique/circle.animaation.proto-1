// Проверка оптимизации без потери качества: нулевой DOF-проход пропускается,
// включается обратно по настройке, кадры совпадают в пределах округления,
// а стоимость кадра в software-WebGL уменьшается. npm run verify:performance
const { launchBrowser } = require("./browser.cjs");
const URL_ = process.env.URL || "http://localhost:5173/?scene=intro";

(async () => {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    // Каждый verify:* начинается с чистого localStorage: соседний прогон не должен подменять defaults.
    await page.evaluateOnNewDocument(() => { try { localStorage.clear(); } catch (_) {} });
    const messages = [];
    page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") messages.push(m.text()); });
    page.on("pageerror", (e) => messages.push(e.message));
    await page.goto(URL_, { waitUntil: "networkidle0", timeout: 120000 });
    await page.waitForFunction(() => document.body.classList.contains("boot-ready"), { timeout: 240000 });
    const result = await page.evaluate(async () => {
      await document.fonts.ready;
      const L = window.__logo;
      L.cfg.playback.paused = true;
      const s = L.scene, tl = L.cfg.timeline;
      const gl = s.renderer.getContext();
      const syncPixel = new Uint8Array(4);
      const sync = () => {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.finish();
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, syncPixel);
      };
      const renderSync = (t) => { L.renderAt(t); sync(); };
      const timed = (t) => { const start = performance.now(); renderSync(t); return performance.now() - start; };
      const originalApplyPost = s._applyPost.bind(s);
      let forceDofPass = false;
      s._applyPost = (...args) => {
        originalApplyPost(...args);
        // Эталон: тот же нулевой DOF, но без пропуска прохода.
        if (forceDofPass) s.dofPass.enabled = true;
      };
      const snapshot = (local, forced) => {
        forceDofPass = forced;
        renderSync(tl.startDelay + local);
        const canvas = document.createElement("canvas");
        canvas.width = 1920; canvas.height = 1080;
        canvas.getContext("2d").drawImage(s.renderer.domElement, 0, 0);
        return {
          data: canvas.getContext("2d").getImageData(0, 0, 1920, 1080).data,
          opacity: s.dof.blendMode.opacity.value,
          passEnabled: s.dofPass.enabled,
        };
      };
      const compare = (local) => {
        const forced = snapshot(local, true);
        const skipped = snapshot(local, false);
        let differingPixels = 0, maxDelta = 0;
        for (let i = 0; i < forced.data.length; i += 4) {
          const d = Math.abs(forced.data[i] - skipped.data[i]) +
            Math.abs(forced.data[i + 1] - skipped.data[i + 1]) +
            Math.abs(forced.data[i + 2] - skipped.data[i + 2]);
          if (d > 0) differingPixels++;
          if (d > maxDelta) maxDelta = d;
        }
        return {
          local: +local.toFixed(3), differingPixels, maxDelta,
          forcedOpacity: forced.opacity, forcedPassEnabled: forced.passEnabled,
          skippedPassEnabled: skipped.passEnabled,
        };
      };
      const comparisons = [0.42, 2.9, 8.4, L.runtime.cycle - 1 / 60].map(compare);
      // Прогреваем обе конфигурации и сравниваем стоимость одного и того же кадра.
      forceDofPass = true;
      timed(tl.startDelay + 8.4);
      const forcedMs = Math.min(timed(tl.startDelay + 8.4), timed(tl.startDelay + 8.4));
      forceDofPass = false;
      timed(tl.startDelay + 8.4);
      const skippedMs = Math.min(timed(tl.startDelay + 8.4), timed(tl.startDelay + 8.4));
      const dofSkipped = !s.dofPass.enabled && s.dof.blendMode.opacity.value === 0;
      const wasDofEnabled = L.cfg.post.dofEnabled;
      L.cfg.post.dofEnabled = true;
      renderSync(tl.startDelay + 8.4);
      const dofReenabled = s.dofPass.enabled && s.dof.blendMode.opacity.value === 1;
      L.cfg.post.dofEnabled = wasDofEnabled;
      renderSync(tl.startDelay + 8.4);
      const dofRestored = !s.dofPass.enabled && s.dof.blendMode.opacity.value === 0;
      s._applyPost = originalApplyPost;
      // Кэш титра: на неизменном кадре не должно быть повторных записей в DOM,
      // но при перемотке значения обязаны записаться заново.
      const holdTime = tl.startDelay + 8.4;
      L.renderAt(holdTime);
      const originalSetProperty = CSSStyleDeclaration.prototype.setProperty;
      let writes = 0;
      CSSStyleDeclaration.prototype.setProperty = function (...args) {
        writes++;
        return originalSetProperty.apply(this, args);
      };
      const styleSample = (time) => { writes = 0; L.renderAt(time); return writes; };
      const captionCache = {
        sameFrameWrites: styleSample(holdTime),
        adjacentFrameWrites: styleSample(holdTime + 1 / 60),
        changedFrameWrites: styleSample(tl.startDelay + 6.2),
        returnedFrameWrites: styleSample(holdTime),
      };
      CSSStyleDeclaration.prototype.setProperty = originalSetProperty;
      const updateStart = performance.now();
      for (let i = 0; i < 200; i++) {
        L.scene.update(tl.startDelay + i * L.runtime.cycle / 200, 1 / 60);
      }
      const updateMsPer200 = +(performance.now() - updateStart).toFixed(1);
      renderSync(holdTime);
      return {
        dofSkipped, dofReenabled, dofRestored,
        captionCache, updateMsPer200,
        forcedMs: +forcedMs.toFixed(1), skippedMs: +skippedMs.toFixed(1),
        speedup: +(forcedMs / skippedMs).toFixed(2),
        comparisons,
        maxDifferingPixels: Math.max(...comparisons.map((c) => c.differingPixels)),
        maxDelta: Math.max(...comparisons.map((c) => c.maxDelta)),
        seamDifferingPixels: comparisons[comparisons.length - 1].differingPixels,
        forcedOpacity: comparisons.every((c) => c.forcedOpacity === 0),
        glError: gl.getError(), contextLost: gl.isContextLost(),
      };
    });
    const cache = result.captionCache;
    const captionCacheOk = cache.sameFrameWrites === 0 && cache.adjacentFrameWrites === 0 &&
      cache.changedFrameWrites > 0 && cache.returnedFrameWrites > 0;
    const ok = result.dofSkipped && result.dofReenabled && result.dofRestored && result.forcedOpacity &&
      captionCacheOk && result.updateMsPer200 < 80 &&
      result.speedup > 1.15 && result.maxDelta <= 1 && result.maxDifferingPixels < 1500 &&
      result.seamDifferingPixels === 0 && !result.glError && !result.contextLost && messages.length === 0;
    console.log(JSON.stringify({ ...result, captionCacheOk, ok, messages }, null, 2));
    if (!ok) process.exitCode = 1;
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error("FAIL", e); process.exitCode = 1; });
