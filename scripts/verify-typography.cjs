// Вертикальный ритм и читаемость титра (P1-6): равные оптические промежутки,
// минимальные толщины линий и контраст строк при приглушённой яркости.
// npm run dev; npm run verify:typography
const assert = require("node:assert/strict");
const { launchBrowser } = require("./browser.cjs");
const URL_ = process.env.URL || "http://localhost:5173/";

// Ниже этого отношения «чернила» к фону строка на LED-стене с дальних мест
// сливается: проверяем по тому же кадру, что уходит в запись.
const MIN_CONTRAST = 1.6;

(async () => {
  const browser = await launchBrowser({ width: 1920, height: 1080 });
  try {
    for (const scene of ["waiting", "finale"]) {
      const page = await browser.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      try {
        await page.goto(`${URL_}?scene=${scene}`, { waitUntil: "networkidle0", timeout: 120000 });
        await page.waitForFunction(() => document.body.classList.contains("boot-ready"), { timeout: 240000 });
        const result = await page.evaluate(async () => {
          await document.fonts.ready;
          const L = window.__logo;
          L.cfg.playback.paused = true;
          window.requestAnimationFrame = () => 0;
          const tl = L.cfg.timeline;
          L.renderAt(tl.startDelay + tl.drawDuration + tl.emergeDuration + tl.holdDuration * 0.7, 1 / 60);
          const canvas = L.scene.captionLayer.canvas;
          const W = canvas.width, H = canvas.height;
          const data = canvas.getContext("2d").getImageData(0, 0, W, H).data;
          // Полосы «чернил»: строки текста и линии-разделители.
          const rows = new Array(H).fill(0);
          for (let y = 0; y < H; y++) {
            let ink = 0;
            for (let x = 0; x < W; x += 2) if (data[(y * W + x) * 4 + 3] > 24) ink++;
            rows[y] = ink;
          }
          const bands = [];
          let start = -1;
          for (let y = 0; y < H; y++) {
            const on = rows[y] > 2;
            if (on && start < 0) start = y;
            if (!on && start >= 0) { bands.push([start, y - 1]); start = -1; }
          }
          if (start >= 0) bands.push([start, H - 1]);
          const merged = [];
          for (const band of bands) {
            const last = merged[merged.length - 1];
            if (last && band[0] - last[1] < H * 0.012) last[1] = band[1];
            else merged.push([...band]);
          }
          // Внутри строки берём «типичную» яркость знаков, иначе крайние
          // антиалиасные пиксели дают ложное сравнение.
          const bandContrast = ([top, bottom]) => {
            const values = [];
            for (let y = top; y <= bottom; y++) for (let x = 0; x < W; x += 2) {
              const i = (y * W + x) * 4;
              if (data[i + 3] > 200) values.push((data[i] + data[i + 1] + data[i + 2]) / 3);
            }
            values.sort((a, b) => a - b);
            const ink = values.length ? values[Math.floor(values.length * 0.9)] : 0;
            return +(ink / Math.max(1, 40)).toFixed(2);
          };
          // Границы знака в кадре — чтобы понять, что титр стоит под ним.
          const mesh = L.scene.logo.mesh;
          mesh.geometry.computeBoundingBox();
          const box = mesh.geometry.boundingBox;
          let logoBottom = -1;
          for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
            const p = box.min.clone().set(x, y, z).applyMatrix4(mesh.matrixWorld).project(L.scene.camera);
            logoBottom = Math.max(logoBottom, (1 - (p.y + 1) / 2));
          }
          const norm = merged.map(([a, b]) => [+(a / H).toFixed(4), +((b + 1) / H).toFixed(4)]);
          const gaps = [];
          for (let i = 1; i < norm.length; i++) gaps.push(+(norm[i][0] - norm[i - 1][1]).toFixed(4));
          // Толщина самих линий (без ромба в центре): считаем непрозрачные
          // подряд идущие пиксели в колонке на 40% ширины. Тоньше 2 px при
          // 1080p линия на LED-стене превращается в муар.
          const ruleThickness = (band) => {
            const x = Math.round(W * 0.40);
            let count = 0;
            for (let y = band[0] - 4; y <= band[1] + 4; y++) {
              if (data[(y * W + x) * 4 + 3] > 24) count++;
            }
            const scale = 1080 / H;
            return +(count * scale).toFixed(2);
          };
          const rules = merged.filter(([a, b]) => (b - a) / H < 0.02).map(ruleThickness);
          return { scene: L.activeScene.id, height: H, bands: norm, gaps, rules,
            contrast: merged.map(bandContrast), logoBottom: +logoBottom.toFixed(4),
            subtitleTracking: getComputedStyle(document.querySelector("#caption .cap-sub")).letterSpacing,
            subtitleFont: parseFloat(getComputedStyle(document.querySelector("#caption .cap-sub")).fontSize),
            subtitleSize: parseFloat(getComputedStyle(document.querySelector("#caption .cap-sub")).fontSize) / H,
            dateSize: parseFloat(getComputedStyle(document.querySelector("#caption .cap-date")).fontSize) / H };
        });
        assert.equal(result.scene, scene);
        assert.deepEqual(errors, []);
        // Дата должна читаться: не меньше 1,9% высоты кадра.
        assert.ok(result.dateSize >= 0.019, `${scene}: дата мелкая (${result.dateSize.toFixed(3)} высоты)`);
        // Трекинг подзаголовка не разрывает слово на буквы.
        assert.ok(parseFloat(result.subtitleTracking) / result.subtitleFont <= 0.24,
          `${scene}: трекинг подзаголовка ${result.subtitleTracking} при кегле ${result.subtitleFont}`);
        assert.ok(result.contrast.every((c) => c >= MIN_CONTRAST),
          `${scene}: низкий контраст строк ${JSON.stringify(result.contrast)}`);
        assert.ok(result.bands[0][0] > result.logoBottom,
          `${scene}: титр перекрывает знак (${JSON.stringify(result.bands[0])} против ${result.logoBottom})`);
        // Ритм: промежутки вокруг линий-разделителей близки по величине.
        const rules = result.bands.filter(([a, b]) => (b - a) < 0.02);
        if (rules.length === 2) {
          const idx = result.bands.map((b, i) => (b[1] - b[0] < 0.02 ? i : -1)).filter((i) => i >= 0);
          const above = result.bands[idx[0] - 1], below = result.bands[idx[0] + 1];
          const nextAbove = result.bands[idx[1] - 1], nextBelow = result.bands[idx[1] + 1];
          const gapsAroundFirst = [above ? +(rules[0][0] - above[1]).toFixed(4) : null, +(below[0] - rules[0][1]).toFixed(4)];
          const gapsAroundSecond = [+(nextAbove[1] ? +(rules[1][0] - nextAbove[1]).toFixed(4) : null), +(nextBelow[0] - rules[1][1]).toFixed(4)];
          const all = [...gapsAroundFirst, ...gapsAroundSecond].filter((v) => v !== null);
          // Допуск: промежутки не должны отличаться более чем в 1,8 раза.
          assert.ok(Math.max(...all) / Math.min(...all) <= 1.8,
            `${scene}: неровный ритм титра ${JSON.stringify({ gapsAroundFirst, gapsAroundSecond })}`);
          // Линии должны быть толще 2 px при 1080p, иначе на LED виден муар.
          assert.ok(result.rules.every((thickness) => thickness >= 2),
            `${scene}: линия тоньше 2 px при 1080p ${JSON.stringify(result.rules)}`);
        }
        // Камера: подъезд на удержании задан настройкой, ноль по умолчанию не
        // меняет прежний кадр и не зависит от порядка перемотки.
        const dolly = await page.evaluate(() => {
          const L = window.__logo;
          const tl = L.cfg.timeline;
          const holdStart = tl.drawDuration + tl.emergeDuration;
          const at = (p) => tl.startDelay + holdStart + tl.holdDuration * p;
          const zs = (amount) => {
            L.cfg.camera.holdDolly = amount;
            return [0, 0.5, 1].map((p) => { L.renderAt(at(p), 1 / 60); return +L.scene.camera.position.z.toFixed(4); });
          };
          const off = zs(0);
          const on = zs(0.03);
          L.renderAt(at(0.9), 1 / 60);
          const first = L.scene.camera.position.z;
          L.renderAt(at(0.3), 1 / 60);
          L.renderAt(at(0.9), 1 / 60);
          const again = L.scene.camera.position.z;
          L.cfg.camera.holdDolly = 0;
          return { off, on, seekStable: Math.abs(first - again) < 1e-9 };
        });
        assert.ok(dolly.off.every((z) => Math.abs(z - dolly.off[0]) < 1e-9),
          `${scene}: нулевой подъезд не должен двигать камеру ${JSON.stringify(dolly.off)}`);
        assert.ok(dolly.on[2] > dolly.on[0] + 0.01, `${scene}: подъезд камеры не включается ${JSON.stringify(dolly.on)}`);
        assert.ok(dolly.seekStable, `${scene}: подъезд камеры зависит от порядка перемотки`);
        console.log({ scene, bands: result.bands, gaps: result.gaps, rules: result.rules,
          contrast: result.contrast, dateSize: +result.dateSize.toFixed(4), dolly });
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error("FAIL", error); process.exitCode = 1; });
