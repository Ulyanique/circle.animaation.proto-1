// Сквозная проверка реального WebGL + экспортного canvas в видах 01 и 09.
// npm run dev; npm run verify:caption:export (software WebGL может работать несколько минут).
const assert = require("node:assert/strict");
const { launchBrowser } = require("./browser.cjs");
const URL_ = process.env.URL || "http://localhost:5173/";
const segmenter = new Intl.Segmenter("ru", { granularity: "grapheme" });
const glyphs = (text) => [...segmenter.segment(text)].map(({ segment }) => segment);

(async () => {
  const browser = await launchBrowser({ width: 960, height: 540, deviceScaleFactor: 1 });
  try {
    for (const sceneId of ["waiting", "finale"]) {
      const page = await browser.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
      const url = new URL(URL_);
      url.searchParams.set("scene", sceneId);
      await page.goto(url.href, { waitUntil: "networkidle0", timeout: 120000 });
      await page.waitForFunction(() => document.body.classList.contains("boot-ready"), { timeout: 240000 });
      const result = await page.evaluate(async (id) => {
        await document.fonts.ready;
        const L = window.__logo;
        L.cfg.playback.paused = true;
        // Останавливаем лишние RAF-рендеры, не меняя точный renderAt внутри compositeFrameAt.
        window.requestAnimationFrame = () => 0;
        const tl = L.cfg.timeline;
        const time = id === "waiting"
          ? tl.startDelay + tl.drawDuration + tl.emergeDuration + tl.holdDuration * 0.55
          : L.runtime.cycle / 2;
        const calls = { measure: [], stroke: [], fill: [] };
        const prototype = CanvasRenderingContext2D.prototype;
        const originals = {};
        for (const [method, key] of [["measureText", "measure"], ["strokeText", "stroke"], ["fillText", "fill"]]) {
          originals[method] = prototype[method];
          prototype[method] = function (text, ...args) {
            if (this.canvas.width === 1920 && this.canvas.height === 1080) calls[key].push(text);
            return originals[method].call(this, text, ...args);
          };
        }
        let frame;
        try {
          frame = L.compositeFrameAt(time);
        } finally {
          for (const [method, original] of Object.entries(originals)) prototype[method] = original;
        }
        // Тот же export-кадр без титра: титр теперь рисуется внутри WebGL-прохода,
        // поэтому эталон — compositeFrameAt(..., false), а не сырой canvas сцены.
        const background = L.compositeFrameAt(time, 1 / 60, false);
        const changedPixels = (x, y, width, height) => {
          const a = frame.getContext("2d").getImageData(x, y, width, height).data;
          const b = background.getContext("2d").getImageData(x, y, width, height).data;
          let changed = 0;
          for (let i = 0; i < a.length; i += 4) {
            if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 30) changed++;
          }
          return changed;
        };
        return {
          id: L.activeScene.id,
          size: [frame.width, frame.height],
          calls,
          raw: [...document.querySelectorAll("#caption [data-text]")].map((el) => el.textContent.replaceAll("\u00a0", " ")),
          subtitlePixels: changedPixels(450, 725, 1020, 110),
          datePixels: id === "waiting" ? changedPixels(650, 875, 650, 70) : null,
          backgroundPixels: changedPixels(0, 0, 1920, 100),
        };
      }, sceneId);
      const title = glyphs("Янтарный циркуль");
      const subtitle = glyphs(sceneId === "waiting" ? "Вечер ретроспектива" : "История продолжается")
        .map((g) => g.toLocaleUpperCase("ru"));
      const date = sceneId === "waiting" ? glyphs("20 ноября 2026 года").map((g) => g.toLocaleUpperCase("ru")) : [];
      const expectedMeasure = [...title, ...subtitle, ...date];
      const expectedPaint = expectedMeasure.filter((g) => g !== " ");
      assert.equal(result.id, sceneId);
      assert.deepEqual(result.size, [1920, 1080]);
      assert.deepEqual(result.calls.measure, expectedMeasure, `${sceneId}: измерения графем`);
      // Штатные титры сейчас используют плавное проявление без обводки.
      assert.deepEqual(result.calls.stroke, [], `${sceneId}: у плавного проявления не должно быть контура`);
      assert.deepEqual(result.calls.fill, expectedPaint, `${sceneId}: заливка графем`);
      assert.equal(result.raw[0], "Янтарный циркуль");
      assert.equal(result.raw[1], sceneId === "waiting" ? "Вечер ретроспектива" : "История продолжается");
      assert.ok(result.subtitlePixels > 500, `${sceneId}: нет пикселей подзаголовка`);
      if (sceneId === "waiting") assert.ok(result.datePixels > 200, "Нет пикселей даты");
      assert.ok(result.backgroundPixels < 1920, `${sceneId}: несопоставимые WebGL-фоны`);
      assert.deepEqual(errors, []);
      console.log({ sceneId, size: result.size, subtitlePixels: result.subtitlePixels,
        datePixels: result.datePixels, backgroundPixels: result.backgroundPixels,
        measuredGlyphs: result.calls.measure.length, paintedGlyphs: result.calls.fill.length });
      await page.close();
    }

    // Экспорт при открытом редакторе: DOM-титр нужен для рамок, но кадр обязан
    // получить запечённый текст, иначе запись теряет надпись.
    const editorPage = await browser.newPage();
    try {
      await editorPage.goto(`${URL_}?scene=waiting`, { waitUntil: "networkidle0", timeout: 120000 });
      await editorPage.waitForFunction(() => document.body.classList.contains("boot-ready"), { timeout: 240000 });
      const baked = await editorPage.evaluate(async () => {
        await document.fonts.ready;
        const L = window.__logo;
        L.cfg.playback.paused = true;
        window.requestAnimationFrame = () => 0;
        await L.editorReady();
        document.querySelector(".editor-toggle").click();
        const tl = L.cfg.timeline;
        const time = tl.startDelay + tl.drawDuration + tl.emergeDuration + tl.holdDuration * 0.55;
        const withCaption = L.compositeFrameAt(time);
        const without = L.compositeFrameAt(time, 1 / 60, false);
        const a = withCaption.getContext("2d").getImageData(450, 725, 1020, 110).data;
        const b = without.getContext("2d").getImageData(450, 725, 1020, 110).data;
        let changed = 0;
        for (let i = 0; i < a.length; i += 4) {
          if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 30) changed++;
        }
        const editorOn = document.body.classList.contains("editor-on");
        document.querySelector(".editor-toggle").click();
        return { changed, editorOn, editorStillOn: document.body.classList.contains("editor-on") };
      });
      assert.ok(baked.editorOn && !baked.editorStillOn, "режим редактора не переключился");
      assert.ok(baked.changed > 500, "экспорт при открытом редакторе потерял титр");
      console.log({ sceneId: "waiting", editorOn: true, subtitlePixels: baked.changed });
    } finally {
      await editorPage.close();
    }
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error("FAIL", error); process.exitCode = 1; });
