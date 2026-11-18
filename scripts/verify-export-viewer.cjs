// Просмотр готового экспорта: диалог поверх кадра, сохранение кнопкой, закрытие Esc.
// npm run dev; node scripts/verify-export-viewer.cjs
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { launchBrowser } = require("./browser.cjs");

const dlDir = fs.mkdtempSync(path.join(os.tmpdir(), "export-viewer-"));

(async () => {
  const browser = await launchBrowser({ width: 1600, height: 900 });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    const client = await page.createCDPSession();
    await client.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: dlDir, eventsEnabled: true });
    await page.goto(`${process.env.URL || "http://localhost:5173"}/?scene=waiting`, { waitUntil: "networkidle0", timeout: 120000 });
    await page.waitForFunction(() => document.body.classList.contains("boot-ready"), { timeout: 240000 });
    await page.evaluate(async () => {
      await document.fonts.ready; window.requestAnimationFrame = () => 0;
      const L = window.__logo; L.cfg.playback.paused = true;
      Object.assign(L.cfg.timeline, { drawDuration: .6, emergeDuration: .5, holdDuration: 2.1,
        fadeDuration: .5, restDuration: .3, startDelay: 0, speed: 20, ringsIntro: .5 });
      return L.startRecording({ download: true });
    });
    // Диалог открывается после кодирования: видео с объект-URL и подписью.
    await page.waitForFunction(() => {
      const video = document.querySelector(".export-viewer video");
      return video && video.src.startsWith("blob:") && video.readyState >= 2;
    }, { timeout: 300000, polling: 300 });
    const head = await page.evaluate(() => ({
      filename: document.querySelector(".export-viewer-title strong").textContent,
      meta: document.querySelector(".export-viewer-title span").textContent,
      playing: !document.querySelector(".export-viewer video").paused,
      controls: document.querySelector(".export-viewer video").controls,
    }));
    assert.match(head.filename, /^intro-1920x1080\.mp4$/, `имя файла: ${head.filename}`);
    assert.ok(head.meta.includes("30 fps") && head.meta.includes("МиБ"), `метаданные: ${head.meta}`);
    assert.ok(head.controls, "у плеера нет органов управления");
    // Кнопка сохранения кладёт файл правильным именем.
    await page.click("[data-viewer=download]");
    const file = await (async () => {
      for (let i = 0; i < 60; i++) {
        const list = fs.readdirSync(dlDir).filter((n) => !n.endsWith(".crdownload"));
        if (list.length) return list[0];
        await new Promise((r) => setTimeout(r, 500));
      }
      return null;
    })();
    assert.equal(file, head.filename, `в загрузки попал файл ${file}`);
    assert.ok(fs.statSync(path.join(dlDir, file)).size > 1000, "файл пустой");
    // Esc закрывает диалог и освобождает объект-URL.
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.querySelector(".export-viewer"), { timeout: 15000 });
    assert.deepEqual(errors, [], `ошибки страницы: ${errors.join("; ")}`);
    console.log("Просмотр экспорта: диалог, сохранение кнопкой и закрытие Esc — OK");
  } finally {
    await browser.close();
    fs.rmSync(dlDir, { recursive: true, force: true });
  }
})().catch((e) => { console.error("FAIL", e); process.exitCode = 1; });
