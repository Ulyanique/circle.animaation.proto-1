// DOM против экспортного canvas без дорогого WebGL: npm run dev; npm run verify:caption
// CHROME=/путь/к/chrome или scripts/setup-headless.sh; URL — адрес dev-сервера Vite.
const assert = require("node:assert/strict");
const { PNG } = require("pngjs");
const { launchBrowser } = require("./browser.cjs");

const URL_ = process.env.URL || "http://localhost:5173/";
const segmenter = new Intl.Segmenter("ru", { granularity: "grapheme" });
const segment = (text) => [...segmenter.segment(text)].map(({ segment }) => segment);
const linesFor = (scene) => scene === "waiting" ? ["title", "subtitle", "date"]
  : scene === "finale" ? ["title", "subtitle"] : ["title"];
const ranges = {
  waiting: { title: [480, 700], subtitle: [725, 830], date: [865, 960], custom: [220, 330] },
  finale: { title: [480, 700], subtitle: [720, 830] },
  brand: { title: [770, 875] },
  "photo-pause": { title: [480, 700] },
};

function overlap(dom, canvas, [top, bottom]) {
  assert.equal(dom.width, 1920);
  assert.equal(dom.height, 1080);
  assert.equal(canvas.width, dom.width);
  assert.equal(canvas.height, dom.height);
  const domPoints = [];
  let canvasPixels = 0;
  const lit = (image, x, y) => {
    const i = (y * image.width + x) * 4;
    return Math.max(image.data[i], image.data[i + 1], image.data[i + 2]) > 45;
  };
  for (let y = top; y < bottom; y++) for (let x = 0; x < dom.width; x++) {
    if (lit(dom, x, y)) domPoints.push([x, y]);
    if (lit(canvas, x, y)) canvasPixels++;
  }
  // Разный способ растрирования DOM и Canvas может сдвинуть край на 1 пиксель.
  // Большие ошибки геометрии, регистр и формы букв этот допуск не скрывает.
  let raw = 0, best = { score: 0, dx: 0, dy: 0 };
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    let intersection = 0;
    for (const [x, y] of domPoints) {
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && xx < canvas.width && yy >= 0 && yy < canvas.height && lit(canvas, xx, yy)) intersection++;
    }
    const score = intersection / (domPoints.length + canvasPixels - intersection || 1);
    if (dx === 0 && dy === 0) raw = score;
    if (score > best.score) best = { score, dx, dy };
  }
  return { domPixels: domPoints.length, canvasPixels, raw, ...best };
}

(async () => {
  const { glyphReveal } = await import("../src/caption.js");
  const browser = await launchBrowser({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  const errors = [];
  try {
    const page = await browser.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setRequestInterception(true);
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === "/src/main.js") {
        // Загружаем настоящие CSS, шрифты и модуль композита, но не инициализируем Three.js.
        request.respond({ status: 200, contentType: "application/javascript", body: `
          import "/src/styles.css";
          import "/src/font-assets.js";
          import { loadFonts } from "/src/fonts.js";
          import "/node_modules/@fontsource/cormorant-garamond/cyrillic-400.css";
          import "/node_modules/@fontsource/cormorant-garamond/cyrillic-600.css";
          import { drawCaption } from "/src/caption-compositor.js";
          import { glyphReveal } from "/src/caption.js";
          import { applyCaptionFit } from "/src/caption-fit.js";
          window.__captionProbe = { drawCaption, glyphReveal, applyCaptionFit, loadFonts };
          window.__bootReady();
        ` });
      } else request.continue();
    });
    await page.goto(URL_, { waitUntil: "networkidle0", timeout: 30000 });
    await page.waitForFunction(() => !!window.__captionProbe, { timeout: 10000 });
    await page.evaluate(async () => {
      await window.__captionProbe.loadFonts();
      const loaded = await Promise.all([
        document.fonts.load('400 46px "Cormorant Garamond"', "История продолжается"),
        document.fonts.load('600 138px "Cormorant Garamond"', "Янтарный циркуль"),
      ]);
      if (loaded.some((fonts) => fonts.length === 0)) throw new Error("Не загружен шрифт титров");
    });
    await page.addStyleTag({ content: `
      html, body { background: #000 !important; }
      body > *:not(#caption):not(#probe-canvas) { display: none !important; }
    ` });

    const cases = [
      { name: "waiting/своя длинная надпись", scene: "waiting", custom: "Очень длинная надпись для юбилейного вечера архитектуры и искусства", customFit: true, customTracking: .24, outline: 1, fill: 1 },
      { name: "waiting/длинное название", scene: "waiting", title: "Янтарный циркуль — большой юбилейный вечер архитектуры", fit: true, outline: 1, fill: 1, tracking: [.04, .12, .2] },
      { name: "waiting/свои интервалы", scene: "waiting", outline: 1, fill: 1, tracking: [.08, .12, .2] },
      { name: "finale/свои интервалы", scene: "finale", outline: 1, fill: 1, tracking: [.04, .10, .2] },
      { name: "waiting/готово", scene: "waiting", outline: 1, fill: 1 },
      { name: "waiting/появление", scene: "waiting", outline: 0.46, fill: 0.21, lift: 5, drift: 4 },
      { name: "finale/готово", scene: "finale", outline: 1, fill: 1 },
      { name: "finale/появление", scene: "finale", outline: 0.48, fill: 0.19, lift: 6, drift: 3 },
      { name: "brand/название", scene: "brand", outline: 1, fill: 1 },
      { name: "brand/появление", scene: "brand", outline: 0.46, fill: 0.21, lift: 5, drift: 4 },
      { name: "waiting/расширение графем", scene: "waiting", outline: 1, fill: 1, subtitle: "Straße  i ß" },
      { name: "waiting/расширение в проявлении", scene: "waiting", outline: 0.405, fill: 0.1, subtitle: "Straße  i ß", expectPartialExpansion: true },
      { name: "waiting/старый Canvas", scene: "waiting", outline: 0.405, fill: 0.1, subtitle: "Straße  i ß", tracking: [.05, .15, .2], legacyCanvas: true, expectPartialExpansion: true },
      { name: "waiting/без uppercase", scene: "waiting", outline: 1, fill: 1, subtitle: "MiXeD текст", subTransform: "none" },
    ];
    for (const [id, family] of [['cormorant-garamond','Cormorant Garamond'],['playfair-display','Playfair Display'],['prata','Prata'],['pt-serif','PT Serif'],['manrope','Manrope'],['unbounded','Unbounded']]) {
      cases.push({ name: `waiting/свой шрифт ${id}`, scene: 'waiting', custom: 'Пример Кириллица ABC', customFont:id, customFamily:family, customTracking:.1, outline:1, fill:1 });
    }
    cases.push({name:'waiting/свой регистр верхний',scene:'waiting',custom:'Привет Straße МИР',customTransform:'uppercase',customTracking:.12,outline:1,fill:1});
    cases.push({name:'waiting/свой регистр нижний',scene:'waiting',custom:'ПРИВЕТ MiXeD',customTransform:'lowercase',customTracking:.08,outline:1,fill:1});
    cases.push({name:'waiting/свой регистр проявление',scene:'waiting',custom:'abc ß Текст',customTransform:'uppercase',customTracking:.1,outline:.48,fill:.2,expectPartialExpansion:true});
    const viewports = [
      { name: "1920×1080", width: 1920, height: 1080, deviceScaleFactor: 1, cases },
      { name: "960×540 @2x", width: 960, height: 540, deviceScaleFactor: 2, cases: cases.slice(0, 8) },
    ];
    const results = [];
    for (const viewport of viewports) {
      await page.setViewport(viewport);
      for (const c of viewport.cases) {
        const copy = {
          title: c.title ?? (c.scene === "photo-pause" ? "Фотопауза" : "Янтарный циркуль"),
          subtitle: c.subtitle ?? (c.scene === "finale" ? "История продолжается" : "Вечер ретроспектива"),
          date: "20 ноября 2026 года",
          ...(c.custom ? {custom: c.custom} : {}),
        };
        await page.evaluate(({ c, copy, viewport }) => {
          document.querySelector("#probe-canvas")?.remove();
          document.body.className = `boot-ready scene-${c.scene === "photo-pause" ? "photo" : c.scene}`;
          const cap = document.querySelector("#caption");
          cap.style.width = `${viewport.width}px`;
          cap.style.height = `${viewport.height}px`;
          cap.style.opacity = "1";
          cap.style.setProperty("--u", `${(viewport.width / 100).toFixed(3)}px`);
          cap.style.setProperty("--drift", `${c.drift || 0}px`);
          ["title", "subtitle", "date"].forEach((name, i) => {
            if (c.tracking) cap.style.setProperty(`--${name}-tracking`, `${c.tracking[i]}em`);
            else cap.style.removeProperty(`--${name}-tracking`);
          });
          cap.style.transform = "translate(-50%, calc(-50% + var(--drift)))";
          cap.querySelectorAll('.cap-custom').forEach(el => el.remove());
          if (c.custom) {
            const el = document.createElement('div'); el.className = 'cap-custom'; el.dataset.custom = 'text1';
            el.dataset.text = c.custom; el.style.left = '50%'; el.style.top = '25%';
            el.style.setProperty('--custom-tracking', `${c.customTracking || 0}em`);
            if (c.customFont) { el.dataset.font = c.customFont; el.style.fontFamily = `"${c.customFamily}", Georgia, serif`; }
            cap.appendChild(el);
          }
          const selector = { title: ".cap-title", subtitle: ".cap-sub", date: ".cap-date", custom: '[data-custom="text1"]' };
          for (const [name, text] of Object.entries(copy)) {
            const el = cap.querySelector(selector[name]);
            // Класс титра теперь капителью; «без регистра» моделируем явным none.
            el.style.textTransform = name === "subtitle" ? (c.subTransform === "none" ? "none" : c.subTransform || "") : name === "custom" ? (c.customTransform || "") : "";
            el.style.setProperty("--p", c.outline.toFixed(4));
            el.style.setProperty("--f", c.fill.toFixed(4));
            el.style.setProperty("--lift", `${c.lift || 0}px`);
            el.style.setProperty("--pen", "0");
            const parts = [...new Intl.Segmenter("ru", { granularity: "grapheme" }).segment(text)];
            el.replaceChildren(...parts.map(({ segment }, i) => {
              const glyph = document.createElement("span");
              glyph.className = "cap-glyph";
              glyph.textContent = segment === " " ? "\u00a0" : segment;
              glyph.dataset.glyph = glyph.textContent;
              const state = window.__captionProbe.glyphReveal(c, i, parts.length);
              glyph.style.setProperty("--o", state.outline.toFixed(4));
              glyph.style.setProperty("--f", state.fill.toFixed(4));
              glyph.style.setProperty("--gpen", "0");
              return glyph;
            }));
          }
          for (const rule of cap.querySelectorAll(".cap-rule")) rule.style.setProperty("--p", "0");
          window.__captionProbe.applyCaptionFit(cap, {titleAutoFit: !!c.fit, titleX: 0}, {text1AutoFit: !!c.customFit, text1X: 0});
        }, { c, copy, viewport: { width: viewport.width, height: viewport.height } });
        if (c.fit) {
          const metrics = await page.evaluate(() => {const cap = document.querySelector("#caption"), line = cap.querySelector(".cap-title"); return {fit:Number(cap.style.getPropertyValue("--title-fit")), width:line.getBoundingClientRect().width, frame:cap.getBoundingClientRect().width};});
          assert.ok(metrics.fit < 1 && metrics.width <= metrics.frame * .901, `${c.name}: строка не поместилась в поля`);
        }
        if (c.customFit) {
          const m = await page.evaluate(() => {const cap=document.querySelector('#caption'), line=cap.querySelector('.cap-custom'); return {fit:Number(line.style.getPropertyValue('--custom-fit')), width:line.getBoundingClientRect().width, frame:cap.getBoundingClientRect().width};});
          assert.ok(m.fit < 1 && m.width <= m.frame * .901, `${c.name}: строка не вписалась`);
        }
        const dom = PNG.sync.read(Buffer.from(await page.screenshot({ type: "png" })));
        const actual = await page.evaluate(({ c, viewport }) => {
          const canvas = document.createElement("canvas");
          canvas.id = "probe-canvas";
          canvas.width = 1920; canvas.height = 1080;
          canvas.style.cssText = `position:fixed;inset:0;z-index:9999;width:${viewport.width}px;height:${viewport.height}px`;
          document.body.appendChild(canvas);
          const ctx = canvas.getContext("2d");
          ctx.fillStyle = "#000"; ctx.fillRect(0, 0, canvas.width, canvas.height);
          const calls = { measure: [], stroke: [], fill: [] };
          for (const [method, key] of [["measureText", "measure"], ["strokeText", "stroke"], ["fillText", "fill"]]) {
            const original = ctx[method];
            ctx[method] = function (text, ...args) {
              calls[key].push(text);
              return original.call(this, text, ...args);
            };
          }
          const supportsSpacing = "letterSpacing" in ctx;
          let spacingOwner, spacingDescriptor;
          if (c.legacyCanvas && supportsSpacing) {
            spacingOwner = Object.getPrototypeOf(ctx);
            while (spacingOwner && !Object.prototype.hasOwnProperty.call(spacingOwner, "letterSpacing")) {
              spacingOwner = Object.getPrototypeOf(spacingOwner);
            }
            spacingDescriptor = Object.getOwnPropertyDescriptor(spacingOwner, "letterSpacing");
            if (!spacingDescriptor?.configurable) throw new Error("Невозможно смоделировать старый Canvas");
            delete spacingOwner.letterSpacing;
          }
          try {
            window.__captionProbe.drawCaption(ctx, 1, c.scene);
          } finally {
            if (spacingDescriptor) Object.defineProperty(spacingOwner, "letterSpacing", spacingDescriptor);
          }
          const counts = {};
          for (const [name, sel] of [["title", ".cap-title"], ["subtitle", ".cap-sub"], ["date", ".cap-date"], ...(c.custom ? [["custom", ".cap-custom"]] : [])]) {
            counts[name] = document.querySelector(`#caption ${sel}`).children.length;
          }
          return { calls, counts, fallbackSpacing: c.legacyCanvas || !supportsSpacing };
        }, { c, viewport: { width: viewport.width, height: viewport.height } });
        const canvas = PNG.sync.read(Buffer.from(await page.screenshot({ type: "png" })));
        const expected = { measure: [], stroke: [], fill: [] };
        let partialGlyphs = 0, partialExpandedGlyphs = 0;
        for (const name of [...linesFor(c.scene), ...(c.custom ? ["custom"] : [])]) {
          const glyphs = segment(copy[name]).map(g => {
            if (name === 'custom') return c.customTransform === 'lowercase' ? g.toLocaleLowerCase('ru') : g.toLocaleUpperCase('ru');
            if (name === 'subtitle' && c.subTransform === 'none') return g;
            return g.toLocaleUpperCase('ru');
          });
          assert.equal(actual.counts[name], glyphs.length, `${c.name}: число графем ${name}`);
          glyphs.forEach((glyph, i) => {
            const runs = actual.fallbackSpacing ? segment(glyph) : [glyph];
            expected.measure.push(...runs);
            const reveal = glyphReveal(c, i, glyphs.length);
            if (reveal.outline > 0.001 && reveal.outline < 0.999) {
              partialGlyphs++;
              if (segment(glyph).length > 1) partialExpandedGlyphs++;
            }
            if (glyph !== " " && reveal.outline > 0.001) expected.stroke.push(...runs);
            if (glyph !== " " && reveal.fill > 0.001) expected.fill.push(...runs);
          });
          const score = overlap(dom, canvas, ranges[c.scene][name]);
          const minimum = c.outline === 1 ? 0.80 : 0.75;
          assert.ok(score.domPixels > 50 && score.canvasPixels > 50, `${c.name}/${name}: титр не нарисован`);
          assert.ok(score.score >= minimum, `${viewport.name} ${c.name}/${name}: совпадение ${score.score.toFixed(3)} < ${minimum}`);
          const shift = score.dx || score.dy ? ` (±1px: ${(100 * score.score).toFixed(1)}%)` : "";
          results.push(`${viewport.name} ${c.name}/${name}: ${(100 * score.raw).toFixed(1)}%${shift}`);
        }
        if (c.outline < 1) assert.ok(partialGlyphs > 0, `${c.name}: нет частично проявленных графем`);
        if (c.expectPartialExpansion) assert.ok(partialExpandedGlyphs > 0, `${c.name}: расширенная графема не раскрывается частично`);
        assert.deepEqual(actual.calls, expected, `${viewport.name} ${c.name}: реальные measureText/strokeText/fillText`);
      }
    }
    assert.deepEqual(errors, [], "Ошибки браузера");
    console.log("DOM и экспортный canvas, контрольные кадры (совпадение масок):\n" + results.join("\n"));
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error("FAIL", error); process.exitCode = 1; });
