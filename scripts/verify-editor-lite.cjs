// Быстрая DOM-проверка редактора и вертикального запаса букв без WebGL/скриншотов.
// Запустите Vite и затем URL=http://localhost:5175 node scripts/verify-editor-lite.cjs
const assert = require('node:assert/strict');
const { launchBrowser } = require('./browser.cjs');
(async () => {
  const browser = await launchBrowser({ width: 960, height: 540 });
  try {
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(new URL('/tests/fixtures/editor.html', process.env.URL || 'http://localhost:5173').href);
    await page.waitForFunction(() => window.editorFixture);
    const descender = await page.$eval('.cap-glyph', el => {
      const s = getComputedStyle(el, '::after');
      return { top: parseFloat(s.top), bottom: parseFloat(s.bottom), padding: parseFloat(s.paddingTop) };
    });
    assert.ok(descender.top < 0 && descender.bottom < 0 && descender.padding > 0, 'нет запаса для нижних элементов букв');
    await page.click('.editor-toggle');
    async function drag(selector, dx, dy) {
      const p = await page.$eval(selector, el => { const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
      await page.mouse.move(p.x, p.y); await page.mouse.down();
      await page.mouse.move(p.x + dx, p.y + dy, { steps: 3 }); await page.mouse.up();
    }
    await drag('[data-element=logo]', 60, 20);
    await drag('[data-element=subtitle]', 60, 10);
    await drag('[data-element=date]', -30, 15);
    const cfg = await page.evaluate(() => window.editorFixture.state.config);
    assert.ok(cfg.logo.offsetX > 0 && cfg.logo.offsetY < 1.1);
    assert.ok(cfg.caption.subtitleX > 0 && cfg.caption.subtitleY > 0);
    assert.ok(cfg.caption.dateX < 0 && cfg.caption.dateY > 0);
    await page.click('[data-element=subtitle]');
    await page.click('[data-action=reset]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.caption.subtitleX), 0);
    assert.deepEqual(errors, []);
    console.log('Редактор: перенос логотипа, подзаголовка и даты, сброс и запас для букв — OK');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
