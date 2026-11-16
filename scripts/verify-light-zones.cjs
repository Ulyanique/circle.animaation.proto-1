// P1-5: диагностика яркости фактического композита интро на удержании.
// Три кадра одного времени: полный, без титра, без титра и знака. Разности
// выделяют вклад слоёв (включая свечение/тень), а не идеальную маску геометрии.
// Это измерение в sRGB-кодах, не фотометрия LED-стены и не тест читаемости.
const assert = require('node:assert/strict');
const { launchBrowser } = require('./browser.cjs');

(async () => {
  const browser = await launchBrowser({ width: 1280, height: 720 });
  try {
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', e => { if (e.type() === 'error') errors.push(e.text()); });
    const url = new URL(process.env.URL || 'http://localhost:5173/');
    url.searchParams.set('scene', 'waiting');
    await page.goto(url.href, { waitUntil: 'networkidle0', timeout: 120000 });
    await page.waitForFunction(() => document.body.classList.contains('boot-ready'), { timeout: 240000 });
    const result = await page.evaluate(async () => {
      await document.fonts.ready;
      window.requestAnimationFrame = () => 0;
      const L = window.__logo, tl = L.cfg.timeline;
      L.cfg.playback.paused = true;
      const t = tl.startDelay + tl.drawDuration + tl.emergeDuration + tl.holdDuration * 0.7;
      const read = caption => {
        const canvas = L.compositeFrameAt(t, 1 / 60, caption);
        return canvas.getContext('2d', {willReadFrequently:true}).getImageData(0, 0, canvas.width, canvas.height);
      };
      const originalVisible = L.cfg.logo.visible;
      let full, noCaption, background;
      try {
        full = read(true);
        noCaption = read(false);
        L.cfg.logo.visible = false;
        background = read(false);
      } finally { L.cfg.logo.visible = originalVisible; }
      const {width:w, height:h} = full;
      const lum = (d, i) => .2126*d[i] + .7152*d[i+1] + .0722*d[i+2];
      const difference = (a, b, i) => Math.abs(a[i]-b[i]) + Math.abs(a[i+1]-b[i+1]) + Math.abs(a[i+2]-b[i+2]);
      const percentiles = values => {
        values.sort((a,b) => a-b);
        const q = p => +(values[Math.min(values.length-1, Math.floor(values.length*p))] ?? 0).toFixed(2);
        return {count: values.length, p10:q(.1), p50:q(.5), p90:q(.9)};
      };
      let dark = 0, centerDark = 0, centerCount = 0;
      const logo = [], logoBg = [], caption = [], captionBg = [];
      const bins = [0,0,0,0,0]; // 0–8%, 8–20%, 20–50%, 50–80%, 80–100%
      for (let y=0; y<h; y++) for (let x=0; x<w; x++) {
        const i = (y*w+x)*4, value = lum(full.data, i);
        bins[value < 20.4 ? 0 : value < 51 ? 1 : value < 127.5 ? 2 : value < 204 ? 3 : 4]++;
        if (value < 20.4) dark++;
        // Центральная зона без титра и знака: здесь могут оставаться свет и другие эффекты.
        if (x >= w*.4 && x < w*.6 && y >= h*.25 && y < h*.75) {
          centerCount++;
          if (lum(background.data, i) < 20.4) centerDark++;
        }
        if (difference(full.data, noCaption.data, i) > 24) {
          caption.push(value); captionBg.push(lum(noCaption.data, i));
        }
        // Исключаем пиксели титра, чтобы не приписать их знаку.
        if (difference(noCaption.data, background.data, i) > 24) {
          logo.push(lum(noCaption.data, i)); logoBg.push(lum(background.data, i));
        }
      }
      return {size:[w,h], time:+t.toFixed(3), bins:bins.map(n => +(n/(w*h)*100).toFixed(2)),
        darkPercent:+(dark/(w*h)*100).toFixed(2), centerBackgroundDarkPercent:+(centerDark/centerCount*100).toFixed(2),
        logo:percentiles(logo), logoBackground:percentiles(logoBg),
        caption:percentiles(caption), captionBackground:percentiles(captionBg)};
    });
    assert.deepEqual(errors, []);
    assert.deepEqual(result.size, [1920,1080], 'ожидался 1080p мастер по умолчанию');
    // Технический регресс-порог для текущего кадра, не критерий LED-приёмки.
    assert.ok(result.darkPercent >= 20, `менее 20% кадра темнее 8% кода: ${result.darkPercent}%`);
    assert.ok(result.logo.count > 1000, 'вклад знака не найден');
    assert.ok(result.caption.count > 1000, 'вклад титра не найден');
    assert.ok(result.logo.p90 > result.logoBackground.p50, 'знак не выделяется на измеренном фоне');
    assert.ok(result.caption.p90 > result.captionBackground.p50, 'титр не выделяется на измеренном фоне');
    console.log(JSON.stringify(result, null, 2));
    console.log('P1-5: диагностический 1080p кадр; распределение и вклад слоёв измерены. Визуальная приёмка и LED-стена не проверены.');
  } finally { await browser.close(); }
})().catch(error => { console.error('FAIL', error); process.exitCode = 1; });
