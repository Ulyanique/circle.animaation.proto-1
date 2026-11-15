// Сетка такта в реальном пульте: при 0 BPM индикатор скрыт и ничего не
// двигается; при 120 BPM появляется «такт · доля» и обновляется каждую долю.
// npm run dev; npm run verify:beat
const assert = require("node:assert/strict");
const { launchBrowser } = require("./browser.cjs");
const URL_ = process.env.URL || "http://localhost:5173/";

(async () => {
  const browser = await launchBrowser({ width: 1280, height: 720 });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${URL_}?scene=intro`, { waitUntil: "networkidle0", timeout: 120000 });
    await page.waitForFunction(() => document.body.classList.contains("boot-ready"), { timeout: 240000 });

    const result = await page.evaluate(async () => {
      const L = window.__logo;
      const beatEl = document.querySelector('[data-role="beat"]');
      const read = () => ({ text: beatEl.textContent, hidden: beatEl.hidden });
      const cycleBefore = L.runtime.cycle;
      const holdBefore = L.cfg.timeline.holdDuration;
      L.cfg.playback.paused = true;
      // 1. Выключенная сетка: индикатора нет, отрезки не изменились.
      L.cfg.timeline.beatBpm = 0;
      L.operator.refresh();
      const off = read();
      const untouched = { cycle: L.runtime.cycle, hold: L.cfg.timeline.holdDuration };
      // 2. Включённая сетка 120 BPM: индикатор на месте.
      L.cfg.timeline.beatBpm = 120;
      L.cfg.timeline.beatOffset = 0;
      for (const t of [1.0, 1.5, 2.05]) {
        L.runtime.renderAt(t, 1 / 60);
        L.operator.refresh();
      }
      const samples = [];
      for (const t of [1.0, 1.6, 2.1, 4.95]) {
        L.runtime.renderAt(t, 1 / 60);
        L.operator.refresh();
        samples.push({ t, ...read(), time: document.querySelector('[data-role="time"]').textContent });
      }
      // 3. Ближайшее событие показывается в подписи (знак/титр/уход).
      L.runtime.renderAt(3.2, 1 / 60);
      L.operator.refresh();
      const nearEvent = { ...read() };
      // 4. Выключили обратно — индикатор снова скрыт.
      L.cfg.timeline.beatBpm = 0;
      L.operator.refresh();
      const offAgain = read();
      return { off, untouched, samples, nearEvent, offAgain, cycleBefore, holdBefore,
        paused: L.cfg.playback.paused };
    });

    assert.deepEqual(errors, []);
    const checks = {
      "сетка выключена по умолчанию": result.off.hidden && result.off.text === "",
      "включение сетки не двигает цикл": Math.abs(result.untouched.cycle - result.cycleBefore) < 1e-9,
      "включение сетки не двигает удержание": Math.abs(result.untouched.hold - result.holdBefore) < 1e-9,
      "при 120 BPM индикатор виден": result.samples.every((s) => !s.hidden && s.text.length > 0),
      "подпись содержит такт и долю": result.samples.every((s) => /такт \d+ · доля [1-4]/.test(s.text)),
      "доля меняется на границе 0.5 с": result.samples[0].text !== result.samples[1].text,
      "счётчик тактов растёт": result.samples[3].text !== result.samples[0].text,
      "подпись подсказывает ближайшее событие": /→ (знак|титр|уход) через \d/.test(result.nearEvent.text),
      "после выключения индикатор скрыт": result.offAgain.hidden,
    };
    const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
    if (failed.length) {
      console.error(`FAIL: ${failed.join("; ")}`);
      process.exitCode = 1;
    } else {
      console.log({ samples: result.samples.map((s) => `${s.t.toFixed(2)}с — ${s.text}`) });
      console.log("Сетка такта: индикатор, доли и независимость от длительности — OK");
    }
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error("FAIL", error); process.exitCode = 1; });
