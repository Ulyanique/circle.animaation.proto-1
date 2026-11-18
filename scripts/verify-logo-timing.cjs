// Реальный WebGL + экспортный canvas: знак внутри/вне своего интервала.
const assert = require('node:assert/strict');
const {launchBrowser} = require('./browser.cjs');
const id = process.env.SCENE || 'waiting';
if (!['waiting','brand','photo-pause','finale'].includes(id)) throw new Error('Неизвестная сцена');
(async()=>{const browser=await launchBrowser({width:960,height:540});try{
  const page=await browser.newPage(), errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())});
  const url=new URL(process.env.URL || 'http://localhost:5173');url.searchParams.set('scene',id);
  await page.goto(url.href,{waitUntil:'networkidle0',timeout:120000});
  await page.waitForFunction(()=>document.body.classList.contains('boot-ready'),{timeout:240000});
  const result=await page.evaluate(async()=>{
    await document.fonts.ready;window.requestAnimationFrame=()=>0;
    const L=window.__logo; L.cfg.playback.paused=true;
    L.scene.renderer.setSize(320,180,false);L.scene.composer.setSize(320,180);
    Object.assign(L.cfg.logoTiming,{timingMode:'custom',timingStart:30,timingEnd:70,timingFade:15});
    const values=[];
    for(const fraction of [.15,.5,.85,.5]) {
      const time=L.cfg.timeline.startDelay+L.runtime.cycle*fraction;
      L.scene.logo.body.visible=true;
      const frame=L.compositeFrameAt(time,1/60,false);
      const outline=L.scene.logo.outline.visible;
      L.scene.logo.body.visible=false;
      const without=L.compositeFrameAt(time,1/60,false);
      const a=frame.getContext('2d').getImageData(0,0,1920,1080).data;
      const b=without.getContext('2d').getImageData(0,0,1920,1080).data;
      let changed=0;for(let i=0;i<a.length;i+=4) if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2]) changed++;
      values.push({fraction,outline,changed});
    }
    return values;
  });
  assert.deepEqual(errors,[]);
  assert.equal(result[0].outline,false);assert.equal(result[2].outline,false);
  assert.equal(result[0].changed,0);assert.equal(result[2].changed,0);
  assert.ok(result[1].changed>100,JSON.stringify(result));
  assert.equal(result[1].changed,result[3].changed);
  console.log(`${id}: знак до, внутри, после интервала и после перемотки — OK`,result);
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
