// Макет: реальные кадры, текстовые настройки, перемотка, шов, переходы и MP4 smoke.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {launchBrowser} = require('./browser.cjs');
(async()=>{
 const browser=await launchBrowser({width:960,height:540});
 try {
  const page=await browser.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
  const url=new URL(process.env.URL||'http://localhost:5173/');url.searchParams.set('scene','partners');
  await page.goto(url.href,{waitUntil:'networkidle0',timeout:120000});
  await page.waitForFunction(()=>document.body.classList.contains('boot-ready'),{timeout:240000});
  const result=await page.evaluate(async()=>{
   await document.fonts.ready;const logoAssets=await (await import('/src/partners-scene.js')).loadPartnersBackground();window.requestAnimationFrame=()=>0;
   const L=window.__logo;L.cfg.playback.paused=true;
   async function sample(t){const c=L.compositeFrameAt(t),data=c.getContext('2d').getImageData(0,0,1920,1080).data;
    let nonBlack=0;for(let i=0;i<data.length;i+=4)if(data[i]||data[i+1]||data[i+2])nonBlack++;
    return {hash:[...new Uint8Array(await crypto.subtle.digest('SHA-256',data))].join(','),nonBlack,t};}
   const initial=await sample(0),hold=await sample(8);const early=await sample(1);const repeat=await sample(8),end=await sample(L.runtime.cycle-1/60);
   const reveal=await sample(3), revealLater=await sample(4.5);
   const earlyAgain=await sample(1);const revealAgain=await sample(3), revealLaterAgain=await sample(4.5);const holdOtherBuffer=await sample(8);
   // Проверяем саму верхнюю часть левого борта: сравнение с выключенной
   // рамкой ловит незамкнутый dash, даже когда остальная рамка видима.
   const framePixels=()=>{const c=L.compositeFrameAt(8);return c.getContext('2d').getImageData(49,100,12,100).data;};
   L.cfg.partners.frameVisible=true;const frameOn=framePixels();
   L.cfg.partners.frameVisible=false;const frameOff=framePixels();L.cfg.partners.frameVisible=true;
   let frameChanged=0;for(let i=0;i<frameOn.length;i+=4)if(Math.abs(frameOn[i]-frameOff[i])+Math.abs(frameOn[i+1]-frameOff[i+1])+Math.abs(frameOn[i+2]-frameOff[i+2])>12)frameChanged++;
   L.cfg.partners.curtainVisible=false;const noCurtain=await sample(8);L.cfg.partners.curtainVisible=true;
   L.cfg.partners.motion=0;const noMotion=await sample(8);L.cfg.partners.motion=1;
   L.cfg.partners.particlesVisible=false;const noParticles=await sample(8);L.cfg.partners.particlesVisible=true;
   L.cfg.partners.shimmerVisible=false;const noShimmer=await sample(8);L.cfg.partners.shimmerVisible=true;
   // Фон проверяем на участке без текста и декора при полном удержании.
   const crop=t=>new Uint8ClampedArray(L.compositeFrameAt(t).getContext('2d').getImageData(850,900,100,100).data);
   const difference=(a,b)=>{let n=0;for(let i=0;i<a.length;i+=4)if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2])n++;return n;};
   L.cfg.partners.motion=1;const bg8=crop(8), bg12=crop(12);
   L.cfg.partners.motion=0;const still8=crop(8), still12=crop(12);L.cfg.partners.motion=1;
   const bgChanged=difference(bg8,bg12), bgStill=difference(still8,still12);
   const field=document.querySelector('input[data-key="partners.partner1"]');
   if(!field) throw new Error('Нет поля партнёра в настройках');
   field.value='Проверка';field.dispatchEvent(new Event('input',{bubbles:true}));const changed=await sample(8);
   const stored=JSON.parse(localStorage.getItem('circle-anim-settings-v2:partners')).partners.partner1;
   field.value='Промрукав';field.dispatchEvent(new Event('input',{bubbles:true}));
   const c=document.createElement('canvas');c.width=320;c.height=180;const ctx=c.getContext('2d');
   const {encodeOfflineVideo}=await import('/src/offline-video.js');
   const video=await encodeOfflineVideo({canvas:c,fps:60,total:12,bitrate:1000000,cancelled:()=>false,draw(i){ctx.drawImage(L.compositeFrameAt(8+i/60),0,0,320,180)}});
   const marker=new TextDecoder().decode(new Uint8Array(await video.blob.slice(4,8).arrayBuffer()));
   L.getSceneConfig('brand').transition.duration=0;const switched=L.switchScene('brand');
   L.getSceneConfig('partners').transition.duration=0;const back=L.switchScene('partners');
   return {logoAssets,bgChanged,bgStill,frameChanged,initial,hold,early,earlyAgain,reveal,revealAgain,revealLater,revealLaterAgain,holdOtherBuffer,noCurtain,noMotion,noParticles,noShimmer,repeat,end,changed,stored,switched,back,id:L.activeScene.id,video:{frames:video.frames,marker,size:video.blob.size}};
  });
  assert.equal(result.logoAssets[0],true);assert.deepEqual(result.logoAssets[1],[true,true,true,true]);assert.equal(result.logoAssets[2],true);
  assert.ok(result.bgChanged>100, `фон не движется: ${result.bgChanged}`);assert.equal(result.bgStill,0);
  assert.ok(result.frameChanged>100, `левая рамка не дорисована: ${result.frameChanged} пикселей`);
  assert.equal(result.initial.nonBlack,0);assert.equal(result.end.nonBlack,0);
  assert.notEqual(result.early.hash,result.hold.hash);assert.equal(result.early.hash,result.earlyAgain.hash);
  assert.equal(result.reveal.hash,result.revealAgain.hash);assert.equal(result.revealLater.hash,result.revealLaterAgain.hash);
  assert.equal(result.hold.hash,result.holdOtherBuffer.hash);assert.notEqual(result.hold.hash,result.noCurtain.hash);assert.notEqual(result.hold.hash,result.noMotion.hash);assert.notEqual(result.hold.hash,result.noParticles.hash);assert.notEqual(result.hold.hash,result.noShimmer.hash);
  assert.equal(result.hold.hash,result.repeat.hash);assert.notEqual(result.hold.hash,result.changed.hash);
  assert.equal(result.stored,'Проверка');assert.ok(result.switched&&result.back);assert.equal(result.id,'partners');
  assert.equal(result.video.frames,12);assert.equal(result.video.marker,'ftyp');assert.ok(result.video.size>1000);
  assert.deepEqual(errors,[]);
  if(process.env.OUT){fs.mkdirSync(process.env.OUT,{recursive:true});await page.addStyleTag({content:'.cfg-toggle,.editor-toggle,.cfg-panel,.operator-panel,.toast,.review-panel{display:none!important}'});
   const data=await page.evaluate(()=>window.__logo.compositeFrameAt(8).toDataURL('image/jpeg',.92));
   fs.writeFileSync(path.join(process.env.OUT,'partners.jpg'),Buffer.from(data.split(',')[1],'base64'));}
  console.log('Макет спонсоров: SVG-логотипы, названия, seek, чёрный шов, переключение сцен, 12 кадров MP4 — OK');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
