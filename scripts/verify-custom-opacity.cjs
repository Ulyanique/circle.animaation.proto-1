// Непрозрачность собственных надписей: DOM, canvas, порядок, история и история кадров.
const assert=require('node:assert/strict');
const {PNG}=require('pngjs');
const {launchBrowser}=require('./browser.cjs');
(async()=>{
 const b=await launchBrowser({width:1920,height:1080});
 try{
  const p=await b.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto(new URL('/tests/fixtures/editor.html',process.env.URL||'http://localhost:5173').href);
  await p.waitForFunction(()=>window.editorFixture);await p.click('.editor-toggle');
  assert.equal(await p.$eval('[data-field=opacity]',e=>e.hidden),true);
  await p.$eval('[data-add-text]',e=>e.click());
  await p.$eval('[data-appearance=text]',e=>{e.focus();e.value='Пример текста';e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));});
  const setOpacity=v=>p.$eval('[data-custom-opacity]',(e,v)=>{e.focus();e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));},v);
  await setOpacity('.5');
  assert.equal(await p.evaluate(()=>window.editorFixture.state.config.textLayers.text1Opacity),.5);
  assert.equal(await p.$eval('[data-custom=text1]',e=>Number(getComputedStyle(e).opacity)),.5);
  await p.$eval('[data-history=undo]',e=>e.click());assert.equal(await p.evaluate(()=>window.editorFixture.state.config.textLayers.text1Opacity),1);
  await p.$eval('[data-history=redo]',e=>e.click());
  await p.$eval('[data-action=duplicate]',e=>e.click());assert.equal(await p.evaluate(()=>window.editorFixture.state.config.textLayers.text2Opacity),.5);
  await setOpacity('.7');assert.deepEqual(await p.evaluate(()=>[window.editorFixture.state.config.textLayers.text1Opacity,window.editorFixture.state.config.textLayers.text2Opacity]),[.5,.7]);
  // Второй слой оставляем видимым, чтобы проверить композицию прозрачных слоёв.
  await p.evaluate(async()=>{
    await import('/src/font-assets.js');const {loadFonts}=await import('/src/fonts.js');await loadFonts();
    const {drawCaption}=await import('/src/caption-compositor.js');window.drawCaptionProbe=drawCaption;
    const cap=document.querySelector('#caption');cap.style.cssText='position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:1920px;height:1080px;--u:19.2px;opacity:1;font-family:"Cormorant Garamond", Georgia, serif';
    for(const el of cap.querySelectorAll('.cap-title,.cap-sub,.cap-date,.cap-rule'))el.style.display='none';
    for(const line of cap.querySelectorAll('.cap-custom')){line.style.left='50%';line.style.top='25%';line.style.setProperty('--p','1');line.style.setProperty('--f','1');line.style.setProperty('--lift','0px');for(const span of line.querySelectorAll('.cap-glyph')){span.style.setProperty('--o','1');span.style.setProperty('--f','1');span.style.setProperty('--gpen','0')}}
    const style=document.createElement('style');style.textContent='html,body{background:#000!important} body>*:not(#caption):not(#probe-canvas){display:none!important}';document.head.appendChild(style);
  });
  const dom=PNG.sync.read(Buffer.from(await p.screenshot({type:'png'})));
  const rendered=await p.evaluate(()=>{
    const canvas=document.createElement('canvas');canvas.id='probe-canvas';canvas.width=1920;canvas.height=1080;canvas.style.cssText='position:fixed;inset:0;width:1920px;height:1080px;z-index:9999';document.body.appendChild(canvas);
    const ctx=canvas.getContext('2d');ctx.fillStyle='#000';ctx.fillRect(0,0,1920,1080);
    const original=ctx.drawImage;const alphas=[];ctx.drawImage=function(...args){alphas.push(this.globalAlpha);return original.apply(this,args)};
    window.drawCaptionProbe(ctx,1,'waiting');return alphas;
  });
  assert.deepEqual(rendered,[.5,.7]);
  const alphaChecks=await p.evaluate(()=>{
    const first=document.querySelector('[data-custom=text1]');first.style.opacity='0';
    const canvas=document.createElement('canvas');canvas.width=1920;canvas.height=1080;
    const ctx=canvas.getContext('2d'),draw=ctx.drawImage,alphas=[];
    ctx.drawImage=function(...args){alphas.push(this.globalAlpha);return draw.apply(this,args)};
    window.drawCaptionProbe(ctx,.4,'waiting');return alphas;
  });
  assert.equal(alphaChecks.length,1);assert.ok(Math.abs(alphaChecks[0]-.28)<1e-8);

  const out=PNG.sync.read(Buffer.from(await p.screenshot({type:'png'})));
  let err=0,n=0,lit=0;for(let y=180;y<370;y++)for(let x=0;x<1920;x++){const i=(y*1920+x)*4;for(let c=0;c<3;c++)err+=Math.abs(dom.data[i+c]-out.data[i+c]);n+=3;if(dom.data[i]>35)lit++}
  assert.ok(lit>500);assert.ok(err/n<1.5,`DOM/canvas MAE ${err/n}`);
  console.log(`Непрозрачность: слои, undo/redo, DOM/canvas MAE ${(err/n).toFixed(3)} — OK`);
  assert.deepEqual(errors,[]);
 }finally{await b.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
