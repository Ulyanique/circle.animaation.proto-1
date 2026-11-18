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
   await document.fonts.ready;window.requestAnimationFrame=()=>0;
   const assetsReady=await (await import('/src/partners-scene.js')).loadPartnersBackground();
   if(!assetsReady) throw new Error('Не загрузились изображения спонсоров');
   const L=window.__logo;L.cfg.playback.paused=true;
   async function sample(t){const c=L.compositeFrameAt(t),data=c.getContext('2d').getImageData(0,0,1920,1080).data;
    let nonBlack=0;for(let i=0;i<data.length;i+=4)if(data[i]||data[i+1]||data[i+2])nonBlack++;
    return {hash:[...new Uint8Array(await crypto.subtle.digest('SHA-256',data))].join(','),nonBlack,t};}
   const initial=await sample(0),hold=await sample(8);const early=await sample(1);const repeat=await sample(8),end=await sample(L.runtime.cycle-1/60);
   const earlyAgain=await sample(1);const holdOtherBuffer=await sample(8);
   // Правый борт рамки: сравнение с выключенной рамкой ловит незамкнутый dash,
   // даже когда остальная рамка видима. Левый борт теперь перекрыт занавесом
   // (это передний план по замыслу), поэтому мерить надо там, где он не висит.
   const framePixels=()=>{const c=L.compositeFrameAt(8);return c.getContext('2d').getImageData(1859,100,12,100).data;};
   L.cfg.partners.frameVisible=true;const frameOn=framePixels();
   L.cfg.partners.frameVisible=false;const frameOff=framePixels();L.cfg.partners.frameVisible=true;
   let frameChanged=0;for(let i=0;i<frameOn.length;i+=4)if(Math.abs(frameOn[i]-frameOff[i])+Math.abs(frameOn[i+1]-frameOff[i+1])+Math.abs(frameOn[i+2]-frameOff[i+2])>12)frameChanged++;
   L.cfg.partners.curtainVisible=false;const noCurtain=await sample(8);L.cfg.partners.curtainVisible=true;
   L.cfg.partners.motion=0;const noMotion=await sample(8);L.cfg.partners.motion=1;
   // Четыре присланных знака: смена имени на пустое удаляет вклад именно
   // этого логотипа, а фоновый композит остаётся; старые имена заменяются текстом.
   const imageData=()=>L.compositeFrameAt(8).getContext('2d',{willReadFrequently:true}).getImageData(0,0,1920,1080).data;
   const marked=imageData(), logoChanges={};
   for(const key of ['organizer1','organizer2','partner1','partner2']) {
    const saved=L.cfg.partners[key];L.cfg.partners[key]='';const without=imageData();L.cfg.partners[key]=saved;
    let changed=0;for(let i=0;i<marked.length;i+=4)if(Math.abs(marked[i]-without[i])+Math.abs(marked[i+1]-without[i+1])+Math.abs(marked[i+2]-without[i+2])>12)changed++;
    logoChanges[key]=changed;
   }
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
   return {frameChanged,logoChanges,initial,hold,early,earlyAgain,holdOtherBuffer,noCurtain,noMotion,repeat,end,changed,stored,switched,back,id:L.activeScene.id,video:{frames:video.frames,marker,size:video.blob.size}};
  });
  assert.ok(result.frameChanged>100, `левая рамка не дорисована: ${result.frameChanged} пикселей`);
  for(const [key, count] of Object.entries(result.logoChanges)) assert.ok(count>300, `${key}: логотип не виден (${count} пикселей)`);
  console.log('Вклад логотипов (пиксели):', result.logoChanges);
  assert.equal(result.initial.nonBlack,0);assert.equal(result.end.nonBlack,0);
  assert.notEqual(result.early.hash,result.hold.hash);assert.equal(result.early.hash,result.earlyAgain.hash);
  assert.equal(result.hold.hash,result.holdOtherBuffer.hash);assert.notEqual(result.hold.hash,result.noCurtain.hash);assert.notEqual(result.hold.hash,result.noMotion.hash);
  assert.equal(result.hold.hash,result.repeat.hash);assert.notEqual(result.hold.hash,result.changed.hash);
  assert.equal(result.stored,'Проверка');assert.ok(result.switched&&result.back);assert.equal(result.id,'partners');
  assert.equal(result.video.frames,12);assert.equal(result.video.marker,'ftyp');assert.ok(result.video.size>1000);
  assert.deepEqual(errors,[]);
  if(process.env.OUT){fs.mkdirSync(process.env.OUT,{recursive:true});await page.addStyleTag({content:'.cfg-toggle,.editor-toggle,.cfg-panel,.operator-panel,.toast,.review-panel{display:none!important}'});
   const data=await page.evaluate(()=>window.__logo.compositeFrameAt(8).toDataURL('image/jpeg',.92));
   fs.writeFileSync(path.join(process.env.OUT,'partners.jpg'),Buffer.from(data.split(',')[1],'base64'));}
  console.log('Макет спонсоров: названия, seek, чёрный шов, переключение сцен, 12 кадров MP4 — OK');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
