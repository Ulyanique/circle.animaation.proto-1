// Имитация устаревшего кэша: прежний модуль свойств ещё не содержит группировку.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {launchBrowser} = require('./browser.cjs');
(async()=>{
  const browser = await launchBrowser({width:1200,height:800});
  try {
    const page=await browser.newPage(), errors=[]; let intercepted=0;
    page.on('pageerror',e=>errors.push(e.message));
    await page.setRequestInterception(true);
    page.on('request', request=>{
      const url=new URL(request.url());
      if(url.pathname==='/src/editor-properties.js') {
        intercepted++;
        // Исходная версия без новых экспортов продолжает предоставлять inspectorProperties.
        const source=fs.readFileSync('src/editor-properties.js','utf8');
        request.respond({status:200,contentType:'text/javascript',body:source});
      } else request.continue();
    });
    const url=new URL('/tests/fixtures/editor.html',process.env.URL||'http://localhost:5173');
    await page.goto(url.href,{waitUntil:'networkidle0',timeout:120000});
    await page.waitForFunction(()=>!!window.editorFixture,{timeout:30000});
    await page.evaluate(()=>{window.editorFixture.state.config.logo.depth=.4;});
    await page.click('.editor-toggle');
    await page.$eval('[data-layer=logo]',el=>el.click());
    assert.ok(await page.$('[data-extra-property="logo.depth"]'));
    assert.ok(intercepted>0,'старый модуль не подставлен');assert.deepEqual(errors,[]);
    console.log('Редактор запускается с прежней версией inspectorProperties без inspectorPropertyGroup — OK');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
