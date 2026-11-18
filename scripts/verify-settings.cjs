// Настройки каждой сцены: вкладки 01/02/04/08/09, изоляция значений, JSON сцены и проекта.
const fs = require("node:fs");
const path = require("node:path");
const { launchBrowser } = require("./browser.cjs");

const OUT = process.env.OUT;
if (OUT) fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    page.on("dialog", (dialog) => dialog.accept());
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });

    const url = new URL(process.env.URL || "http://localhost:5173/");
    url.searchParams.set("scene", "intro");
    await page.goto(url.href, { waitUntil: "networkidle0", timeout: 120000 });
    await page.waitForFunction(() => document.body.classList.contains("boot-ready"), { timeout: 240000 });

    // 1. Кнопка настроек есть в интро и открывает панель.
    const closed = await page.evaluate(() => ({
      display: getComputedStyle(document.querySelector(".cfg-toggle")).display,
      open: document.querySelector(".cfg-panel").classList.contains("open"),
    }));
    await page.click(".cfg-toggle");
    const opened = await page.evaluate(() => ({
      open: document.querySelector(".cfg-panel").classList.contains("open"),
      tabs: [...document.querySelectorAll(".cfg-tab")].map((tab) => tab.dataset.cfgScene),
      active: document.querySelector(".cfg-tab.active")?.dataset.cfgScene,
      heading: document.querySelector(".cfg-scene-name").textContent.trim(),
    }));

    await page.evaluate(() => {
      window.__uiLog = [];
      new MutationObserver(() => window.__uiLog.push(document.body.className))
        .observe(document.body, { attributes: true, attributeFilter: ["class"] });
    });

    // 2. Вкладка 02 переключает и сцену, и набор настроек; панель остаётся открытой.
    await page.evaluate(() => document.querySelector('.cfg-tab[data-cfg-scene="brand"]').click());
    await page.waitForFunction(() => window.__logo.activeScene.id === "brand", { timeout: 120000 });
    await page.waitForFunction(() => !document.querySelector(".transition-overlay:not([hidden])") && (() => { const o = document.querySelector(".transition-overlay"); return !o || o.style.display === "none"; })(), { timeout: 60000 });
    const brandPanel = await page.evaluate(() => ({
      open: document.querySelector(".cfg-panel").classList.contains("open"),
      active: document.querySelector(".cfg-tab.active")?.dataset.cfgScene,
      scale: document.querySelector('input[data-key="logo.scale"]').value,
      offsetY: document.querySelector('input[data-key="logo.offsetY"]').value,
    }));

    // 3. Правка в панели меняет живую сцену и сохраняется под ключом этой сцены.
    const edited = await page.evaluate(() => {
      const input = document.querySelector('input[data-key="logo.scale"]');
      input.value = "0.62";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      return {
        live: window.__logo.cfg.logo.scale,
        stored: JSON.parse(localStorage.getItem("circle-anim-settings-v2:brand") || "null")?.logo?.scale,
      };
    });

    // 4. Настройки интро не пострадали от правки фоновой сцены.
    await page.evaluate(() => document.querySelector('.cfg-tab[data-cfg-scene="waiting"]').click());
    await page.waitForFunction(() => window.__logo.activeScene.id === "waiting", { timeout: 120000 });
    await page.waitForFunction(() => !document.querySelector(".transition-overlay:not([hidden])") && (() => { const o = document.querySelector(".transition-overlay"); return !o || o.style.display === "none"; })(), { timeout: 60000 });
    const isolation = await page.evaluate(() => ({
      introScale: window.__logo.cfg.logo.scale,
      introStored: JSON.parse(localStorage.getItem("circle-anim-settings-v2:waiting") || "null"),
      brandScale: window.__logo.getSceneConfig("brand").logo.scale,
    }));

    // 5. Экспорт: JSON сцены и JSON всего проекта.
    const exported = await page.evaluate(() => {
      document.querySelector('[data-act="export"]').click();
      const scene = JSON.parse(document.querySelector(".cfg-textarea").value);
      document.querySelector('[data-act="export-project"]').click();
      const project = JSON.parse(document.querySelector(".cfg-textarea").value);
      return { sceneKeys: Object.keys(scene), scenes: Object.keys(project.scenes || {}), version: project.version };
    });

    // 6. Импорт JSON сцены применяется к текущей сцене и сохраняется.
    const importedScene = await page.evaluate(() => {
      document.querySelector('[data-act="import"]').click();
      const ta = document.querySelector(".cfg-textarea");
      ta.value = JSON.stringify({ logo: { scale: 0.54, offsetY: 1.24 } });
      document.querySelector('[data-io="apply"]').click();
      return {
        scale: window.__logo.cfg.logo.scale,
        offsetY: window.__logo.cfg.logo.offsetY,
        stored: JSON.parse(localStorage.getItem("circle-anim-settings-v2:waiting") || "null")?.logo?.scale,
        closed: document.querySelector(".cfg-io").hidden,
      };
    });

    // 7. Импорт проекта меняет ту сцену, к которой относится.
    const importedProject = await page.evaluate(() => {
      document.querySelector('[data-act="import"]').click();
      const ta = document.querySelector(".cfg-textarea");
      ta.value = JSON.stringify({ version: 2, scenes: { brand: { logo: { scale: 0.66 } } } });
      document.querySelector('[data-io="apply"]').click();
      return {
        brand: window.__logo.getSceneConfig("brand").logo.scale,
        intro: window.__logo.cfg.logo.scale,
      };
    });

    // 8. Сброс возвращает умолчания сцены, а не чужой сцены.
    await page.evaluate(() => document.querySelector('.cfg-tab[data-cfg-scene="brand"]').click());
    await page.waitForFunction(() => window.__logo.activeScene.id === "brand", { timeout: 120000 });
    await page.waitForFunction(() => !document.querySelector(".transition-overlay:not([hidden])") && (() => { const o = document.querySelector(".transition-overlay"); return !o || o.style.display === "none"; })(), { timeout: 60000 });
    await page.evaluate(() => document.querySelector('[data-act="reset"]').click());
    const reset = await page.evaluate(() => ({
      scale: window.__logo.cfg.logo.scale,
      offsetY: window.__logo.cfg.logo.offsetY,
    }));

    if (OUT) {
      await page.screenshot({ path: path.join(OUT, "settings-panel.jpg"), type: "jpeg", quality: 92 });
    }

    // 9. В простое кнопка приглушена, но остаётся видимой и кликабельной.
    // Панель не должна мешать проверке: закрываем её, только если она открыта.
    await page.evaluate(() => {
      if (document.body.classList.contains("ui-on")) document.querySelector(".cfg-toggle").click();
    });
    const panelClosed = await page.evaluate(() => ({
      uiOn: document.body.classList.contains("ui-on"),
      open: document.querySelector(".cfg-panel").classList.contains("open"),
    }));
    // После диалогов фокус может вернуться на пульт: он намеренно удерживает его видимым.
    await page.evaluate(() => document.activeElement?.blur());
    await page.mouse.move(400, 400);
    await page.waitForFunction(() => document.body.classList.contains("operator-idle"), { timeout: 30000 });
    // Переход прозрачности на software-WebGL может не успевать за кадрами,
    // поэтому читаем итоговое значение без transition.
    const idle = await page.evaluate(() => {
      const btn = document.querySelector(".cfg-toggle");
      btn.style.transition = "none";
      const style = getComputedStyle(btn);
      const value = { display: style.display, opacity: Number(style.opacity) };
      btn.style.transition = "";
      return value;
    });

    const result = {
      panelClosed, closed, opened, brandPanel, edited, isolation, exported, importedScene, importedProject, reset, idle, errors,
    };
    console.log(result);

    const expectedResetScale = 0.58;
    const expectedResetY = 0;
    // Каждое условие с именем: молчаливый exit 1 ничего не говорит о причине.
    const checks = {
      "нет ошибок страницы": errors.length === 0,
      "кнопка настроек видна": closed.display !== "none",
      "панель закрыта при старте": !closed.open,
      "панель открывается": opened.open,
      "вкладки всех сцен": opened.tabs.join(",") === "waiting,brand,partners,photo-pause,finale",
      "активная вкладка — интро": opened.active === "waiting",
      "заголовок панели 01": opened.heading === "01",
      "вкладка «Фон» открыта": brandPanel.open && brandPanel.active === "brand",
      "масштаб знака из настроек сцены": Number(brandPanel.scale) === 0.58,
      "смещение знака из настроек сцены": Number(brandPanel.offsetY) === 0,
      "правка применяется сразу": edited.live === 0.62,
      "правка сохраняется": edited.stored === 0.62,
      "интро не меняется от правки «Фона»": isolation.introScale === 0.47,
      "«Фон» сохраняет свою правку": isolation.brandScale === 0.62,
      "интро не получило чужое сохранение": isolation.introStored === null,
      "JSON сцены содержит logo и timeline": exported.sceneKeys.includes("logo") && exported.sceneKeys.includes("timeline"),
      // Готовых ролей теперь пять: к 01/02/08/09 добавились «Спонсоры» (04).
      "JSON проекта содержит все готовые сцены": exported.scenes.sort().join(",") === "brand,finale,partners,photo-pause,waiting",
      "версия проекта 2": exported.version === 2,
      "импорт сцены меняет масштаб": importedScene.scale === 0.54,
      "импорт сцены меняет смещение": importedScene.offsetY === 1.24,
      "импорт сцены сохраняется": importedScene.stored === 0.54,
      "импорт закрывает панель": importedScene.closed,
      "импорт проекта: «Фон»": importedProject.brand === 0.66,
      "импорт проекта: интро": importedProject.intro === 0.54,
      "сброс масштаба": reset.scale === expectedResetScale,
      "сброс смещения": reset.offsetY === expectedResetY,
      "в простое панель закрыта": !panelClosed.uiOn && !panelClosed.open,
      "кнопка в простое видна": idle.display !== "none",
      "кнопка в простое приглушена, но кликабельна": idle.opacity <= 0.8 && idle.opacity >= 0.3,
    };
    const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
    if (failed.length) {
      console.error(`FAIL: ${failed.join("; ")}`);
      process.exitCode = 1;
    } else {
      console.log("Настройки сцен, изоляция, JSON и простое — OK");
    }
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error("FAIL", e); process.exitCode = 1; });
