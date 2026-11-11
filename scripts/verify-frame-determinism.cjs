// Реальный WebGL + DOM/canvas-композит, одни времена в двух порядках.
// URL=http://localhost:5175 npm run verify:frame-determinism
// SCENES=waiting,finale RENDER_WIDTH=1920 — выбор сцен и полное разрешение WebGL.
// По умолчанию WebGL рендерится в 320×180 для скорости; экспортный композит — 1920×1080.
const assert = require('node:assert/strict');
const {launchBrowser} = require('./browser.cjs');
const validScenes = ['waiting', 'brand', 'photo-pause', 'finale'];
const scenes = (process.env.SCENES || validScenes.join(',')).split(',').map(s => s.trim()).filter(Boolean);
const renderWidth = Number(process.env.RENDER_WIDTH || 320);
const modified = process.env.MODIFIED === '1';
if (!scenes.length || scenes.some(id => !validScenes.includes(id))) throw new Error('SCENES: waiting, brand, photo-pause, finale');
if (!Number.isInteger(renderWidth) || renderWidth < 160 || renderWidth > 1920 || renderWidth % 16 !== 0)
  throw new Error('RENDER_WIDTH должен быть кратен 16 и находиться в диапазоне 160–1920');

(async () => {
  const browser = await launchBrowser({width:960, height:540});
  try {
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    const url = new URL(process.env.URL || 'http://localhost:5173');
    url.searchParams.set('scene', modified ? validScenes.find(id => id !== scenes[0]) : scenes[0]);
    await page.goto(url.href, {waitUntil:'networkidle0', timeout:120000});
    await page.waitForFunction(() => document.body.classList.contains('boot-ready'), {timeout:240000});
    await page.evaluate(async () => {
      await document.fonts.ready;
      window.requestAnimationFrame = () => 0;
    });
    for (const id of scenes) {
      const meta = await page.evaluate(({id, renderWidth, modified}) => {
        const L = window.__logo;
        if (modified) {
          const cfg = L.getSceneConfig(id);
          Object.assign(cfg.timeline, {drawDuration:3.1, emergeDuration:2.1, holdDuration:8.4, fadeDuration:2.6, restDuration:1.7, startDelay:.35, speed:1.4});
          Object.assign(cfg.textLayers, {text1Present:true, text1Visible:true, text1Text:'Проверка кадра', text1X:.12, text1Y:.3,
            text1TimingMode:'custom', text1Start:10, text1End:90, text1Fade:20, text1RevealStyle:'fade-up', text1Opacity:.75});
          Object.assign(cfg.particleCloud, {present:true, enabled:true, offsetX:.4, timingMode:'custom', timingStart:10, timingEnd:90});
          Object.assign(cfg.backgroundGlow, {present:true, enabled:true, offsetX:-.3, intensity:.7, timingMode:'custom', timingStart:10, timingEnd:90});
          cfg.effectOrder.enabled = true;
          cfg.effectOrder.particleCloud = -1;
        }
        if (L.activeScene.id !== id) {
          // В тесте сравниваются отдельные сцены, а не межсценовые переходы.
          L.getSceneConfig(id).transition.duration = 0;
          if (!L.switchScene(id)) throw new Error(`Не удалось открыть сцену ${id}`);
        }
        L.cfg.playback.paused = true;
        const renderer = L.scene.renderer;
        renderer.setSize(renderWidth, renderWidth * 9 / 16, false);
        L.scene.composer.setSize(renderWidth, renderWidth * 9 / 16);
        const cycle = L.runtime.cycle, start = L.cfg.timeline.startDelay;
        const times = [.2, .5, .8].map(fraction => start + cycle * fraction);
        return {id:L.activeScene.id, times, size:[renderer.domElement.width, renderer.domElement.height],
          textPresent: !modified || document.querySelector('[data-custom="text1"]')?.dataset.text === 'Проверка кадра'};
      }, {id, renderWidth, modified});
      assert.equal(meta.id, id);
      assert.ok(meta.textPresent, `${id}: изменённая надпись не появилась в DOM`);
      const captures = await page.evaluate(async times => {
        const hash = async time => {
          // Используем именно композит WebGL + DOM/canvas из кода экспорта.
          const canvas = window.__logo.compositeFrameAt(time, 1 / 60);
          const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
          const digest = await crypto.subtle.digest('SHA-256', pixels);
          return [...new Uint8Array(digest)].map(v => v.toString(16).padStart(2, '0')).join('');
        };
        const first = [], second = [];
        for (const index of [0, 1, 2]) first[index] = await hash(times[index]);
        for (const index of [1, 0, 2]) second[index] = await hash(times[index]);
        return {first, second};
      }, meta.times);
      const differences = meta.times.filter((_, i) => captures.first[i] !== captures.second[i]);
      assert.deepEqual(differences, [], `${id}: изображения зависят от предыдущего времени; проблемные секунды: ${differences.join(', ')}`);
      assert.ok(new Set(captures.first).size > 1, `${id}: все проверенные кадры одинаковы, проверка неинформативна`);
      assert.deepEqual(errors, [], `${id}: ошибки браузера: ${errors.join('; ')}`);
      console.log(`${id}${modified ? ' (изменённые настройки)' : ''}: ${meta.times.map(t => t.toFixed(2)).join(', ')} с, WebGL ${meta.size.join('×')}, повторные кадры совпадают`);
    }
    console.log('Сравнение не проверяет MP4-кодер, визуальное качество, все времена или настройки.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
