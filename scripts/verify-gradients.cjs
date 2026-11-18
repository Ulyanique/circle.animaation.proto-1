// Полосы на тёмных градиентах и совпадение яркости титра в превью и в кадре
// экспорта (P2-10). Полосы заметны на LED-стене раньше, чем на мониторе,
// поэтому проверяем не «есть ли дизеринг», а реальную гладкость рампы.
// npm run dev; npm run verify:gradients
const assert = require("node:assert/strict");
const { launchBrowser } = require("./browser.cjs");
const URL_ = process.env.URL || "http://localhost:5173/";

// Ступени на тёмной рампе. Фон здесь намеренно зернистый (плёнка + дизеринг),
// поэтому критерий — не «идеальный ноль», а отсутствие широких полос: медиана
// около 1 LSB и 90-й процентиль не выше 5 LSB.
const MAX_MEDIAN_STEP = 2.5;
const MAX_P90_STEP = 5;
// Уникальных уровней в полосе: меньше 20 — рампа вырождается в несколько зон.
const MIN_LEVELS = 20;
// Допустимая разница яркости титра между DOM-превью и canvas-слоем, который
// уходит в кадр: подложка/контур могут сдвигать среднее на несколько единиц,
// но не более. Порог ловит рассинхрон цвета, а не сглаживание.
const MAX_CAPTION_DELTA = 40;

(async () => {
  const browser = await launchBrowser({ width: 1280, height: 720, protocolTimeout: 300000 });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${URL_}?scene=intro`, { waitUntil: "networkidle0", timeout: 120000 });
    await page.waitForFunction(() => document.body.classList.contains("boot-ready"), { timeout: 240000 });

    const result = await page.evaluate(async () => {
      await document.fonts.ready;
      const L = window.__logo;
      L.cfg.playback.paused = true;
      window.requestAnimationFrame = () => 0;
      const tl = L.cfg.timeline;
      const t = tl.startDelay + tl.drawDuration + tl.emergeDuration + tl.holdDuration * 0.7;
      // Один и тот же кадр считаем один раз и читаем его через WebGL-композит.
      const readComposite = () => {
        L.runtime.renderAt(t, 1 / 60);
        L.scene.composer.render(1 / 60);
        const gl = L.scene.renderer.getContext();
        const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
        const pixels = new Uint8Array(w * h * 4);
        gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        return { w, h, pixels };
      };
      const frame = readComposite();
      const { w, h, pixels } = frame;
      // Гладкость фона: смотрим «пустую» левую полосу кадра (там только фон,
      // без колец, знака и титра) и оцениваем размах локальных прыжков — это и
      // есть видимые ступени на тёмной рампе.
      const scan = (x0, x1, y0, y1) => {
        const steps = [];
        const levels = new Set();
        for (let y = Math.round(h * y0); y < Math.round(h * y1); y += 2) {
          let prev = null;
          for (let x = Math.round(w * x0); x < Math.round(w * x1); x++) {
            const i = (y * w + x) * 4;
            const v = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
            levels.add(pixels[i]);
            if (prev !== null) steps.push(Math.abs(v - prev));
            prev = v;
          }
        }
        steps.sort((a, b) => a - b);
        return { steps, levels: levels.size };
      };
      const smooth = scan(0.03, 0.22, 0.06, 0.38);
      const medianStep = smooth.steps[Math.floor(smooth.steps.length / 2)] ?? 0;
      const p90Step = smooth.steps[Math.floor(smooth.steps.length * 0.9)] ?? 0;
      const worstStep = smooth.steps[smooth.steps.length - 1] ?? 0;

      // Яркость титра: слой титра (то, что уходит в кадр) против DOM-превью.
      const layer = L.scene.captionLayer.canvas;
      const ld = layer.getContext("2d").getImageData(0, 0, layer.width, layer.height).data;
      let layerSum = 0, layerN = 0;
      for (let i = 0; i < ld.length; i += 4) {
        if (ld[i + 3] > 200) { layerSum += (ld[i] + ld[i + 1] + ld[i + 2]) / 3; layerN++; }
      }
      const layerBrightness = layerN ? layerSum / layerN : 0;
      // DOM-превью: берём цвет заливки, посчитанный самим браузером для того
      // же глифа (элемент #caption скрыт от кадра, но стили живы).
      const glyph = document.querySelector("#caption .cap-sub .cap-glyph");
      const source = glyph ? getComputedStyle(glyph).color : "";
      const hex = (value) => {
        const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(value || "");
        return m ? (Number(m[1]) + Number(m[2]) + Number(m[3])) / 3 : null;
      };
      // Цвет заливки задаёт псевдоэлемент ::after — именно он виден в превью.
      const pseudo = glyph ? getComputedStyle(glyph, "::after").color : "";
      const domBrightness = hex(pseudo) ?? hex(source);
      return {
        size: [w, h], medianStep: +medianStep.toFixed(2), p90Step: +p90Step.toFixed(2),
        worstStep: +worstStep.toFixed(2), levels: smooth.levels,
        layerBrightness: +layerBrightness.toFixed(2), domBrightness,
        dither: L.cfg.post.dither, ditherEnabled: L.cfg.post.ditherEnabled !== false,
      };
    });

    assert.deepEqual(errors, []);
    assert.ok(result.levels >= MIN_LEVELS, `в рампе фона всего ${result.levels} уровней — градиент ступенчатый`);
    assert.ok(result.medianStep <= MAX_MEDIAN_STEP,
      `медианная ступень ${result.medianStep} LSB (допуск ${MAX_MEDIAN_STEP}); дизеринг: ${result.ditherEnabled}, ${result.dither}`);
    assert.ok(result.p90Step <= MAX_P90_STEP,
      `90-й процентиль ступеней ${result.p90Step} LSB (допуск ${MAX_P90_STEP}) — на стене видны полосы`);
    assert.ok(result.layerBrightness > 40, `титр слишком тёмный в кадре: ${result.layerBrightness}`);
    if (result.domBrightness !== null) {
      const delta = Math.abs(result.layerBrightness - result.domBrightness);
      assert.ok(delta <= MAX_CAPTION_DELTA,
        `яркость титра в кадре ${result.layerBrightness} расходится с DOM ${result.domBrightness}`);
      console.log({ ...result, captionDelta: +delta.toFixed(2) });
    } else {
      console.log(result);
    }
    await page.close();
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error("FAIL", error); process.exitCode = 1; });
