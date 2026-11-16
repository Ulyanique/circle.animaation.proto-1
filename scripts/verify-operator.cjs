// Пульт, перемотка, изменение длительности и переходы между готовыми видами.
const { launchBrowser } = require("./browser.cjs");
(async () => {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
    const base = process.env.URL || "http://localhost:5173";
    await page.goto(new URL("/?scene=intro", base).href, { waitUntil: "networkidle0", timeout: 120000 });
    await page.waitForFunction(() => document.body.classList.contains("boot-ready"), { timeout: 240000 });
    const first = await page.evaluate(() => ({
      cursor: getComputedStyle(document.body).cursor,
      panel: !!document.querySelector(".operator-panel"),
      settings: getComputedStyle(document.querySelector(".cfg-toggle")).display !== "none",
      label: document.querySelector('[data-scene="waiting"]')?.textContent.trim(),
      isIntro: window.__logo.scene.isIntro && !window.__logo.scene.contourWaves,
    }));
    // Кадр перехода живёт ~1 с; на software-WebGL опрос может опоздать к его удалению,
    // поэтому фиксируем появление оверлея наблюдателем, а не чтением DOM после ожидания.
    await page.evaluate(() => {
      window.__sawTransition = false;
      new MutationObserver((records) => {
        for (const record of records) for (const node of record.addedNodes) {
          if (node.nodeType === 1 && node.classList?.contains("transition-frame")) window.__sawTransition = true;
        }
      }).observe(document.body, { childList: true });
      document.querySelector('[data-scene="brand"]').click();
    });
    await page.waitForFunction(() => window.__logo.activeScene.id === "brand", { timeout: 120000 });
    const crossfade = await page.evaluate(() => ({
      overlay: window.__sawTransition,
      canvasCount: document.querySelectorAll("#stage").length,
      samePage: location.search.includes("scene=brand"),
      brandTitle: document.querySelector(".cap-title").textContent.replaceAll("\u00a0", " "),
      brandNotIntro: !window.__logo.scene.isIntro && Boolean(window.__logo.scene.circularText),
    }));
    await page.waitForFunction(() => !document.querySelector(".transition-frame"), { timeout: 180000 });
    const edit = await page.evaluate(() => {
      const duration = document.querySelector('[data-action="duration"]');
      duration.value = "30";
      duration.dispatchEvent(new Event("change", { bubbles: true }));
      const range = document.querySelector('[data-action="seek"]');
      range.value = "15";
      range.dispatchEvent(new Event("input", { bubbles: true }));
      return { cycle: window.__logo.runtime.cycle, paused: window.__logo.cfg.playback.paused,
        time: window.__logo.runtime.time };
    });
    const auto = await page.evaluate(() => {
      document.querySelector('[data-action="auto"]').click();
      window.__logo.cfg.playback.paused = false;
      window.__logo.renderAt(window.__logo.runtime.cycle - 0.001);
      return window.__logo.operator.auto;
    });
    await page.waitForFunction(() => window.__logo.activeScene.id === "photo-pause", { timeout: 120000 });
    await page.waitForFunction(() => !document.querySelector(".transition-frame"), { timeout: 180000 });
    await page.evaluate(() => document.querySelector('[data-action="auto"]').click());
    await page.evaluate(() => document.querySelector('[data-scene="finale"]').click());
    await page.waitForFunction(() => window.__logo.activeScene.id === "finale", { timeout: 120000 });
    await page.waitForFunction(() => !document.querySelector(".transition-frame"), { timeout: 180000 });
    const finalState = await page.evaluate(() => ({
      title: document.querySelector(".cap-title").textContent.replaceAll("\u00a0", " "),
      phrase: document.querySelector(".cap-sub").textContent.replaceAll("\u00a0", " "),
      stage: [window.__logo.scene.renderer.domElement.width, window.__logo.scene.renderer.domElement.height],
    }));
    await page.evaluate(() => document.querySelector('[data-scene="waiting"]').click());
    await page.waitForFunction(() => window.__logo.activeScene.id === "waiting", { timeout: 120000 });
    const returnState = await page.evaluate(() => ({
      title: document.querySelector(".cap-title").textContent.replaceAll("\u00a0", " "),
      settings: getComputedStyle(document.querySelector(".cfg-toggle")).display !== "none",
      isIntro: window.__logo.scene.isIntro && !window.__logo.scene.contourWaves,
      introUrl: location.search.includes("scene=intro"),
    }));
    // Кнопка настроек в простое остаётся кликабельной, поэтому ждём приглушение,
    // а не исчезновение: панель должна быть доступна в каждой сцене.
    await page.waitForFunction(() => document.body.classList.contains("operator-idle"), { timeout: 15000 });
    const idle = await page.evaluate(() => {
      const btn = document.querySelector(".cfg-toggle");
      // transition читаем без анимации: software-WebGL не успевает за кадрами.
      btn.style.transition = "none";
      const style = getComputedStyle(btn);
      const buttonOpacity = style.opacity;
      btn.style.transition = "";
      return {
        cursor: getComputedStyle(document.body).cursor,
        buttonOpacity,
        panelOpacity: getComputedStyle(document.querySelector(".operator-panel")).opacity,
      };
    });
    // Пробуждение фиксируем наблюдателем: на software-WebGL кадры идут медленно,
    // и опрос может застать уже повторно добавленный класс простоя.
    await page.evaluate(() => {
      window.__awakened = false;
      new MutationObserver(() => {
        if (!document.body.classList.contains("operator-idle")) window.__awakened = true;
      }).observe(document.body, { attributes: true, attributeFilter: ["class"] });
    });
    await page.mouse.move(200, 180);
    await page.waitForFunction(() => window.__awakened, { timeout: 20000 }).catch(() => {});
    const awakened = await page.evaluate(() => window.__awakened);
    const result = { first, crossfade, edit, auto, finalState, returnState, idle, awakened, errors };
    console.log(result);
    // Именованные условия: молчаливый exit 1 не подсказывает, что сломалось.
    const checks = {
      "нет ошибок страницы": errors.length === 0,
      "курсор виден": first.cursor === "auto",
      "пульт на месте": Boolean(first.panel),
      "кнопка настроек видна": Boolean(first.settings),
      "подпись ролика — интро": first.label.includes("Интро"),
      "стартовали с интро": first.isIntro,
      "переход рисуется оверлеем": crossfade.overlay,
      "в кадре один canvas": crossfade.canvasCount === 1,
      "переход без перезагрузки": crossfade.samePage,
      // Волны контура — особенность «Фотопаузы», а не «Фона»: у фонового ролика
      // своя композиция (круговая надпись), поэтому здесь проверяем только смену
      // сцены без перезагрузки и без потери canvas.
      "переход не включает интро-режим": crossfade.brandNotIntro,
      "название после перехода": crossfade.brandTitle === "Янтарный циркуль",
      "длительность цикла 30 с": edit.cycle === 30,
      "пауза включена": Boolean(edit.paused),
      "перемотка на середину": Math.abs(edit.time - 15) <= 0.01,
      "автоцепочка включена": Boolean(auto),
      "название в финале": finalState.title === "Янтарный циркуль",
      "фраза в финале": finalState.phrase === "История продолжается",
      "кадр 1920×1080": finalState.stage.join("x") === "1920x1080",
      "возврат к интро": returnState.title === "Янтарный циркуль" && Boolean(returnState.isIntro),
      "кнопка настроек после возврата": Boolean(returnState.settings),
      "URL остался интро": Boolean(returnState.introUrl),
      "курсор в простое": idle.cursor === "auto",
      "кнопка в простое приглушена": Number(idle.buttonOpacity) <= 0.8 && Number(idle.buttonOpacity) >= 0.3,
      "пульт в простое скрыт": Number(idle.panelOpacity) <= 0.01,
      "движение мыши возвращает пульт": Boolean(awakened),
    };
    const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
    if (failed.length) {
      console.error(`FAIL: ${failed.join("; ")}`);
      process.exitCode = 1;
    } else {
      console.log("Пульт, переход, автоцепочка и простой — OK");
    }
  } finally { await browser.close(); }
})().catch((e) => { console.error("FAIL", e); process.exitCode = 1; });
