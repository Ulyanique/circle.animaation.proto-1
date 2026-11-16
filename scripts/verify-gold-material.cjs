// P0-4: материал золота, процедурные карты, янтарная вставка, контактная тень и детерминизм.
const assert = require('node:assert/strict');
const { launchBrowser } = require('./browser.cjs');

(async () => {
  const browser = await launchBrowser({ width: 960, height: 540 });
  try {
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', e => { if (e.type() === 'error') errors.push(e.text()); });
    const url = new URL(process.env.URL || 'http://localhost:5173/');
    url.searchParams.set('scene', 'intro');
    await page.goto(url.href, { waitUntil: 'networkidle0', timeout: 120000 });
    await page.waitForFunction(() => document.body.classList.contains('boot-ready'), { timeout: 240000 });

    const res = await page.evaluate(async () => {
      await document.fonts.ready;
      window.requestAnimationFrame = () => 0;
      const L = window.__logo;
      L.cfg.playback.paused = true;
      // Считаем на 640×360, чтобы не упираться в software-WebGL, но видеть окно оголовка.
      L.scene.renderer.setSize(640, 360, false);
      L.scene.composer.setSize(640, 360);

      const grab = (time) => {
        const frame = L.compositeFrameAt(time, 1 / 60, false);
        const c = document.createElement('canvas');
        c.width = 640; c.height = 360;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(frame, 0, 0, 640, 360);
        return ctx.getImageData(0, 0, 640, 360).data;
      };
      const digest = async (bytes) => {
        const buf = await crypto.subtle.digest('SHA-256', bytes);
        return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
      };
      const countDiff = (a, b, threshold, box) => {
        let count = 0;
        const x0 = box ? box[0] : 0, y0 = box ? box[1] : 0;
        const x1 = box ? box[2] : 640, y1 = box ? box[3] : 360;
        for (let y = y0; y < y1; y++) {
          for (let x = x0; x < x1; x++) {
            const i = (y * 640 + x) * 4;
            const d = Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
            if (d > threshold) count++;
          }
        }
        return count;
      };

      const tHold = 11.0;
      const amberDefault = L.cfg.logo.amber;
      const shadowDefault = L.cfg.lights.shadowOpacity;

      const base = grab(tHold);
      const baseHash = await digest(base);

      // Янтарная вставка: amber=0 выключает и mesh, и срез на гранях, и ореол.
      L.cfg.logo.amber = 0;
      const amberOff = grab(tHold);
      const insetVisibleOff = Boolean(L.scene.logo.amberInset?.visible);
      L.cfg.logo.amber = amberDefault;

      // Повторный seek через другую фазу должен вернуть тот же самый кадр.
      grab(3.2);
      const repeat = grab(tHold);
      const repeatHash = await digest(repeat);
      const insetVisibleOn = Boolean(L.scene.logo.amberInset?.visible);

      // Контактная тень: shadowOpacity=0 меняет пиксели вокруг знака, но не ломает повтор.
      L.cfg.lights.shadowOpacity = 0;
      const shadowOff = grab(tHold);
      L.cfg.lights.shadowOpacity = shadowDefault;

      // Процедурные карты: отключение карт меняет микроотражения на лице знака.
      const mat = L.scene.logo.material;
      const rMap = mat.roughnessMap, nMap = mat.normalMap;
      mat.roughnessMap = null; mat.normalMap = null; mat.needsUpdate = true;
      const mapsOff = grab(tHold);
      mat.roughnessMap = rMap; mat.normalMap = nMap; mat.needsUpdate = true;

      // Белый клиппинг в зоне логотипа недопустим.
      let whiteClip = 0;
      for (let y = 10; y < 220; y++) {
        for (let x = 220; x < 420; x++) {
          const i = (y * 640 + x) * 4;
          if (base[i] >= 253 && base[i + 1] >= 253 && base[i + 2] >= 253) whiteClip++;
        }
      }

      // Окно медальона циркуля при 640×360 находится примерно в [290..350, 35..100].
      const medallionDiff = countDiff(base, amberOff, 12, [290, 35, 350, 100]);
      const shadowDiff = countDiff(base, shadowOff, 6, [200, 15, 450, 230]);
      const mapsDiff = countDiff(base, mapsOff, 4, [230, 25, 410, 200]);

      return {
        baseHash,
        repeatHash,
        insetVisibleOn,
        insetVisibleOff,
        hasMaps: Boolean(rMap && nMap),
        medallionDiff,
        shadowDiff,
        mapsDiff,
        whiteClip,
      };
    });

    assert.deepEqual(errors, []);
    assert.equal(res.hasMaps, true, 'процедурные карты шероховатости и нормалей подключены');
    assert.equal(res.insetVisibleOn, true, 'янтарная вставка включена при amber > 0');
    assert.equal(res.insetVisibleOff, false, 'янтарная вставка скрывается при amber = 0');
    assert.ok(res.medallionDiff > 80, `янтарная вставка в окне оголовка незаметна: ${res.medallionDiff}`);
    assert.ok(res.shadowDiff > 400, `контактная тень под знаком незаметна: ${res.shadowDiff}`);
    assert.ok(res.mapsDiff > 50, `процедурные карты золота не влияют на поверхность: ${res.mapsDiff}`);
    assert.equal(res.whiteClip, 0, `белый пересвет на металле: ${res.whiteClip} пикс.`);
    assert.equal(res.baseHash, res.repeatHash, 'кадр с картами, янтарём и тенью должен быть детерминирован');
    console.log(`Материал P0-4: медальон Δ=${res.medallionDiff} пикс., тень Δ=${res.shadowDiff} пикс., карты Δ=${res.mapsDiff} пикс., клиппинг 0, seek побитовый — OK`);
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
