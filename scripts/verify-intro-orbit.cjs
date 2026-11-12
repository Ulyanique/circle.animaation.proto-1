// WebGL: точное движение орбиты, режим совместимости и воспроизводимость seek.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {launchBrowser} = require('./browser.cjs');
(async () => {
  const browser = await launchBrowser({width:960,height:540});
  try {
    const page = await browser.newPage(), errors=[];
    page.on('pageerror', e=>errors.push(e.message));
    page.on('console', e=>{if(e.type()==='error')errors.push(e.text());});
    const url = new URL(process.env.URL || 'http://localhost:5173/'); url.searchParams.set('scene','intro');
    await page.goto(url.href,{waitUntil:'networkidle0',timeout:120000});
    await page.waitForFunction(()=>document.body.classList.contains('boot-ready'),{timeout:240000});
    const results=await page.evaluate(async ()=>{
      await document.fonts.ready; window.requestAnimationFrame=()=>0;
      const L=window.__logo, tl=L.cfg.timeline;
      L.cfg.playback.paused=true; L.scene.renderer.setSize(640,360,false); L.scene.composer.setSize(640,360);
      const start=Math.min(.5,tl.drawDuration*.3),end=Math.max(start+.1,tl.drawDuration*.68);
      const time=tl.startDelay+start+(end-start)*.25;
      async function sample(t,enabled){
        L.cfg.logo.directedMotion=enabled; const frame=L.compositeFrameAt(t);
        const px=frame.getContext('2d').getImageData(0,0,frame.width,frame.height).data;
        return {hash:[...new Uint8Array(await crypto.subtle.digest('SHA-256',px))].join(','),
          sweep:L.scene.plotter.uniforms.uSweep.value,mode:L.scene.plotter.uniforms.uDirected.value,
          image:frame.toDataURL('image/jpeg',.88)};
      }
      const on=await sample(time,true),off=await sample(time,false); await sample(time+.4,true);
      const repeat=await sample(time,true); return {time,on,off,repeat};
    });
    assert.notEqual(results.on.hash,results.off.hash); assert.ok(results.on.sweep<results.off.sweep);
    assert.equal(results.on.mode,1); assert.equal(results.off.mode,0); assert.equal(results.on.hash,results.repeat.hash);
    assert.deepEqual(errors,[]);
    if(process.env.OUT){fs.mkdirSync(process.env.OUT,{recursive:true});for(const k of ['on','off'])
      fs.writeFileSync(path.join(process.env.OUT,`${k}.jpg`),Buffer.from(results[k].image.split(',')[1],'base64'));}
    console.log(`Орбита на ${results.time.toFixed(2)} с: мягкий старт, отключение режима и повторный композит — OK`);
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
