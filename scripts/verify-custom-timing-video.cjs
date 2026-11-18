// Короткая настоящая запись 1920×1080 с собственным временем знака и титра.
// Сверяем декодированные кадры с экспортным canvas; H.264 с потерями, поэтому нужен допуск.
const assert = require('node:assert/strict');
const {launchBrowser} = require('./browser.cjs');
(async () => {
  const browser = await launchBrowser({width:1920,height:1080}, {protocolTimeout:900000});
  try {
    const page = await browser.newPage(), errors=[];
    page.on('pageerror', e=>errors.push(e.message));
    page.on('console', e=>{if(e.type()==='error') errors.push(e.text())});
    const url=new URL(process.env.URL || 'http://localhost:5173');url.searchParams.set('scene','waiting');
    console.log('Загружаем интро и подготавливаем собственные интервалы…');
    await page.goto(url.href,{waitUntil:'networkidle0',timeout:120000});
    await page.waitForFunction(()=>document.body.classList.contains('boot-ready'),{timeout:240000});
    const start=await page.evaluate(async()=>{
      await document.fonts.ready;window.requestAnimationFrame=()=>0;
      const L=window.__logo; L.cfg.playback.paused=true;
      Object.assign(L.cfg.timeline,{drawDuration:.6,emergeDuration:.5,holdDuration:2.1,fadeDuration:.5,restDuration:.3,startDelay:0,speed:20,ringsIntro:.5});
      Object.assign(L.cfg.logoTiming,{timingMode:'custom',timingStart:25,timingEnd:75,timingFade:15});
      Object.assign(L.cfg.captionTiming,{titleTimingMode:'custom',titleStart:20,titleEnd:80,titleFade:15});
      return {accepted:L.startRecording({download:false}),cycle:L.runtime.cycle};
    });
    assert.equal(start.accepted,true); assert.equal(start.cycle,4);
    console.log('Записываем 6 кадров с реальными сценой и кодировщиком…');
    await page.waitForFunction(()=>window.__lastVideoBlob?.size>0 || !!window.__recStats?.error,{timeout:600000,polling:500});
    const error=await page.evaluate(()=>window.__recStats.error);
    if(error) throw new Error(`Экспорт: ${error}`);
    await page.waitForFunction(()=>!document.querySelector('.export-overlay'),{timeout:120000,polling:500});
    console.log('Декодируем кадры и сравниваем с экспортным canvas…');
    const result=await page.evaluate(async()=>{
      const L=window.__logo, stats=window.__recStats, blob=window.__lastVideoBlob;
      const video=document.createElement('video'), objectURL=URL.createObjectURL(blob);video.src=objectURL;
      const wait=(event,trigger)=>new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>{cleanup();reject(new Error(`Таймаут video.${event}`));},30000);
        const done=()=>{cleanup();resolve();}, fail=()=>{cleanup();reject(new Error(video.error?.message || 'Ошибка video'))};
        const cleanup=()=>{clearTimeout(timer);video.removeEventListener(event,done);video.removeEventListener('error',fail)};
        video.addEventListener(event,done,{once:true});video.addEventListener('error',fail,{once:true});trigger?.();
      });
      if(video.readyState<2) await wait('loadeddata');
      const metadata={width:video.videoWidth,height:video.videoHeight,duration:video.duration};
      const decoded=document.createElement('canvas'), reference=document.createElement('canvas');
      decoded.width=reference.width=320;decoded.height=reference.height=180;
      const dc=decoded.getContext('2d',{willReadFrequently:true}),rc=reference.getContext('2d',{willReadFrequently:true});
      const pixels=ctx=>ctx.getImageData(0,0,320,180).data;
      const diff=(a,b)=>{let total=0;for(let i=0;i<a.length;i+=4) for(let c=0;c<3;c++)total+=Math.abs(a[i+c]-b[i+c]);return total/(320*180*3)};
      const snap=(canvas,ctx,source)=>{ctx.clearRect(0,0,320,180);ctx.drawImage(source,0,0,320,180);return pixels(ctx)};
      // В SwiftShader первый доступ к видеотекстуре может инициализировать её лениво.
      await wait('seeked',()=>{video.currentTime=3.25/30});snap(decoded,dc,video);
      await wait('seeked',()=>{video.currentTime=2.25/30});snap(decoded,dc,video);
      const samples=[];
      let priming = true;
      for(const index of [2,5,3,2]) {
        await wait('seeked',()=>{video.currentTime=(index+.25)/30});
        let actual=snap(decoded,dc,video);
        const opaqueCount = data => {let n=0;for(let i=3;i<data.length;i+=4) if(data[i]===255)n++;return n;};
        // На некоторых headless GPU первый seeked приходит раньше готовой текстуры.
        // Повторяем выбор кадра после другого seek; отсутствие декодирования всё равно ошибка ниже.
        if (opaqueCount(actual) === 0) {
          await wait('seeked',()=>{video.currentTime=((index===3 ? 1 : 3)+.25)/30});
          snap(decoded,dc,video);
          await wait('seeked',()=>{video.currentTime=(index+.25)/30});
          actual=snap(decoded,dc,video);
        }
        const time=index*20/30;
        L.scene.logo.body.visible=true;
        const source=L.compositeFrameAt(time,1/30);
        const expected=snap(reference,rc,source);
        let hiddenDifference=null,hiddenMatch=null;
        if(index===3) {
          L.scene.logo.body.visible=false;
          const hidden=L.compositeFrameAt(time,1/30);
          const noLogo=snap(reference,rc,hidden);
          hiddenDifference=diff(expected,noLogo);hiddenMatch=diff(actual,noLogo);
          L.scene.logo.body.visible=true;
        }
        // Первое сравнение только прогревает видео и WebGL; оно не засчитывается.
        if (priming) priming = false;
        else samples.push({index, time, error:diff(actual,expected), hiddenDifference, hiddenMatch,
          opacity:opaqueCount(actual)});
      }
      video.removeAttribute('src');video.load();URL.revokeObjectURL(objectURL);
      return {metadata,samples,frames:stats.frames,expected:stats.expectedFrames,codec:stats.codec,bytes:blob.size};
    });
    console.log(result);
    assert.deepEqual(errors,[]);assert.equal(result.frames,6);assert.equal(result.expected,6);
    assert.equal(result.metadata.width,1920);assert.equal(result.metadata.height,1080);
    assert.ok(Math.abs(result.metadata.duration-.2)<.002);
    for(const sample of result.samples) {
      assert.equal(sample.opacity,320*180,JSON.stringify(sample));
      assert.ok(sample.error<6,`Декодированный кадр отличается от canvas: ${JSON.stringify(sample)}`);
    }
    const mid=result.samples.find(s=>s.index===3);
    assert.ok(mid.hiddenDifference>.1 && mid.hiddenMatch>mid.error+.05,`В середине не удалось подтвердить вклад логотипа: ${JSON.stringify(mid)}`);
    console.log('MP4 с собственным временем знака и титра: выбранные кадры соответствуют canvas — OK');
  } finally { await browser.close(); }
})().catch(e=>{console.error('FAIL',e);process.exitCode=1});
