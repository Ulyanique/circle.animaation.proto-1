// Ускоренный браузерный прогон единой записи MP4. Только в тесте циклы
// короткие и скорость выше обычной; выходной файл по-прежнему 1920×1080.
const { launchBrowser } = require("./browser.cjs");
(async () => {
  const browser = await launchBrowser({width:1920, height:1080}, {protocolTimeout: 900000});
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
    console.log('Цепочка: открываем сцену и загружаем шрифты…');
    await page.goto(`${process.env.URL || "http://localhost:5173"}/?scene=waiting`, { waitUntil: "networkidle0", timeout: 120000 });
    await page.waitForFunction(() => document.body.classList.contains("boot-ready"), { timeout: 240000 });
    console.log('Цепочка: загрузка завершена, проверяем переключение…');
    await page.evaluate(() => window.__logo.switchScene("brand"));
    await page.waitForFunction(() => !document.querySelector(".transition-overlay:not([hidden])") && (() => { const o = document.querySelector(".transition-overlay"); return !o || o.style.display === "none"; })(), { timeout: 60000 });
    console.log('Цепочка: задаём сокращённые тестовые циклы и запускаем MP4…');
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
    if (!requested.accepted) throw new Error("Экспорт цепочки не был принят");
    await page.waitForFunction(() => !!window.__sequenceStats, { timeout: 120000, polling: 500 });
    console.log("Цепочка: экспорт запущен; ожидаем завершения и проверки пакетов…");
    const duplicate = await page.evaluate(() => window.__logo.startSequenceRecording({ download: false }));
    // Второй вызов отклонён: запись не начинается повторно по случайному клику.
    await page.waitForFunction(() => window.__lastSequenceBlob?.size > 0 || !!window.__sequenceStats?.error, { timeout: 600000, polling: 500 });
    const failure = await page.evaluate(() => window.__sequenceStats?.error);
    if (failure) throw new Error(`Экспорт прерван: ${failure}`);
    console.log("Цепочка: MP4 сформирован, читаем метаданные…");
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
      if (decoded.error) { URL.revokeObjectURL(url); throw new Error(`Метаданные MP4: ${decoded.error}`); }
      // Декодируем реальные кадры MP4 на границах сегментов и в конце.
      const waitEvent = (name, trigger) => new Promise((resolve, reject) => {
        const timer = setTimeout(() => { cleanup(); reject(new Error(`Таймаут video.${name}`)); }, 30000);
        const done = () => { cleanup(); resolve(); };
        const fail = () => { cleanup(); reject(new Error(video.error?.message || 'Ошибка декодирования')); };
        const cleanup = () => { clearTimeout(timer); video.removeEventListener(name, done); video.removeEventListener('error', fail); };
        video.addEventListener(name, done, {once:true}); video.addEventListener('error', fail, {once:true});
        trigger?.();
      });
      if (video.readyState < 2) await waitEvent('loadeddata');
      const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 180;
      const ctx = canvas.getContext('2d'), samples = [];
      // Первый drawImage в headless SwiftShader может лишь инициализировать
      // видео-текстуру и вернуть пустой canvas, несмотря на loadeddata/seeked.
      // Прогрев отдельно, затем каждый проверяемый кадр читаем на чистый canvas.
      await waitEvent('seeked', () => {video.currentTime = 3.25 / 30;});
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      ctx.getImageData(0, 0, canvas.width, canvas.height);
      for (const index of [0, 3, 6, 9, 11]) {
        const time = (index + .25) / 30;
        await waitEvent('seeked', () => {video.currentTime = time;});
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const rgba = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let hash = 2166136261, opaque = 0;
        for (let i=0; i<rgba.length; i+=4) {
          hash = Math.imul(hash ^ rgba[i], 16777619); hash = Math.imul(hash ^ rgba[i+1], 16777619);
          hash = Math.imul(hash ^ rgba[i+2], 16777619); if (rgba[i+3] === 255) opaque++;
        }
        samples.push({index, hash:(hash >>> 0).toString(16), opaque});
      }
      video.removeAttribute('src'); video.load(); URL.revokeObjectURL(url);
      return { scenes: stats.scenes, transitions: stats.transitions, frames: stats.frames,
        blendedFrames: stats.blendedFrames, bytes: blob.size, type: blob.type, samples,
        final: window.__logo.activeScene.id, decoded,
        recordingFinished: !document.querySelector(".operator-busy") };
    });
    console.log({ requested, duplicate, ...result, errors });
    if (errors.length || !requested.accepted || !requested.button || duplicate ||
        result.scenes.join() !== "waiting,brand,photo-pause,finale" ||
        result.transitions.length !== 3 ||
        result.transitions.some((transition) => transition.blendedFrames !== 3) || result.frames !== 12 ||
        result.blendedFrames < 1 || result.bytes < 1000 ||
        !result.type.startsWith("video/mp4") || result.final !== "finale" ||
        result.decoded.width !== 1920 || result.decoded.height !== 1080 || Math.abs(result.decoded.duration - 12 / 30) > .002 ||
        !result.recordingFinished || result.samples?.length !== 5 ||
        result.samples.some(sample => sample.opaque !== 320 * 180) ||
        new Set(result.samples.map(sample => sample.hash)).size < 2) process.exitCode = 1;
  } finally { await browser.close(); }
})().catch((e) => { console.error("FAIL", e); process.exitCode = 1; });
