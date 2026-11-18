// Реальный композит: переключатель заметен, а возврат к прежнему кадру детерминирован.
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
    const results = await page.evaluate(async () => {
      await document.fonts.ready;
      window.requestAnimationFrame = () => 0;
      const L = window.__logo;
      L.scene.renderer.setSize(320, 180, false); L.scene.composer.setSize(320, 180);
      const hash = async (t, enabled) => {
        L.cfg.logo.cinematic = enabled;
        const frame = L.compositeFrameAt(t), ctx = frame.getContext('2d');
        const pixels = ctx.getImageData(0, 0, frame.width, frame.height).data;
        const digest = await crypto.subtle.digest('SHA-256', pixels);
        return {digest:[...new Uint8Array(digest)].map(v => v.toString(16).padStart(2, '0')).join(''), pixels};
      };
      const out = [];
      for (const t of [2.41, 8.02, 10.98]) {
        const cinematic = await hash(t, true), classic = await hash(t, false);
        await hash(t + .5, true);
        const repeated = await hash(t, true);
        let changed = 0;
        for (let i = 0; i < cinematic.pixels.length; i += 4) {
          const diff = Math.abs(cinematic.pixels[i] - classic.pixels[i]) + Math.abs(cinematic.pixels[i+1] - classic.pixels[i+1]) + Math.abs(cinematic.pixels[i+2] - classic.pixels[i+2]);
          if (diff > 18) changed++;
        }
        out.push({time:t, cinematic:cinematic.digest, classic:classic.digest, repeated:repeated.digest, changedFraction:changed / (cinematic.pixels.length / 4)});
      }
      L.cfg.background.fabricTexture = .8;
      const fabric = await hash(10.98, true);
      L.cfg.background.fabricTexture = 0;
      const noFabric = await hash(10.98, true);
      L.cfg.background.fabricTexture = .8;
      await hash(4, true);
      const fabricAgain = await hash(10.98, true);
      let fabricChanged = 0;
      for (let i = 0; i < fabric.pixels.length; i += 4) {
        const diff = Math.abs(fabric.pixels[i] - noFabric.pixels[i]) + Math.abs(fabric.pixels[i+1] - noFabric.pixels[i+1]) + Math.abs(fabric.pixels[i+2] - noFabric.pixels[i+2]);
        if (diff > 9) fabricChanged++;
      }
      return {out, fabric: {on:fabric.digest, off:noFabric.digest, repeated:fabricAgain.digest, changedFraction:fabricChanged / (fabric.pixels.length / 4)}};
    });
    for (const result of results.out) {
      assert.notEqual(result.cinematic, result.classic, 'режимы должны отличаться');
      assert.equal(result.cinematic, result.repeated, 'кадр не должен зависеть от порядка seek');
    }
    assert.notEqual(results.fabric.on, results.fabric.off, 'фактура должна влиять на кадр');
    assert.equal(results.fabric.on, results.fabric.repeated, 'фактура должна быть детерминирована');
    assert.ok(results.fabric.changedFraction > .03, `фактура недостаточно заметна: ${results.fabric.changedFraction}`);
    const middle = results.out.find(r => r.time === 8.02);
    assert.ok(middle.changedFraction > .05, `недостаточно заметная разница на 8 секунде: ${middle.changedFraction}`);
    assert.deepEqual(errors, []);
    console.log(`Интро: переключение заметно на ${Math.round(middle.changedFraction * 100)}% кадра, фактура — ${Math.round(results.fabric.changedFraction * 100)}%, повторные композиты совпадают — OK`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
