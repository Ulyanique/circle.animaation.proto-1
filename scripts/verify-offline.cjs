// Ускоренная браузерная проверка точного экспорта 4 сцен: 1920×1080 / 60 FPS,
// каждый кадр в WebM, три перехода и управляемая отмена.
const { launchBrowser } = require("./browser.cjs");
const { Input, BlobSource, WEBM, EncodedPacketSink } = require("mediabunny");

(async () => {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
    await page.goto("http://localhost:5173/?scene=brand", { waitUntil: "networkidle0", timeout: 120000 });
    await page.waitForFunction(() => document.body.classList.contains("boot-ready"), { timeout: 240000 });
    await page.evaluate(() => {
      const L = window.__logo;
      Object.assign(L.getSceneConfig("waiting").timeline, {
        drawDuration: .02, emergeDuration: .02, holdDuration: .02,
        fadeDuration: .02, restDuration: .02, startDelay: 0, ringsIntro: .02, speed: 1,
      });
      for (const id of ["brand", "photo-pause", "finale"])
        L.getSceneConfig(id).timeline.holdDuration = .05;
      L.cfg.playback.paused = true;
    });
    const chain = await page.evaluate(async () => {
      const L = window.__logo;
      const succeeded = await L.startOfflineExport("chain", { download: false });
      const buffer = await window.__lastOfflineBlob?.arrayBuffer();
      return { succeeded, stats: window.__offlineStats, error: window.__offlineError,
        restored: L.activeScene.id === "brand" && L.cfg.playback.paused,
        uiClosed: document.querySelector(".operator-export").hidden,
        bytes: buffer ? [...new Uint8Array(buffer)] : null };
    });
    const data = chain.bytes ? Buffer.from(chain.bytes) : Buffer.alloc(0);
    delete chain.bytes;
    let video = null;
    if (data.length) {
      const input = new Input({ source: new BlobSource(new Blob([data])), formats: [WEBM] });
      const track = await input.getPrimaryVideoTrack();
      const timestamps = [];
      for await (const packet of new EncodedPacketSink(track).packets()) timestamps.push(packet.timestamp);
      video = { width: await track.getDisplayWidth(), height: await track.getDisplayHeight(),
        duration: await input.computeDuration(), timestamps };
    }
    const cancel = await page.evaluate(async () => {
      const L = window.__logo;
      // В реальном UI кнопка доступна во время экспорта. Отменяем, пока кодер
      // обрабатывает первые кадры следующего короткого цикла.
      const pending = L.startOfflineExport("single", { download: false });
      setTimeout(() => {
        window.__cancelUIVisible = !document.querySelector(".operator-export").hidden;
        document.querySelector('[data-action="cancel-export"]').click();
      }, 50);
      const succeeded = await pending;
      return { succeeded, cancelled: window.__offlineStats.cancelled,
        restored: L.activeScene.id === "brand", visibleAfter: !document.querySelector(".operator-export").hidden,
        visibleDuring: window.__cancelUIVisible,
        partialFile: !!window.__lastOfflineBlob, error: window.__offlineError };
    });
    console.log({ chain: { ...chain, bytes: data.length },
      video: video && { ...video, timestamps: [video.timestamps[0], video.timestamps.at(-1)],
        packetCount: video.timestamps.length }, cancel, errors });
    const plan = chain.stats?.plan;
    if (errors.length || !chain.succeeded || chain.error || !chain.restored || !chain.uiClosed ||
        plan?.totalFrames !== 15 || chain.stats.renderedFrames !== plan.totalFrames ||
        chain.stats.transitions.length !== 3 || chain.stats.fileSize !== data.length ||
        video?.width !== 1920 || video.height !== 1080 ||
        video.timestamps.length !== plan.totalFrames ||
        Math.abs(video.duration - plan.totalFrames / 60) > .02 ||
        !video.timestamps.every((time, i) => Math.abs(time - i / 60) < .002) ||
        cancel.succeeded || !cancel.cancelled || !cancel.restored || !cancel.visibleDuring ||
        cancel.visibleAfter || cancel.partialFile)
      process.exitCode = 1;
  } finally { await browser.close(); }
})().catch((error) => { console.error("FAIL", error); process.exitCode = 1; });
