// Стартовое интро: проверка роли сцены и настоящих WebGL-пикселей света.
// npm run dev; OUT=out/intro npm run verify:intro
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { launchBrowser } = require("./browser.cjs");
const url = new URL(process.env.URL || "http://localhost:5173/");
url.searchParams.set("scene", "intro");

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
      const start = tl.startDelay;
      const times = {
        light: start + tl.drawDuration * 0.90,
        handoff: start + tl.drawDuration * 0.87,
        strike: start + tl.drawDuration + tl.emergeDuration * 0.50,
        hold: start + tl.drawDuration + tl.emergeDuration + tl.holdDuration * 0.55,
      };
      const grab = () => {
        const c = document.createElement("canvas");
        c.width = 1520; c.height = 540;
        const context = c.getContext("2d");
        context.drawImage(document.querySelector("#stage"), 200, 0, 1520, 540, 0, 0, 1520, 540);
        return context.getImageData(0, 0, 1520, 540).data;
      };
      const changed = (a, b, threshold = 6) => {
        let count = 0;
        for (let i = 0; i < a.length; i += 4) {
          if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) +
              Math.abs(a[i + 2] - b[i + 2]) > threshold) count++;
        }
        return count;
      };
      L.renderAt(times.light);
      const scene = L.scene;
      const lightState = { beams: scene.background.uniforms.uIntroLight.value,
        cameraZ: scene.camera.position.z, cameraX: scene.camera.position.x, cameraY: scene.camera.position.y, pitch: scene.logo.root.rotation.x, yaw: scene.logo.root.rotation.y };
      const withBeams = grab();
      scene.background.uniforms.uIntroLight.value = 0;
      scene.render(1 / 60);
      const beamPixels = changed(withBeams, grab());
      L.renderAt(times.strike);
      const strikeState = { beams: scene.background.uniforms.uIntroLight.value,
        flare: scene.flare.uniforms.uI.value, flareVisible: scene.flare.mesh.visible,
        sparkIntensity: scene.sparks.uniforms.uIntensity.value, cameraZ: scene.camera.position.z };
      const withFlare = grab();
      scene.flare.mesh.visible = false;
      scene.render(1 / 60);
      const flarePixels = changed(withFlare, grab(), 3);
      L.renderAt(times.hold);
      const holdState = { beams: scene.background.uniforms.uIntroLight.value,
        cameraZ: scene.camera.position.z, waveCount: scene.contourWaves?.layers.length ?? 0,
        centerRing: scene.corners.centerRing.visible,
        backgroundTime: scene.background.uniforms.uTime.value,
        // Угловые огни только в двух местах: левый верх и правый низ.
        cornerGroups: Object.keys(scene.corners.sides) };
      scene.update(times.light, 1 / 60);
      const again = [scene.background.uniforms.uIntroLight.value, scene.camera.position.z, scene.logo.root.rotation.y];
      const first = [lightState.beams, lightState.cameraZ, lightState.yaw];
      return { id: L.activeScene.id, title: L.activeScene.title, isIntro: scene.isIntro,
        panelLabel: document.querySelector('[data-scene="waiting"]')?.textContent.trim(),
        configAlias: L.getSceneConfig("intro") === L.getSceneConfig("waiting"),
        initialDelay: tl.startDelay, times, lightState, strikeState, holdState, beamPixels, flarePixels,
        seekStable: first.every((value, i) => Math.abs(value - again[i]) < 1e-9) };
    });
    if (process.env.OUT) {
      fs.mkdirSync(process.env.OUT, { recursive: true });
      await page.addStyleTag({ content: ".cfg-toggle,.cfg-panel,.operator-panel,.toast,.review-panel{display:none!important}" });
      for (const [name, time] of Object.entries(result.times)) {
        await page.evaluate((value) => window.__logo.renderAt(value), time);
        await page.screenshot({ path: path.join(process.env.OUT, `${name}.jpg`), type: "jpeg", quality: 90 });
      }
    }
    console.log({ ...result, errors });
    assert.deepEqual(errors, []);
    assert.equal(result.id, "waiting", "старый технический id должен сохраняться");
    assert.match(result.title, /Интро/);
    assert.match(result.panelLabel, /Интро/);
    assert.ok(result.isIntro && result.configAlias && result.initialDelay < 0.5);
    assert.ok(result.lightState.beams > 0.7 && result.lightState.cameraZ > 9.5 && result.lightState.yaw === 0 && result.lightState.pitch === 0 && result.lightState.cameraX === 0 && result.lightState.cameraY === 0);
    assert.ok(result.beamPixels > 1000, `лучи не видны в WebGL: ${result.beamPixels}`);
    assert.ok(result.strikeState.flareVisible && result.strikeState.flare > 0.04 && result.strikeState.sparkIntensity > 1.5);
    assert.ok(result.flarePixels > 20, `раскрывающий блик не виден в WebGL: ${result.flarePixels}`);
    assert.equal(result.holdState.waveCount, 0, "в интро не должно быть фоновых контуров");
    assert.equal(result.holdState.centerRing, false, "вокруг знака интро не должно быть фонового кольца");
    assert.ok(result.holdState.beams > 0 && result.holdState.beams < result.lightState.beams, "лучи остаются мягче на удержании");
    // Никаких добавленных кругов: только исходные левый верх и правый низ.
    assert.deepEqual(result.holdState.cornerGroups.sort(), ["left", "right"]);
    assert.ok(Math.abs(result.holdState.cameraZ - 9) < 1e-9 && result.seekStable);
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error("FAIL", error); process.exitCode = 1; });
