// Интро: асимметрия, выключение режима и детерминированный seek на реальном WebGL.
const assert = require('node:assert/strict');
const {launchBrowser} = require('./browser.cjs');
(async () => {
  const browser = await launchBrowser({width:960, height:540});
  try {
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', e => { if (e.type() === 'error') errors.push(e.text()); });
    const url = new URL(process.env.URL || 'http://localhost:5173/');
    url.searchParams.set('scene','intro');
    await page.goto(url.href, {waitUntil:'networkidle0', timeout:120000});
    await page.waitForFunction(() => document.body.classList.contains('boot-ready'), {timeout:240000});
    const result = await page.evaluate(async () => {
      await document.fonts.ready; window.requestAnimationFrame = () => 0;
      const L = window.__logo; L.cfg.playback.paused = true;
      L.scene.renderer.setSize(320,180,false); L.scene.composer.setSize(320,180);
      const tl = L.cfg.timeline;
      const time = tl.startDelay + tl.drawDuration + tl.emergeDuration + L.cfg.intro.cornerDuration * .55;
      const sample = async (t, enabled) => {
        L.cfg.logo.directedMotion = enabled;
        const frame = L.compositeFrameAt(t);
        const pixels = frame.getContext('2d').getImageData(0,0,frame.width,frame.height).data;
        const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256',pixels))].join(',');
        const sides = L.scene.corners.sides;
        return {digest, left:sides.left.layers[0].u.value, right:sides.right.layers[0].u.value};
      };
      const on = await sample(time,true), off = await sample(time,false);
      await sample(time+3,true);
      const repeat = await sample(time,true);
      return {on,off,repeat};
    });
    assert.equal(result.on.digest,result.repeat.digest,'seek должен быть детерминированным');
    assert.notEqual(result.on.digest,result.off.digest,'режим должен влиять на экспортный кадр');
    assert.ok(result.on.right < result.on.left,'правый круг должен отставать');
    assert.equal(result.off.right,result.off.left,'выключенный режим сохраняет синхронные круги');
    assert.deepEqual(errors,[]);
    console.log('Интро: асимметрия колец, отключение и повторный экспортный кадр — OK');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
