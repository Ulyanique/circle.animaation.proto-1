// Положение штатного титра в DOM и экспортном композите во время входа.
const assert = require('node:assert/strict');
const {launchBrowser} = require('./browser.cjs');
(async () => {
  const browser=await launchBrowser({width:960,height:540});
  try {
    const page=await browser.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
    const url=new URL(process.env.URL||'http://localhost:5173/');url.searchParams.set('scene','intro');
    await page.goto(url.href,{waitUntil:'networkidle0',timeout:120000});
    await page.waitForFunction(()=>document.body.classList.contains('boot-ready'),{timeout:240000});
    const result=await page.evaluate(async()=>{
      await document.fonts.ready;window.requestAnimationFrame=()=>0;
      const L=window.__logo, tl=L.cfg.timeline, seq=L.cfg.intro, title=document.querySelector('#caption .cap-title');
      L.cfg.playback.paused=true;L.scene.renderer.setSize(320,180,false);L.scene.composer.setSize(320,180);
      const t=tl.startDelay+tl.drawDuration+tl.emergeDuration+seq.cornerDuration+seq.liftDuration+seq.titleDelay+.30;
      const sample=async (time,enabled,style='fade',mode='scene')=>{
        L.cfg.logo.directedMotion=enabled;L.cfg.captionTiming.titleRevealStyle=style;L.cfg.captionTiming.titleTimingMode=mode;
        const frame=L.compositeFrameAt(time);const data=frame.getContext('2d').getImageData(260,440,1400,230).data;
        const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',data))].join(',');
        return {hash,lift:parseFloat(title.style.getPropertyValue('--lift')),top:title.getBoundingClientRect().top,opacity:parseFloat(getComputedStyle(title).opacity)};
      };
      const on=await sample(t,true),off=await sample(t,false);
      const fadeUpOn=await sample(t,true,'fade-up'),fadeUpOff=await sample(t,false,'fade-up');
      const custom=await sample(t,true,'fade','custom');
      await sample(t+2,true);const repeat=await sample(t,true);
      return {on,off,fadeUpOn,fadeUpOff,custom,repeat};
    });
    assert.ok(result.on.opacity>0 && result.on.opacity<1);
    assert.ok(result.on.lift>0);assert.equal(result.off.lift,0);
    assert.ok(Math.abs((result.on.top-result.off.top)-result.on.lift)<.1);
    assert.notEqual(result.on.hash,result.off.hash);
    assert.equal(result.fadeUpOn.lift,result.fadeUpOff.lift,'выбранный fade-up сохраняется');
    assert.equal(result.custom.lift,0,'свой интервал не меняется');
    assert.equal(result.on.hash,result.repeat.hash);assert.equal(result.on.lift,result.repeat.lift);
    assert.deepEqual(errors,[]);
    console.log('Посадка титра: DOM, экспортный композит, свои настройки и повторный seek — OK');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
