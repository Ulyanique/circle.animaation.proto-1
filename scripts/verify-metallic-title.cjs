// Реальный DOM и экспортный композит: градиент, цвет пользователя и точный seek.
const assert = require('node:assert/strict');
const {launchBrowser} = require('./browser.cjs');
(async () => {
  const browser = await launchBrowser({width:960,height:540});
  try {
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', e => { if (e.type() === 'error') errors.push(e.text()); });
    const url = new URL(process.env.URL || 'http://localhost:5173/'); url.searchParams.set('scene', 'intro');
    await page.goto(url.href, {waitUntil:'networkidle0', timeout:120000});
    await page.waitForFunction(() => document.body.classList.contains('boot-ready'), {timeout:240000});
    const result = await page.evaluate(async () => {
      await document.fonts.ready; window.requestAnimationFrame = () => 0;
      const L = window.__logo, cap = document.querySelector('#caption');
      L.scene.renderer.setSize(320, 180, false); L.scene.composer.setSize(320, 180);
      const {syncCaptionContent} = await import('/src/caption-content.js');
      const update = () => syncCaptionContent(cap, L.cfg.caption, L.cfg.textLayers);
      const sample = async (time, enabled, color) => {
        L.cfg.caption.titleMetallic = enabled; L.cfg.caption.titleColor = color; update();
        const frame = L.compositeFrameAt(time);
        const pixels = frame.getContext('2d').getImageData(280, 490, 1360, 170).data;
        const digest = await crypto.subtle.digest('SHA-256', pixels);
        const glyph = cap.querySelector('.cap-title .cap-glyph');
        return {hash:[...new Uint8Array(digest)].map(v => v.toString(16).padStart(2, '0')).join(''),
          mode:cap.dataset.titleMetallic, gradient:getComputedStyle(glyph, '::after').backgroundImage,
          color:getComputedStyle(cap).getPropertyValue('--title-color').trim(),
          opacity:parseFloat(getComputedStyle(cap.querySelector('.cap-title')).opacity)};
      };
      const classic = await sample(10.98, false, null);
      const metal = await sample(10.98, true, null);
      const own = await sample(10.98, true, '#336699');
      await sample(5, true, null);
      const repeat = await sample(10.98, true, null);
      return {classic, metal, own, repeat};
    });
    assert.equal(result.classic.mode,'false'); assert.equal(result.metal.mode,'true');
    assert.notEqual(result.classic.hash,result.metal.hash, 'название в экспортном кадре не изменилось');
    assert.match(result.metal.gradient,/linear-gradient/);
    assert.equal(result.own.mode,'false'); assert.equal(result.own.color,'#336699');
    assert.notEqual(result.own.hash,result.metal.hash);
    assert.equal(result.metal.hash,result.repeat.hash, 'кадр зависит от предыдущего seek');
    assert.ok(result.metal.opacity > .99);
    assert.deepEqual(errors, []);
    console.log('Металл в DOM и экспортном композите, свой цвет и повторный seek — OK');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
