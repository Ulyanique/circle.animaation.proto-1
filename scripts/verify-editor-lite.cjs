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
    const titleCenter = await page.$eval('[data-element=title]', el => {
      const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    await page.mouse.move(titleCenter.x, titleCenter.y); await page.mouse.down();
    await page.mouse.move(titleCenter.x + 4, titleCenter.y);
    assert.equal(await page.$eval('.editor-guide-x', el => el.hidden), false, 'нет направляющей');
    assert.ok(Math.abs(await page.evaluate(() => window.editorFixture.state.config.caption.titleX)) < 1e-6, 'центр не притянулся');
    await page.mouse.up();
    assert.equal(await page.$eval('.editor-guide-x', el => el.hidden), true, 'направляющая не скрылась');
    await page.mouse.move(titleCenter.x, titleCenter.y); await page.keyboard.down('Alt'); await page.mouse.down();
    await page.mouse.move(titleCenter.x + 4, titleCenter.y); await page.mouse.up(); await page.keyboard.up('Alt');
    assert.ok(await page.evaluate(() => window.editorFixture.state.config.caption.titleX) > 0, 'Alt не отключает прилипание');
    await page.click('[data-element=title]'); await page.click('[data-action=align-x]');
    assert.ok(Math.abs(await page.evaluate(() => window.editorFixture.state.config.caption.titleX)) < 1e-6);
    await page.click('[data-element=title]'); await page.click('[data-action=align-y]');
    assert.ok(Math.abs(await page.evaluate(() => window.editorFixture.state.config.caption.titleY) + 0.05) < 1e-4);
    await page.click('[data-element=title]'); await page.click('[data-action=reset]');
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
    await page.evaluate(() => window.editorFixture.activate('photo-pause'));
    await drag('[data-element=photoLabel]', 50, 20);
    const photo = await page.evaluate(() => window.editorFixture.state.config);
    assert.ok(photo.photo.offsetX > 0 && photo.photo.offsetY < 0);
    assert.equal(photo.logo.offsetX, 0);
    await page.click('[data-element=photoLabel]');
    await page.click('[data-action=settings]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.settingsSection), 'photo');
    await page.click('[data-element=photoLabel]');
    await page.click('[data-action=reset]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.photo.offsetX), 0);
    await page.evaluate(() => window.editorFixture.activate('brand'));
    await drag('[data-element=brandDecor]', -45, 20);
    const brand = await page.evaluate(() => window.editorFixture.state.config);
    assert.ok(brand.decor.offsetX < 0 && brand.decor.offsetY < 0);
    assert.equal(brand.logo.offsetX, 0);
    await page.click('[data-element=brandDecor]');
    await page.click('[data-action=settings]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.settingsSection), 'decor');
    await page.click('[data-element=brandDecor]');
    await page.click('[data-action=reset]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.decor.offsetX), 0);
    assert.deepEqual(errors, []);
    console.log('Редактор: прилипание, направляющие, центрирование, перенос и сброс — OK; запас для букв — OK');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
