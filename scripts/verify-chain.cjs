// Ускоренный браузерный прогон единой записи MP4. Только в тесте циклы
// короткие и скорость выше обычной; выходной файл по-прежнему 1920×1080.
const { launchBrowser } = require("./browser.cjs");
(async () => {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
    await page.goto(`${process.env.URL || "http://localhost:5173"}/?scene=waiting`, { waitUntil: "networkidle0", timeout: 120000 });
    await page.waitForFunction(() => document.body.classList.contains("boot-ready"), { timeout: 240000 });
    await page.evaluate(() => window.__logo.switchScene("brand"));
    await page.waitForFunction(() => !document.querySelector(".transition-frame"), { timeout: 60000 });
    const requested = await page.evaluate(() => {
      const L = window.__logo;
      const w = L.getSceneConfig("waiting").timeline;
      Object.assign(w, { drawDuration: .1, emergeDuration: .1, holdDuration: .3,
        fadeDuration: .1, restDuration: .1, startDelay: 0, ringsIntro: .1, speed: 7 });
      for (const id of ["brand", "photo-pause", "finale"]) {
        const timeline = L.getSceneConfig(id).timeline;
        Object.assign(timeline, { drawDuration: .1, emergeDuration: .1, holdDuration: .3,
          fadeDuration: .1, restDuration: .1, startDelay: 0, ringsIntro: .1, speed: 7 });
      }
      return { accepted: L.startSequenceRecording({ download: false }),
        button: !!document.querySelector('[data-action="record-chain"]') };
    });
    await page.waitForFunction(() => !!window.__sequenceStats, { timeout: 120000 });
    const duplicate = await page.evaluate(() => window.__logo.startSequenceRecording({ download: false }));
    // Второй вызов отклонён: запись не начинается повторно по случайному клику.
    await page.waitForFunction(() => window.__lastSequenceBlob?.size > 0, { timeout: 600000 });
    const result = await page.evaluate(async () => {
      const blob = window.__lastSequenceBlob;
      const stats = window.__sequenceStats;
      const url = URL.createObjectURL(blob);
      const video = document.createElement("video");
      video.src = url;
      const decoded = await new Promise((resolve) => {
        video.onloadedmetadata = () => resolve({ width: video.videoWidth, height: video.videoHeight, duration: video.duration });
        video.onerror = () => resolve({ error: video.error?.message || "decode failed" });
      });
      URL.revokeObjectURL(url);
      return { scenes: stats.scenes, transitions: stats.transitions, frames: stats.frames,
        blendedFrames: stats.blendedFrames, bytes: blob.size, type: blob.type,
        final: window.__logo.activeScene.id, decoded,
        recordingFinished: !document.querySelector(".operator-busy") };
    });
    console.log({ requested, duplicate, ...result, errors });
    if (errors.length || !requested.accepted || !requested.button || duplicate ||
        result.scenes.join() !== "waiting,brand,photo-pause,finale" ||
        result.transitions.length !== 3 ||
        result.transitions.some((transition) => transition.blendedFrames !== 6) || result.frames !== 24 ||
        result.blendedFrames < 1 || result.bytes < 1000 ||
        !result.type.startsWith("video/mp4") || result.final !== "finale" ||
        result.decoded.width !== 1920 || result.decoded.height !== 1080 || Math.abs(result.decoded.duration - 24 / 60) > .002 ||
        !result.recordingFinished) process.exitCode = 1;
  } finally { await browser.close(); }
})().catch((e) => { console.error("FAIL", e); process.exitCode = 1; });
