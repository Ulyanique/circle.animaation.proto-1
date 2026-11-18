// Реальная сцена: маска штатной строки и её вклад в экспортный canvas.
const assert=require('node:assert/strict');
const {launchBrowser}=require('./browser.cjs');
const scene=process.env.SCENE || 'waiting', id=process.env.CAPTION || 'title';
if (!['waiting','brand','finale'].includes(scene) || !['title','subtitle','date'].includes(id) ||
    (scene==='brand' && id!=='title') || (scene==='finale' && id==='date')) throw new Error('Недоступная строка для сцены');
(async()=>{const browser=await launchBrowser({width:960,height:540});try{
  const page=await browser.newPage(), errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())});
  const url=new URL(process.env.URL || 'http://localhost:5173');url.searchParams.set('scene',scene);
  await page.goto(url.href,{waitUntil:'networkidle0',timeout:120000});
  await page.waitForFunction(()=>document.body.classList.contains('boot-ready'),{timeout:240000});
  const result=await page.evaluate(async ({id})=>{
    await document.fonts.ready;window.requestAnimationFrame=()=>0;
    const L=window.__logo;L.cfg.playback.paused=true;
    L.scene.renderer.setSize(320,180,false);L.scene.composer.setSize(320,180);
    const timing=L.cfg.captionTiming;
    Object.assign(timing,{[`${id}TimingMode`]:'custom',[`${id}Start`]:30,[`${id}End`]:70,[`${id}Fade`]:15});
    const selectors={title:'.cap-title',subtitle:'.cap-sub',date:'.cap-date'};
    for(const [key,selector] of Object.entries(selectors)) {
      const el=document.querySelector(selector);el.style.visibility=key===id?'visible':'hidden';
    }
    for(const el of document.querySelectorAll('.cap-rule,.cap-custom')) el.style.visibility='hidden';
    const values=[];
    for(const fraction of [.15,.31,.5,.85,.5]) {
      const time=L.cfg.timeline.startDelay+L.runtime.cycle*fraction;
      const frame=L.compositeFrameAt(time,1/60), plain=L.compositeFrameAt(time,1/60,false);
      const a=frame.getContext('2d').getImageData(0,0,1920,1080).data;
      const b=plain.getContext('2d').getImageData(0,0,1920,1080).data;
      let changed=0;for(let i=0;i<a.length;i+=4) if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2]) changed++;
      const el=document.querySelector(selectors[id]);values.push({fraction,opacity:Number(getComputedStyle(el).opacity),style:el.dataset.revealStyle,stroke:getComputedStyle(el).webkitTextStrokeWidth,contour:getComputedStyle(el.querySelector('.glyph-contour') || el.querySelector('.cap-glyph')).display,changed});
    }
    return values;
  },{id});
  assert.deepEqual(errors,[]);
  assert.equal(result[0].opacity,0); assert.equal(result[3].opacity,0);
  assert.ok(result[1].opacity>0 && result[1].opacity<1,JSON.stringify(result));
  assert.equal(result[2].opacity,1); assert.equal(result[4].opacity,1);
  assert.ok(result.every(v=>v.style==='fade' && v.stroke==='0px'),JSON.stringify(result));
  assert.equal(result[0].changed,0); assert.equal(result[3].changed,0);
  assert.ok(result[1].changed>0 && result[2].changed>100,JSON.stringify(result));
  assert.equal(result[2].changed,result[4].changed);
  console.log(`${scene}/${id}: маска и экспортный композит до, внутри, после и после перемотки — OK`,result);
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
