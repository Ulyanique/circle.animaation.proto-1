// Второй вид: символ над названием, общий золотой фон, экспорт и пиксельный шов.
// npm run dev; npm run verify:brand [OUT=docs/brand-background.jpg]
const assert = require("node:assert/strict");
const { launchBrowser } = require("./browser.cjs");
const { inspectSceneDesign, assertSceneDesign, countSeamDifferences } = require("./scene-probe.cjs");
const URL_ = process.env.URL || "http://localhost:5173/?scene=brand";

(async () => {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    await page.goto(URL_, { waitUntil: "networkidle0", timeout: 120000 });
    await page.waitForFunction(() => document.body.classList.contains("boot-ready"), { timeout: 240000 });
    await page.waitForSelector("#boot-screen", { hidden: true, timeout: 10000 });
    const state = await page.evaluate(inspectSceneDesign);
    await page.addStyleTag({ content: ".brand-controls,.operator-panel,.toast{display:none!important}" });
    if (process.env.OUT) await page.screenshot({ path: process.env.OUT, type: "jpeg", quality: 90 });
    const seamChangedPixels = await countSeamDifferences(page, state.cycle);
    console.log({ ...state, seamChangedPixels, errors });
    assert.deepEqual(errors, []);
    assert.equal(state.id, "brand");
    assert.equal(state.cycle, 24);
    assert.equal(state.title, "Янтарный циркуль");
    assert.ok(state.onlyTitle);
    assertSceneDesign(state);
    assert.equal(seamChangedPixels, 0, "пиксельный шов");
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error("FAIL", error); process.exitCode = 1; });
