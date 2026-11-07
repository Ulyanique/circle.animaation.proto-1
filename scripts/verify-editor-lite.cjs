// Быстрая DOM-проверка редактора и вертикального запаса букв без WebGL/скриншотов.
// Запустите Vite и затем URL=http://localhost:5175 node scripts/verify-editor-lite.cjs
const assert = require('node:assert/strict');
const { launchBrowser } = require('./browser.cjs');
(async () => {
  const browser = await launchBrowser({ width: 1440, height: 900 });
  try {
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
    // Шкала показывает добавленные элементы; сценический режим не притворяется интервалом.
    await page.click('[data-add-text]');
    assert.deepEqual(await page.$$eval('[data-track]:not([hidden])', els => els.map(el => el.dataset.track)), ['text1']);
    assert.equal(await page.$eval('[data-track=text1] .editor-track-auto', el => el.hidden), false);
    await page.click('[data-track=text1] .editor-track-auto');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.textLayers.text1TimingMode), 'custom');
    await page.click('[data-history=undo]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.textLayers.text1TimingMode), 'scene');
    await page.click('[data-history=redo]');
    assert.equal(await page.evaluate(() => window.editorFixture.state.config.textLayers.text1TimingMode), 'custom');
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
    await page.click('[data-add-decor]');
    assert.deepEqual(await page.$$eval('[data-track]:not([hidden])', els => els.map(el => el.dataset.track)), ['brandDecor', 'text1']);
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
    await page.evaluate(() => { window.editorFixture.state.config.timeline.startDelay = 3; });
    await page.mouse.click(rulerBounds.x + rulerBounds.width * .5, rulerBounds.y);
    assert.ok(Math.abs(await page.evaluate(() => window.editorFixture.state.time) - 13) < 0.01, 'перемотка не учитывает задержку');
    await page.evaluate(() => { window.editorFixture.state.config.timeline.startDelay = 0; });
    await page.focus('[data-track-ruler]'); await page.keyboard.press('End');
    assert.ok(await page.evaluate(() => window.editorFixture.state.time) < 20);
    assert.ok(await page.evaluate(() => window.editorFixture.state.time) > 19.9);
    await page.evaluate(() => { window.editorFixture.state.config.timeline.holdDuration = 15; window.editorFixture.editor.refresh(); });
    assert.equal(await page.$eval('[data-tick="25"]', el => el.textContent), '7.5 с');
    await page.evaluate(() => { window.editorFixture.state.config.timeline.holdDuration = 5; window.editorFixture.setTime(10); });
    await page.click('[data-layer=brandDecor]'); await page.click('[data-action=delete-decor]');
    await page.click('[data-layer=text1]'); await page.click('[data-action=delete-text]');
    assert.equal(await page.$eval('.editor-track-empty', el => el.hidden), false);
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
    assert.equal(await page.$eval('.editor-track-empty', el => el.hidden), false, 'дорожки другой сцены остались на шкале');
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
    await page.evaluate(() => { window.editorFixture.setTime(10); window.editorFixture.editor.clearHistory('photo-pause'); });
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
      const result = {text: config.photo.text, x: label.mesh.position.x, y: label.mesh.position.y,
        rotation: label.mesh.rotation.z, visible: label.mesh.visible, opacity: label.mesh.material.opacity,
        attached: scene.children.includes(label.mesh)};
      label.dispose(); result.removed = !scene.children.includes(label.mesh);
      return result;
    });
    assert.equal(circularBrandResult.text, 'ЯНТАРНЫЙ ЦИРКУЛЬ'); assert.equal(circularBrandResult.x, .3); assert.equal(circularBrandResult.y, -.2);
    assert.ok(Math.abs(circularBrandResult.rotation + .175) < 1e-12); assert.equal(circularBrandResult.opacity, .82);
    assert.ok(circularBrandResult.visible && circularBrandResult.attached && circularBrandResult.removed);
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
    assert.match(await page.$eval('[data-section=finale] .cfg-io-hint', el => el.textContent), /сокращаются/);
    await page.$eval('[data-cfg-scene=brand]', el => el.click());
    assert.equal(await page.$('[data-key="finale.subtitleHoldDuration"]'), null);
    await page.$eval('[data-cfg-scene=finale]', el => el.click());
    assert.equal(await page.$eval('[data-key="finale.subtitleHoldDuration"]', el => Number(el.value)), 3);
    assert.deepEqual(errors, []);
    console.log('Редактор: таймлайн, история, дублирование, текст, эффекты и перенос — OK; запас для букв — OK');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
