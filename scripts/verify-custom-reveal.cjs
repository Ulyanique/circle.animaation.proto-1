// Мягкое проявление: абсолютное время, DOM и экспортный canvas без WebGL.
const assert=require('node:assert/strict');const {PNG}=require('pngjs');const {launchBrowser}=require('./browser.cjs');
(async()=>{for(const style of ['fade','fade-up']){const b=await launchBrowser({width:1920,height:1080});try{
 const p=await b.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(new URL('/tests/fixtures/editor.html',process.env.URL||'http://localhost:5173').href);await p.waitForFunction(()=>window.editorFixture);await p.click('.editor-toggle');
 assert.equal(await p.$eval('[data-field=reveal]',e=>e.hidden),true);
 await p.$eval('[data-add-text]',e=>e.click());assert.equal(await p.$eval('[data-custom-reveal]',e=>e.value),'draw');
 await p.$eval('[data-appearance=text]',e=>{e.focus();e.value='Плавный Текст';e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));});
 await p.select('[data-timing-mode]','custom');await p.select('[data-custom-reveal]',style);
 const state=async t=>{await p.evaluate(t=>window.editorFixture.setTime(t),t);return p.$eval('[data-custom=text1]',e=>({opacity:Number(getComputedStyle(e).opacity),lift:parseFloat(e.style.getPropertyValue('--lift')),p:Number(e.style.getPropertyValue('--p')),f:Number(e.style.getPropertyValue('--f')),glyphs:[...e.querySelectorAll('.cap-glyph')].map(x=>[Number(x.style.getPropertyValue('--o')),Number(x.style.getPropertyValue('--f'))])}));};
 const values=[];for(const time of [0,5,6,10,17,18,20])values.push(await state(time));
 assert.equal(values[0].opacity,0);assert.equal(values[1].opacity,0);assert.ok(values[2].opacity>0&&values[2].opacity<1);assert.equal(values[3].opacity,1);assert.ok(values[4].opacity>0&&values[4].opacity<1);assert.equal(values[5].opacity,0);assert.equal(values[6].opacity,0);
 if(style==='fade-up'){assert.ok(values[2].lift>0);assert.equal(values[3].lift,0);assert.ok(values[4].lift>0);}else assert.ok(values.every(v=>v.lift===0));
 for(const value of values){assert.equal(value.p,1);assert.equal(value.f,1);for(const g of value.glyphs)assert.deepEqual(g,[1,1]);}
 await p.$eval('[data-history=undo]',e=>e.click());assert.equal(await p.$eval('[data-custom-reveal]',e=>e.value),'draw');
 await p.$eval('[data-history=redo]',e=>e.click());await p.$eval('[data-action=duplicate]',e=>e.click());assert.equal(await p.evaluate(()=>window.editorFixture.state.config.textLayers.text2RevealStyle),style);
 await p.$eval('[data-action=delete-text]',e=>e.click());await p.$eval('[data-layer=text1]',e=>e.click());await state(6);
 await p.evaluate(async()=>{await import('/src/font-assets.js');const {loadFonts}=await import('/src/fonts.js');await loadFonts();const {drawCaption}=await import('/src/caption-compositor.js');window.drawReveal=drawCaption;
 const cap=document.querySelector('#caption');cap.style.cssText='position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:1920px;height:1080px;--u:19.2px;opacity:1;font-family:"Cormorant Garamond", Georgia, serif';
 for(const el of cap.querySelectorAll('.cap-title,.cap-sub,.cap-date,.cap-rule'))el.style.display='none';
 const line=cap.querySelector('[data-custom=text1]');line.style.left='50%';line.style.top='25%';window.editorFixture.setTime(6);line.style.setProperty('--pen','0');
 const style=document.createElement('style');style.textContent='html,body{background:#000!important} body>*:not(#caption):not(#probe-canvas){display:none!important}';document.head.appendChild(style);
 });
 const dom=PNG.sync.read(Buffer.from(await p.screenshot({type:'png'})));
 await p.evaluate(()=>{const canvas=document.createElement('canvas');canvas.id='probe-canvas';canvas.width=1920;canvas.height=1080;canvas.style.cssText='position:fixed;inset:0;width:1920px;height:1080px;z-index:9999';document.body.appendChild(canvas);const ctx=canvas.getContext('2d');ctx.fillStyle='#000';ctx.fillRect(0,0,1920,1080);window.drawReveal(ctx,1,'waiting')});
 const out=PNG.sync.read(Buffer.from(await p.screenshot({type:'png'})));let err=0,n=0,lit=0;for(let y=180;y<370;y++)for(let x=0;x<1920;x++){const i=(y*1920+x)*4;for(let c=0;c<3;c++)err+=Math.abs(dom.data[i+c]-out.data[i+c]);n+=3;if(dom.data[i]>25)lit++;}
 assert.ok(lit>200);assert.ok(err/n<1,`DOM/canvas MAE ${err/n}`);assert.deepEqual(errors,[]);
 console.log(`${style}: интервалы, история, копирование, DOM/canvas MAE ${(err/n).toFixed(3)} — OK`);
 }finally{await b.close()}}})().catch(e=>{console.error(e);process.exitCode=1});
