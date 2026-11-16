// Проверка шрифтов в живой сцене, сохранения и композита записи.
const assert = require('node:assert/strict');
const { launchBrowser } = require('./browser.cjs');
(async () => {
  const browser = await launchBrowser({width: 960, height: 540, deviceScaleFactor: 1});
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(process.env.URL || 'http://localhost:5173/?scene=intro', {waitUntil:'networkidle0', timeout:120000});
    await page.waitForFunction(() => document.body.classList.contains('boot-ready'), {timeout:240000});
    const result = await page.evaluate(async () => {
      window.__logo.cfg.playback.paused = true;
      window.__logo.renderAt(8);
      document.querySelector('.cfg-toggle').click();
      document.querySelector('.cfg-select').closest('details').open = true;
      // Раскрываем раздел типографики и подводим его к кадру, как это делает
      // инспектор: иначе снимок панели показывает только блок действий.
      window.__logo.settings.openSection('typography');
      document.querySelector('[data-section="typography"]')
        .scrollIntoView({ block: 'start', behavior: 'instant' });
      await new Promise(r => setTimeout(r, 400));
      const input = document.querySelector('select[data-key="typography.font"]');
      const values = [...input.options].map(o => o.value);
      const fonts = [];
      for (const value of values) {
        input.value = value;
        input.dispatchEvent(new Event('change', {bubbles:true}));
        const title = document.querySelector('.cap-title');
        const bounds = title.getBoundingClientRect();
        const original = CanvasRenderingContext2D.prototype.fillText;
        let usedFont = '';
        CanvasRenderingContext2D.prototype.fillText = function (...args) {
          if (!usedFont) usedFont = this.font;
          return original.apply(this, args);
        };
        let frame;
        try { frame = window.__logo.compositeFrameAt(8); }
        finally { CanvasRenderingContext2D.prototype.fillText = original; }
        fonts.push({value, family: getComputedStyle(title).fontFamily,
          fits: bounds.left >= 0 && bounds.right <= innerWidth,
          frame: [frame.width, frame.height],
          fontInCanvas: usedFont,
          stored: JSON.parse(localStorage.getItem('circle-anim-settings-v2:waiting')).typography.font});
      }
      input.value = 'playfair-display';
      input.dispatchEvent(new Event('change', {bubbles:true}));
      return {values, fonts, other: window.__logo.getSceneConfig('brand').typography.font};
    });
    // Кадр документации снимаем на высоком окне: на 540 px панель обрезает
    // раздел типографики, и снимок перестаёт показывать то, что проверяет тест.
    await page.setViewport({width: 1280, height: 720, deviceScaleFactor: 1});
    await page.evaluate(() => {
      window.__logo.settings.openSection('typography');
      const section = document.querySelector('[data-section="typography"]');
      const body = section?.parentElement;
      if (body && section) body.scrollTop = section.offsetTop - body.offsetTop - 8;
      window.__logo.renderAt(8);
    });
    await new Promise((resolve) => setTimeout(resolve, 600));
    await page.screenshot({path:'docs/font-settings.jpg',type:'jpeg',quality:85});
    console.log(JSON.stringify({result, errors}, null, 2));
    assert.equal(result.values.length, 6);
    assert.equal(result.other, 'cormorant-garamond');
    for (const f of result.fonts) {
      assert.equal(f.value, f.stored);
      assert.ok(f.fontInCanvas.toLowerCase().includes(f.family.split(',')[0].replaceAll('"','').toLowerCase()));
      assert.deepEqual(f.frame, [1920,1080]);
      assert.ok(f.fits, `${f.value} выходит за границы кадра`);
    }
    assert.deepEqual(errors, []);
  } finally {
    // На software WebGL закрытие Chromium иногда зависает; принудительно завершаем тестовый браузер.
    const process = browser.process();
    if (process) process.kill("SIGKILL");
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
