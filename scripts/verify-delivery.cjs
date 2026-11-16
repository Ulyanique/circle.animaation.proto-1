// Доставка мастера (P0-2): 10 бит должны быть настоящими, а недоступный кодек —
// честным отказом. Проверяем файл, а не обещание: читаем строку кодека и
// декодируем кадр обратно.
const assert = require('node:assert/strict');
const { launchBrowser } = require('./browser.cjs');

(async () => {
  const browser = await launchBrowser({ width: 800, height: 450 });
  const checks = [];
  const fail = (name, detail) => checks.push(`FAIL: ${name} — ${detail}`);
  const pass = (name, detail) => checks.push(`ok: ${name}${detail ? ` — ${detail}` : ''}`);
  try {
    const page = await browser.newPage();
    page.on('pageerror', error => fail('страница', error.message));
    await page.goto((process.env.URL || 'http://localhost:5173') + '/tests/fixtures/editor.html', { waitUntil: 'networkidle0' });
    const result = await page.evaluate(async () => {
      const { encodeOfflineVideo } = await import('/src/offline-video.js');
      const mb = await import('/node_modules/.vite/deps/mediabunny.js');
      const W = 320, H = 180;
      const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      // Ровный вертикальный градиент: именно на нём видны ступени в 8 битах.
      const draw = () => {
        const gradient = ctx.createLinearGradient(0, 0, 0, H);
        gradient.addColorStop(0, '#ffffff'); gradient.addColorStop(1, '#000000');
        ctx.fillStyle = gradient; ctx.fillRect(0, 0, W, H);
      };
      const inspect = async blob => {
        const input = new mb.Input({ source: new mb.BufferSource(new Uint8Array(await blob.arrayBuffer())), formats: mb.ALL_FORMATS });
        try {
          const track = await input.getPrimaryVideoTrack();
          const param = await track.getCodecParameterString();
          const colorSpace = await track.getColorSpace();
          const frame = await new mb.VideoSampleSink(track).getSample(0);
          let levels = null, midLuma = null;
          if (frame) {
            const c = document.createElement('canvas'); c.width = W; c.height = H;
            const cctx = c.getContext('2d', { willReadFrequently: true });
            frame.draw(cctx, 0, 0);
            const data = cctx.getImageData(0, 0, W, H).data;
            const seen = new Set();
            for (let y = 0; y < H; y++) {
              const o = (y * W + Math.floor(W / 2)) * 4;
              seen.add(data[o]);
            }
            levels = seen.size;
            const o = (Math.floor(H / 2) * W + Math.floor(W / 2)) * 4;
            midLuma = data[o];
            frame.close();
          }
          return { param, colorSpace, levels, midLuma, width: await track.getCodedWidth(), height: await track.getCodedHeight() };
        } finally { input.dispose(); }
      };
      const encode = async (delivery) => {
        try {
          const video = await encodeOfflineVideo({ canvas, fps: 30, total: 12, cancelled: () => false, draw, bitrate: 3000000, delivery });
          return { ok: true, codec: video.codec, bitDepth: video.bitDepth, type: video.blob.type, bytes: video.blob.size, ...(await inspect(video.blob)) };
        } catch (error) { return { ok: false, error: error.message }; }
      };
      // Мастер-разрешение: важно, что 10 бит работают именно на 1920×1080, а не
      // только на маленьком тестовом кадре.
      const big = document.createElement('canvas'); big.width = 1920; big.height = 1080;
      const bigCtx = big.getContext('2d', { willReadFrequently: true });
      const bigStart = performance.now();
      const bigVideo = await encodeOfflineVideo({ canvas: big, fps: 60, total: 3, cancelled: () => false,
        bitrate: 40000000, delivery: 'vp9_10',
        draw() {
          const g = bigCtx.createLinearGradient(0, 0, 0, 1080);
          g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#000000');
          bigCtx.fillStyle = g; bigCtx.fillRect(0, 0, 1920, 1080);
        } });
      const bigInput = new mb.Input({ source: new mb.BufferSource(new Uint8Array(await bigVideo.blob.arrayBuffer())), formats: mb.ALL_FORMATS });
      const bigTrack = await bigInput.getPrimaryVideoTrack();
      const bigResult = { param: await bigTrack.getCodecParameterString(), width: await bigTrack.getCodedWidth(),
        height: await bigTrack.getCodedHeight(), ms: Math.round(performance.now() - bigStart), bytes: bigVideo.blob.size };
      bigInput.dispose();
      const { probeDelivery } = await import('/src/delivery.js');
      return {
        master4k: { width: 3840, height: 2160 },
        big: bigResult,
        h264: await encode('h264'),
        vp9: await encode('vp9_10'),
        hevc: await encode('hevc10'),
        probe: {
          hevc: await probeDelivery('hevc10', { width: 1920, height: 1080, bitrate: 40000000, fps: 60 }),
          h264: await probeDelivery('h264', { width: 1920, height: 1080, bitrate: 40000000, fps: 60 }),
        },
      };
    });

    // 1. Совместимый вариант остаётся прежним: MP4/H.264/8 бит.
    if (!result.h264.ok) fail('H.264', result.h264.error);
    else {
      assert.equal(result.h264.codec, 'avc');
      assert.equal(result.h264.type, 'video/mp4');
      assert.equal(result.h264.bitDepth, 8);
      pass('H.264 MP4', `${result.h264.bytes} Б, ${result.h264.width}×${result.h264.height}`);
    }

    // 2. 10-битный файл: глубина видна в строке кодека, а не только в отчёте.
    if (!result.vp9.ok) fail('VP9 10 бит', result.vp9.error);
    else {
      assert.equal(result.vp9.bitDepth, 10);
      assert.equal(result.vp9.codec, 'vp9');
      assert.equal(result.vp9.type, 'video/webm');
      assert.match(result.vp9.param, /^vp09\.02\.\d{2}\.10/, `строка кодека: ${result.vp9.param}`);
      assert.equal(result.vp9.colorSpace.primaries, 'bt709');
      assert.equal(result.vp9.colorSpace.transfer, 'bt709');
      assert.equal(result.vp9.colorSpace.fullRange, false);
      pass('VP9 10 бит', `${result.vp9.param}, BT.709 limited, ${result.vp9.bytes} Б`);
      // 3. Кадр декодируется и содержит градиент, а не мусор после конверсии.
      assert.ok(result.vp9.levels > 40, `уровней яркости в кадре: ${result.vp9.levels}`);
      assert.ok(result.vp9.midLuma > 90 && result.vp9.midLuma < 165, `середина градиента: ${result.vp9.midLuma}`);
      pass('10-битный кадр читается', `уровней ${result.vp9.levels}, середина ${result.vp9.midLuma}`);
    }

    // 4. Мастер-разрешение: 10 бит не должны зависеть от размера кадра.
    assert.equal(result.big.width, 1920);
    assert.equal(result.big.height, 1080);
    assert.match(result.big.param, /^vp09\.02\.\d{2}\.10/, `строка кодека на 1080p: ${result.big.param}`);
    pass('10 бит на 1920×1080', `${result.big.param}, ${result.big.ms} мс на 3 кадра`);

    // 5. Недоступный кодек — это отказ с причиной, а не тихий 8-битный файл.
    if (result.probe.hevc.ok) pass('HEVC доступен', 'кодировщик есть, отказ не проверить');
    else {
      assert.match(String(result.probe.hevc.reason), /HEVC|не поддерж/i);
      pass('HEVC недоступен честно', result.probe.hevc.reason);
    }
    if (!result.hevc.ok) {
      assert.match(result.hevc.error, /HEVC 10 бит/);
      assert.doesNotMatch(result.hevc.error, /не поддерживается в этом браузере для 320×180\. *$/);
      pass('запись HEVC отказала', result.hevc.error.slice(0, 90));
    }
    if (!result.probe.h264.ok) fail('H.264 probe', result.probe.h264.reason);

    const errors = checks.filter(line => line.startsWith('FAIL'));
    for (const line of checks.filter(l => l.startsWith('ok:'))) console.log(line);
    if (errors.length) { for (const line of errors) console.error(line); process.exitCode = 1; }
    else console.log('Доставка: 8 бит, честные 10 бит и отказ без подмены — OK');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
