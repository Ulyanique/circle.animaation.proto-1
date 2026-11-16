// DOM ease-in-out and the export's per-frame opacity must agree, including non-default durations.
const assert = require('node:assert/strict');
const {launchBrowser} = require('./browser.cjs');
(async()=>{
  const browser = await launchBrowser({width:960,height:540});
  try {
    const page = await browser.newPage();
    await page.goto((process.env.URL || 'http://localhost:5173') + '/tests/fixtures/editor.html', {waitUntil:'networkidle0'});
    const result = await page.evaluate(async()=>{
      const {outgoingOpacity, drawOutgoingFrame} = await import('/src/scene-transition.js');
      const frame = document.createElement('canvas'); frame.className = 'transition-frame transition-out';
      document.body.appendChild(frame);
      const easing = getComputedStyle(frame).transitionTimingFunction;
      const anim = frame.animate([{opacity:1},{opacity:0}], {duration:1000,easing:'ease-in-out',fill:'both'});
      anim.pause();
      const samples = [];
      for (const duration of [.25,.9,1.5]) for (const frameIndex of [0,3,9,12,18]) {
        const time = frameIndex / 60 / duration;
        anim.currentTime = time * 1000;
        samples.push({dom:Number(getComputedStyle(frame).opacity), video:outgoingOpacity(frameIndex,60,duration)});
      }
      anim.cancel(); frame.remove();
      // Реальный Canvas2D, тот же вызов наложения, что и в MP4-экспорте.
      // Уходящий кадр красный, входящий — синий; проверяем пиксели и состояние контекста.
      const canvas = document.createElement('canvas'), outgoing = document.createElement('canvas');
      canvas.width = outgoing.width = 2; canvas.height = outgoing.height = 2;
      const ctx = canvas.getContext('2d'), old = outgoing.getContext('2d');
      old.fillStyle = '#ff0000'; old.fillRect(0,0,2,2);
      const blended = [];
      for (const duration of [0, .25, .9, 1.5]) for (const index of [0, 3, 9, 15, 27, 54, 90]) {
        ctx.globalAlpha = 1; ctx.fillStyle = '#0000ff'; ctx.fillRect(0,0,2,2);
        ctx.globalAlpha = .37;
        const active = drawOutgoingFrame(ctx, outgoing, index, 60, duration, 2, 2);
        blended.push({duration,index,active,alpha:ctx.globalAlpha,
          pixel:[...ctx.getImageData(0,0,1,1).data], opacity:outgoingOpacity(index,60,duration)});
      }
      window.editorFixture.createFinaleSettings();
      const control = document.querySelector('[data-key="transition.duration"]');
      control.value = '1.5'; control.dispatchEvent(new Event('input',{bubbles:true}));
      return {easing,samples,blended,finale:window.finaleSettings.configs.finale.transition.duration,
        brand:window.finaleSettings.configs.brand.transition.duration,
        hint:document.querySelector('[data-section=transition] .cfg-io-hint').textContent};
    });
    assert.equal(result.easing,'ease-in-out');
    for (const pair of result.samples) assert.ok(Math.abs(pair.dom-pair.video)<.00001, JSON.stringify(pair));
    for (const sample of result.blended) {
      const {duration,index,active,alpha,pixel,opacity} = sample;
      assert.equal(active, opacity > 0, JSON.stringify(sample));
      assert.ok(Math.abs(alpha-.37) < .00001, 'Контекст не восстановлен');
      assert.ok(Math.abs(pixel[0] - 255 * opacity) <= 1 && Math.abs(pixel[2] - 255 * (1-opacity)) <= 1 && pixel[1] === 0 && pixel[3] === 255, JSON.stringify(sample));
    }
    assert.equal(result.finale,1.5); assert.equal(result.brand,.9); assert.match(result.hint,/одиночный цикл/);
    console.log('Переходы: кривая предпросмотра и пиксели наложения экспорта совпадают; настройка независима по сценам — OK');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
