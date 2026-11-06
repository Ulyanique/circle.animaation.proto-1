// Виды №8 и №9: фирменный фон, текст под знаком, экспортный canvas и шов.
// SCENE=photo-pause|finale OUT=docs/photo-pause.jpg npm run verify:priority
const assert = require("node:assert/strict");
const { launchBrowser } = require("./browser.cjs");
const { inspectSceneDesign, assertSceneDesign, countSeamDifferences } = require("./scene-probe.cjs");
const sceneId = process.env.SCENE;
const expected = {
  "photo-pause": { title: "Фотопауза", subtitle: false, cycle: 24 },
  finale: { title: "Янтарный циркуль", subtitle: "История продолжается", cycle: 18 },
}[sceneId];
if (!expected) throw new Error("SCENE должен быть photo-pause или finale");
const URL_ = process.env.URL || `http://localhost:5173/?scene=${sceneId}`;

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
    assert.equal(state.id, sceneId);
    assert.equal(state.cycle, expected.cycle);
    assert.equal(state.title, expected.title);
    assert.equal(state.subtitle, expected.subtitle);
    assert.ok(state.noDate);
    if (sceneId === "finale") assert.ok(state.phraseInProgress, "фаза написания финальной фразы");
    if (sceneId === "photo-pause") assert.ok(state.viewfinder, "рамка видоискателя");
    assertSceneDesign(state);
    assert.equal(seamChangedPixels, 0, "пиксельный шов");
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error("FAIL", error); process.exitCode = 1; });
