// Лёгкая браузерная проверка отдельного прототипа; видео синтетическое, экспорт MP4 не проверяется.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {launchBrowser}=require('./browser.cjs');
const {PNG}=require('pngjs');
(async()=>{
  const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'archive-check-'));
  const browser=await launchBrowser({width:960,height:720});
  try {
    const page=await browser.newPage(), errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    await page.evaluateOnNewDocument(()=>{const create=document.createElement.bind(document);window.__archiveVideos=[];document.createElement=(name,...args)=>{const el=create(name,...args);if(String(name).toLowerCase()==='video')window.__archiveVideos.push(el);return el;};});
    const url=new URL('/archive.html',process.env.URL||'http://localhost:5173');
    await page.goto(url.href,{waitUntil:'networkidle0',timeout:120000});
    assert.equal(await page.$$('.slot').then(x=>x.length),10);
    const initialFrame=await page.$eval('.stage-frame',el=>{const r=el.getBoundingClientRect();return r.width/r.height;});assert.ok(Math.abs(initialFrame-16/9)<.002);
    await page.click('[data-play]');
    await page.$eval('[data-seek]',el=>{el.value='9';el.dispatchEvent(new Event('input',{bubbles:true}));});
    const stage=await page.$('#archive-stage');
    const before=PNG.sync.read(Buffer.from(await stage.screenshot()));
    const bytes=await page.evaluate(async()=>{
      const canvas=document.createElement('canvas');canvas.width=160;canvas.height=90;
      const ctx=canvas.getContext('2d');ctx.fillStyle='#f00';ctx.fillRect(0,0,80,90);ctx.fillStyle='#0f0';ctx.fillRect(80,0,80,90);
      const png=canvas.toDataURL('image/png').split(',')[1];
      const {encodeOfflineVideo}=await import('/src/offline-video.js');
      const video=await encodeOfflineVideo({canvas,fps:30,total:30,cancelled:()=>false,draw(i){ctx.fillStyle=i<15?'#f00':'#0f0';ctx.fillRect(0,0,160,90);}});
      const data=await video.blob.arrayBuffer();
      return {png, video:Array.from(new Uint8Array(data))};
    });
    await fs.writeFile(path.join(tmp,'photo.png'),Buffer.from(bytes.png,'base64'));
    await fs.writeFile(path.join(tmp,'clip.mp4'),Buffer.from(bytes.video));
    const inputs=await page.$$('.slot input[type=file]');
    await inputs[0].uploadFile(path.join(tmp,'photo.png'));
    await page.waitForFunction(()=>document.querySelectorAll('.slot-name')[0].textContent==='photo.png',{timeout:30000});
    await inputs[1].uploadFile(path.join(tmp,'clip.mp4'));
    await page.waitForFunction(()=>document.querySelectorAll('.slot-name')[1].textContent==='clip.mp4',{timeout:30000});
    await page.waitForFunction(()=>window.__archiveVideos.some(v=>v.duration>0&&!v.seeking&&v.currentTime>.85&&v.paused),{timeout:30000});
    // Перемотка назад после удержания последнего кадра восстанавливает начало клипа.
    await page.$eval('[data-seek]',el=>{el.value='8.5';el.dispatchEvent(new Event('input',{bubbles:true}));});
    await page.waitForFunction(()=>window.__archiveVideos.some(v=>v.duration>0&&!v.seeking&&Math.abs(v.currentTime-.5)<.08&&v.paused),{timeout:30000});
    await page.$eval('[data-seek]',el=>{el.value='9';el.dispatchEvent(new Event('input',{bubbles:true}));});
    await page.waitForFunction(()=>window.__archiveVideos.some(v=>v.duration>0&&!v.seeking&&v.currentTime>.85&&v.paused),{timeout:30000});
    const trim=await page.$$('.slot-trim');
    const fields=await trim[1].$$('input');
    await fields[0].click({clickCount:3});await fields[0].type('0:00.2');await fields[0].press('Tab');
    await fields[1].click({clickCount:3});await fields[1].type('0:00.7');await fields[1].press('Tab');
    await page.$eval('[data-seek]',el=>{el.value='8.3';el.dispatchEvent(new Event('input',{bubbles:true}));});
    await page.waitForFunction(()=>window.__archiveVideos.some(v=>v.duration>0&&!v.seeking&&Math.abs(v.currentTime-.5)<.08&&v.paused),{timeout:30000});
    await page.$eval('[data-seek]',el=>{el.value='9';el.dispatchEvent(new Event('input',{bubbles:true}));});
    await page.waitForFunction(()=>window.__archiveVideos.some(v=>v.duration>0&&!v.seeking&&Math.abs(v.currentTime-(.7-1/30))<.08&&v.paused),{timeout:30000});
    const after=PNG.sync.read(Buffer.from(await stage.screenshot()));
    let different=0;for(let i=0;i<before.data.length;i+=4) if(Math.abs(before.data[i]-after.data[i])+Math.abs(before.data[i+1]-after.data[i+1])+Math.abs(before.data[i+2]-after.data[i+2])>20)different++;
    assert.ok(different>1000,`Загруженное видео не изменило изображение панели: ${different}`);
    await page.$eval('[data-seek]',el=>{el.value='9';el.dispatchEvent(new Event('input',{bubbles:true}));});
    assert.match(await page.$eval('[data-time]',el=>el.textContent),/00:09/);
    // Переключение вписывания реально меняет геометрию кадра на загруженной фотографии.
    await page.$eval('[data-seek]',el=>{el.value='2';el.dispatchEvent(new Event('input',{bubbles:true}));});
    const cover=PNG.sync.read(Buffer.from(await stage.screenshot()));
    await page.$eval('.slot-focus input',(el)=>{el.value='0';el.dispatchEvent(new Event('input',{bubbles:true}));});
    const left=PNG.sync.read(Buffer.from(await stage.screenshot()));
    await page.$eval('.slot-focus input',(el)=>{el.value='100';el.dispatchEvent(new Event('input',{bubbles:true}));});
    const right=PNG.sync.read(Buffer.from(await stage.screenshot()));
    let focusDiff=0;for(let i=0;i<left.data.length;i+=4)if(Math.abs(left.data[i]-right.data[i])>20)focusDiff++;
    assert.ok(focusDiff>500,`смещение не изменило область кадрирования: ${focusDiff}`);
    await page.select('.slot-options select','contain');
    assert.equal(await page.$eval('.slot-focus',el=>el.hidden),true);
    const contain=PNG.sync.read(Buffer.from(await stage.screenshot()));
    let fitDiff=0;for(let i=0;i<cover.data.length;i+=4)if(Math.abs(cover.data[i]-contain.data[i])>20)fitDiff++;
    assert.ok(fitDiff>500,`режим вписывания не изменил изображение: ${fitDiff}`);
    // Проверяем именно живое воспроизведение, а не только перемотку по отдельным кадрам.
    await page.$eval('[data-seek]',el=>{el.value='2';el.dispatchEvent(new Event('input',{bubbles:true}));});
    const playStart=PNG.sync.read(Buffer.from(await stage.screenshot()));
    await page.click('[data-play]');
    await page.waitForFunction(()=>Number(document.querySelector('[data-seek]').value)>3.5,{timeout:30000});
    await page.click('[data-play]');
    const playEnd=PNG.sync.read(Buffer.from(await stage.screenshot()));
    let playDiff=0;for(let i=0;i<playStart.data.length;i+=4)if(Math.abs(playStart.data[i]-playEnd.data[i])+Math.abs(playStart.data[i+1]-playEnd.data[i+1])+Math.abs(playStart.data[i+2]-playEnd.data[i+2])>20)playDiff++;
    assert.ok(playDiff>500,`изображение не изменилось при воспроизведении: ${playDiff}`);
    // Знак оповещает об асинхронной готовности: финал обновится даже на паузе.
    const ready=await page.evaluate(async()=>{
      const {createFinale}=await import('/src/archive/finale.js');
      return new Promise(resolve=>{let count=0;createFinale(document.createElement('canvas'),()=>{count++;if(count>=2)resolve(count);});setTimeout(()=>resolve(count),5000);});
    });
    assert.ok(ready>=2,'финал не оповестил о готовности знака и шрифта');
    // Повторный переход к одному времени финала должен дать тот же canvas.
    await page.evaluate(()=>document.fonts.ready);
    const finaleFrame=async(t)=>{await page.$eval('[data-seek]',(el,t)=>{el.value=String(t);el.dispatchEvent(new Event('input',{bubbles:true}));},t);return page.$eval('#archive-finale',el=>el.toDataURL());};
    const firstFinal=await finaleFrame(83.5), laterFinal=await finaleFrame(86), repeatedFinal=await finaleFrame(83.5);
    const finaleAlpha=await page.$eval('#archive-finale',el=>el.getContext('2d').getImageData(2,2,1,1).data[3]);
    assert.equal(finaleAlpha,255,'финальный фон не должен просвечивать на удержании');
    assert.notEqual(firstFinal,laterFinal,'финальный свет должен двигаться');
    assert.equal(firstFinal,repeatedFinal,'финал изменился после перемотки');
    assert.match(await page.$eval('[data-time]',el=>el.textContent),/01:23 \/ 01:29/);
    await page.$eval('.slot button',el=>el.click());
    assert.equal(await page.$eval('.slot-name',el=>el.textContent),'Плейсхолдер');
    assert.equal(await page.$eval('.slot button',el=>el.disabled),true);
    assert.equal(await page.$eval('.slot-focus input',el=>el.value),'50');
    await page.setViewport({width:320,height:750});
    const mobile=await page.evaluate(()=>({width:document.documentElement.scrollWidth,viewer:document.querySelector('.viewer').getBoundingClientRect().width,ratio:document.querySelector('.stage-frame').getBoundingClientRect().width/document.querySelector('.stage-frame').getBoundingClientRect().height,slots:document.querySelectorAll('.slot').length}));
    assert.ok(mobile.width<=320&&mobile.viewer>0&&Math.abs(mobile.ratio-16/9)<.002&&mobile.slots===10,JSON.stringify(mobile));
    assert.deepEqual(errors,[]);console.log('Архив: фото, видеофрагмент, кадрирование и его смещение, перемотка, финал и ширина 320px — OK; экспорт MP4 не проверен');
  } finally {await browser.close();await fs.rm(tmp,{recursive:true,force:true});}
})().catch(e=>{console.error('FAIL',e);process.exitCode=1});
