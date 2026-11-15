// Быстрая DOM-проверка редактора и вертикального запаса букв без WebGL/скриншотов.
// Запустите Vite и затем URL=http://localhost:5175 node scripts/verify-editor-lite.cjs
const assert = require('node:assert/strict');
const { launchBrowser } = require('./browser.cjs');
(async () => {
  const browser = await launchBrowser({ width: 1440, height: 900 });
  try {
    const mobile = await browser.newPage();
    await mobile.setViewport({width:320,height:700});
    await mobile.goto(new URL('/tests/fixtures/editor.html', process.env.URL || 'http://localhost:5173').href);
    await mobile.waitForFunction(() => window.editorFixture);
    await mobile.click('.editor-toggle');
    const bar = await mobile.$eval('.editor-history', el => ({width:el.clientWidth, content:el.scrollWidth}));
    assert.ok(bar.content <= bar.width, 'кнопки редактора не помещаются при ширине 320px');
    const compactTools = await mobile.$eval('.editor-preview-tools', el => el.getBoundingClientRect().toJSON());
    assert.ok(compactTools.right <= 320 && compactTools.top >= 76, 'управление просмотром перекрыто или выходит за экран');
    await mobile.click('[data-preview=in]');
    assert.equal(await mobile.$eval('[data-preview-zoom]', el => el.textContent), '125%');
    await mobile.click('[data-preview=fit]');
    assert.equal(await mobile.$eval('[data-preview-zoom]', el => el.textContent), '100%');
    await mobile.click('[data-preview-help]');
    assert.equal(await mobile.$eval('[data-preview-help]', el => el.getAttribute('aria-expanded')), 'true');
    assert.notEqual(await mobile.$eval('.editor-quick-help', el => getComputedStyle(el).display), 'none');
    const helpBounds = await mobile.$eval('.editor-quick-help', el => el.getBoundingClientRect().toJSON());
    assert.ok(helpBounds.right <= 320);
    await mobile.focus('[data-help-close]'); await mobile.keyboard.press('Escape');
    assert.equal(await mobile.$eval('.editor-quick-help', el => el.hidden), true);
    assert.equal(await mobile.evaluate(() => document.body.classList.contains('editor-on')), true);
    assert.equal(await mobile.$eval('[data-preview-help]', el => document.activeElement === el), true);
    const timelineHeader = await mobile.$eval('.editor-track-head', el => ({width:el.clientWidth, content:el.scrollWidth}));
    assert.ok(timelineHeader.content <= timelineHeader.width, `покадровое управление не помещается на 320px: ${JSON.stringify(timelineHeader)}`);
    await mobile.$eval('.editor-track-list', el => {el.style.scrollbarGutter='stable'; el.style.overflowY='scroll';});
    await mobile.waitForFunction(() => {const list=document.querySelector('.editor-track-list'), panel=document.querySelector('.editor-track-panel'); return parseFloat(panel.style.getPropertyValue('--timeline-scrollbar')) === list.offsetWidth-list.clientWidth;});
    const narrowAligned = await mobile.evaluate(() => {
      const inner = el => {const r=el.getBoundingClientRect(), s=getComputedStyle(el); return [r.left+parseFloat(s.borderLeftWidth),r.right-parseFloat(s.borderRightWidth)];};
      return [inner(document.querySelector('[data-track-ruler]')),inner(document.querySelector('[data-phase-lane]')),inner(document.querySelector('[data-track=title] .editor-track-lane'))];
    });
    for (const bounds of narrowAligned.slice(1)) for (let i=0;i<2;i++) assert.ok(Math.abs(bounds[i]-narrowAligned[0][i])<1, `смещение шкалы на 320px: ${JSON.stringify(narrowAligned)}`);
    await mobile.close();
    // Все параметры по объекту доступны прямо в инспекторе и не теряют историю.
    const props = await browser.newPage();
    await props.goto(new URL('/tests/fixtures/editor.html', process.env.URL || 'http://localhost:5173').href);
    await props.waitForFunction(() => window.editorFixture);
    await props.evaluate(() => { const c=window.editorFixture.state.config; c.logo.depth=.4; c.rings.speed=1; c.typography={font:'prata',titleTracking:.1}; });
    await props.click('.editor-toggle');
    await props.$eval('[data-layer=logo]', el => el.click());
    assert.equal(await props.$eval('[data-timing-title]', el => el.textContent), 'Время логотипа');
    assert.equal(await props.$eval('[data-property-group=advanced]', el => el.hidden), false);
    const previousDepth = await props.evaluate(() => window.editorFixture.state.config.logo.depth);
    await props.$eval('[data-extra-property="logo.depth"]', el => {el.focus(); el.value='0.75'; el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); el.blur();});
    assert.equal(await props.evaluate(() => window.editorFixture.state.config.logo.depth), .75);
    await props.$eval('[data-history=undo]', el => el.click());
    assert.equal(await props.evaluate(() => window.editorFixture.state.config.logo.depth), previousDepth);
    await props.$eval('[data-history=redo]', el => el.click());
    assert.equal(await props.evaluate(() => window.editorFixture.state.config.logo.depth), .75);
    await props.$eval('[data-layer=ringLeft]', el => el.click());
    assert.ok((await props.$eval('[data-extra-property="rings.speed"]', el => el.closest('label').textContent)).includes('общее'));
    await props.$eval('[data-layer=title]', el => el.click());
    assert.equal(await props.$eval('[data-custom-reveal]', el => el.value), 'fade');
    await props.select('[data-custom-reveal]', 'fade-up');
    assert.equal(await props.evaluate(() => window.editorFixture.state.config.captionTiming.titleRevealStyle), 'fade-up');
    await props.$eval('[data-history=undo]', el => el.click());
    assert.equal(await props.evaluate(() => window.editorFixture.state.config.captionTiming.titleRevealStyle), 'fade');
    assert.ok(await props.$('[data-extra-property="typography.font"]'));
    assert.equal(await props.$('[data-extra-property="logo.depth"]'), null);
    await props.$eval('[data-add-glow]', el => el.click());
    assert.ok(await props.$('[data-extra-property="backgroundGlow.pulse"]'));
    await props.close();
    // Характер проявления применяется только к добавленным эффектам и поддерживает историю.
    const curve = await browser.newPage();
    await curve.goto(new URL('/tests/fixtures/editor.html', process.env.URL || 'http://localhost:5173').href);
    await curve.waitForFunction(() => window.editorFixture); await curve.click('.editor-toggle');
    await curve.$eval('[data-add-decor]', el => el.click());
    await curve.$eval('[data-timing-mode]', el => {el.value='custom'; el.dispatchEvent(new Event('change',{bubbles:true}));});
    assert.equal(await curve.$eval('[data-effect-curve-row]', el => getComputedStyle(el).display !== 'none'), true);
    await curve.select('[data-effect-curve]', 'soft');
    assert.equal(await curve.evaluate(() => window.editorFixture.state.config.decor.timingCurve), 'soft');
    await curve.$eval('[data-history=undo]', el => el.click());
    assert.equal(await curve.evaluate(() => window.editorFixture.state.config.decor.timingCurve), 'normal');
    await curve.$eval('[data-history=redo]', el => el.click());
    assert.equal(await curve.$eval('[data-effect-curve]', el => el.value), 'soft');
    await curve.$eval('[data-layer=title]', el => el.click());
    assert.equal(await curve.$eval('[data-effect-curve-row]', el => el.hidden), true);
    await curve.close();
    // Подключаем настоящий пульт к лёгкому fixture: в редакторе нет второй перемотки.
    const operatorPage = await browser.newPage();
    await operatorPage.goto(new URL('/tests/fixtures/editor.html', process.env.URL || 'http://localhost:5173').href);
    await operatorPage.waitForFunction(() => window.editorFixture);
    await operatorPage.evaluate(async () => {
      const {createOperatorControls} = await import('/src/operator.js');
      const state = {id:'waiting', time:0, cycle:20, config:{timeline:{startDelay:0}, playback:{paused:true}}, recording:false};
      window.operatorTest = {state, played:0};
      createOperatorControls({getState:()=>state, seek:t=>{state.time=t}, setDuration:v=>{state.cycle=v},
        togglePause:()=>{state.config.playback.paused=!state.config.playback.paused; window.operatorTest.played++},
        switchScene:()=>{}, record:()=>{}, recordChain:()=>{}});
    });
    const visible = selector => operatorPage.$eval(selector, el => getComputedStyle(el).display !== 'none');
    for (const id of ['prev','seek','next']) assert.equal(await visible(`.operator-panel [data-action="${id}"]`), true);
    await operatorPage.click('.editor-toggle');
    for (const id of ['prev','seek','next']) assert.equal(await visible(`.operator-panel [data-action="${id}"]`), false);
    assert.equal(await visible('.operator-panel [data-role="time"]'), false);
    for (const id of ['play','duration','record','record-chain']) assert.equal(await visible(`.operator-panel [data-action="${id}"]`), true);
    assert.equal(await visible('.operator-panel [data-scene="finale"]'), true);
    const compact = await operatorPage.evaluate(() => {
      const box = selector => document.querySelector(selector).getBoundingClientRect();
      const a=box('.operator-panel .operator-row:first-child'), b=box('.operator-transport'), panel=box('.operator-panel'), timeline=box('.editor-track-panel');
      return {sameRow: Math.abs((a.top+a.height/2)-(b.top+b.height/2)) < 2, noOverlap:a.right <= b.left, timelineBottom:timeline.bottom, timelineTop:timeline.top, panelBottom:panel.bottom, panelTop:panel.top, panelRight:panel.right};
    });
    assert.ok(compact.sameRow && compact.noOverlap && compact.panelBottom <= compact.timelineTop && compact.panelRight <= 1440, `пульт/таймлайн перекрываются: ${JSON.stringify(compact)}`);
    await operatorPage.setViewport({width:1200,height:750});
    const boundary = await operatorPage.evaluate(() => {
      const r = selector => document.querySelector(selector).getBoundingClientRect();
      const panel=r('.operator-panel'), a=r('.operator-panel .operator-row:first-child'), b=r('.operator-transport'), timeline=r('.editor-track-panel');
      return {panelLeft:panel.left, panelRight:panel.right, overlap:a.right-b.left, bottom:timeline.bottom, timelineTop:timeline.top, panelBottom:panel.bottom, panelTop:panel.top, height:panel.height};
    });
    assert.ok(boundary.panelLeft >= 0 && boundary.panelRight <= 1200 && boundary.overlap <= 0 && boundary.panelBottom <= boundary.timelineTop, JSON.stringify(boundary));
    await operatorPage.setViewport({width:320,height:700});
    const mobileBar = await operatorPage.evaluate(() => {
      const panel=document.querySelector('.operator-panel'), bar=panel.getBoundingClientRect(), tools=document.querySelector('.editor-preview-tools').getBoundingClientRect(), timeline=document.querySelector('.editor-track-panel').getBoundingClientRect();
      return {top:bar.top,bottom:bar.bottom,right:bar.right, toolsBottom:tools.bottom, timelineTop:timeline.top, scroll:panel.scrollWidth > panel.clientWidth};
    });
    assert.ok(mobileBar.toolsBottom <= mobileBar.top && mobileBar.bottom <= mobileBar.timelineTop && mobileBar.right <= 320 && mobileBar.scroll, JSON.stringify(mobileBar));
    await operatorPage.$eval('.operator-panel', el => {el.scrollLeft = el.scrollWidth});
    const mobileExport = await operatorPage.$eval('.operator-panel [data-action=record-chain]', el => {const a=el.getBoundingClientRect(),p=el.closest('.operator-panel').getBoundingClientRect();return a.left >= p.left && a.right <= p.right;});
    assert.ok(mobileExport, 'экспорт должен быть доступен прокруткой верхней ленты');
    await operatorPage.setViewport({width:1440,height:900});
    const redundant = await operatorPage.evaluate(() => {
      const observer = new MutationObserver(()=>{});
      observer.observe(document.querySelector('.editor-layers'), {subtree:true, attributes:true, childList:true, characterData:true});
      for (let i=0;i<5;i++) window.editorFixture.editor.refresh();
      const count = observer.takeRecords().length; observer.disconnect(); return count;
    });
    assert.equal(redundant, 0, 'неизменная панель слоёв перезаписывается каждый кадр');
    await operatorPage.$eval('.operator-panel [data-action="play"]', el => el.click());
    assert.equal(await operatorPage.evaluate(() => window.operatorTest.played), 1);
    await operatorPage.click('.editor-toggle');
    for (const id of ['prev','seek','next']) assert.equal(await visible(`.operator-panel [data-action="${id}"]`), true);
    await operatorPage.close();
    // Масштаб и рука двигают только предпросмотр, а границы кадра остаются на месте.
    const preview = await browser.newPage();
    await preview.goto(new URL('/tests/fixtures/editor.html', process.env.URL || 'http://localhost:5173').href);
    await preview.waitForFunction(() => window.editorFixture); await preview.click('.editor-toggle');
    const beforePreview = await preview.evaluate(() => {
      const r = document.querySelector('#stage').getBoundingClientRect();
      return {config:JSON.stringify(window.editorFixture.state.config), width:r.width, left:r.left, top:r.top};
    });
    await preview.click('[data-preview=focus]');
    const focusState = await preview.evaluate(() => ({width:document.querySelector('#stage').getBoundingClientRect().width,
      panels:['.editor-layers','.editor-inspector','.editor-track-panel'].map(s => getComputedStyle(document.querySelector(s)).display),
      config:JSON.stringify(window.editorFixture.state.config),pressed:document.querySelector('[data-preview=focus]').getAttribute('aria-pressed')}));
    assert.ok(focusState.width > beforePreview.width); assert.deepEqual(focusState.panels, ['none','none','none']);
    assert.equal(focusState.config, beforePreview.config); assert.equal(focusState.pressed, 'true');
    await preview.click('[data-preview=in]');
    assert.equal(await preview.$eval('[data-preview-zoom]', el => el.textContent), '125%');
    await preview.click('[data-preview=fit]'); await preview.click('[data-preview=focus]');
    assert.equal(await preview.$eval('.editor-track-panel', el => getComputedStyle(el).display !== 'none'), true);
    assert.ok(Math.abs(await preview.$eval('#stage', el => el.getBoundingClientRect().width) - beforePreview.width) < 1);
    await preview.click('[data-preview=in]'); await preview.click('[data-preview=in]'); await preview.click('[data-preview=in]');
    assert.equal(await preview.$eval('[data-preview-zoom]', el => el.textContent), '200%');
    const enlarged = await preview.evaluate(() => {
      const s = document.querySelector('#stage').getBoundingClientRect(), c = document.querySelector('#caption').getBoundingClientRect();
      return {width:s.width, left:s.left, top:s.top, captionWidth:c.width, canvasClip:document.querySelector('#stage').style.clipPath, overlayClip:document.querySelector('.editor-preview-clip').style.clipPath};
    });
    assert.ok(Math.abs(enlarged.width - beforePreview.width * 2) <= 1);
    assert.equal(enlarged.captionWidth, enlarged.width); assert.match(enlarged.canvasClip, /inset/); assert.match(enlarged.overlayClip, /inset/);
    await preview.click('[data-preview=pan]');
    const centerX = beforePreview.left + beforePreview.width / 2, centerY = beforePreview.top + beforePreview.width * 9 / 32;
    await preview.mouse.move(centerX, centerY); await preview.mouse.down(); await preview.mouse.move(centerX + 65, centerY + 30, {steps:3}); await preview.mouse.up();
    const panned = await preview.$eval('#stage', el => el.getBoundingClientRect().toJSON());
    assert.ok(Math.abs(panned.left - enlarged.left - 65) < 1 && Math.abs(panned.top - enlarged.top - 30) < 1);
    assert.equal(await preview.evaluate(() => JSON.stringify(window.editorFixture.state.config)), beforePreview.config);
    await preview.keyboard.press('ArrowRight');
    assert.ok(Math.abs(await preview.$eval('#stage', el => el.getBoundingClientRect().left) - panned.left - 20) < 1);
    await preview.keyboard.press('Escape');
    assert.equal(await preview.$eval('[data-preview=pan]', el => el.getAttribute('aria-pressed')), 'false');
    await preview.$eval('[data-layer=title]', el => el.click());
    const textBox = await preview.$eval('[data-element=title]', el => {const r=el.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};});
    await preview.keyboard.down('Alt'); await preview.mouse.move(textBox.x, textBox.y); await preview.mouse.down();
    await preview.mouse.move(textBox.x + 40, textBox.y); await preview.mouse.up(); await preview.keyboard.up('Alt');
    const movedText = await preview.evaluate(() => window.editorFixture.state.config.caption.titleX);
    assert.ok(Math.abs(movedText - 40 / enlarged.width) < .002, `неверное смещение при масштабе: ${movedText}`);
    await preview.$eval('[data-history=undo]', el => el.click());
    assert.equal(await preview.evaluate(() => window.editorFixture.state.config.caption.titleX), 0);
    await preview.click('[data-preview=fit]');
    const restoredPreview = await preview.$eval('#stage', el => el.getBoundingClientRect().toJSON());
    assert.ok(Math.abs(restoredPreview.left - beforePreview.left) < 1 && Math.abs(restoredPreview.width - beforePreview.width) < 1);
    await preview.click('[data-preview=in]'); await preview.click('[data-preview=focus]'); await preview.click('.editor-toggle');
    assert.equal(await preview.evaluate(() => document.body.classList.contains('editor-focus')), false);
    assert.equal(await preview.$eval('#stage', el => el.style.clipPath), '');
    await preview.click('.editor-toggle');
    assert.equal(await preview.$eval('[data-preview-zoom]', el => el.textContent), '100%');
    await preview.close();
    // Разделы инспектора не меняют проект; видимые настройки следуют выбору слоя.
    const groups = await browser.newPage();
    await groups.goto(new URL('/tests/fixtures/editor.html', process.env.URL || 'http://localhost:5173').href);
    await groups.waitForFunction(() => window.editorFixture); await groups.click('.editor-toggle');
    assert.equal(await groups.$eval('[data-property-group=animation]', el => el.hidden), false);
    assert.equal(await groups.$eval('[data-property-group=order]', el => el.hidden), true);
    assert.equal(await groups.$eval('[data-geometry=x]', el => el.getAttribute('aria-label')), 'X, единицы сцены');
    const groupConfig = await groups.evaluate(() => JSON.stringify(window.editorFixture.state.config));
    await groups.click('[data-property-group=geometry] > summary');
    assert.equal(await groups.$eval('[data-property-group=geometry]', el => el.open), false);
    assert.equal(await groups.$eval('[data-geometry=x]', el => el.getClientRects().length), 0);
    assert.equal(await groups.evaluate(() => JSON.stringify(window.editorFixture.state.config)), groupConfig);
    await groups.focus('[data-property-group=geometry] > summary'); await groups.keyboard.press('Enter');
    assert.equal(await groups.$eval('[data-property-group=geometry]', el => el.open), true);
    await groups.$eval('[data-add-text]', el => el.click());
    assert.equal(await groups.$eval('[data-property-group=animation]', el => el.hidden), false);
    assert.equal(await groups.$eval('[data-property-group=order]', el => el.hidden), false);
    assert.equal(await groups.$eval('[data-geometry=x]', el => el.getAttribute('aria-label')), 'X, процент ширины кадра');
    assert.equal(await groups.$eval('[data-geometry=y]', el => el.getAttribute('aria-label')), 'Y, процент высоты кадра');
    await groups.$eval('[data-layer-name]', el => {el.focus(); el.value = 'Группа'; el.dispatchEvent(new Event('input', {bubbles:true}));});
    await groups.click('[data-property-group=appearance] > summary');
    assert.equal(await groups.$eval('[data-property-group=appearance]', el => el.open), false);
    await groups.$eval('[data-history=undo]', el => el.click());
    assert.equal(await groups.evaluate(() => window.editorFixture.state.config.textLayers.text1Name), '');
    await groups.click('[data-property-group=appearance] > summary');
    assert.equal(await groups.$eval('[data-layer-name]', el => el.value), '');
    await groups.setViewport({width: 390, height: 844});
    await groups.click('[data-panel=layers]'); await groups.click('[data-layer=title]');
    assert.notEqual(await groups.$eval('.editor-inspector', el => getComputedStyle(el).display), 'none');
    await groups.click('[data-property-group=geometry] > summary');
    assert.equal(await groups.$eval('[data-property-group=geometry]', el => el.open), false);
    assert.equal(await groups.$eval('[data-geometry=x]', el => el.getClientRects().length), 0);
    await groups.close();
    // Имена пользовательских слоёв живут только в редакторе и обратимы.
    const names = await browser.newPage(), nameErrors = [];
    names.on('pageerror', e => nameErrors.push(e.message));
    await names.goto(new URL('/tests/fixtures/editor.html', process.env.URL || 'http://localhost:5173').href);
    await names.waitForFunction(() => window.editorFixture);
    await names.click('.editor-toggle');
    assert.equal(await names.$eval('[data-field=name]', el => el.hidden), true);
    for (const [button, id, section, key, label] of [
      ['text', 'text1', 'textLayers', 'text1Name', 'Титр сцены'],
      ['decor', 'brandDecor', 'decor', 'name', 'Кольцо'],
      ['cloud', 'particleCloud', 'particleCloud', 'name', 'Искры слева'],
      ['glow', 'backgroundGlow', 'backgroundGlow', 'name', 'Ореол'],
    ]) {
      await names.$eval(`[data-add-${button}]`, el => el.click());
      const oldText = await names.evaluate(() => window.editorFixture.state.config.textLayers.text1Text);
      await names.$eval('[data-layer-name]', (el, value) => { el.focus(); el.value = value; el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); }, label);
      assert.equal(await names.evaluate(([section,key]) => window.editorFixture.state.config[section][key], [section,key]), label);
      assert.equal(await names.$eval(`[data-layer=${id}] strong`, el => el.textContent), label);
      assert.equal(await names.$eval(`[data-track=${id}] .editor-track-label`, el => el.textContent), label);
      assert.equal(await names.$eval('[data-selected-label]', el => el.textContent), label);
      assert.equal(await names.evaluate(() => window.editorFixture.state.config.textLayers.text1Text), oldText);
      await names.$eval('[data-history=undo]', el => el.click());
      assert.equal(await names.evaluate(([section,key]) => window.editorFixture.state.config[section][key], [section,key]), '');
      await names.$eval('[data-history=redo]', el => el.click());
      assert.equal(await names.$eval(`[data-layer=${id}] strong`, el => el.textContent), label);
      await names.$eval('[data-action=duplicate]', el => el.click());
      const copy = {text:'text2',decor:'brandDecor2',cloud:'particleCloud2',glow:'backgroundGlow2'}[button];
      assert.equal(await names.$eval(`[data-layer=${copy}] strong`, el => el.textContent), label);
    }
    await names.$eval('[data-layer=text1]', el => el.click());
    await names.$eval('[data-layer-name]', el => { el.focus(); el.value = '   '; el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); });
    assert.equal(await names.$eval('[data-layer=text1] strong', el => el.textContent), 'Текст 1');
    assert.deepEqual(nameErrors, []);
    await names.close();
    // Защита от случайного перемещения и изменения размера, но не от правки текста.
    const locks = await browser.newPage(), lockErrors = [];
    locks.on('pageerror', e => lockErrors.push(e.message));
    await locks.goto(new URL('/tests/fixtures/editor.html', process.env.URL || 'http://localhost:5173').href);
    await locks.waitForFunction(() => window.editorFixture); await locks.click('.editor-toggle');
    const geometry = () => locks.evaluate(() => {const l = window.editorFixture.state.config.logo; return [l.offsetX,l.offsetY,l.scale];});
    const original = await geometry();
    await locks.$eval('[data-lock=logo]', el => el.click());
    assert.equal(await locks.$eval('[data-lock=logo]', el => el.getAttribute('aria-pressed')), 'true');
    assert.equal(await locks.$eval('[data-action=align-x]', el => el.disabled), true);
    const rect = await locks.$eval('[data-element=logo]', el => {const r=el.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2};});
    await locks.mouse.move(rect.x,rect.y); await locks.mouse.down(); await locks.mouse.move(rect.x+70,rect.y+40,{steps:3}); await locks.mouse.up();
    await locks.focus('[data-layer=logo]'); await locks.keyboard.press('ArrowRight'); await locks.keyboard.press('+');
    assert.deepEqual(await geometry(), original);
    await locks.$eval('[data-history=undo]', el => el.click());
    assert.equal(await locks.$eval('[data-lock=logo]', el => el.getAttribute('aria-pressed')), 'false');
    await locks.$eval('[data-history=redo]', el => el.click());
    assert.equal(await locks.$eval('[data-lock=logo]', el => el.getAttribute('aria-pressed')), 'true');
    await locks.$eval('[data-lock=logo]', el => el.click());
    await locks.focus('[data-layer=logo]'); await locks.keyboard.press('ArrowRight');
    assert.notDeepEqual(await geometry(), original);
    await locks.$eval('[data-add-text]', el => el.click()); await locks.$eval('[data-lock=text1]', el => el.click());
    await locks.$eval('[data-appearance=text]', el => {el.focus(); el.value='Изменено'; el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true}));});
    assert.equal(await locks.evaluate(() => window.editorFixture.state.config.textLayers.text1Text), 'Изменено');
    await locks.$eval('[data-action=duplicate]', el => el.click());
    assert.equal(await locks.evaluate(() => window.editorFixture.state.config.editorLocks.text2), false);
    await locks.$eval('[data-layer=text1]', el => el.click()); await locks.$eval('[data-action=delete-text]', el => el.click());
    await locks.$eval('[data-add-text]', el => el.click());
    assert.equal(await locks.evaluate(() => window.editorFixture.state.config.editorLocks.text1), false);
    await locks.$eval('[data-history=undo]', el => el.click());
    assert.equal(await locks.evaluate(() => window.editorFixture.state.config.editorLocks.text1), true);
    assert.deepEqual(lockErrors, []); await locks.close();
    // Точная геометрия: единицы, границы, история, блокировка и синхронизация.
    const geom = await browser.newPage(), geomErrors = [];
    geom.on('pageerror', e => geomErrors.push(e.message));
    await geom.goto(new URL('/tests/fixtures/editor.html', process.env.URL || 'http://localhost:5173').href);
    await geom.waitForFunction(() => window.editorFixture); await geom.click('.editor-toggle');
    const setGeom = (key, value) => geom.$eval(`[data-geometry=${key}]`, (el, value) => {el.focus(); el.value=value; el.dispatchEvent(new Event('change',{bubbles:true}));}, value);
    await setGeom('x', '1.25'); await setGeom('y', '-0.6'); await setGeom('size', '1.4');
    assert.deepEqual(await geom.evaluate(() => {const l=window.editorFixture.state.config.logo; return [l.offsetX,l.offsetY,l.scale]}), [1.25,-0.6,1.4]);
    await geom.$eval('[data-history=undo]', el=>el.click());
    assert.equal(await geom.evaluate(() => window.editorFixture.state.config.logo.scale),1);
    await geom.$eval('[data-history=redo]', el=>el.click());
    assert.equal(await geom.evaluate(() => window.editorFixture.state.config.logo.scale),1.4);
    await setGeom('x','99'); assert.equal(await geom.evaluate(() => window.editorFixture.state.config.logo.offsetX),2);
    await setGeom('x',''); assert.equal(await geom.evaluate(() => window.editorFixture.state.config.logo.offsetX),2);
    assert.equal(await geom.$eval('[data-geometry=x]', el=>Number(el.value)),2);
    await geom.$eval('[data-lock=logo]', el=>el.click());
    assert.equal(await geom.$eval('[data-geometry=x]', el=>el.disabled),true);
    await setGeom('x','0'); assert.equal(await geom.evaluate(() => window.editorFixture.state.config.logo.offsetX),2);
    await geom.$eval('[data-add-text]', el=>el.click());
    assert.match(await geom.$eval('[data-geometry-hint]', el=>el.textContent), /% кадра/);
    await setGeom('x','12.5'); await setGeom('y','-20'); await setGeom('size','1.2');
    assert.deepEqual(await geom.evaluate(() => {const t=window.editorFixture.state.config.textLayers; return [t.text1X,t.text1Y,t.text1Scale]}), [.125,-.2,1.2]);
    await setGeom('x','-100'); assert.equal(await geom.evaluate(() => window.editorFixture.state.config.textLayers.text1X),-.45);
    await geom.$eval('[data-add-decor]', el=>el.click());
    assert.equal(await geom.$eval('[data-geometry-size-label]', el=>el.textContent), 'Радиус · ед.');
    await setGeom('x','3.25'); await setGeom('size','1.8');
    assert.deepEqual(await geom.evaluate(() => [window.editorFixture.state.config.decor.offsetX,window.editorFixture.state.config.decor.radius]),[3.25,1.8]);
    await geom.$eval('[data-layer=title]', el=>el.click());
    assert.equal(await geom.$eval('[data-geometry-size-label]', el=>el.textContent), 'Масштаб · ×');
    assert.equal(await geom.$eval('[data-geometry=x]', el=>Number(el.value)),0);
    assert.deepEqual(geomErrors, []); await geom.close();
    // Копирование и удаление с клавиатуры не затрагивают поля ввода и таймлайн.
    const keys = await browser.newPage(), keyErrors = [];
    keys.on('pageerror', e => keyErrors.push(e.message));
    await keys.goto(new URL('/tests/fixtures/editor.html', process.env.URL || 'http://localhost:5173').href);
    await keys.waitForFunction(() => window.editorFixture); await keys.click('.editor-toggle');
    for (const [kind, source, copy, section, flag] of [
      ['text','text1','text2','textLayers','text2Present'],
      ['decor','brandDecor','brandDecor2','decor2','present'],
      ['cloud','particleCloud','particleCloud2','particleCloud2','present'],
      ['glow','backgroundGlow','backgroundGlow2','backgroundGlow2','present'],
    ]) {
      await keys.$eval(`[data-add-${kind}]`, el => el.click());
      await keys.$eval(`[data-layer=${source}]`, el => {el.click(); el.focus();});
      await keys.keyboard.down('Control'); await keys.keyboard.press('d'); await keys.keyboard.up('Control');
      assert.equal(await keys.evaluate(([s,k]) => window.editorFixture.state.config[s][k], [section,flag]), true);
      await keys.$eval(`[data-layer=${copy}]`, el => {el.click(); el.focus();});
      await keys.keyboard.press('Delete');
      assert.equal(await keys.evaluate(([s,k]) => window.editorFixture.state.config[s][k], [section,flag]), false);
      await keys.$eval('[data-history=undo]', el => el.click());
      assert.equal(await keys.evaluate(([s,k]) => window.editorFixture.state.config[s][k], [section,flag]), true);
      await keys.$eval('[data-history=redo]', el => el.click());
      assert.equal(await keys.evaluate(([s,k]) => window.editorFixture.state.config[s][k], [section,flag]), false);
    }
    await keys.$eval('[data-layer=text1]', el => el.click());
    await keys.focus('[data-appearance=text]');
    await keys.keyboard.down('Control'); await keys.keyboard.press('d'); await keys.keyboard.up('Control');
    assert.equal(await keys.evaluate(() => window.editorFixture.state.config.textLayers.text2Present), false);
    await keys.focus('[data-track-ruler]'); await keys.keyboard.press('Delete');
    assert.equal(await keys.evaluate(() => window.editorFixture.state.config.textLayers.text1Present), true);
    await keys.$eval('[data-layer=logo]', el => {el.click(); el.focus();}); await keys.keyboard.press('Delete');
    assert.equal(await keys.evaluate(() => window.editorFixture.state.config.logo.visible),true);
    // Заполненные слоты: Ctrl+D не должен создать новый или перезаписать существующий.
    for (let i=0; i<7; i++) await keys.$eval('[data-add-text]', el => el.click());
    await keys.$eval('[data-layer=text1]', el => {el.click(); el.focus();});
    const before = await keys.evaluate(() => structuredClone(window.editorFixture.state.config.textLayers));
    await keys.keyboard.down('Control'); await keys.keyboard.press('d'); await keys.keyboard.up('Control');
    assert.deepEqual(await keys.evaluate(() => window.editorFixture.state.config.textLayers),before);
    assert.deepEqual(keyErrors, []); await keys.close();
    // Индивидуальный интервал собственного текста и его копирование.
    const trackingPage = await browser.newPage(), trackingErrors = [];
    trackingPage.on('pageerror', e => trackingErrors.push(e.message));
    await trackingPage.goto(new URL('/tests/fixtures/editor.html', process.env.URL || 'http://localhost:5173').href);
    await trackingPage.waitForFunction(() => window.editorFixture); await trackingPage.click('.editor-toggle');
    assert.equal(await trackingPage.$eval('[data-field=tracking]', el => el.hidden),true);
    await trackingPage.$eval('[data-add-text]', el => el.click());
    await trackingPage.$eval('[data-custom-tracking]', el => {el.focus();el.value='.24';el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));});
    assert.equal(await trackingPage.evaluate(() => window.editorFixture.state.config.textLayers.text1Tracking),.24);
    const cs = await trackingPage.$eval('[data-custom=text1]', el => ({spacing:parseFloat(getComputedStyle(el).letterSpacing), size:parseFloat(getComputedStyle(el).fontSize)}));
    assert.ok(Math.abs(cs.spacing - cs.size*.24)<.01);
    await trackingPage.$eval('[data-history=undo]', el=>el.click());
    assert.equal(await trackingPage.evaluate(() => window.editorFixture.state.config.textLayers.text1Tracking),0);
    await trackingPage.$eval('[data-history=redo]', el=>el.click());
    await trackingPage.$eval('[data-action=duplicate]', el=>el.click());
    assert.equal(await trackingPage.evaluate(() => window.editorFixture.state.config.textLayers.text2Tracking),.24);
    await trackingPage.$eval('[data-custom-tracking]', el => {el.focus();el.value='.4';el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));});
    assert.deepEqual(await trackingPage.evaluate(() => {const t=window.editorFixture.state.config.textLayers;return [t.text1Tracking,t.text2Tracking]}),[.24,.4]);
    assert.deepEqual(trackingErrors,[]); await trackingPage.close();
    // Интенсивность добавленных эффектов — те же значения и материалы, что у сцены.
    const fxPage = await browser.newPage(), fxErrors=[];
    fxPage.on('pageerror',e=>fxErrors.push(e.message));
    await fxPage.goto(new URL('/tests/fixtures/editor.html',process.env.URL || 'http://localhost:5173').href);
    await fxPage.waitForFunction(()=>window.editorFixture); await fxPage.click('.editor-toggle');
    assert.equal(await fxPage.$eval('.editor-effect-intensity',el=>el.hidden),true);
    for (const [type,id,section,key,defaultValue,group] of [
      ['decor','brandDecor','decor','opacity',.22,'brandDecor'],
      ['cloud','particleCloud','particleCloud','opacity',.65,'particleCloud'],
      ['glow','backgroundGlow','backgroundGlow','intensity',.45,'backgroundGlow'],
    ]) {
      await fxPage.$eval(`[data-add-${type}]`,e=>e.click());
      assert.equal(await fxPage.$eval('.editor-effect-intensity',el=>el.hidden),false);
      assert.equal(await fxPage.$eval('[data-effect-dust-row]',el=>el.hidden),type!=='decor');
      await fxPage.$eval('[data-effect-intensity]',e=>{e.focus();e.value='.3';e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));});
      assert.equal(await fxPage.evaluate(([s,k])=>window.editorFixture.state.config[s][k],[section,key]),.3);
      const material=await fxPage.evaluate(([type,group])=>{const x=window.editorFixture.state.scene[group];return type==='decor'?x.ring.material.opacity:x.material.opacity},[type,group]);
      if (type==='glow') assert.ok(material>0 && material<=.3); else assert.ok(Math.abs(material-.3)<1e-6);
      await fxPage.$eval('[data-history=undo]',e=>e.click());
      assert.equal(await fxPage.evaluate(([s,k])=>window.editorFixture.state.config[s][k],[section,key]),defaultValue);
      await fxPage.$eval('[data-history=redo]',e=>e.click());
      if(type==='decor') {
        await fxPage.$eval('[data-effect-dust]',e=>{e.focus();e.value='.17';e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));});
        assert.deepEqual(await fxPage.evaluate(()=>[window.editorFixture.state.config.decor.opacity,window.editorFixture.state.config.decor.dustOpacity]),[.3,.17]);
        assert.ok(Math.abs(await fxPage.evaluate(()=>window.editorFixture.state.scene.brandDecor.dust.material.opacity)-.17)<1e-6);
      }
      await fxPage.$eval('[data-action=duplicate]',e=>e.click());
      const copy={decor:'decor2',cloud:'particleCloud2',glow:'backgroundGlow2'}[type];
      assert.equal(await fxPage.evaluate(([s,k])=>window.editorFixture.state.config[s][k],[copy,key]),.3);
      if(type==='decor') assert.equal(await fxPage.evaluate(()=>window.editorFixture.state.config.decor2.dustOpacity),.17);
      await fxPage.$eval(`[data-lock=${{decor:'brandDecor2',cloud:'particleCloud2',glow:'backgroundGlow2'}[type]}]`,e=>e.click());
      assert.equal(await fxPage.$eval('[data-effect-intensity]',e=>e.disabled),false);
    }
    assert.deepEqual(fxErrors,[]);await fxPage.close();
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(new URL('/tests/fixtures/editor.html', process.env.URL || 'http://localhost:5173').href);
    await page.waitForFunction(() => window.editorFixture);
    const descender = await page.$eval('.cap-glyph', el => {
      const s = getComputedStyle(el, '::after');
      return { top: parseFloat(s.top), bottom: parseFloat(s.bottom), padding: parseFloat(s.paddingTop) };
    });
    assert.ok(descender.top < 0 && descender.bottom < 0 && descender.padding > 0, 'нет запаса для нижних элементов букв');
    await page.click('.editor-toggle');
    assert.equal(await page.$eval('[data-layer=logo]', el => el.getAttribute('aria-pressed')), 'true', 'логотип не выбран при входе');
    assert.equal(await page.$eval('[data-selected-label]', el => el.textContent), 'Логотип');
    const layout = await page.evaluate(() => {
      const bounds = sel => { const r = document.querySelector(sel).getBoundingClientRect(); return {left:r.left, right:r.right, top:r.top, bottom:r.bottom}; };
      return { frame: bounds('#stage'), layers: bounds('.editor-layers'), inspector: bounds('.editor-inspector') };
    });
    assert.ok(layout.layers.right <= layout.frame.left && layout.inspector.left >= layout.frame.right, 'панели перекрывают кадр');
    // Безопасная область — ориентир в DOM редактора, в canvas её нет.
    const safe = await page.evaluate(() => {
      const r = document.querySelector('.editor-safe-frame').getBoundingClientRect();
      const f = document.querySelector('#stage').getBoundingClientRect();
      return {left:r.left, top:r.top, width:r.width, height:r.height,
        expectedLeft:f.left + f.width * .05, expectedTop:f.top + f.height * .05,
        expectedWidth:f.width * .90, expectedHeight:f.height * .90};
    });
    for (const name of ['left','top','width','height']) assert.ok(Math.abs(safe[name] - safe['expected' + name[0].toUpperCase() + name.slice(1)]) < 1, `ошибка безопасной области: ${name}`);
    const cleanExport = await page.evaluate(() => window.editorFixture.exportedTitle());
    await page.evaluate(() => { document.querySelector('#caption').style.setProperty('--date-offset-x','43%'); window.editorFixture.editor.refresh(); });
    assert.match(await page.$eval('.editor-safe-notice', el => el.textContent), /За полями 5%: Дата/);
    await page.evaluate(() => { document.querySelector('#caption').style.setProperty('--date-offset-x','0%'); window.editorFixture.editor.refresh(); });

    await page.evaluate(() => { document.querySelector('#caption').style.setProperty('--title-offset-x','46%'); window.editorFixture.editor.refresh(); });
    assert.match(await page.$eval('.editor-safe-notice', el => el.textContent), /За кадром: Название/);
    await page.evaluate(() => { window.editorFixture.state.config.caption.titleVisible = false; window.editorFixture.editor.refresh(); });
    assert.equal(await page.$eval('.editor-safe-notice', el => el.hidden), true, 'скрытый титр не должен предупреждать');
    await page.evaluate(() => { window.editorFixture.state.config.caption.titleVisible = true; document.querySelector('#caption').style.setProperty('--title-offset-x','0%'); window.editorFixture.editor.refresh(); });
    await page.$eval('[data-safe-toggle]', el => el.click());
    assert.equal(await page.$eval('.editor-safe-frame', el => el.hidden), true);
    assert.equal(await page.$eval('[data-safe-toggle]', el => el.getAttribute('aria-pressed')), 'false');
    assert.deepEqual(await page.evaluate(() => window.editorFixture.exportedTitle()), cleanExport, 'ориентир попал в экспорт');
    await page.$eval('[data-safe-toggle]', el => el.click());

    const timelineTop = await page.$eval('.editor-track-panel', el => el.getBoundingClientRect().top);
    assert.ok(layout.frame.bottom <= timelineTop + 1, 'таймлайн перекрывает кадр');
    assert.deepEqual(await page.$$eval('[data-layer]:not([hidden])', els => els.map(el => el.dataset.layer)), ['logo', 'title', 'subtitle', 'date', 'ringLeft', 'ringRight', 'constructionGuides', 'topIllumination']);
    // Границы базовых фаз редактируются атомарно, без изменения длины цикла.
    const phaseBefore = await page.evaluate(() => structuredClone(window.editorFixture.state.config.timeline));
    const phaseLane = await page.$eval('[data-phase-lane]', el => { const r = el.getBoundingClientRect(); return {x:r.x, y:r.y+r.height/2, width:r.width}; });
    await page.mouse.move(phaseLane.x + phaseLane.width * .5, phaseLane.y); await page.mouse.down();
    await page.mouse.move(phaseLane.x + phaseLane.width * .4, phaseLane.y, {steps:3}); await page.mouse.up();
    let phaseAfter = await page.evaluate(() => structuredClone(window.editorFixture.state.config.timeline));
    assert.ok(Math.abs(phaseAfter.drawDuration + phaseAfter.emergeDuration - 8) < .05);
    assert.ok(Math.abs(phaseAfter.drawDuration + phaseAfter.emergeDuration + phaseAfter.holdDuration - 15) < 1e-8);
    assert.equal(phaseAfter.fadeDuration, phaseBefore.fadeDuration); assert.equal(phaseAfter.restDuration, phaseBefore.restDuration);
    await page.$eval('[data-history=undo]', el => el.click());
    assert.deepEqual(await page.evaluate(() => window.editorFixture.state.config.timeline), phaseBefore);
    await page.$eval('[data-history=redo]', el => el.click());
    assert.deepEqual(await page.evaluate(() => window.editorFixture.state.config.timeline), phaseAfter);
    await page.$eval('[data-history=undo]', el => el.click());
    await page.focus('[data-phase=exit]'); await page.keyboard.press('ArrowRight');
    phaseAfter = await page.evaluate(() => structuredClone(window.editorFixture.state.config.timeline));
    assert.ok(Math.abs(phaseAfter.holdDuration - 5.1) < 1e-8);
    assert.equal(phaseAfter.drawDuration, phaseBefore.drawDuration);
    await page.$eval('[data-history=undo]', el => el.click());
    assert.deepEqual(await page.evaluate(() => window.editorFixture.state.config.timeline), phaseBefore);
    await page.evaluate(() => window.editorFixture.editor.clearHistory('waiting'));
    // Чертёжные линии включаются, настраиваются и выключаются отдельно.
    await page.$eval('[data-visibility=constructionGuides]', el => el.click());
    assert.equal(await page.evaluate(() => window.editorFixture.state.scene.constructionGuides.group.visible), true);
    assert.equal(await page.$eval('[data-track=constructionGuides]', el => el.hidden), false);
    await page.$eval('[data-layer=constructionGuides]', el => el.click());
    await page.$eval('[data-appearance=color]', el => { el.focus(); el.value = '#987654'; el.dispatchEvent(new Event('input', {bubbles:true})); el.dispatchEvent(new Event('change', {bubbles:true})); });
    assert.equal(await page.evaluate(() => window.editorFixture.state.scene.constructionGuides.material.color.getHexString()), '987654');
    await page.$eval('[data-action=settings]', el => el.click());
    assert.equal(await page.evaluate(() => window.editorFixture.state.settingsSection), 'constructionGuides');
    await page.$eval('[data-visibility=constructionGuides]', el => el.click());
    assert.equal(await page.evaluate(() => window.editorFixture.state.scene.constructionGuides.group.visible), false);
    await page.evaluate(() => window.editorFixture.editor.clearHistory('waiting'));
    await page.click('[data-layer=title]');
    assert.equal(await page.$eval('[data-element=title]', el => el.classList.contains('selected')), true);
    assert.equal(await page.$eval('[data-selected-label]', el => el.textContent), 'Название');
    assert.equal(await page.$eval('[data-action=duplicate]', el => el.hidden), true);
    await page.focus('[data-layer=title]'); await page.keyboard.press('ArrowRight');
    assert.ok(await page.evaluate(() => window.editorFixture.state.config.caption.titleX) > 0, 'клавиатура не работает из списка');
    await page.click('[data-history=undo]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.caption.titleX), 0);
    assert.equal(await page.$eval('.editor-menu', el => el.hidden), false, 'инспектор закрылся после отмены');
    await page.click('[data-visibility=title]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.caption.titleVisible), false);
    assert.equal(await page.$eval('.cap-title', el => getComputedStyle(el).visibility), 'hidden');
    assert.equal(await page.$eval('[data-element=title]', el => el.hidden), true);
    assert.equal(await page.$eval('[data-visibility=title]', el => el.getAttribute('aria-pressed')), 'false');
    assert.equal(await page.$eval('.editor-hidden-note', el => el.hidden), false);
    assert.deepEqual(await page.evaluate(() => window.editorFixture.exportedTitle()), [], 'скрытый текст попал в canvas');
    await page.click('[data-history=undo]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.caption.titleVisible), true);
    await page.click('[data-history=redo]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.caption.titleVisible), false);
    await page.click('[data-history=undo]');
    await page.click('[data-visibility=logo]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.scene.logo.root.visible), false);
    await page.click('[data-history=undo]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.scene.logo.root.visible), true);
    await page.click('[data-add-text]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.textLayers.text1Present), true);
    assert.equal(await page.$eval('[data-layer=text1]', el => el.getAttribute('aria-pressed')), 'true');
    await page.$eval('[data-appearance=text]', el => { el.focus(); el.value = 'Свой текст'; el.dispatchEvent(new Event('input', {bubbles:true})); el.dispatchEvent(new Event('change', {bubbles:true})); });
    await page.$eval('[data-appearance=color]', el => { el.focus(); el.value = '#127abc'; el.dispatchEvent(new Event('input', {bubbles:true})); el.dispatchEvent(new Event('change', {bubbles:true})); });
    assert.equal(await page.$eval('[data-custom=text1]', el => el.textContent.replaceAll('\u00a0', ' ')), 'Свой текст');
    // Вписывание для отдельной надписи: история, экспорт и дублирование.
    await page.$eval('[data-appearance=text]', el => { el.focus(); el.value = 'Очень длинная собственная надпись для юбилейного торжественного вечера архитектуры и искусства'; el.dispatchEvent(new Event('input', {bubbles:true})); el.dispatchEvent(new Event('change', {bubbles:true})); });
    await page.$eval('[data-custom-autofit]', el => el.click());
    const customFit = await page.evaluate(() => {
      const el = document.querySelector('[data-custom=text1]'), cap = document.querySelector('#caption');
      const paint = window.editorFixture.exportedTitle().find(v => v.color === '#127abc');
      return {fit:Number(el.style.getPropertyValue('--custom-fit')), width:el.getBoundingClientRect().width,
        frame:cap.getBoundingClientRect().width, domSize:parseFloat(getComputedStyle(el).fontSize), exportSize:parseFloat(paint.font.match(/([\d.]+)px/)[1])};
    });
    assert.ok(customFit.fit < 1 && customFit.width <= customFit.frame * .901);
    assert.ok(Math.abs(customFit.exportSize - customFit.domSize * 1920 / customFit.frame) < .15, `автоподгонка отличается в экспорте: ${JSON.stringify(customFit)}`);
    await page.click('[data-history=undo]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.textLayers.text1AutoFit), false);
    await page.click('[data-history=redo]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.textLayers.text1AutoFit), true);
    await page.$eval('[data-appearance=text]', el => { el.focus(); el.value = 'Свой текст'; el.dispatchEvent(new Event('input', {bubbles:true})); el.dispatchEvent(new Event('change', {bubbles:true})); });

    let customPaint = await page.evaluate(() => window.editorFixture.exportedTitle());
    assert.equal(customPaint.filter(v => v.color === '#127abc').map(v => v.text).join(''), 'Свойтекст', 'новый текст отсутствует в canvas');
    assert.equal(await page.$eval('[data-timing-mode]', el => el.value), 'scene');
    await page.select('[data-timing-mode]', 'custom');
    for (const [field, value] of [['Start', 20], ['End', 80], ['Fade', 20]]) {
      await page.$eval(`[data-timing=${field}]`, (el, value) => { el.focus(); el.value = value; el.dispatchEvent(new Event('input', {bubbles:true})); el.dispatchEvent(new Event('change', {bubbles:true})); }, value);
    }
    assert.equal(await page.$eval('[data-timing-output=Start]', el => el.textContent), '20% · 4.0 с');
    await page.click('[data-action=duplicate]');
    assert.equal(await page.$eval('[data-layer=text2]', el => el.getAttribute('aria-pressed')), 'true');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.textLayers.text2Text), 'Свой текст');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.textLayers.text2AutoFit), true);
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.textLayers.text2TimingMode), 'custom');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.textLayers.text2Start), 20);
    assert.ok(await page.evaluate(() => window.editorFixture.state.config.textLayers.text2X > window.editorFixture.state.config.textLayers.text1X));
    assert.equal((await page.evaluate(() => window.editorFixture.exportedTitle())).filter(v => v.color === '#127abc').length, 2 * 'Свойтекст'.length);
    await page.click('[data-history=undo]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.textLayers.text2Present), false);
    await page.click('[data-history=redo]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.textLayers.text2Present), true);
    await page.click('[data-layer=text2]');
    await page.$eval('[data-appearance=text]', el => { el.focus(); el.value = 'Копия'; el.dispatchEvent(new Event('input', {bubbles:true})); el.dispatchEvent(new Event('change', {bubbles:true})); });
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.textLayers.text1Text), 'Свой текст');
    await page.click('[data-action=delete-text]');
    await page.click('[data-layer=text1]');
    await page.evaluate(() => window.editorFixture.setTime(2));
    assert.equal((await page.evaluate(() => window.editorFixture.exportedTitle())).filter(v => v.color === '#127abc').length, 0, 'текст виден до интервала');
    await page.evaluate(() => window.editorFixture.setTime(10));
    assert.equal((await page.evaluate(() => window.editorFixture.exportedTitle())).filter(v => v.color === '#127abc').map(v => v.text).join(''), 'Свойтекст');
    await page.evaluate(() => window.editorFixture.setTime(18));
    assert.equal((await page.evaluate(() => window.editorFixture.exportedTitle())).filter(v => v.color === '#127abc').length, 0, 'текст виден после интервала');
    await page.evaluate(() => {
      window.editorFixture.setTime(10);
      const cap = document.querySelector('#caption'); cap.style.setProperty('--drift', '10px');
      cap.style.transform = 'translate(-50%, calc(-50% + var(--drift)))';
    });
    const positionBefore = await page.$eval('[data-custom=text1]', el => el.getBoundingClientRect().top);
    await page.$eval('#caption', el => el.style.setProperty('--drift', '20px'));
    const positionAfter = await page.$eval('[data-custom=text1]', el => el.getBoundingClientRect().top);
    assert.ok(Math.abs(positionBefore - positionAfter) < 0.01, 'надпись с собственным временем унаследовала движение титра');
    assert.ok((await page.evaluate(() => window.editorFixture.exportedTitle())).filter(v => v.color === '#127abc').every(v => Math.abs(v.transformY) < 0.01), 'canvas не компенсирует движение титра');
    await page.$eval('#caption', el => { el.style.removeProperty('--drift'); el.style.transform = ''; });
    await page.$eval('[data-timing=Start]', el => { el.focus(); el.value = '95'; el.dispatchEvent(new Event('input', {bubbles:true})); el.dispatchEvent(new Event('change', {bubbles:true})); });
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.textLayers.text1End), 96);
    await page.click('[data-history=undo]');
    assert.deepEqual(await page.evaluate(() => [window.editorFixture.state.config.textLayers.text1Start, window.editorFixture.state.config.textLayers.text1End]), [20, 80]);
    await drag('[data-element=text1]', 40, 20);
    assert.ok(await page.evaluate(() => window.editorFixture.state.config.textLayers.text1X) > 0);
    await resize('text1', 35, 20);
    assert.ok(await page.evaluate(() => window.editorFixture.state.config.textLayers.text1Scale) > 1);
    await page.click('[data-visibility=text1]');
    assert.equal(await page.$eval('[data-custom=text1]', el => getComputedStyle(el).visibility), 'hidden');
    customPaint = await page.evaluate(() => window.editorFixture.exportedTitle());
    assert.equal(customPaint.filter(v => v.color === '#127abc').length, 0);
    await page.click('[data-history=undo]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.textLayers.text1Visible), true);
    await page.click('[data-action=delete-text]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.textLayers.text1Present), false);
    assert.equal(await page.$('[data-custom=text1]'), null);
    await page.click('[data-history=undo]');
    assert.equal(await page.$eval('[data-custom=text1]', el => el.textContent.replaceAll('\u00a0', ' ')), 'Свой текст');
    await page.click('[data-history=redo]');
    assert.equal(await page.$('[data-custom=text1]'), null);
    await page.evaluate(() => window.editorFixture.editor.clearHistory('waiting'));
    async function drag(selector, dx, dy) {
      const p = await page.$eval(selector, el => { const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
      await page.mouse.move(p.x, p.y); await page.mouse.down();
      await page.mouse.move(p.x + dx, p.y + dy, { steps: 3 }); await page.mouse.up();
    }
    async function resize(id, dx, dy) {
      const p = await page.$eval(`[data-element="${id}"] .editor-resize`, el => {
        const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      });
      await page.mouse.move(p.x, p.y); await page.mouse.down();
      await page.mouse.move(p.x + dx, p.y + dy, {steps: 3}); await page.mouse.up();
    }
    // Штатный ореол и реальный источник света перемещаются вместе, не меняя логотип.
    await page.$eval('[data-layer=topIllumination]', el => el.click());
    await drag('[data-element=topIllumination]', 40, 20);
    const topMoved = await page.evaluate(() => {
      const {config, scene} = window.editorFixture.state;
      return {x: config.topIllumination.offsetX, y: config.topIllumination.offsetY,
        lightX: scene.topLight.position.x, lightY: scene.topLight.position.y,
        glowX: scene.topGlow.position.x, glowY: scene.topGlow.position.y, logoX: config.logo.offsetX};
    });
    assert.ok(topMoved.x > 0 && topMoved.y < 1.5);
    assert.equal(topMoved.glowX, topMoved.x); assert.equal(topMoved.lightX, topMoved.x);
    assert.equal(topMoved.lightY, topMoved.y + .9); assert.equal(topMoved.logoX, 0);
    await page.$eval('[data-history=undo]', el => el.click());
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.topIllumination.offsetX), 0);
    await page.$eval('[data-history=redo]', el => el.click());
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.topIllumination.offsetX), topMoved.x);
    await resize('topIllumination', 0, -20);
    assert.ok(await page.evaluate(() => window.editorFixture.state.config.topIllumination.scale) > 1);
    await page.$eval('[data-action=reset-size]', el => el.click());
    await page.$eval('[data-layer=topIllumination]', el => el.focus()); await page.keyboard.press('+');
    assert.ok(await page.evaluate(() => window.editorFixture.state.config.topIllumination.scale) > 1);
    await page.$eval('[data-action=reset-size]', el => el.click());
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.topIllumination.scale), 1);
    await page.$eval('[data-appearance=color]', el => { el.focus(); el.value = '#123456'; el.dispatchEvent(new Event('input', {bubbles:true})); el.dispatchEvent(new Event('change', {bubbles:true})); });
    assert.equal(await page.evaluate(() => window.editorFixture.state.scene.topGlow.material.color.getHexString()), '123456');
    await page.$eval('[data-visibility=topIllumination]', el => el.click());
    assert.deepEqual(await page.evaluate(() => [window.editorFixture.state.scene.topLight.visible, window.editorFixture.state.scene.topGlow.visible]), [false, false]);
    await page.$eval('[data-history=undo]', el => el.click());
    assert.deepEqual(await page.evaluate(() => [window.editorFixture.state.scene.topLight.visible, window.editorFixture.state.scene.topGlow.visible]), [true, true]);
    await page.$eval('[data-action=settings]', el => el.click());
    assert.equal(await page.evaluate(() => window.editorFixture.state.settingsSection), 'topIllumination');
    await page.$eval('[data-action=reset]', el => el.click());
    assert.deepEqual(await page.evaluate(() => [window.editorFixture.state.config.topIllumination.offsetX, window.editorFixture.state.config.topIllumination.offsetY]), [0, 1.5]);
    await page.evaluate(() => window.editorFixture.editor.clearHistory('waiting'));
    await page.click('[data-layer=ringLeft]');
    assert.equal(await page.$eval('[data-color-label]', el => el.textContent), 'Цвет свечения');
    await drag('[data-element=ringLeft]', 45, 30);
    const ringMoved = await page.evaluate(() => window.editorFixture.state.config.rings);
    assert.ok(ringMoved.leftOffsetX > 0 && ringMoved.leftOffsetY < 0);
    assert.equal(ringMoved.rightOffsetX, 0); assert.equal(ringMoved.rightOffsetY, 0);
    await page.click('[data-history=undo]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.rings.leftOffsetX), 0);
    await page.click('[data-history=redo]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.rings.leftOffsetX), ringMoved.leftOffsetX);
    await page.$eval('[data-ring-scale]', el => { el.focus(); el.value = '1.4'; el.dispatchEvent(new Event('input', {bubbles:true})); el.dispatchEvent(new Event('change', {bubbles:true})); });
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.rings.leftScale), 1.4);
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.rings.rightScale), 1);
    await page.click('[data-history=undo]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.rings.leftScale), 1);
    await page.click('[data-visibility=ringLeft]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.scene.corners.sides.left.group.visible), false);
    assert.equal(await page.evaluate(() => window.editorFixture.state.scene.corners.sides.right.group.visible), true);
    await page.click('[data-history=undo]');
    await page.evaluate(() => { window.editorFixture.state.config.rings.enabled = false; window.editorFixture.editor.refresh(); });
    assert.equal(await page.$eval('[data-visibility=ringLeft]', el => el.getAttribute('aria-pressed')), 'false');
    await page.click('[data-visibility=ringLeft]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.rings.enabled), true);
    await page.click('[data-history=undo]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.rings.enabled), false);
    await page.click('[data-history=redo]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.rings.enabled), true);
    await page.click('[data-action=reset]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.rings.leftOffsetX), 0);
    await page.evaluate(() => window.editorFixture.editor.clearHistory('waiting'));
    // Построительная окружность добавляется вне сцены 02, а привязка не сдвигает её при переключении.
    await page.click('[data-add-decor]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.decor.present), true);
    assert.equal(await page.$eval('[data-layer=brandDecor]', el => el.getAttribute('aria-pressed')), 'true');
    assert.equal(await page.$eval('[data-follow-logo]', el => el.checked), false);
    await drag('[data-element=brandDecor]', 45, -20);
    const independent = await page.evaluate(() => ({...window.editorFixture.state.scene.brandDecor.group.position}));
    await drag('[data-element=logo]', 40, 15);
    const afterLogo = await page.evaluate(() => ({...window.editorFixture.state.scene.brandDecor.group.position}));
    assert.ok(Math.abs(independent.x - afterLogo.x) < 1e-8 && Math.abs(independent.y - afterLogo.y) < 1e-8, 'свободная окружность следует за логотипом');
    await page.click('[data-layer=brandDecor]');
    await page.click('[data-follow-logo]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.decor.followLogo), true);
    const followed = await page.evaluate(() => ({...window.editorFixture.state.scene.brandDecor.group.position}));
    assert.ok(Math.abs(afterLogo.x - followed.x) < 1e-8 && Math.abs(afterLogo.y - followed.y) < 1e-8, 'привязка сдвинула окружность');
    await page.click('[data-history=undo]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.decor.followLogo), false);
    await page.click('[data-history=redo]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.decor.followLogo), true);
    await drag('[data-element=logo]', 35, 10);
    const movedTogether = await page.evaluate(() => ({...window.editorFixture.state.scene.brandDecor.group.position}));
    assert.ok(Math.abs(movedTogether.x - followed.x) > 0.01, 'привязанная окружность не следует за логотипом');
    await page.click('[data-history=undo]');
    // До четырёх окружностей: отдельная привязка, цвет, размер и время.
    await page.click('[data-add-decor]');
    assert.equal(await page.$eval('[data-layer=brandDecor2]', el => el.getAttribute('aria-pressed')), 'true');
    assert.equal(await page.$eval('[data-follow-logo]', el => el.checked), false);
    await drag('[data-element=brandDecor2]', 60, 25);
    const freeSecond = await page.evaluate(() => ({...window.editorFixture.state.scene.brandDecors.brandDecor2.group.position}));
    await page.$eval('[data-appearance=color]', el => { el.focus(); el.value = '#aabbcc'; el.dispatchEvent(new Event('input', {bubbles:true})); el.dispatchEvent(new Event('change', {bubbles:true})); });
    assert.notEqual(await page.evaluate(() => window.editorFixture.state.config.decor.color), '#aabbcc');
    await resize('brandDecor2', 0, -25);
    assert.ok(await page.evaluate(() => window.editorFixture.state.config.decor2.radius) > 1.2);
    await page.click('[data-follow-logo]');
    const anchoredSecond = await page.evaluate(() => ({...window.editorFixture.state.scene.brandDecors.brandDecor2.group.position}));
    assert.ok(Math.abs(freeSecond.x - anchoredSecond.x) < 1e-8 && Math.abs(freeSecond.y - anchoredSecond.y) < 1e-8, 'вторая окружность сдвинулась при привязке');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.decor2.followLogo), true);
    await page.click('[data-history=undo]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.decor2.followLogo), false);
    await page.click('[data-history=redo]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.decor2.followLogo), true);
    await page.click('[data-action=settings]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.settingsSection), 'decor2');
    await page.select('[data-timing-mode]', 'custom');
    await page.$eval('[data-timing=Start]', el => { el.focus(); el.value = '50'; el.dispatchEvent(new Event('input', {bubbles:true})); el.dispatchEvent(new Event('change', {bubbles:true})); });
    await page.evaluate(() => window.editorFixture.setTime(7));
    assert.equal(await page.evaluate(() => window.editorFixture.state.scene.brandDecors.brandDecor.group.visible), true);
    assert.equal(await page.evaluate(() => window.editorFixture.state.scene.brandDecors.brandDecor2.group.visible), false);
    await page.evaluate(() => window.editorFixture.setTime(13));
    assert.equal(await page.evaluate(() => window.editorFixture.state.scene.brandDecors.brandDecor2.group.visible), true);
    await page.click('[data-add-decor]'); await page.click('[data-add-decor]');
    assert.equal(await page.$eval('[data-add-decor]', el => el.disabled), true);
    assert.equal(await page.$eval('[data-action=duplicate]', el => el.disabled), true, 'копирование доступно при полном лимите');
    await page.click('[data-visibility=brandDecor2]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.scene.brandDecors.brandDecor2.group.visible), false);
    assert.equal(await page.evaluate(() => window.editorFixture.state.scene.brandDecors.brandDecor.group.visible), true);
    await page.click('[data-history=undo]');
    await page.click('[data-layer=brandDecor2]'); await page.click('[data-action=delete-decor]');
    assert.equal(await page.$eval('[data-add-decor]', el => el.disabled), false);
    await page.click('[data-history=undo]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.decor2.color), '#aabbcc');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.decor2.timingStart), 50);
    await page.click('[data-history=redo]'); await page.click('[data-add-decor]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.decor2.color), '#d9b268');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.decor2.followLogo), false);
    await page.click('[data-history=undo]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.decor2.present), false);
    await page.click('[data-history=redo]');
    for (const id of ['brandDecor2', 'brandDecor3', 'brandDecor4']) {
      await page.click(`[data-layer=${id}]`); await page.click('[data-action=delete-decor]');
    }
    await page.evaluate(() => window.editorFixture.setTime(10));
    await page.click('[data-layer=brandDecor]');
    await page.click('[data-action=delete-decor]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.decor.present), false);
    assert.equal(await page.$eval('[data-add-decor]', el => el.disabled), false);
    await page.click('[data-history=undo]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.decor.present), true);
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.decor.followLogo), true);
    await page.click('[data-history=redo]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.decor.present), false);
    await page.click('[data-layer=logo]'); await page.click('[data-action=reset]');
    await page.evaluate(() => window.editorFixture.editor.clearHistory('waiting'));
    // Независимое облако частиц: добавление, движение, размер, цвет, видимость и история.
    await page.click('[data-add-cloud]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.particleCloud.present), true);
    assert.equal(await page.$eval('[data-layer=particleCloud]', el => el.getAttribute('aria-pressed')), 'true');
    await drag('[data-element=particleCloud]', 45, 25);
    let cloud = await page.evaluate(() => window.editorFixture.state.config.particleCloud);
    assert.ok(cloud.offsetX > 0 && cloud.offsetY < 0);
    const cloudPosition = await page.evaluate(() => ({...window.editorFixture.state.scene.particleCloud.group.position}));
    await drag('[data-element=logo]', 40, 15);
    const cloudAfterLogo = await page.evaluate(() => ({...window.editorFixture.state.scene.particleCloud.group.position}));
    assert.deepEqual(cloudAfterLogo, cloudPosition, 'облако сдвинулось вместе с логотипом');
    await page.click('[data-layer=particleCloud]');
    await resize('particleCloud', 0, -25);
    assert.ok(await page.evaluate(() => window.editorFixture.state.config.particleCloud.radius) > 1.2);
    await page.$eval('[data-appearance=color]', el => { el.focus(); el.value = '#12aaff'; el.dispatchEvent(new Event('input', {bubbles:true})); el.dispatchEvent(new Event('change', {bubbles:true})); });
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.particleCloud.color), '#12aaff');
    await page.click('[data-visibility=particleCloud]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.scene.particleCloud.group.visible), false);
    await page.click('[data-history=undo]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.particleCloud.enabled), true);
    await page.click('[data-action=settings]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.settingsSection), 'particleCloud');
    await page.click('[data-add-cloud]');
    assert.equal(await page.$eval('[data-layer=particleCloud2]', el => el.getAttribute('aria-pressed')), 'true');
    await drag('[data-element=particleCloud2]', 50, 25);
    await page.$eval('[data-appearance=color]', el => { el.focus(); el.value = '#e10088'; el.dispatchEvent(new Event('input', {bubbles:true})); el.dispatchEvent(new Event('change', {bubbles:true})); });
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.particleCloud.color), '#12aaff');
    assert.ok(await page.evaluate(() => window.editorFixture.state.config.particleCloud2.offsetX) > 0);
    await page.click('[data-action=settings]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.settingsSection), 'particleCloud2');
    await page.select('[data-timing-mode]', 'custom');
    await page.$eval('[data-timing=Start]', el => { el.focus(); el.value = '50'; el.dispatchEvent(new Event('input', {bubbles:true})); el.dispatchEvent(new Event('change', {bubbles:true})); });
    await page.evaluate(() => window.editorFixture.setTime(7));
    assert.equal(await page.evaluate(() => window.editorFixture.state.scene.particleClouds.particleCloud.group.visible), true);
    assert.equal(await page.evaluate(() => window.editorFixture.state.scene.particleClouds.particleCloud2.group.visible), false);
    await page.evaluate(() => window.editorFixture.setTime(13));
    assert.equal(await page.evaluate(() => window.editorFixture.state.scene.particleClouds.particleCloud2.group.visible), true);
    await page.click('[data-add-cloud]'); await page.click('[data-add-cloud]');
    assert.equal(await page.$eval('[data-add-cloud]', el => el.disabled), true);
    assert.equal(await page.$eval('[data-action=duplicate]', el => el.disabled), true, 'копирование доступно при полном лимите');
    await page.click('[data-visibility=particleCloud2]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.scene.particleClouds.particleCloud2.group.visible), false);
    assert.equal(await page.evaluate(() => window.editorFixture.state.scene.particleClouds.particleCloud.group.visible), true);
    await page.click('[data-history=undo]');
    await page.click('[data-layer=particleCloud2]'); await page.click('[data-action=delete-cloud]');
    assert.equal(await page.$eval('[data-add-cloud]', el => el.disabled), false);
    await page.click('[data-history=undo]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.particleCloud2.color), '#e10088');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.particleCloud2.timingStart), 50);
    await page.click('[data-history=redo]');
    await page.click('[data-add-cloud]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.particleCloud2.color), '#e8c77e');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.particleCloud2.timingMode), 'scene');
    await page.click('[data-history=undo]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.particleCloud2.present), false);
    await page.click('[data-history=redo]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.particleCloud2.present), true);
    for (const id of ['particleCloud2', 'particleCloud3', 'particleCloud4']) {
      await page.click(`[data-layer=${id}]`); await page.click('[data-action=delete-cloud]');
    }
    await page.evaluate(() => window.editorFixture.setTime(10));
    await page.click('[data-layer=particleCloud]');
    await page.click('[data-action=delete-cloud]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.particleCloud.present), false);
    await page.click('[data-history=undo]');
    cloud = await page.evaluate(() => window.editorFixture.state.config.particleCloud);
    assert.equal(cloud.present, true); assert.equal(cloud.color, '#12aaff');
    await page.click('[data-history=redo]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.particleCloud.present), false);
    await page.click('[data-layer=logo]'); await page.click('[data-action=reset]');
    await page.evaluate(() => window.editorFixture.editor.clearHistory('waiting'));
    // Дополнительное фоновое свечение не связано с логотипом и кругами.
    await page.click('[data-add-glow]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.backgroundGlow.present), true);
    assert.equal(await page.$eval('[data-layer=backgroundGlow]', el => el.getAttribute('aria-pressed')), 'true');
    assert.equal(await page.$eval('[data-add-glow]', el => el.disabled), false);
    await drag('[data-element=backgroundGlow]', 45, 25);
    let glow = await page.evaluate(() => window.editorFixture.state.config.backgroundGlow);
    assert.ok(glow.offsetX > 0 && glow.offsetY < 0);
    const glowPosition = await page.evaluate(() => ({...window.editorFixture.state.scene.backgroundGlow.group.position}));
    await drag('[data-element=logo]', 40, 15);
    assert.deepEqual(await page.evaluate(() => ({...window.editorFixture.state.scene.backgroundGlow.group.position})), glowPosition);
    await page.click('[data-layer=backgroundGlow]');
    await resize('backgroundGlow', 0, -25);
    assert.ok(await page.evaluate(() => window.editorFixture.state.config.backgroundGlow.radius) > 1.6);
    await page.$eval('[data-appearance=color]', el => { el.focus(); el.value = '#12aaff'; el.dispatchEvent(new Event('input', {bubbles:true})); el.dispatchEvent(new Event('change', {bubbles:true})); });
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.backgroundGlow.color), '#12aaff');
    await page.click('[data-visibility=backgroundGlow]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.scene.backgroundGlow.group.visible), false);
    await page.click('[data-history=undo]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.scene.backgroundGlow.group.visible), true);
    await page.click('[data-action=settings]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.settingsSection), 'backgroundGlow');
    await page.click('[data-action=align-x]'); await page.click('[data-action=align-y]');
    glow = await page.evaluate(() => window.editorFixture.state.config.backgroundGlow);
    assert.equal(glow.offsetX, 0); assert.equal(glow.offsetY, 0);
    await page.click('[data-add-glow]');
    assert.equal(await page.$eval('[data-layer=backgroundGlow2]', el => el.getAttribute('aria-pressed')), 'true');
    await drag('[data-element=backgroundGlow2]', 50, 25);
    await page.$eval('[data-appearance=color]', el => { el.focus(); el.value = '#e10088'; el.dispatchEvent(new Event('input', {bubbles:true})); el.dispatchEvent(new Event('change', {bubbles:true})); });
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.backgroundGlow.color), '#12aaff');
    assert.ok(await page.evaluate(() => window.editorFixture.state.config.backgroundGlow2.offsetX) > 0);
    await page.click('[data-action=settings]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.settingsSection), 'backgroundGlow2');
    await page.click('[data-add-glow]'); await page.click('[data-add-glow]');
    assert.equal(await page.$eval('[data-add-glow]', el => el.disabled), true);
    assert.equal(await page.$eval('[data-action=duplicate]', el => el.disabled), true, 'копирование доступно при полном лимите');
    await page.click('[data-visibility=backgroundGlow2]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.scene.backgroundGlows.backgroundGlow2.group.visible), false);
    assert.equal(await page.evaluate(() => window.editorFixture.state.scene.backgroundGlows.backgroundGlow.group.visible), true);
    await page.click('[data-history=undo]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.backgroundGlow2.enabled), true);
    await page.click('[data-layer=backgroundGlow2]'); await page.click('[data-action=delete-glow]');
    assert.equal(await page.$eval('[data-add-glow]', el => el.disabled), false);
    await page.click('[data-history=undo]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.backgroundGlow2.color), '#e10088');
    await page.click('[data-history=redo]');
    await page.click('[data-add-glow]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.backgroundGlow2.color), '#ffbd68');
    await page.click('[data-history=undo]'); await page.click('[data-history=redo]');
    for (const id of ['backgroundGlow2', 'backgroundGlow3', 'backgroundGlow4']) {
      await page.click(`[data-layer=${id}]`); await page.click('[data-action=delete-glow]');
    }
    await page.click('[data-layer=backgroundGlow]');
    await page.click('[data-action=delete-glow]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.backgroundGlow.present), false);
    await page.click('[data-history=undo]');
    glow = await page.evaluate(() => window.editorFixture.state.config.backgroundGlow);
    assert.equal(glow.present, true); assert.equal(glow.color, '#12aaff');
    await page.click('[data-history=redo]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.backgroundGlow.present), false);
    await page.click('[data-layer=logo]'); await page.click('[data-action=reset]');
    await page.evaluate(() => window.editorFixture.editor.clearHistory('waiting'));
    // У каждого добавляемого эффекта собственный интервал, без зависимости от соседних слоёв.
    for (const [button, id, section, group] of [
      ['decor', 'brandDecor', 'decor', 'brandDecor'],
      ['cloud', 'particleCloud', 'particleCloud', 'particleCloud'],
      ['glow', 'backgroundGlow', 'backgroundGlow', 'backgroundGlow'],
    ]) {
      await page.click(`[data-add-${button}]`);
      assert.equal(await page.$eval('[data-timing-title]', el => el.textContent), 'Время эффекта');
      assert.equal(await page.$eval('[data-timing-mode]', el => el.value), 'scene');
      await page.select('[data-timing-mode]', 'custom');
      for (const [field, value] of [['Start', 20], ['End', 80], ['Fade', 20]]) {
        await page.$eval(`[data-timing=${field}]`, (el, value) => { el.focus(); el.value = value; el.dispatchEvent(new Event('input', {bubbles:true})); el.dispatchEvent(new Event('change', {bubbles:true})); }, value);
      }
      assert.equal(await page.$eval('[data-timing-output=Start]', el => el.textContent), '20% · 4.0 с');
      for (const [time, visible] of [[2, false], [10, true], [18, false]]) {
        await page.evaluate(time => window.editorFixture.setTime(time), time);
        assert.equal(await page.evaluate(group => window.editorFixture.state.scene[group].group.visible, group), visible, `${id}: неверная видимость в ${time}`);
      }
      await page.evaluate(() => window.editorFixture.setTime(10));
      await page.$eval('[data-timing=Start]', el => { el.focus(); el.value = '95'; el.dispatchEvent(new Event('input', {bubbles:true})); el.dispatchEvent(new Event('change', {bubbles:true})); });
      assert.equal(await page.evaluate(section => window.editorFixture.state.config[section].timingEnd, section), 96);
      await page.click('[data-history=undo]');
      assert.deepEqual(await page.evaluate(section => [window.editorFixture.state.config[section].timingStart, window.editorFixture.state.config[section].timingEnd], section), [20, 80]);
      await page.click('[data-history=redo]');
      assert.equal(await page.evaluate(section => window.editorFixture.state.config[section].timingStart, section), 95);
      await page.click('[data-history=undo]');
      await page.click(`[data-action=delete-${button}]`);
      await page.click('[data-history=undo]');
      assert.equal(await page.evaluate(section => window.editorFixture.state.config[section].timingMode, section), 'custom');
      await page.click('[data-history=redo]');
    }
    // У разных свечений интервалы также независимы друг от друга.
    await page.click('[data-add-glow]');
    await page.select('[data-timing-mode]', 'custom');
    await page.$eval('[data-timing=Start]', el => { el.focus(); el.value = '20'; el.dispatchEvent(new Event('input', {bubbles:true})); el.dispatchEvent(new Event('change', {bubbles:true})); });
    await page.click('[data-add-glow]');
    await page.select('[data-timing-mode]', 'custom');
    await page.$eval('[data-timing=Start]', el => { el.focus(); el.value = '50'; el.dispatchEvent(new Event('input', {bubbles:true})); el.dispatchEvent(new Event('change', {bubbles:true})); });
    await page.evaluate(() => window.editorFixture.setTime(7));
    assert.equal(await page.evaluate(() => window.editorFixture.state.scene.backgroundGlows.backgroundGlow.group.visible), true);
    assert.equal(await page.evaluate(() => window.editorFixture.state.scene.backgroundGlows.backgroundGlow2.group.visible), false);
    await page.evaluate(() => window.editorFixture.setTime(13));
    assert.equal(await page.evaluate(() => window.editorFixture.state.scene.backgroundGlows.backgroundGlow2.group.visible), true);
    await page.click('[data-layer=backgroundGlow2]'); await page.click('[data-action=delete-glow]');
    await page.click('[data-layer=backgroundGlow]'); await page.click('[data-action=delete-glow]');
    await page.evaluate(() => window.editorFixture.setTime(10));
    await page.evaluate(() => window.editorFixture.editor.clearHistory('waiting'));
    // Дублирование эффектов копирует настройки и оставляет исходник независимым.
    for (const [button, sourceId, targetId, sourceSection, targetSection] of [
      ['decor', 'brandDecor', 'brandDecor2', 'decor', 'decor2'],
      ['cloud', 'particleCloud', 'particleCloud2', 'particleCloud', 'particleCloud2'],
      ['glow', 'backgroundGlow', 'backgroundGlow2', 'backgroundGlow', 'backgroundGlow2'],
    ]) {
      await page.click(`[data-add-${button}]`);
      await page.$eval('[data-appearance=color]', el => { el.focus(); el.value = '#34abce'; el.dispatchEvent(new Event('input', {bubbles:true})); el.dispatchEvent(new Event('change', {bubbles:true})); });
      if (button === 'decor') await page.click('[data-follow-logo]');
      await page.select('[data-timing-mode]', 'custom');
      await page.$eval('[data-timing=Start]', el => { el.focus(); el.value = '20'; el.dispatchEvent(new Event('input', {bubbles:true})); el.dispatchEvent(new Event('change', {bubbles:true})); });
      const source = await page.evaluate(section => ({...window.editorFixture.state.config[section]}), sourceSection);
      await page.click('[data-action=duplicate]');
      assert.equal(await page.$eval(`[data-layer=${targetId}]`, el => el.getAttribute('aria-pressed')), 'true');
      const copy = await page.evaluate(section => ({...window.editorFixture.state.config[section]}), targetSection);
      assert.equal(copy.present, true); assert.equal(copy.color, source.color);
      assert.equal(copy.timingMode, 'custom'); assert.equal(copy.timingStart, 20);
      assert.ok(Math.abs(copy.offsetX - source.offsetX - 0.25) < 1e-8);
      assert.ok(Math.abs(copy.offsetY - source.offsetY + 0.2) < 1e-8);
      if (button === 'decor') assert.equal(copy.followLogo, true);
      if (button === 'cloud') {
        assert.equal(copy.seed, source.seed);
        assert.equal(await page.evaluate(() => {
          const c = window.editorFixture.state.scene.particleClouds;
          return Array.from(c.particleCloud.geometry.getAttribute('position').array).every((v, i) => v === c.particleCloud2.geometry.getAttribute('position').array[i]);
        }), true, 'копия облака изменила рисунок частиц');
      }
      await page.click('[data-history=undo]');
      assert.equal(await page.evaluate(section => window.editorFixture.state.config[section].present, targetSection), false);
      assert.equal(await page.evaluate(section => window.editorFixture.state.config[section].present, sourceSection), true);
      await page.click('[data-history=redo]');
      assert.equal(await page.evaluate(section => window.editorFixture.state.config[section].present, targetSection), true);
      await page.click(`[data-layer=${targetId}]`);
      await page.$eval('[data-appearance=color]', el => { el.focus(); el.value = '#ff00aa'; el.dispatchEvent(new Event('input', {bubbles:true})); el.dispatchEvent(new Event('change', {bubbles:true})); });
      assert.equal(await page.evaluate(section => window.editorFixture.state.config[section].color, sourceSection), '#34abce');
      await page.click(`[data-action=delete-${button}]`);
      await page.click(`[data-layer=${sourceId}]`); await page.click(`[data-action=delete-${button}]`);
    }
    await page.evaluate(() => window.editorFixture.editor.clearHistory('waiting'));
    // Все элементы показаны на шкале; сценарные строки не притворяются точным интервалом.
    await page.click('[data-add-text]');
    assert.deepEqual(await page.$$eval('[data-track]:not([hidden])', els => els.map(el => el.dataset.track)), ['logo', 'title', 'subtitle', 'date', 'ringLeft', 'ringRight', 'constructionGuides', 'topIllumination', 'text1']);
    assert.equal(await page.$eval('[data-track=logo] .editor-track-auto', el => el.textContent), 'По сценарию · задать своё время');
    assert.equal(await page.$eval('[data-track=logo] .editor-track-range', el => el.hidden), true);
    assert.equal(await page.$eval('[data-track=title] .editor-track-caption-mask', el => el.hidden), false);
    assert.equal(await page.$eval('[data-track=title] .editor-track-scenario', el => el.textContent), 'Маска титра · задать своё время');
    assert.equal(await page.$eval('[data-track=title] .editor-track-range', el => el.hidden), true);
    await page.evaluate(() => window.editorFixture.setTime(13));
    assert.equal(await page.$eval('[data-track=title]', el => el.classList.contains('is-timing-active')), true);
    assert.equal(await page.$eval('[data-track=subtitle]', el => el.classList.contains('is-timing-active')), false);
    await page.evaluate(() => window.editorFixture.setTime(14));
    assert.equal(await page.$eval('[data-track=subtitle]', el => el.classList.contains('is-timing-active')), true);
    assert.equal(await page.$eval('[data-track=date]', el => el.classList.contains('is-timing-active')), false);
    await page.evaluate(() => window.editorFixture.setTime(16));
    assert.equal(await page.$eval('[data-track=title]', el => el.classList.contains('is-timing-active')), false);
    await page.evaluate(() => window.editorFixture.setTime(10));
    // Штатная строка начинает с реальных границ сценария, затем получает ручки.
    await page.click('[data-track=title] .editor-track-scenario');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.captionTiming.titleTimingMode), 'custom');
    assert.equal(await page.$eval('[data-track=title] .editor-track-range', el => el.hidden), false);
    const initialTiming = await page.evaluate(() => ({...window.editorFixture.state.config.captionTiming}));
    // Границы берутся из реальной маски титра, а не из зашитых процентов:
    // с нахлёстом (0,12 с до конца подъёма) старт сдвинулся с 63% на 62%.
    const expectedMask = await page.evaluate(async () => {
      const mod = await import('/src/editor-caption-range.js');
      const cfg = window.editorFixture.state.config, m = mod.captionMaskRange('waiting', 'title', cfg);
      return [Math.round(m.start / m.cycle * 100), Math.round(m.end / m.cycle * 100)];
    });
    assert.deepEqual([initialTiming.titleStart, initialTiming.titleEnd], expectedMask);
    const S = initialTiming.titleStart, E = initialTiming.titleEnd;
    const timing = () => page.evaluate(() => {const t=window.editorFixture.state.config.captionTiming;return [t.titleStart,t.titleEnd];});
    // Ручка старта двигает границу на процент и отменяется точечно.
    await page.focus('[data-track=title] [data-edge=start]'); await page.keyboard.press('ArrowRight');
    assert.deepEqual(await timing(), [S + 1, E]);
    await page.click('[data-history=undo]');
    assert.deepEqual(await timing(), [S, E]);
    await page.click('[data-history=undo]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.captionTiming.titleTimingMode), 'scene');
    assert.equal(await page.$eval('[data-track=title] .editor-track-range', el => el.hidden), true);
    await page.click('[data-history=redo]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.captionTiming.titleTimingMode), 'custom');
    await page.focus('[data-track=title] [data-edge=start]'); await page.keyboard.press('ArrowRight');
    assert.deepEqual(await timing(), [S + 1, E]);
    await page.select('[data-timing-mode]', 'scene');
    assert.equal(await page.$eval('[data-track=title] .editor-track-range', el => el.hidden), true);
    await page.select('[data-timing-mode]', 'custom');
    assert.deepEqual(await timing(), [S + 1, E], 'повторное включение должно сохранять собственный интервал');
    // Перемещение всей полосы не растягивает её; отмена и история остаются точечными.
    const rangeDrag = async (percent, cancel = false) => {
      const bar = await page.$eval('[data-track=title] .editor-track-range', el => { const r=el.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; });
      const lane = await page.$eval('[data-track=title] .editor-track-lane', el => el.getBoundingClientRect().width);
      await page.mouse.move(bar.x,bar.y); await page.mouse.down(); await page.mouse.move(bar.x+lane*percent/100,bar.y,{steps:4});
      if (cancel) await page.keyboard.press('Escape');
      await page.mouse.up();
    };
    await rangeDrag(-5);
    const dragged = await timing();
    assert.equal(dragged[0], S - 4, `начало сдвинулось на 5%: ${dragged}`);
    assert.equal(dragged[1] - dragged[0], E - (S + 1), 'перетаскивание не должно растягивать полосу');
    await page.click('[data-history=undo]');
    assert.deepEqual(await timing(), [S + 1, E]);
    await rangeDrag(-8, true);
    assert.deepEqual(await timing(), [S + 1, E]);
    assert.equal(await page.evaluate(() => document.body.classList.contains('editor-on')), true);
    await page.focus('[data-track=title] .editor-track-range'); await page.keyboard.press('ArrowLeft');
    const nudged = await timing();
    assert.equal(nudged[0], S, 'клавиша сдвигает полосу на процент');
    assert.equal(nudged[1] - nudged[0], E - (S + 1));
    await page.click('[data-history=undo]');
    await page.select('[data-timing-mode]', 'scene');
    await page.evaluate(() => window.editorFixture.editor.clearHistory('waiting'));
    // Принудительный gutter воспроизводит обычную (не overlay) полосу прокрутки.
    const measureTimeline = async () => page.evaluate(() => {
      const inner = el => {const r=el.getBoundingClientRect(), s=getComputedStyle(el); return [r.left+parseFloat(s.borderLeftWidth), r.right-parseFloat(s.borderRightWidth)];};
      return {ruler:inner(document.querySelector('[data-track-ruler]')), phase:inner(document.querySelector('[data-phase-lane]')),
        lane:inner(document.querySelector('[data-track=title] .editor-track-lane')),
        gutter:document.querySelector('.editor-track-list').offsetWidth-document.querySelector('.editor-track-list').clientWidth};
    });
    const assertAligned = bounds => {
      for (const key of ['phase','lane']) for (let i=0;i<2;i++) assert.ok(Math.abs(bounds.ruler[i]-bounds[key][i]) < 1, `линейка и ${key} не совпадают: ${JSON.stringify(bounds)}`);
    };
    assertAligned(await measureTimeline());
    await page.$eval('.editor-track-list', el => {el.style.scrollbarGutter='stable'; el.style.overflowY='scroll';});
    await page.waitForFunction(() => {const list=document.querySelector('.editor-track-list'), panel=document.querySelector('.editor-track-panel'); return parseFloat(panel.style.getPropertyValue('--timeline-scrollbar')) === list.offsetWidth-list.clientWidth;});
    const forcedScrollbar = await measureTimeline();
    assert.ok(forcedScrollbar.gutter > 0, 'тест не воспроизвёл полосу, занимающую место');
    assertAligned(forcedScrollbar);
    await page.$eval('.editor-track-list', el => {el.style.scrollbarGutter=''; el.style.overflowY='';});
    await page.waitForFunction(() => {const list=document.querySelector('.editor-track-list'), panel=document.querySelector('.editor-track-panel'); return parseFloat(panel.style.getPropertyValue('--timeline-scrollbar')) === list.offsetWidth-list.clientWidth;});
    assertAligned(await measureTimeline());
    const beforeTimelineSelection = await page.evaluate(() => JSON.stringify(window.editorFixture.state.config));
    await page.click('[data-track=logo] .editor-track-label');
    assert.equal(await page.$eval('[data-track=logo] .editor-track-label', el => el.getAttribute('aria-pressed')), 'true');
    assert.equal(await page.$eval('[data-selected-label]', el => el.textContent), 'Логотип');
    assert.equal(await page.evaluate(() => JSON.stringify(window.editorFixture.state.config)), beforeTimelineSelection);
    await page.$eval('[data-layer=logo]', el => el.parentElement.querySelector('.editor-visibility').click());
    assert.equal(await page.$eval('[data-track=logo] .editor-track-auto', el => el.hidden), false);
    assert.equal(await page.$eval('[data-track=logo]', el => el.classList.contains('is-hidden')), true);
    await page.$eval('[data-layer=logo]', el => el.parentElement.querySelector('.editor-visibility').click());
    await page.click('[data-track=logo] .editor-track-auto');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.logoTiming.timingMode), 'custom');
    assert.equal(await page.$eval('[data-track=logo] .editor-track-range', el => el.hidden), false);
    assert.equal(await page.$eval('[data-logo-timing-note]', el => el.hidden), false);
    await page.focus('[data-track=logo] [data-edge=start]'); await page.keyboard.press('ArrowRight');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.logoTiming.timingStart), 26);
    await page.click('[data-history=undo]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.logoTiming.timingStart), 25);
    await page.click('[data-history=undo]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.logoTiming.timingMode), 'scene');
    assert.equal(await page.$eval('[data-track=logo] .editor-track-range', el => el.hidden), true);
    await page.evaluate(() => window.editorFixture.editor.clearHistory('waiting'));
    assert.equal(await page.$eval('[data-track=constructionGuides]', el => el.hidden), false, 'выключенный штатный слой остаётся на таймлайне');
    assert.equal(await page.$eval('[data-track=text1] .editor-track-auto', el => el.hidden), false);
    await page.click('[data-track=text1] .editor-track-auto');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.textLayers.text1TimingMode), 'custom');
    await page.click('[data-history=undo]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.textLayers.text1TimingMode), 'scene');
    await page.click('[data-history=redo]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.textLayers.text1TimingMode), 'custom');
    await page.evaluate(() => window.editorFixture.setTime(10.024));
    await page.click('[data-timing-cursor=start]');
    assert.ok(Math.abs(await page.evaluate(() => window.editorFixture.state.config.textLayers.text1Start) - (10 + 1/60) * 5) < 1e-8);
    await page.click('[data-history=undo]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.textLayers.text1Start), 25);
    await page.click('[data-timing-cursor=end]');
    assert.ok(Math.abs(await page.evaluate(() => window.editorFixture.state.config.textLayers.text1End) - (10 + 1/60) * 5) < 1e-8);
    await page.click('[data-history=undo]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.textLayers.text1End), 90);
    await page.evaluate(() => window.editorFixture.setTime(0));
    await page.click('[data-timing-cursor=end]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.textLayers.text1End), 90);
    assert.equal(await page.$eval('[data-timing-error]', el => el.hidden), false);
    await page.evaluate(() => window.editorFixture.setTime(10));
    const secondsField = '[data-timing-seconds=start]';
    await page.$eval(secondsField, el => {el.focus();el.value='5.125';el.dispatchEvent(new Event('input',{bubbles:true}));});
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.textLayers.text1Start), 25.625);
    assert.equal(await page.$eval(secondsField, el => el.value), '5.125');
    await page.$eval(secondsField, el => {el.focus();el.value='19';el.dispatchEvent(new Event('input',{bubbles:true}));});
    await page.keyboard.press('Enter');
    assert.equal(await page.$eval(secondsField, el => el.getAttribute('aria-invalid')), 'true');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.textLayers.text1Start), 25.625);
    await page.keyboard.press('Escape');
    assert.equal(await page.$eval(secondsField, el => el.value), '5.125');
    assert.equal(await page.evaluate(() => document.body.classList.contains('editor-on')), true);
    await page.$eval(secondsField, el => {el.focus();el.value='6.500';el.dispatchEvent(new Event('input',{bubbles:true}));});
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.textLayers.text1Start), 25.625, 'Escape не должен применять даже допустимое значение');
    assert.equal(await page.$eval(secondsField, el => el.value), '5.125');
    await page.click('[data-history=undo]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.textLayers.text1Start), 25);
    async function dragTrack(id, edge, percent) {
      const grip = await page.$eval(`[data-track=${id}] [data-edge=${edge}]`, el => { el.scrollIntoView({block:'nearest'}); const r = el.getBoundingClientRect(); return {x:r.x + r.width/2, y:r.y + r.height/2}; });
      const lane = await page.$eval(`[data-track=${id}] .editor-track-lane`, el => { const r = el.getBoundingClientRect(); return {x:r.x, width:r.width}; });
      await page.mouse.move(grip.x, grip.y); await page.mouse.down();
      await page.mouse.move(lane.x + lane.width * percent / 100, grip.y, {steps:3}); await page.mouse.up();
    }
    await dragTrack('text1', 'start', 40);
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.textLayers.text1Start), 40);
    assert.equal(await page.$eval('[data-timing=Start]', el => Number(el.value)), 40);
    await page.click('[data-history=undo]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.textLayers.text1Start), 25);
    await page.click('[data-history=redo]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.textLayers.text1Start), 40);
    await dragTrack('text1', 'end', 60);
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.textLayers.text1End), 60);
    await dragTrack('text1', 'start', 95);
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.textLayers.text1Start), 59, 'границы пересеклись');
    await page.click('[data-history=undo]');
    const startGrip = await page.$eval('[data-track=text1] [data-edge=start]', el => { const r = el.getBoundingClientRect(); return {x:r.x + r.width/2, y:r.y + r.height/2}; });
    const lane = await page.$eval('[data-track=text1] .editor-track-lane', el => { const r = el.getBoundingClientRect(); return {x:r.x, width:r.width}; });
    await page.mouse.move(startGrip.x, startGrip.y); await page.mouse.down();
    await page.mouse.move(lane.x + lane.width * .30, startGrip.y);
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.textLayers.text1Start), 30);
    await page.keyboard.press('Escape'); await page.mouse.up();
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.textLayers.text1Start), 40, 'Escape не отменил жест');
    await page.focus('[data-track=text1] [data-edge=start]'); await page.keyboard.press('ArrowRight');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.textLayers.text1Start), 41);
    await page.click('[data-history=undo]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.textLayers.text1Start), 40);
    await page.focus('[data-track=text1] .editor-track-range'); await page.keyboard.down('Shift'); await page.keyboard.press('ArrowRight'); await page.keyboard.up('Shift');
    assert.deepEqual(await page.evaluate(() => {const t=window.editorFixture.state.config.textLayers;return [t.text1Start,t.text1End];}),[45,65]);
    await page.click('[data-history=undo]');
    assert.deepEqual(await page.evaluate(() => {const t=window.editorFixture.state.config.textLayers;return [t.text1Start,t.text1End];}),[40,60]);
    await page.click('[data-add-decor]');
    assert.deepEqual(await page.$$eval('[data-track]:not([hidden])', els => els.map(el => el.dataset.track)), ['logo', 'title', 'subtitle', 'date', 'ringLeft', 'ringRight', 'constructionGuides', 'topIllumination', 'brandDecor', 'text1']);
    await page.click('[data-track=brandDecor] .editor-track-auto');
    await dragTrack('brandDecor', 'start', 70);
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.decor.timingStart), 70);
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.textLayers.text1Start), 40);
    for (const [button, id, section] of [['cloud', 'particleCloud', 'particleCloud'], ['glow', 'backgroundGlow', 'backgroundGlow']]) {
      await page.click(`[data-add-${button}]`);
      await page.click(`[data-track=${id}] .editor-track-auto`);
      await dragTrack(id, 'end', 65);
      assert.equal(await page.evaluate(section => window.editorFixture.state.config[section].timingEnd, section), 65);
      await page.click('[data-history=undo]');
      assert.equal(await page.evaluate(section => window.editorFixture.state.config[section].timingEnd, section), 90);
      await page.click('[data-history=redo]');
      assert.equal(await page.evaluate(section => window.editorFixture.state.config[section].timingEnd, section), 65);
      await page.click(`[data-layer=${id}]`); await page.click(`[data-action=delete-${button}]`);
    }
    const rulerBounds = await page.$eval('[data-track-ruler]', el => { const r = el.getBoundingClientRect(); return {x:r.x, y:r.y+r.height/2, width:r.width}; });
    await page.mouse.click(rulerBounds.x + rulerBounds.width * .5, rulerBounds.y);
    assert.ok(Math.abs(await page.evaluate(() => window.editorFixture.state.time) - 10) < 0.01);
    assert.equal(await page.evaluate(() => window.editorFixture.state.scene.brandDecor.group.visible), false);
    assert.equal(await page.$eval('[data-track-time]', el => el.textContent), '10.0 / 20.0 с');
    assert.equal(await page.$eval('[data-track-timecode]', el => el.value), '00:00:10:00');
    await page.click('[data-frame-step="1"]');
    assert.ok(Math.abs(await page.evaluate(() => window.editorFixture.state.time) - (10 + 1/60)) < 1e-8);
    assert.equal(await page.$eval('[data-track-timecode]', el => el.value), '00:00:10:01');
    await page.click('[data-frame-step="-1"]');
    assert.ok(Math.abs(await page.evaluate(() => window.editorFixture.state.time) - 10) < 1e-8);
    await page.focus('[data-track-ruler]'); await page.keyboard.down('Alt'); await page.keyboard.press('ArrowRight'); await page.keyboard.up('Alt');
    assert.equal(await page.$eval('[data-track-timecode]', el => el.value), '00:00:10:01');
    const timecode = '[data-track-timecode]';
    await page.$eval(timecode, el => { el.focus(); el.value = '00:00:12:03'; el.dispatchEvent(new Event('input', {bubbles:true})); });
    await page.keyboard.press('Enter');
    assert.ok(Math.abs(await page.evaluate(() => window.editorFixture.state.time) - (12 + 3/60)) < 1e-8);
    await page.$eval(timecode, el => { el.focus(); el.value = '00:00:20:00'; });
    await page.keyboard.press('Enter');
    assert.equal(await page.$eval(timecode, el => el.getAttribute('aria-invalid')), 'true');
    assert.ok(Math.abs(await page.evaluate(() => window.editorFixture.state.time) - (12 + 3/60)) < 1e-8);
    await page.keyboard.press('Escape');
    assert.equal(await page.$eval(timecode, el => el.value), '00:00:12:03');
    assert.equal(await page.evaluate(() => document.body.classList.contains('editor-on')), true);
    await page.evaluate(() => { window.editorFixture.state.config.timeline.startDelay = 3; });
    await page.mouse.click(rulerBounds.x + rulerBounds.width * .5, rulerBounds.y);
    assert.ok(Math.abs(await page.evaluate(() => window.editorFixture.state.time) - 13) < 0.01, 'перемотка не учитывает задержку');
    await page.$eval(timecode, el => { el.focus(); el.value = '00:00:02:30'; });
    await page.keyboard.press('Enter');
    assert.ok(Math.abs(await page.evaluate(() => window.editorFixture.state.time) - 5.5) < 1e-8, 'ввод таймкода не учитывает задержку');
    await page.$eval(timecode, el => { el.focus(); el.value = '00:00:01:00'; el.blur(); });
    assert.equal(await page.$eval(timecode, el => el.value), '00:00:02:30', 'потеря фокуса должна отменять ввод');
    await page.evaluate(() => { window.editorFixture.state.config.timeline.startDelay = 0; });
    await page.focus('[data-track-ruler]'); await page.keyboard.press('End');
    assert.ok(await page.evaluate(() => window.editorFixture.state.time) < 20);
    assert.ok(await page.evaluate(() => window.editorFixture.state.time) > 19.9);
    await page.evaluate(() => { window.editorFixture.state.config.timeline.holdDuration = 15; window.editorFixture.editor.refresh(); });
    assert.equal(await page.$eval('[data-tick="25"]', el => el.textContent), '7.5 с');
    await page.evaluate(() => { window.editorFixture.state.config.timeline.holdDuration = 5; window.editorFixture.setTime(10); });
    await page.click('[data-layer=brandDecor]'); await page.click('[data-action=delete-decor]');
    await page.click('[data-layer=text1]'); await page.click('[data-action=delete-text]');
    assert.equal(await page.$eval('.editor-track-empty', el => el.hidden), true);
    assert.equal(await page.$eval('[data-track=text1]', el => el.hidden), true);
    await page.evaluate(() => window.editorFixture.editor.clearHistory('waiting'));
    const titleCenter = await page.$eval('[data-element=title]', el => {
      const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    await page.mouse.move(titleCenter.x, titleCenter.y); await page.mouse.down();
    await page.mouse.move(titleCenter.x + 40, titleCenter.y + 20);
    await page.keyboard.press('Escape'); await page.mouse.up();
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.caption.titleX), 0, 'прерванный жест не отменён');
    assert.equal(await page.$eval('[data-history=undo]', el => el.disabled), true, 'прерванный жест попал в историю');
    await page.mouse.move(titleCenter.x, titleCenter.y); await page.mouse.down();
    await page.mouse.move(titleCenter.x + 4, titleCenter.y);
    assert.equal(await page.$eval('.editor-guide-x', el => el.hidden), false, 'нет направляющей');
    assert.ok(Math.abs(await page.evaluate(() => window.editorFixture.state.config.caption.titleX)) < 1e-6, 'центр не притянулся');
    await page.mouse.up();
    assert.equal(await page.$eval('.editor-guide-x', el => el.hidden), true, 'направляющая не скрылась');
    await page.mouse.move(titleCenter.x, titleCenter.y); await page.keyboard.down('Alt'); await page.mouse.down();
    await page.mouse.move(titleCenter.x + 4, titleCenter.y); await page.mouse.up(); await page.keyboard.up('Alt');
    assert.ok(await page.evaluate(() => window.editorFixture.state.config.caption.titleX) > 0, 'Alt не отключает прилипание');
    await page.click('[data-element=title]'); await page.click('[data-action=align-x]');
    assert.ok(Math.abs(await page.evaluate(() => window.editorFixture.state.config.caption.titleX)) < 1e-6);
    await page.click('[data-element=title]'); await page.click('[data-action=align-y]');
    assert.ok(Math.abs(await page.evaluate(() => window.editorFixture.state.config.caption.titleY) + 0.05) < 1e-4);
    await page.click('[data-element=title]'); await page.click('[data-action=reset]');
    const fontBefore = await page.evaluate(() => window.editorFixture.measureTitleFont());
    await resize('title', 60, 30);
    const titleScale = await page.evaluate(() => window.editorFixture.state.config.caption.titleScale);
    const fontAfter = await page.evaluate(() => window.editorFixture.measureTitleFont());
    assert.ok(titleScale > 1 && fontAfter > fontBefore);
    assert.ok(Math.abs(fontAfter / fontBefore - titleScale) < 0.01, 'масштаб текста в экспорте отличается от превью');
    await page.click('[data-history=undo]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.caption.titleScale), 1, 'один жест не отменился целиком');
    await page.click('[data-history=redo]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.caption.titleScale), titleScale);
    await page.keyboard.down('Control'); await page.keyboard.press('z'); await page.keyboard.up('Control');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.caption.titleScale), 1);
    await page.keyboard.down('Control'); await page.keyboard.down('Shift'); await page.keyboard.press('z');
    await page.keyboard.up('Shift'); await page.keyboard.up('Control');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.caption.titleScale), titleScale);
    await page.focus('#typing'); await page.keyboard.type('abc');
    await page.keyboard.down('Control'); await page.keyboard.press('z'); await page.keyboard.up('Control');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.caption.titleScale), titleScale, 'отмена в поле изменила сцену');
    await page.$eval('#typing', el => el.blur());
    await page.click('[data-element=title]'); await page.click('[data-action=reset-size]');
    await page.click('[data-element=title]');
    const textField = '[data-appearance=text]';
    await page.focus(textField); await page.keyboard.down('Control'); await page.keyboard.press('a'); await page.keyboard.up('Control');
    await page.keyboard.type('Новый <текст>');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.caption.titleText), 'Новый <текст>');
    assert.equal(await page.$eval('.cap-title', el => el.textContent.replaceAll('\u00a0', ' ')), 'Новый <текст>');
    assert.equal(await page.$$('.cap-title img').then(list => list.length), 0, 'HTML попал в текст');
    await page.$eval('[data-appearance=color]', el => { el.focus(); el.value = '#12a6e8'; el.dispatchEvent(new Event('input', {bubbles:true})); el.dispatchEvent(new Event('change', {bubbles:true})); });
    const rendered = await page.evaluate(() => window.editorFixture.exportedTitle());
    assert.equal(rendered.map(v => v.text).join(''), 'Новый<текст>');
    assert.ok(rendered.filter(v => v.text !== ' ').every(v => v.color === '#12a6e8'), 'цвет в экспорте не совпал');
    await page.click('[data-history=undo]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.caption.titleColor), null);
    await page.click('[data-history=undo]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.caption.titleText), 'рЦиркуль');
    await page.click('[data-history=redo]'); await page.click('[data-history=redo]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.caption.titleColor), '#12a6e8');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.caption.titleText), 'Новый <текст>');
    await page.click('[data-element=title]'); await page.click('[data-action=reset-text]');
    await page.click('[data-element=title]'); await page.click('[data-action=reset-color]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.caption.titleText), 'рЦиркуль');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.caption.titleColor), null);
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.caption.titleScale), 1);
    await page.click('[data-element=logo]');
    await resize('logo', 40, 30);
    assert.ok(await page.evaluate(() => window.editorFixture.state.config.logo.scale) > 1);
    await page.click('[data-element=logo]'); await page.click('[data-action=reset-size]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.logo.scale), 1);
    await drag('[data-element=logo]', 60, 20);
    await drag('[data-element=subtitle]', 60, 10);
    await drag('[data-element=date]', -30, 15);
    const cfg = await page.evaluate(() => window.editorFixture.state.config);
    assert.ok(cfg.logo.offsetX > 0 && cfg.logo.offsetY < 1.1);
    assert.ok(cfg.caption.subtitleX > 0 && cfg.caption.subtitleY > 0);
    assert.ok(cfg.caption.dateX < 0 && cfg.caption.dateY > 0);
    await page.click('[data-element=subtitle]');
    await page.click('[data-action=reset]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.caption.subtitleX), 0);
    await page.evaluate(() => window.editorFixture.activate('photo-pause'));
    assert.deepEqual(await page.$$eval('[data-layer]:not([hidden])', els => els.map(el => el.dataset.layer)), ['logo', 'ringLeft', 'ringRight', 'constructionGuides', 'topIllumination', 'photoLabel', 'photoAperture']);
    assert.deepEqual(await page.$$eval('[data-track]:not([hidden])', els => els.map(el => el.dataset.track)), ['logo', 'ringLeft', 'ringRight', 'constructionGuides', 'topIllumination', 'photoLabel', 'photoAperture']);
    assert.equal(await page.$eval('[data-track=title]', el => el.hidden), true, 'дорожки другой сцены остались на шкале');
    assert.equal(await page.$eval('.editor-empty', el => el.hidden), false, 'старый выбранный элемент остался в другой сцене');
    await page.evaluate(() => window.editorFixture.setTime(2));
    assert.equal(await page.evaluate(() => window.editorFixture.state.scene.aperture.group.visible), true);
    await page.$eval('[data-layer=photoAperture]', el => el.click());
    assert.equal(await page.$eval('[data-element=photoAperture]', el => el.hidden), false);
    await page.focus('[data-layer=photoAperture]'); await page.keyboard.press('ArrowRight');
    assert.ok(await page.evaluate(() => window.editorFixture.state.config.photo.apertureOffsetX) > 0);
    await page.$eval('[data-history=undo]', el => el.click());
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.photo.apertureOffsetX), 0);
    await page.$eval('[data-visibility=photoAperture]', el => el.click());
    assert.equal(await page.evaluate(() => window.editorFixture.state.scene.aperture.group.visible), false);
    await page.$eval('[data-history=undo]', el => el.click());
    assert.equal(await page.evaluate(() => window.editorFixture.state.scene.aperture.group.visible), true);
    await page.evaluate(() => { const f=window.editorFixture; f.state.config.photo.textEnabled=true; f.state.scene.circularLabel.visible=true; f.setTime(10); f.editor.clearHistory('photo-pause'); });
    await page.click('[data-visibility=photoLabel]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.photo.textEnabled), false);
    assert.equal(await page.evaluate(() => window.editorFixture.state.scene.circularLabel.visible), false);
    await page.click('[data-history=undo]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.photo.textEnabled), true);
    await page.click('[data-add-decor]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.decor.present), true);
    assert.equal(await page.$eval('[data-layer=brandDecor]', el => el.hidden), false);
    await page.click('[data-action=delete-decor]');
    await page.click('[data-add-cloud]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.particleCloud.present), true);
    assert.equal(await page.$eval('[data-layer=particleCloud]', el => el.hidden), false);
    await page.click('[data-action=delete-cloud]');
    await page.click('[data-add-glow]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.backgroundGlow.present), true);
    assert.equal(await page.$eval('[data-layer=backgroundGlow]', el => el.hidden), false);
    await page.click('[data-action=delete-glow]');
    await page.evaluate(() => window.editorFixture.editor.clearHistory('photo-pause'));
    await page.click('[data-add-text]');
    const photoPaint = await page.evaluate(() => window.editorFixture.exportedTitle());
    assert.equal(photoPaint.map(v => v.text).join(''), 'Новыйтекст', 'дополнительный текст фотопаузы отсутствует в canvas');
    await page.click('[data-action=delete-text]');
    await page.evaluate(() => window.editorFixture.editor.clearHistory('photo-pause'));
    await page.click('[data-element=photoLabel]');
    await page.$eval('[data-appearance=text]', el => { el.focus(); el.value = 'КАДРЫ'; el.dispatchEvent(new Event('input', {bubbles:true})); el.dispatchEvent(new Event('change', {bubbles:true})); });
    await page.$eval('[data-appearance=color]', el => { el.focus(); el.value = '#33aa66'; el.dispatchEvent(new Event('input', {bubbles:true})); el.dispatchEvent(new Event('change', {bubbles:true})); });
    const editedPhoto = await page.evaluate(() => window.editorFixture.state.config.photo);
    assert.equal(editedPhoto.text, 'КАДРЫ'); assert.equal(editedPhoto.textColor, '#33aa66');
    assert.equal(editedPhoto.color, '#e8c77e', 'цвет уголков не должен меняться');
    await page.click('[data-element=photoLabel]'); await page.click('[data-action=reset-text]');
    await page.click('[data-element=photoLabel]'); await page.click('[data-action=reset-color]');
    await page.evaluate(() => window.editorFixture.editor.clearHistory('photo-pause'));
    assert.equal(await page.$eval('[data-history=undo]', el => el.disabled), true, 'история чужой сцены доступна');
    await resize('photoLabel', 0, -25);
    assert.ok(await page.evaluate(() => window.editorFixture.state.config.photo.radius) > 1.75);
    await page.click('[data-element=photoLabel]'); await page.click('[data-action=reset-size]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.photo.radius), 1.75);
    await drag('[data-element=photoLabel]', 50, 20);
    const photo = await page.evaluate(() => window.editorFixture.state.config);
    assert.ok(photo.photo.offsetX > 0 && photo.photo.offsetY < 0);
    assert.equal(photo.logo.offsetX, 0);
    await page.click('[data-history=undo]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.photo.offsetX), 0);
    await page.click('[data-history=redo]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.photo.offsetX), photo.photo.offsetX);
    await page.click('[data-element=photoLabel]');
    await page.click('[data-action=settings]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.settingsSection), 'photo');
    await page.click('[data-element=photoLabel]');
    await page.click('[data-action=reset]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.photo.offsetX), 0);
    await page.evaluate(() => window.editorFixture.activate('brand'));
    assert.deepEqual(await page.$$eval('[data-layer]:not([hidden])', els => els.map(el => el.dataset.layer)), ['logo', 'title', 'ringLeft', 'ringRight', 'constructionGuides', 'topIllumination', 'photoLabel', 'brandDecor']);
    // Круговой текст доступен для выбора и редактирования и во втором ролике.
    await page.$eval('[data-layer=photoLabel]', el => el.click());
    assert.equal(await page.$eval('[data-selected-label]', el => el.textContent), 'Надпись по кругу');
    assert.equal(await page.$eval('[data-element=photoLabel]', el => el.hidden), false);
    await page.$eval('[data-visibility=photoLabel]', el => el.click());
    assert.equal(await page.evaluate(() => window.editorFixture.state.scene.circularLabel.visible), false);
    await page.$eval('[data-history=undo]', el => el.click());
    assert.equal(await page.evaluate(() => window.editorFixture.state.scene.circularLabel.visible), true);
    const circularBrandResult = await page.evaluate(async () => {
      const THREE = await import('/node_modules/three/build/three.module.js');
      const { CircularLabel } = await import('/src/circular-label.js');
      const { BRAND_DEFAULTS } = await import('/src/scenes/brand.js');
      const config = structuredClone(BRAND_DEFAULTS), scene = new THREE.Scene();
      const label = new CircularLabel(scene, {capabilities: {getMaxAnisotropy: () => 1}});
      label.update(config, {local: 5}, 1, {position: {x: .3, y: -.2}});
      const hiddenByDefault = !label.mesh.visible;
      config.photo.textEnabled = true; label.update(config, {local: 5}, 1, {position: {x: .3, y: -.2}});
      const result = {hiddenByDefault, text: config.photo.text, x: label.mesh.position.x, y: label.mesh.position.y,
        rotation: label.mesh.rotation.z, visible: label.mesh.visible, opacity: label.mesh.material.opacity,
        attached: scene.children.includes(label.mesh)};
      label.dispose(); result.removed = !scene.children.includes(label.mesh);
      return result;
    });
    assert.equal(circularBrandResult.text, 'ЯНТАРНЫЙ ЦИРКУЛЬ'); assert.equal(circularBrandResult.x, .3); assert.equal(circularBrandResult.y, -.2);
    assert.ok(Math.abs(circularBrandResult.rotation + .175) < 1e-12); assert.equal(circularBrandResult.opacity, .82);
    assert.ok(circularBrandResult.hiddenByDefault && circularBrandResult.visible && circularBrandResult.attached && circularBrandResult.removed);
    await page.evaluate(() => window.editorFixture.editor.clearHistory('brand'));
    await page.click('[data-add-decor]');
    assert.equal(await page.$eval('[data-layer=brandDecor2]', el => el.getAttribute('aria-pressed')), 'true');
    assert.equal(await page.evaluate(() => window.editorFixture.state.scene.brandDecors.brandDecor.group.visible), true);
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.decor.followLogo), true);
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.decor2.followLogo), false);
    await page.click('[data-action=delete-decor]');
    await page.click('[data-visibility=brandDecor]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.decor.enabled), false);
    assert.equal(await page.evaluate(() => window.editorFixture.state.scene.brandDecor.group.visible), false);
    await page.click('[data-history=undo]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.decor.enabled), true);
    await resize('brandDecor', 0, -25);
    assert.ok(await page.evaluate(() => window.editorFixture.state.config.decor.radius) > 1.2);
    await page.click('[data-element=brandDecor]'); await page.click('[data-action=reset-size]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.decor.radius), 1.2);
    await drag('[data-element=brandDecor]', -45, 20);
    const brand = await page.evaluate(() => window.editorFixture.state.config);
    assert.ok(brand.decor.offsetX < 0 && brand.decor.offsetY < 0);
    assert.equal(brand.logo.offsetX, 0);
    await page.click('[data-element=brandDecor]');
    await page.click('[data-action=settings]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.settingsSection), 'decor');
    await page.click('[data-element=brandDecor]');
    await page.click('[data-action=reset]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.decor.offsetX), 0);
    await page.evaluate(() => window.editorFixture.editor.invalidateHistory('brand', 'colors', 'gold'));
    assert.equal(await page.$eval('[data-history=undo]', el => el.disabled), false, 'несвязанная настройка стёрла историю');
    await page.evaluate(() => window.editorFixture.editor.invalidateHistory('brand', 'decor', 'offsetX'));
    assert.equal(await page.$eval('[data-history=undo]', el => el.disabled), true, 'связанная внешняя правка не очистила историю');
    // Повторное использование удалённого слота создаёт новую надпись поверх остальных.
    await page.$eval('[data-add-text]', el => el.click());
    await page.$eval('[data-add-text]', el => el.click());
    await page.$eval('[data-layer=text1]', el => el.click());
    await page.$eval('[data-action=delete-text]', el => el.click());
    await page.$eval('[data-add-text]', el => el.click());
    assert.deepEqual(await page.$$eval('.cap-custom', els => els.map(el => el.dataset.custom)), ['text2', 'text1']);
    // Надписи накладываются в одной позиции; порядок DOM и команд canvas совпадает.
    for (const [id, text, color] of [['text1', 'А', '#112233'], ['text2', 'Б', '#445566']]) {
      await page.$eval(`[data-layer=${id}]`, el => el.click());
      for (const [field, value] of [['text', text], ['color', color]]) {
        await page.$eval(`[data-appearance=${field}]`, (el, value) => { el.focus(); el.value = value; el.dispatchEvent(new Event('input', {bubbles:true})); el.dispatchEvent(new Event('change', {bubbles:true})); }, value);
      }
    }
    const stack = async () => page.evaluate(() => ({
      dom: [...document.querySelectorAll('.cap-custom')].map(el => el.dataset.custom),
      list: [...document.querySelectorAll('.editor-layer-entry:not([hidden]) [data-layer^=text]')].map(el => el.dataset.layer),
      tracks: [...document.querySelectorAll('.editor-track-row:not([hidden])[data-track^=text]')].map(el => el.dataset.track),
      paint: window.editorFixture.exportedTitle().filter(v => ['#112233', '#445566'].includes(v.color)).map(v => v.text),
    }));
    assert.deepEqual(await stack(), {dom: ['text2', 'text1'], list: ['text1', 'text2'], tracks: ['text1', 'text2'], paint: ['Б', 'А']});
    assert.equal(await page.$eval('[data-action=text-front]', el => el.disabled), false);
    assert.equal(await page.$eval('[data-action=text-back]', el => el.disabled), true);
    await page.evaluate(() => { window.stackGlyph = document.querySelector('[data-custom=text2] .cap-glyph'); });
    await page.$eval('[data-action=text-front]', el => el.click());
    assert.deepEqual(await stack(), {dom: ['text1', 'text2'], list: ['text2', 'text1'], tracks: ['text2', 'text1'], paint: ['А', 'Б']});
    assert.equal(await page.evaluate(() => window.stackGlyph === document.querySelector('[data-custom=text2] .cap-glyph')), true, 'перестановка пересоздала глифы');
    assert.equal(await page.$eval('[data-action=text-front]', el => el.disabled), true);
    await page.$eval('[data-history=undo]', el => el.click());
    assert.deepEqual((await stack()).paint, ['Б', 'А']);
    await page.$eval('[data-history=redo]', el => el.click());
    assert.deepEqual((await stack()).paint, ['А', 'Б']);
    await page.$eval('[data-action=text-back]', el => el.click());
    assert.deepEqual((await stack()).paint, ['Б', 'А']);
    for (let i = 0; i < 6; i++) await page.$eval('[data-add-text]', el => el.click());
    assert.equal(await page.$eval('[data-add-text]', el => el.disabled), true, 'лимит текстовых слоёв не работает');
    assert.equal(await page.$eval('[data-action=duplicate]', el => el.disabled), true);
    await page.$eval('[data-layer=text2]', el => el.click());
    await page.$eval('[data-action=delete-text]', el => el.click());
    assert.equal(await page.$eval('[data-add-text]', el => el.disabled), false);
    for (const id of ['text1', 'text3', 'text4', 'text5', 'text6', 'text7', 'text8']) {
      await page.$eval(`[data-layer=${id}]`, el => el.click());
      await page.$eval('[data-action=delete-text]', el => el.click());
    }
    await page.evaluate(() => window.editorFixture.editor.clearHistory('brand'));
    // Реальные классы эффектов без WebGL: позиция кольца, боке и частиц используют общие настройки.
    const effectState = await page.evaluate(async () => {
      const { Corners, Particles } = await import('/src/fx.js');
      const { SolarBokeh } = await import('/src/bokeh.js');
      const { WAITING_DEFAULTS } = await import('/src/scenes/waiting.js');
      const { computePhase } = await import('/src/timeline.js');
      const cfg = structuredClone(WAITING_DEFAULTS);
      cfg.rings.leftOffsetX = 1.25; cfg.rings.leftOffsetY = -0.5;
      cfg.rings.leftScale = 1.4; cfg.rings.leftVisible = false;
      const corners = new Corners(), particles = new Particles(), bokeh = new SolarBokeh();
      const pos = corners.update(8, cfg, 5, 3, 1, 0);
      particles.update(8, cfg, 5, 3, 1, 1080, Math.PI / 6, pos, cfg.rings.radius, 1, 1);
      bokeh.update(8, computePhase(8, cfg.timeline), cfg, pos);
      const result = {
        leftX: pos.left.x, leftY: pos.left.y, rightX: pos.right.x,
        leftVisible: corners.sides.left.group.visible, rightVisible: corners.sides.right.group.visible,
        scale: corners.sides.left.group.scale.x, particlesLeft: particles.left.visible,
        particlesRight: particles.right.visible, particleRadius: particles.left.material.uniforms.uRadius.value,
        dustLeft: particles.dust.material.uniforms.uCornStrengthL.value,
        dustRight: particles.dust.material.uniforms.uCornStrengthR.value,
        bokehLeft: bokeh.discs[0].mesh.visible, bokehRight: bokeh.discs[5].mesh.visible,
      };
      particles.dispose(); bokeh.dispose(); return result;
    });
    assert.ok(Math.abs(effectState.leftX - (-4.4 + 1.25)) < 1e-8);
    assert.ok(Math.abs(effectState.leftY - (2.52 - .5)) < 1e-8);
    assert.ok(Math.abs(effectState.rightX - 4.4) < 1e-8);
    assert.equal(effectState.scale, 1.4); assert.equal(effectState.leftVisible, false); assert.equal(effectState.rightVisible, true);
    assert.equal(effectState.particlesLeft, false); assert.equal(effectState.particlesRight, true);
    assert.ok(Math.abs(effectState.particleRadius - 1.35 * 1.25 * 1.4) < 1e-8);
    assert.equal(effectState.dustLeft, 0); assert.equal(effectState.dustRight, 1);
    assert.equal(effectState.bokehLeft, false); assert.equal(effectState.bokehRight, true);
    // Поиск и фильтр меняют только список: выделение и строки таймлайна остаются доступны.
    const filtered = await page.evaluate(() => {
      const search = document.querySelector('[data-layer-search]');
      search.value = 'название'; search.dispatchEvent(new Event('input', {bubbles:true}));
      const titleVisible = !document.querySelector('[data-layer=title]').hidden;
      const logoHidden = document.querySelector('[data-layer=logo]').hidden;
      const count = document.querySelector('[data-layer-count]').textContent;
      search.value = 'нет такого слоя'; search.dispatchEvent(new Event('input', {bubbles:true}));
      const empty = !document.querySelector('[data-layer-empty]').hidden;
      search.value = ''; search.dispatchEvent(new Event('input', {bubbles:true}));
      document.querySelector('[data-layer-filter=text]').click();
      const textFilter = !document.querySelector('[data-layer=title]').hidden && document.querySelector('[data-layer=logo]').hidden;
      const tracksRemain = [...document.querySelectorAll('.editor-track-row')].some(row => !row.hidden);
      document.querySelector('[data-layer-filter=all]').click();
      return {titleVisible, logoHidden, count, empty, textFilter, tracksRemain};
    });
    assert.ok(filtered.titleVisible && filtered.logoHidden && filtered.empty && filtered.textFilter && filtered.tracksRemain, JSON.stringify(filtered));
    assert.match(filtered.count, /^1 \/ /);
    await page.setViewport({width: 1440, height: 900});
    const studioLayout = await page.evaluate(() => {
      const rect = selector => document.querySelector(selector).getBoundingClientRect();
      const frame = rect('#stage'), left = rect('.editor-layers'), right = rect('.editor-inspector'), timeline = rect('.editor-track-panel');
      return {frameLeft: frame.left, frameRight: frame.right, frameBottom: frame.bottom, leftRight: left.right, rightLeft: right.left, timelineTop: timeline.top, timelineHeight: timeline.height};
    });
    assert.ok(studioLayout.leftRight <= studioLayout.frameLeft && studioLayout.frameRight <= studioLayout.rightLeft && studioLayout.frameBottom <= studioLayout.timelineTop + 1, JSON.stringify(studioLayout));
    assert.ok(studioLayout.timelineHeight >= 200);
    // Разделители меняют место и для DOM, и для кадра; ограничения защищают композицию.
    await page.setViewport({width: 1130, height: 950});
    await page.waitForFunction(() => document.querySelector('[data-workspace-resize=layers]').getAttribute('aria-valuenow') === '176');
    const handle = await page.$('[data-workspace-resize=layers]');
    const handleRect = await handle.boundingBox();
    await page.mouse.move(handleRect.x + 5, handleRect.y + 100);
    await page.mouse.down(); await page.mouse.move(handleRect.x + 105, handleRect.y + 100, {steps: 3}); await page.mouse.up();
    assert.equal(await page.$eval('[data-workspace-resize=layers]', el => el.getAttribute('aria-valuenow')), '276');
    let resized = await page.evaluate(() => {
      const r = s => document.querySelector(s).getBoundingClientRect();
      return {left: r('.editor-layers').right, frameLeft: r('#stage').left, frameRight: r('#stage').right, right: r('.editor-inspector').left, bottom: r('#stage').bottom, track: r('.editor-track-panel').top};
    });
    assert.ok(resized.left <= resized.frameLeft && resized.frameRight <= resized.right && resized.track - resized.bottom >= 0 && resized.track - resized.bottom <= 8, JSON.stringify(resized));
    await page.focus('[data-workspace-resize=inspector]');
    await page.keyboard.press('ArrowLeft');
    assert.equal(await page.$eval('[data-workspace-resize=inspector]', el => el.getAttribute('aria-valuenow')), '236');
    const movedHandle = await (await page.$('[data-workspace-resize=layers]')).boundingBox();
    await page.mouse.move(movedHandle.x + 5, movedHandle.y + 100);
    await page.mouse.down(); await page.mouse.move(movedHandle.x + 35, movedHandle.y + 100);
    await page.keyboard.press('Escape'); await page.mouse.up();
    assert.equal(await page.$eval('[data-workspace-resize=layers]', el => el.getAttribute('aria-valuenow')), '276');
    assert.equal(await page.evaluate(() => document.body.classList.contains('editor-on')), true);
    await page.$eval('[data-workspace-resize=layers]', el => el.dispatchEvent(new MouseEvent('dblclick', {bubbles:true})));
    await page.$eval('[data-workspace-resize=inspector]', el => el.dispatchEvent(new MouseEvent('dblclick', {bubbles:true})));
    assert.equal(await page.$eval('[data-workspace-resize=layers]', el => el.getAttribute('aria-valuenow')), '176');
    assert.equal(await page.$eval('[data-workspace-resize=inspector]', el => el.getAttribute('aria-valuenow')), '226');
    // Ширина со скриншота: обе панели помещаются рядом с кадром, а не поверх него.
    await page.setViewport({width: 978, height: 938});
    await page.waitForFunction(() => parseFloat(document.querySelector('#stage').style.left) === 464);
    const mediumLayout = await page.evaluate(() => {
      const rect = selector => document.querySelector(selector).getBoundingClientRect();
      const frame = rect('#stage'), left = rect('.editor-layers'), right = rect('.editor-inspector'), timeline = rect('.editor-track-panel');
      return {frameLeft: frame.left, frameRight: frame.right, frameBottom: frame.bottom,
        leftRight: left.right, rightLeft: right.left, timelineTop: timeline.top,
        leftDisplay: getComputedStyle(document.querySelector('.editor-layers')).display,
        rightDisplay: getComputedStyle(document.querySelector('.editor-inspector')).display};
    });
    assert.notEqual(mediumLayout.leftDisplay, 'none'); assert.notEqual(mediumLayout.rightDisplay, 'none');
    assert.ok(mediumLayout.leftRight <= mediumLayout.frameLeft && mediumLayout.frameRight <= mediumLayout.rightLeft, `панели перекрывают кадр: ${JSON.stringify(mediumLayout)}`);
    assert.ok(mediumLayout.frameBottom <= mediumLayout.timelineTop + 1, 'таймлайн перекрывает кадр на средней ширине');
    await page.setViewport({width: 700, height: 700});
    await page.waitForFunction(() => parseFloat(document.querySelector('#stage').style.left) === 350);
    const mobileLayout = await page.evaluate(() => ({frame: document.querySelector('#stage').getBoundingClientRect().bottom, timeline: document.querySelector('.editor-track-panel').getBoundingClientRect().top}));
    assert.ok(mobileLayout.frame <= mobileLayout.timeline + 1, `таймлайн перекрывает кадр на узком экране: ${JSON.stringify(mobileLayout)}`);
    assert.equal(await page.$eval('.editor-layers', el => getComputedStyle(el).display), 'none');
    await page.click('[data-panel=layers]');
    assert.notEqual(await page.$eval('.editor-layers', el => getComputedStyle(el).display), 'none');
    const mobilePanels = await page.evaluate(() => ({layers: document.querySelector('.editor-layers').getBoundingClientRect().bottom, timeline: document.querySelector('.editor-track-panel').getBoundingClientRect().top}));
    assert.ok(mobilePanels.layers <= mobilePanels.timeline, `панель слоёв перекрыта таймлайном: ${JSON.stringify(mobilePanels)}`);
    await page.click('[data-layer=title]');
    assert.notEqual(await page.$eval('.editor-inspector', el => getComputedStyle(el).display), 'none');
    assert.equal(await page.$eval('.editor-layers', el => getComputedStyle(el).display), 'none');
    assert.equal(await page.$eval('[data-panel=inspector]', el => el.getAttribute('aria-expanded')), 'true');
    await page.click('[data-panel=inspector]');
    assert.equal(await page.$eval('.editor-inspector', el => getComputedStyle(el).display), 'none');
    await page.click('.editor-toggle');
    assert.equal(await page.evaluate(() => document.body.classList.contains('editor-on')), false);
    const restored = await page.$eval('#stage', el => { const r = el.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; });
    assert.ok(Math.abs(restored.x - 350) < 1 && Math.abs(restored.y - 350) < 1, 'кадр не вернулся после закрытия');
    await page.evaluate(() => window.editorFixture.activate('finale'));
    const placement = await page.evaluate(() => window.editorFixture.finalePlacement());
    assert.ok(Math.abs(placement.x - .5) < .005 && Math.abs(placement.y - .5) < .005, `последняя строка не по центру: ${JSON.stringify(placement)}`);
    assert.ok(Number.isFinite(placement.exportY) && Math.abs(placement.exportY - placement.expectedY) < 1, `экспорт не совпадает с предпросмотром: ${JSON.stringify(placement)}`);
    await page.evaluate(() => window.editorFixture.createFinaleSettings());
    for (const [key, value] of [['subtitleDrawDuration', '2'], ['subtitleMoveDuration', '2.5'], ['subtitleHoldDuration', '3'], ['subtitleEraseDuration', '1.5']]) {
      await page.$eval(`[data-key="finale.${key}"]`, (el, value) => { el.value = value; el.dispatchEvent(new Event('input', {bubbles:true})); }, value);
    }
    assert.deepEqual(await page.evaluate(() => {
      const {subtitleDrawDuration, subtitleMoveDuration, subtitleHoldDuration, subtitleEraseDuration} = window.finaleSettings.configs.finale.finale;
      return [subtitleDrawDuration, subtitleMoveDuration, subtitleHoldDuration, subtitleEraseDuration];
    }), [2, 2.5, 3, 1.5]);
    assert.equal(await page.evaluate(() => window.finaleSettings.changes.length), 4);
    await page.$eval('[data-key="typography.titleTracking"]', el => {el.value = '.08'; el.dispatchEvent(new Event('input', {bubbles:true}));});
    await page.$eval('[data-key="typography.subtitleTracking"]', el => {el.value = '.12'; el.dispatchEvent(new Event('input', {bubbles:true}));});
    assert.deepEqual(await page.evaluate(() => [window.finaleSettings.configs.finale.typography.titleTracking, window.finaleSettings.configs.finale.typography.subtitleTracking]), [.08, .12]);
    assert.equal(await page.evaluate(() => window.finaleSettings.configs.brand.typography.titleTracking), 0);
    assert.equal(await page.$('[data-key="typography.dateTracking"]'), null);

    assert.match(await page.$eval('[data-section=finale] .cfg-io-hint', el => el.textContent), /сокращаются/);
    await page.$eval('[data-cfg-scene=brand]', el => el.click());
    assert.equal(await page.$('[data-key="finale.subtitleHoldDuration"]'), null);
    await page.$eval('[data-cfg-scene=finale]', el => el.click());
    assert.equal(await page.$eval('[data-key="finale.subtitleHoldDuration"]', el => Number(el.value)), 3);
    assert.equal(await page.$eval('[data-key="typography.subtitleTracking"]', el => Number(el.value)), .12);
    assert.deepEqual(errors, []);
    console.log('Редактор: таймлайн, история, дублирование, текст, эффекты и перенос — OK; запас для букв — OK');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
