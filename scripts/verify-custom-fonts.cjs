// Проверка отдельных шрифтов, контуров DOM и контура экспортного canvas без WebGL.
const assert = require('node:assert/strict');
const {launchBrowser} = require('./browser.cjs');
(async () => {
  const browser = await launchBrowser({width:1440,height:900});
  try {
    const page = await browser.newPage(), errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(new URL('/tests/fixtures/editor.html',process.env.URL || 'http://localhost:5173').href);
    await page.waitForFunction(()=>window.editorFixture);
    await page.evaluate(async()=>{
      await import('/src/font-assets.js');
      const {loadFonts}=await import('/src/fonts.js'); await loadFonts();
      const {loadContourFonts,contourShape}=await import('/src/contour-fonts.js');
      const {sources}=await import('/src/contour-font-assets.js');
      const {parse}=await import('/node_modules/opentype.js/dist/opentype.mjs');
      await loadContourFonts(sources,parse);
      const {refreshContours}=await import('/src/contour-preview.js');
      const {drawCaption}=await import('/src/caption-compositor.js');
      window.fontProbe={refreshContours,contourShape,drawCaption};
    });
    await page.click('.editor-toggle');
    assert.equal(await page.$eval('[data-field=font]',e=>e.hidden),true);
    await page.$eval('[data-add-text]',e=>e.click());
    assert.equal(await page.$eval('[data-custom-font]',e=>e.options.length),7);
    await page.$eval('[data-appearance=text]',e=>{e.focus();e.value='Ж';e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));});
    await page.select('[data-custom-font]','manrope');
    assert.equal(await page.evaluate(()=>window.editorFixture.state.config.textLayers.text1Font),'manrope');
    const result=await page.evaluate(()=>{
      const cap=document.querySelector('#caption'); cap.dataset.font='cormorant-garamond';
      cap.style.fontFamily='"Cormorant Garamond", Georgia, serif';
      const line=cap.querySelector('[data-custom=text1]');
      line.style.setProperty('--p','1'); line.style.setProperty('--f','1');
      window.fontProbe.refreshContours('cormorant-garamond');
      const shape=window.fontProbe.contourShape('manrope',600,'Ж');
      const other=window.fontProbe.contourShape('cormorant-garamond',600,'Ж');
      const path=line.querySelector('.glyph-contour path')?.getAttribute('d');
      const canvas=document.createElement('canvas'); canvas.width=1920;canvas.height=1080;
      const ctx=canvas.getContext('2d');const stroke=ctx.stroke;let customStroke=0,wrongStroke=0;
      ctx.stroke=function(p,...args){if(p===shape.path)customStroke++;if(p===other.path)wrongStroke++;return stroke.call(this,p,...args)};
      window.fontProbe.drawCaption(ctx,1,'waiting');
      return {family:getComputedStyle(line).fontFamily,actual:path,expected:shape.d,other:other.d,customStroke,wrongStroke};
    });
    assert.match(result.family,/Manrope/);assert.equal(result.actual,result.expected);assert.notEqual(result.expected,result.other);assert.ok(result.customStroke>0);assert.equal(result.wrongStroke,0);
    await page.select('[data-custom-case]', 'lowercase');
    const letterCase=await page.evaluate(()=>{
      const line=document.querySelector('[data-custom=text1]');window.fontProbe.refreshContours('cormorant-garamond');
      const expected=window.fontProbe.contourShape('manrope',600,'ж');
      const canvas=document.createElement('canvas');canvas.width=1920;canvas.height=1080;
      const ctx=canvas.getContext('2d'),stroke=ctx.stroke;let calls=0;
      ctx.stroke=function(path,...args){if(path===expected.path)calls++;return stroke.call(this,path,...args)};
      window.fontProbe.drawCaption(ctx,1,'waiting');
      return {text:line.dataset.text,transform:getComputedStyle(line).textTransform,path:line.querySelector('.glyph-contour path').getAttribute('d'),expected:expected.d,calls};
    });
    assert.equal(letterCase.text,'Ж');assert.equal(letterCase.transform,'lowercase');
    assert.equal(letterCase.path,letterCase.expected);assert.ok(letterCase.calls>0);
    await page.$eval('[data-history=undo]',e=>e.click());
    assert.equal(await page.$eval('[data-custom-case]',e=>e.value),'none');
    await page.$eval('[data-history=redo]',e=>e.click());
    assert.equal(await page.$eval('[data-custom-case]',e=>e.value),'lowercase');
    await page.select('[data-custom-case]', 'none');

    await page.$eval('[data-history=undo]',e=>e.click());
    await page.$eval('[data-history=undo]',e=>e.click());
    await page.$eval('[data-history=undo]',e=>e.click());
    assert.equal(await page.$eval('[data-custom-font]',e=>e.value),'');
    assert.equal(await page.evaluate(()=>window.editorFixture.state.config.textLayers.text1Font),'');
    await page.$eval('[data-history=redo]',e=>e.click());
    await page.$eval('[data-history=redo]',e=>e.click());
    await page.$eval('[data-action=duplicate]',e=>e.click());
    assert.equal(await page.evaluate(()=>window.editorFixture.state.config.textLayers.text2Case),'lowercase');
    assert.equal(await page.evaluate(()=>window.editorFixture.state.config.textLayers.text2Font),'manrope');
    await page.select('[data-custom-font]','prata');
    assert.deepEqual(await page.evaluate(()=>[window.editorFixture.state.config.textLayers.text1Font,window.editorFixture.state.config.textLayers.text2Font]),['manrope','prata']);
    await page.select('[data-custom-font]','');
    assert.equal(await page.$eval('[data-custom=text2]',e=>e.style.fontFamily),'');
    const inherited=await page.evaluate(()=>{const cap=document.querySelector('#caption');cap.style.fontFamily='"Unbounded", Georgia, serif';const line=cap.querySelector('[data-custom=text2]');window.fontProbe.refreshContours('unbounded');return {family:getComputedStyle(line).fontFamily,shape:line.querySelector('.glyph-contour path')?.getAttribute('d'),expected:window.fontProbe.contourShape('unbounded',600,'ж').d}});
    assert.match(inherited.family,/Unbounded/); assert.equal(inherited.shape,inherited.expected);
    await page.$eval('[data-layer=text1]',e=>e.click());
    await page.$eval('[data-appearance=text]',e=>{e.focus();e.value='Длинная надпись для торжественного юбилейного вечера архитектуры и искусства';e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));});
    await page.$eval('[data-custom-autofit]',e=>e.click());
    for (const font of ['unbounded','prata']) {
      await page.select('[data-custom-font]',font);
      const m=await page.$eval('[data-custom=text1]',e=>({fit:Number(e.style.getPropertyValue('--custom-fit')),width:e.getBoundingClientRect().width,frame:e.parentElement.getBoundingClientRect().width}));
      assert.ok(m.fit<1 && m.width<=m.frame*.901, `${font}: подгонка не пересчитана`);
    }
    assert.deepEqual(errors,[]);console.log('Свой шрифт: DOM, контуры, canvas, история, копирование и наследование — OK');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
