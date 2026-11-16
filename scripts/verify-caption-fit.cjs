const assert = require('node:assert/strict');
const {launchBrowser} = require('./browser.cjs');
(async () => {
  const browser = await launchBrowser({width:960,height:540});
  try {
    const page = await browser.newPage();
    await page.goto((process.env.URL || 'http://localhost:5173') + '/tests/fixtures/editor.html', {waitUntil:'networkidle0'});
    const result = await page.evaluate(async () => {
      const {applyCaptionFit} = await import('/src/caption-fit.js');
      const {syncCaptionContent} = await import('/src/caption-content.js');
      const cap = document.querySelector('#caption');
      const caption = {...window.editorFixture.state.config.caption,
        titleText:'Янтарный циркуль — большой юбилейный вечер архитектуры', titleAutoFit:true, titleX:0};
      syncCaptionContent(cap,caption,window.editorFixture.state.config.textLayers);
      const title = cap.querySelector('.cap-title');
      const measure = () => ({width:title.getBoundingClientRect().width, frame:cap.getBoundingClientRect().width,
        fit:Number(cap.style.getPropertyValue('--title-fit'))});
      applyCaptionFit(cap,caption); const first = measure();
      applyCaptionFit(cap,caption); const repeat = measure();
      caption.titleX = .2; cap.style.setProperty('--title-offset-x','20%');
      applyCaptionFit(cap,caption); const offset = measure();
      caption.titleAutoFit = false; applyCaptionFit(cap,caption); const disabled = measure();
      caption.titleAutoFit = true; caption.titleX = 0; cap.style.setProperty('--title-offset-x','0%');
      caption.titleText = 'Знак'; syncCaptionContent(cap,caption,window.editorFixture.state.config.textLayers);
      applyCaptionFit(cap,caption); const short = measure();
      const custom = {...window.editorFixture.state.config.textLayers, text1Present:true, text1AutoFit:true,
        text1Text:'Очень длинная собственная надпись для юбилейного торжественного вечера архитектуры', text1X:0};
      syncCaptionContent(cap, caption, custom);
      const own = cap.querySelector('[data-custom="text1"]');
      const ownMeasure = () => ({width:own.getBoundingClientRect().width, frame:cap.getBoundingClientRect().width,
        fit:Number(own.style.getPropertyValue('--custom-fit'))});
      applyCaptionFit(cap,caption,custom); const ownFirst = ownMeasure();
      applyCaptionFit(cap,caption,custom); const ownRepeat = ownMeasure();
      custom.text1X = .2; own.style.left = '70%'; applyCaptionFit(cap,caption,custom); const ownOffset = ownMeasure();
      custom.text1AutoFit = false; applyCaptionFit(cap,caption,custom); const ownDisabled = ownMeasure();
      window.editorFixture.createFinaleSettings();
      const input = document.querySelector('[data-key="caption.titleAutoFit"]');
      input.checked = true; input.dispatchEvent(new Event('change', {bubbles:true}));
      return {first,repeat,offset,disabled,short,ownFirst,ownRepeat,ownOffset,ownDisabled,finale:window.finaleSettings.configs.finale.caption.titleAutoFit,
        brand:window.finaleSettings.configs.brand.caption.titleAutoFit};
    });
    assert.ok(result.first.fit < 1 && result.first.width <= result.first.frame * .901);
    assert.deepEqual(result.repeat,result.first);
    assert.ok(result.offset.fit < result.first.fit && result.offset.width <= result.offset.frame * .501);
    assert.equal(result.disabled.fit,1); assert.ok(result.disabled.width > result.disabled.frame*.9);
    assert.equal(result.short.fit,1);
    assert.ok(result.ownFirst.fit < 1 && result.ownFirst.width <= result.ownFirst.frame * .901);
    assert.deepEqual(result.ownRepeat,result.ownFirst);
    assert.ok(result.ownOffset.fit < result.ownFirst.fit && result.ownOffset.width <= result.ownOffset.frame * .501);
    assert.equal(result.ownDisabled.fit,1); assert.ok(result.ownDisabled.width > result.ownDisabled.frame*.9);
    assert.equal(result.finale,true); assert.equal(result.brand,false);
    console.log('Автоподгонка: длинная строка, смещение, повторный расчёт, отключение и независимость сцен — OK');
  } finally { await browser.close(); }
})().catch(e => {console.error(e);process.exitCode=1});
