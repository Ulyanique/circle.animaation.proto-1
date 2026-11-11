// Технический замер в одном браузере; скорость software WebGL не равна скорости GPU пользователя.
// URL=http://localhost:5175 SCENE=waiting WIDTHS=320,960,1920 SAMPLES=3 npm run benchmark:render
const assert = require('node:assert/strict');
const {launchBrowser} = require('./browser.cjs');
const scene = process.env.SCENE || 'waiting';
const widths = (process.env.WIDTHS || '320,960,1920').split(',').map(Number);
const samples = Number(process.env.SAMPLES || 3);
if (!['waiting','brand','photo-pause','finale'].includes(scene) || !Number.isInteger(samples) || samples < 1 || samples > 30 ||
    !widths.length || widths.some(w => !Number.isInteger(w) || w < 160 || w > 1920 || w % 16))
  throw new Error('SCENE: waiting/brand/photo-pause/finale; SAMPLES: 1–30; WIDTHS: кратные 16 от 160 до 1920');
(async () => {
  const browser = await launchBrowser({width:960,height:540});
  try {
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', e => { if (e.type() === 'error') errors.push(e.text()); });
    const url = new URL(process.env.URL || 'http://localhost:5173'); url.searchParams.set('scene', scene);
    await page.goto(url.href, {waitUntil:'networkidle0',timeout:120000});
    await page.waitForFunction(() => document.body.classList.contains('boot-ready'), {timeout:240000});
    const meta = await page.evaluate(async () => {
      await document.fonts.ready; window.requestAnimationFrame = () => 0;
      const L = window.__logo; L.cfg.playback.paused = true;
      const gl = L.scene.renderer.getContext();
      const info = gl.getExtension('WEBGL_debug_renderer_info');
      return {id:L.activeScene.id, renderer:info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : 'не определён', cycle:L.runtime.cycle};
    });
    assert.equal(meta.id, scene); console.log(`Сцена ${scene}; WebGL: ${meta.renderer}; цикл ${meta.cycle.toFixed(2)} с`);
    for (const width of widths) {
      const result = await page.evaluate(async ({width,samples}) => {
        const L = window.__logo, renderer = L.scene.renderer, gl = renderer.getContext();
        renderer.setSize(width,width*9/16,false); L.scene.composer.setSize(width,width*9/16);
        const start=L.cfg.timeline.startDelay, cycle=L.runtime.cycle, frames=[];
        // Прогрев при каждом разрешении; измеряем завершённый WebGL и сборку экспортного canvas.
        L.compositeFrameAt(start+cycle*.40); gl.finish();
        for (let i=0;i<samples;i++) {
          const time=start+cycle*(.45 + .10*i/Math.max(1,samples-1));
          const begin=performance.now(); const frame=L.compositeFrameAt(time,1/60); gl.finish();
          frames.push(performance.now()-begin);
          if(frame.width!==1920 || frame.height!==1080) throw new Error('Некорректный экспортный композит');
          await new Promise(resolve=>setTimeout(resolve,0));
        }
        return {size:[renderer.domElement.width,renderer.domElement.height],frames};
      }, {width,samples});
      assert.deepEqual(result.size,[width,width*9/16]); assert.deepEqual(errors,[]);
      const sorted=[...result.frames].sort((a,b)=>a-b);
      const middle = Math.floor(sorted.length / 2);
      const median = sorted.length % 2 ? sorted[middle] : (sorted[middle-1] + sorted[middle]) / 2;
      console.log(`${result.size.join('×')}: ${result.frames.map(n=>n.toFixed(1)).join(', ')} мс; медиана ${median.toFixed(1)} мс`);
    }
    console.log('Замерен рендер сцены и сборка canvas 1920×1080; WebCodecs, MP4 и FPS в реальном времени не измерялись.');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1});
