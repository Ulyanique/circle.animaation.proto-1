// Роли шрифтов титра: Prata для названия, Forum для подписи, капитель,
// а выбор шрифта в настройках действительно меняет строки.
// npm run dev; node scripts/verify-typography-roles.cjs
const assert = require("node:assert/strict");
const { launchBrowser } = require("./browser.cjs");

const KEY = "circle-anim-settings-v2:brand";

(async () => {
  const browser = await launchBrowser({ width: 1440, height: 900 });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const boot = async () => {
      await page.goto(`${process.env.URL || "http://localhost:5173"}/?scene=brand`, { waitUntil: "networkidle0", timeout: 120000 });
      await page.waitForFunction(() => document.body.classList.contains("boot-ready"), { timeout: 240000 });
      await page.waitForFunction(() => document.querySelector("#caption .cap-title .cap-glyph"), { timeout: 60000 });
    };
    const lines = () => page.evaluate(() => ["title", "sub", "date"].map((name) => {
      const el = document.querySelector(`#caption .cap-${name}`);
      const style = getComputedStyle(el);
      return { name, family: style.fontFamily, transform: style.textTransform, font: el.dataset.font };
    }));

    // 1. Штатные роли: название — Prata, подпись и дата — Forum, всё капителью.
    await boot();
    const base = await lines();
    assert.match(base[0].family, /Prata/, `название: ${base[0].family}`);
    assert.match(base[1].family, /Forum/, `подпись: ${base[1].family}`);
    assert.match(base[2].family, /Forum/, `дата: ${base[2].family}`);
    for (const line of base) assert.equal(line.transform, "uppercase", `${line.name} не капителью`);
    assert.equal(base[0].font, "prata");
    assert.equal(base[1].font, "forum");

    // 2. Выбор шрифта в настройках меняет роль (сохранённая конфигурация).
    await page.evaluate((key) => localStorage.setItem(key, JSON.stringify({
      typography: { titleFont: "manrope", captionFont: "pt-serif" },
    })), KEY);
    await boot();
    const picked = await lines();
    assert.match(picked[0].family, /Manrope/, `выбор названия: ${picked[0].family}`);
    assert.match(picked[1].family, /PT Serif/, `выбор подписи: ${picked[1].family}`);

    // 3. Старые сохранённые настройки с одним шрифтом держат его в обеих ролях.
    await page.evaluate((key) => localStorage.setItem(key, JSON.stringify({
      typography: { font: "playfair-display" },
    })), KEY);
    await boot();
    const legacy = await lines();
    assert.match(legacy[0].family, /Playfair Display/, `наследие названия: ${legacy[0].family}`);
    assert.match(legacy[1].family, /Playfair Display/, `наследие подписи: ${legacy[1].family}`);

    await page.evaluate((key) => localStorage.removeItem(key), KEY);
    assert.deepEqual(errors, [], `ошибки страницы: ${errors.join("; ")}`);
    console.log("Роли шрифтов: Prata/Forum по умолчанию, капитель, выбор и наследие — OK");
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error("FAIL", e); process.exitCode = 1; });
