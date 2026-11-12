// Проход света по металлическому титру: общий материал DOM/canvas, отключение и seek.
const assert = require('node:assert/strict');
const {launchBrowser} = require('./browser.cjs');
(async () => {
  const browser = await launchBrowser({width:960,height:540});
  try {
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', e => {if(e.type()==='error') errors.push(e.text());});
    const url = new URL(process.env.URL || 'http://localhost:5173/'); url.searchParams.set('scene','intro');
    await page.goto(url.href, {waitUntil:'networkidle0',timeout:120000});
    await page.waitForFunction(()=>document.body.classList.contains('boot-ready'),{timeout:240000});
    const result = await page.evaluate(async () => {
      await document.fonts.ready; window.requestAnimationFrame=()=>0;
      const L=window.__logo, cap=document.querySelector('#caption');
      L.cfg.playback.paused=true; L.scene.renderer.setSize(320,180,false); L.scene.composer.setSize(320,180);
      const {syncCaptionContent}=await import('/src/caption-content.js');
      const tl=L.cfg.timeline, seq=L.cfg.intro;
      const t=tl.startDelay+tl.drawDuration+tl.emergeDuration+seq.cornerDuration+seq.liftDuration+seq.titleDelay+1;
      const sample=async (time,enabled,color=null,custom=false)=>{
        L.cfg.logo.directedMotion=enabled; L.cfg.caption.titleColor=color;
        L.cfg.captionTiming.titleTimingMode=custom?'custom':'scene';
        syncCaptionContent(cap,L.cfg.caption,L.cfg.textLayers);
        const canvas=L.compositeFrameAt(time),px=canvas.getContext('2d').getImageData(260,460,1400,180).data;
        const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',px))].join(',');
        const glyphs=[...cap.querySelectorAll('.cap-title .cap-glyph')];
        return {hash,shine:glyphs.map(e=>Number(e.style.getPropertyValue('--title-shine'))),
          css:glyphs.map(e=>e.style.getPropertyValue('--title-metallic-gradient')),mode:cap.dataset.titleMetallic};
      };
      const on=await sample(t,true),off=await sample(t,false),color=await sample(t,true,'#336699'),custom=await sample(t,true,null,true);
      await sample(t+3,true); const repeat=await sample(t,true);
      return {on,off,color,custom,repeat};
    });
    assert.ok(Math.max(...result.on.shine)>.1); assert.ok(result.on.shine.some(x=>x<.01));
    assert.ok(result.off.shine.every(x=>x===0)); assert.notEqual(result.on.hash,result.off.hash);
    assert.ok(result.color.shine.every(x=>x===0)); assert.equal(result.color.mode,'false');
    assert.ok(result.custom.shine.every(x=>x===0));
    assert.equal(result.on.hash,result.repeat.hash); assert.deepEqual(result.on.shine,result.repeat.shine);
    assert.ok(new Set(result.on.css).size>1); assert.deepEqual(errors,[]);
    console.log('Проход по титру в DOM и экспортном композите, свой цвет, собственный тайминг и seek — OK');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
