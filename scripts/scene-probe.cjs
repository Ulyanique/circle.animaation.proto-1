// Выполняется в браузере через page.evaluate; не зависит от переменных Node.
// Проверяем настоящий экспортный кадр и геометрию титров на протяжении цикла,
// не запуская для каждого замера медленный software-WebGL-рендер.
async function inspectSceneDesign() {
  await document.fonts.ready;
  const L = window.__logo;
  const scene = L.scene;
  L.cfg.playback.paused = true;
  window.requestAnimationFrame = () => 0;
  const middle = L.runtime.cycle / 2;
  const frame = L.compositeFrameAt(middle);
  // Титр рисуется внутри WebGL-прохода: эталон без него — тот же композит.
  const background = L.compositeFrameAt(middle, 1 / 60, false);

  const countCaptionPixels = (withCaption, reference) => {
    const a = withCaption.getContext("2d").getImageData(300, 490, 1320, 390).data;
    const b = reference.getContext("2d").getImageData(300, 490, 1320, 390).data;
    let pixels = 0;
    for (let i = 0; i < a.length; i += 4) {
      if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) +
          Math.abs(a[i + 2] - b[i + 2]) > 30) pixels++;
    }
    return pixels;
  };
  const captionPixels = countCaptionPixels(frame, background);
  // Отдельный титр в фирменном фоне по умолчанию скрыт: его место занимает
  // круговая надпись. Проверяем, что включённый титр действительно попадает
  // в экспортный кадр, а не остаётся только в DOM.
  let captionPixelsWhenEnabled = null;
  if (L.cfg.caption?.titleVisible === false) {
    const titleEl = document.querySelector("#caption .cap-title");
    const hidden = titleEl?.style.visibility;
    if (titleEl) titleEl.style.visibility = "";
    const enabled = L.compositeFrameAt(middle);
    const enabledBackground = L.compositeFrameAt(middle, 1 / 60, false);
    captionPixelsWhenEnabled = countCaptionPixels(enabled, enabledBackground);
    if (titleEl) titleEl.style.visibility = hidden;
  }
  // Проверяем именно пиксели финального WebGL-кадра, а не только настройки сцены.
  const warmRatio = (x, y, w, h) => {
    const data = background.getContext("2d").getImageData(x, y, w, h).data;
    let warm = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] > 80 && data[i + 1] > 45 && data[i + 2] < data[i] * 0.8) warm++;
    }
    return warm / (w * h);
  };
  const warmCorners = [warmRatio(0, 0, 500, 360), warmRatio(1420, 720, 500, 360)];
  const title = document.querySelector(".cap-title");
  const subtitle = document.querySelector(".cap-sub");
  // Круговая надпись фотопаузы по умолчанию выключена конфигом сцены.
  // Проверяем и текущее состояние, и подготовку кольца, когда оно включено.
  const readPhotoRing = () => scene.viewfinder && scene.circularLabel ? {
    visible: scene.circularLabel.visible,
    opacity: scene.circularLabel.material.opacity,
    aligned: scene.circularLabel.position.distanceTo(scene.logo.root.position) < 1,
    painted: scene.circularText.canvas.getContext("2d")
      .getImageData(0, 0, scene.circularText.canvas.width, scene.circularText.canvas.height)
      .data.some((v, i) => i % 4 === 3 && v > 0),
    parent: scene.viewfinder.parent === scene.camera && scene.camera.parent === scene.scene,
    titleHidden: getComputedStyle(title).display === "none",
  } : null;
  const state = {
    id: L.activeScene.id,
    cycle: L.runtime.cycle,
    format: [frame.width, frame.height],
    captionPixels,
    captionPixelsWhenEnabled,
    // Есть ли в этой сцене хоть одна строка штатного титра: у фирменного фона
    // название выключено настройками, а остальные строки скрыты стилями сцены,
    // поэтому проверка расположения строк к нему не применяется.
    captionEnabled: ["title", "subtitle", "date"].some((name) => {
      if (L.cfg.caption?.[`${name}Visible`] === false) return false;
      const element = document.querySelector(`.cap-${name}`);
      if (!element) return false;
      const style = getComputedStyle(element);
      return style.display !== "none" && style.visibility !== "hidden";
    }),
    warmCorners,
    title: title.textContent.replaceAll("\u00a0", " "),
    subtitle: getComputedStyle(subtitle).display === "none" ? false : subtitle.textContent.replaceAll("\u00a0", " "),
    onlyTitle: [...document.querySelectorAll(".cap-rule,.cap-sub,.cap-date")]
      .every((element) => getComputedStyle(element).display === "none"),
    noDate: getComputedStyle(document.querySelector(".cap-date")).display === "none",
    noPlotter: !scene.plotter.group.visible,
    sharedBackground: scene.corners.group.visible && scene.particles.group.visible &&
      scene.solarBokeh.group.visible && scene.particles.dust?.material.uniforms.uBright.value > 0 &&
      ["left", "right"].every((side) => {
        const s = scene.corners.sides[side];
        return s.group.visible && s.layers.length > 0 &&
          s.layers.some((layer) => layer.mesh.visible && layer.mesh.material.opacity > 0 && layer.u.value > 0);
      }) && scene.background.uniforms.uEnvL.value > 0.1 && scene.background.uniforms.uEnvR.value > 0.1,
    viewfinder: Boolean(scene.viewfinder?.visible),
    introStyle: Boolean(scene.introStyle),
    introScene: Boolean(scene.isIntro),
    // Уголки кадра есть только у фотопаузы; у фоновой композиции кольцо без них.
    photoRing: readPhotoRing(),
    photoRingWhenEnabled: null,
  };

  // Та же фотопауза с включённой круговой надписью: кольцо должно быть видно.
  if (state.id === "photo-pause" && L.cfg.photo.textEnabled === false) {
    const previous = L.cfg.photo.textEnabled;
    L.cfg.photo.textEnabled = true;
    scene.update(middle, 1 / 60);
    state.photoRingWhenEnabled = readPhotoRing();
    L.cfg.photo.textEnabled = previous;
    scene.update(middle, 1 / 60);
  }

  const tl = L.cfg.timeline;
  const start = tl.startDelay || 0;
  if (state.id === "finale") {
    // Финальная фраза по умолчанию проявляется целиком (плавное появление),
    // поэтому «идёт написание» — это частичная видимость строки на входе,
    // а не промежуточный --p отдельной буквы.
    const visibilityOf = (el) => {
      const outline = parseFloat(el.style.getPropertyValue("--p")) || 0;
      const raw = el.style.getPropertyValue("--caption-reveal");
      return outline * (raw === "" ? 1 : parseFloat(raw) || 0);
    };
    const samples = [];
    for (let i = 0; i <= 120; i++) {
      scene.update(start + L.runtime.cycle * i / 120, 1 / 60);
      samples.push(visibilityOf(subtitle));
    }
    const partial = samples.findIndex((v) => v > 0.05 && v < 0.95);
    state.phraseInProgress = partial >= 0 && samples.slice(partial).some((v) => v > 0.99);
    state.phraseMin = Math.min(...samples);
    state.phraseMax = Math.max(...samples);
  }
  scene.update(start + tl.drawDuration * 0.45, 1 / 60);
  // В фотопаузе на входе круговой штрих заменяет циркуль апертурой кадра.
  const intro = { plotter: scene.plotter.group.visible || Boolean(scene.aperture?.group.visible),
    aperture: Boolean(scene.aperture?.group.visible), sweep: scene.plotter.uniforms.uSweep.value,
    logoStillHidden: scene.logo.outlineU.uDraw.value === 0, isIntro: scene.isIntro,
    openingBeams: scene._openingBeams ?? scene.background.uniforms.uIntroLight.value, cameraZ: scene.camera.position.z };
  const fadeStart = start + tl.drawDuration + tl.emergeDuration + tl.holdDuration;
  scene.update(fadeStart + tl.fadeDuration * 0.92, 1 / 60);
  const retire = scene.logo.outlineU.uRetire.value;
  // Интро сворачивает контур в начале ухода, а не у самого шва: ищем пик отмотки
  // внутри фазы ухода, чтобы не зависеть от одного момента времени.
  let introReverse = false;
  for (let i = 0; i <= 40; i++) {
    scene.update(fadeStart + tl.fadeDuration * (0.55 + 0.4 * i / 40), 1 / 60);
    if (scene.logo.outline.visible && scene.logo.outlineU.uReverse.value === 1 &&
        scene.logo.outlineU.uRetire.value > 0) introReverse = true;
  }
  scene.update(fadeStart + tl.fadeDuration * 0.92, 1 / 60);
  // Финальный уход собран иначе: знак уходит в глубину и стирается вместе с
  // окружностью, а последняя фраза встаёт в центр. Обратную обводку контура и
  // орбиту после титра проверяем только у сцен с общим уходом.
  const finaleExit = scene._finaleState ? {
    active: Boolean(scene._finaleState.active), reveal: scene._finaleState.reveal,
    draw: scene._finaleState.draw, subtitleCenter: scene._finaleState.subtitleCenter,
    blackout: scene._finaleState.blackout, logoZ: scene.logo.root.position.z,
  } : null;
  const u = Math.max(0, Math.min(1, (retire - 0.27) / 0.73));
  const pathTime = 1 - u * u * (3 - 2 * u);
  const point = scene.logo.parsed.subPaths[0].getPointAt(pathTime);
  const anchor = scene.logo.outline.localToWorld(scene.logo.root.position.clone().set(
    point.x - scene.logo.parsed.cx, point.y - scene.logo.parsed.cy, 0));
  const tip = scene.plotter.head.getWorldPosition(anchor.clone());
  // Штатный титр по умолчанию гаснет целиком: --p остаётся 1, а видимость
  // задаёт --caption-reveal. Проверяем произведение, как его видит кадр.
  const captionVisibility = (el) => {
    const outline = parseFloat(el.style.getPropertyValue("--p")) || 0;
    const raw = el.style.getPropertyValue("--caption-reveal");
    const reveal = raw === "" ? 1 : parseFloat(raw) || 0;
    return outline * reveal;
  };
  const exit = { reverse: introReverse || (scene.logo.outline.visible && scene.logo.outlineU.uReverse.value === 1 && retire > 0),
    titleGone: captionVisibility(title) === 0,
    pointOnContour: scene.plotter.group.visible && scene.plotter.head.material.opacity > 0 && tip.distanceTo(anchor) < 0.001 };
  const fadeEnd = fadeStart + tl.fadeDuration;
  const span = Math.min(tl.restDuration, 1.2);
  const orbitAt = (p) => {
    scene.update(fadeEnd + span * p, 1 / 60);
    return { visible: scene.plotter.group.visible, head: scene.plotter.head.material.opacity,
      sweep: scene.plotter.uniforms.uSweep.value, transfer: scene.plotter.uniforms.uTransfer.value,
      opacity: scene.plotter.uniforms.uOpacity.value, curtain: scene.seamCurtain.material.opacity,
      position: scene.plotter.head.getWorldPosition(anchor.clone()).toArray() };
  };
  const transfer = orbitAt(0.12), early = orbitAt(0.38), late = orbitAt(0.62), again = orbitAt(0.38);
  const closed = orbitAt(0.95);
  const rewind = { transfer, early, late, closed,
    seekStable: early.position.every((value, i) => Math.abs(value - again.position[i]) < 1e-8) &&
      Math.abs(early.sweep - again.sweep) < 1e-8 };
  const holdStart = start + tl.drawDuration + tl.emergeDuration;
  const motion = [0.25, 0.5, 0.75].map((p) => {
    const time = holdStart + tl.holdDuration * p;
    scene.update(time, 1 / 60);
    return { time, backgroundTime: scene.background.uniforms.uTime.value,
      tickAngle: scene.corners.sides.left.ticks.rotation.z,
      particleTime: scene.particles.dust.material.uniforms.uTime.value,
      waveVisible: Boolean(scene.contourWaves?.group.visible),
      decorVisible: Boolean(scene.brandDecor?.group.visible),
      decorAngle: scene.brandDecor?.ticks.rotation.z ?? null,
      captionSafe: !scene.contourWaves || scene.contourWaves.layers.every(({ material }) => material.uniforms.uCaptionSafe.value === (state.id === "photo-pause" ? 0 : 1)),
      centerRing: scene.corners.centerRing.visible,
      waves: scene.contourWaves?.layers.map(({ layer, material }) => ({
        distance: material.uniforms.uRadius.value, opacity: material.uniforms.uOpacity.value, visible: layer.visible,
      })) ?? [] };
  });

  const mesh = scene.logo.mesh;
  if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
  const box = mesh.geometry.boundingBox;
  const stage = document.querySelector("#stage").getBoundingClientRect();
  let minGap = Infinity, maxCenterOffset = 0, visibleLines = 0;
  let closest = null, mostOffset = null;
  for (let i = 0; i <= 60; i++) {
    const time = (L.cfg.timeline.startDelay || 0) + L.runtime.cycle * i / 60;
    scene.update(time, 1 / 60);
    scene.camera.updateMatrixWorld(true);
    mesh.updateWorldMatrix(true, false);
    let minX = Infinity, maxX = -Infinity, bottomY = -Infinity;
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) {
      for (const z of [box.min.z, box.max.z]) {
        const point = box.min.clone().set(x, y, z).applyMatrix4(mesh.matrixWorld).project(scene.camera);
        const px = stage.left + (point.x + 1) * stage.width / 2;
        const py = stage.top + (1 - point.y) * stage.height / 2;
        minX = Math.min(minX, px); maxX = Math.max(maxX, px); bottomY = Math.max(bottomY, py);
      }
    }
    const logoCenter = (minX + maxX) / 2;
    // В финале последняя фраза намеренно уходит в центр кадра, к уходящему
    // знаку: правило «текст под логотипом» действует только до этого движения.
    const subtitleMoved = (scene._finaleState?.subtitleCenter ?? 0) > 0.02;
    for (const element of document.querySelectorAll("#caption [data-text]")) {
      if (subtitleMoved) break;
      // Выключенная в настройках строка остаётся в DOM, но в кадр не попадает.
      const style = getComputedStyle(element);
      const reveal = element.style.getPropertyValue("--caption-reveal");
      if (style.display === "none" || style.visibility === "hidden" ||
          parseFloat(style.opacity) === 0 ||
          parseFloat(element.style.getPropertyValue("--p")) <= 0.001 ||
          (reveal !== "" && parseFloat(reveal) <= 0.001)) continue;
      const rect = element.getBoundingClientRect();
      const gap = (rect.top - bottomY) / stage.height;
      const centerOffset = Math.abs((rect.left + rect.right) / 2 - logoCenter) / stage.width;
      visibleLines++;
      if (gap < minGap) {
        minGap = gap;
        closest = { time, line: element.className, gapPx: rect.top - bottomY };
      }
      if (centerOffset > maxCenterOffset) {
        maxCenterOffset = centerOffset;
        mostOffset = { time, line: element.className, offsetPx: centerOffset * stage.width };
      }
    }
  }
  // Оставляем на экране средний кадр для необязательного снимка OUT.
  scene.update(middle, 1 / 60);
  // Композиция фоновых сцен: крупный знак и титр в нижней трети кадра.
  scene.camera.updateMatrixWorld(true);
  mesh.updateWorldMatrix(true, false);
  let topPx = Infinity, bottomPx = -Infinity;
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) {
    for (const z of [box.min.z, box.max.z]) {
      const point = box.min.clone().set(x, y, z).applyMatrix4(mesh.matrixWorld).project(scene.camera);
      const py = stage.top + (1 - point.y) * stage.height / 2;
      topPx = Math.min(topPx, py); bottomPx = Math.max(bottomPx, py);
    }
  }
  const titleRect = document.querySelector("#caption .cap-title").getBoundingClientRect();
  state.layout = { visibleLines, minGap, maxCenterOffset, closest, mostOffset,
    logoHeight: (bottomPx - topPx) / stage.height,
    logoTop: (topPx - stage.top) / stage.height,
    titleCenter: (titleRect.top + titleRect.bottom) / 2 / stage.height };
  state.intro = intro;
  state.finaleExit = finaleExit;
  state.exit = exit;
  state.rewind = rewind;
  state.motion = motion;
  return state;
}

function assertSceneDesign(state) {
  const assert = require("node:assert/strict");
  assert.deepEqual(state.format, [1920, 1080], "размер экспортного кадра");
  if (state.id === "photo-pause") {
    // Кольцо по умолчанию выключено настройками, но при включении обязано быть
    // готовым: текст нарисован, кольцо совмещено со знаком, уголки в камере.
    const ring = state.photoRing?.visible ? state.photoRing : state.photoRingWhenEnabled;
    assert.ok(ring?.visible && ring.opacity > 0 && ring.aligned &&
      ring.painted && ring.parent && ring.titleHidden,
      "круговой текст или уголки фотопаузы не подготовлены");
  } else if (state.captionPixelsWhenEnabled !== null) {
    // Скрытый по умолчанию титр: в кадре его быть не должно, но включённый
    // обязан попасть в тот же экспортный canvas.
    assert.equal(state.captionPixels, 0, "скрытый титр всё же попал в кадр");
    assert.ok(state.captionPixelsWhenEnabled > 1000, "включённый титр отсутствует в экспортном canvas");
  } else assert.ok(state.captionPixels > 1000, "титр отсутствует в экспортном canvas");
  assert.ok(state.sharedBackground, "не видны кольца, частицы или угловой свет");
  assert.ok(state.warmCorners.every((ratio) => ratio > 0.05), "золотой фон не попал в WebGL-кадр");
  assert.ok(state.noPlotter, "вступительный циркуль не должен оставаться на удержании");
  assert.ok(state.intro.plotter && state.intro.sweep > 0 && state.intro.logoStillHidden,
    "вступление не рисуется как в первой заставке");
  // Финал намеренно собран как собственное интро (introStyle): у него свои
  // стартовые лучи и подъезд камеры, поэтому граница действует для фоновых сцен.
  assert.ok(state.introStyle || (!state.intro.isIntro && state.intro.openingBeams === 0 && state.intro.cameraZ === 9),
    "эффектный свет и подъезд камеры должны быть только в интро");
  assert.ok(state.exit.titleGone, "титр не ушёл к концу сцены");
  if (state.finaleExit) {
    const f = state.finaleExit;
    assert.ok(f.active && f.reveal < 0.05 && f.draw < 0.05, "финальный уход не стирает знак");
    assert.ok(f.subtitleCenter > 0.99 && f.blackout > 0.99, "фраза не встала в центр на тёмном фоне");
    assert.ok(f.logoZ < -1, "знак не ушёл в глубину");
  } else if (state.introScene) {
    // У интро свой обратный выход: точка возвращается по контуру и сворачивает
    // окружность, шторка закрывает шов. Орбиты после титра здесь нет.
    assert.ok(state.exit.reverse, "интро не отматывает контур обратно");
    assert.equal(state.rewind.closed.curtain, 1, "шов не закрылся после отмотки");
    assert.ok(state.rewind.seekStable, "обратный выход зависит от seek");
  } else {
    assert.ok(state.exit.reverse && state.exit.pointOnContour,
      "точка не подхватывает обратный уход контура после титра");
    const { transfer, early, late, closed, seekStable } = state.rewind;
    assert.ok(transfer.visible && transfer.head > 0 && transfer.transfer > 0 && transfer.transfer < 1,
      "нет плавной передачи с контура на орбиту");
    assert.ok(early.visible && early.opacity > 0 && early.sweep > late.sweep && late.sweep > 0 &&
      early.curtain === 0 && seekStable, "обратная орбита не отматывается или зависит от seek");
    assert.equal(closed.curtain, 1, "шов не закрылся после отмотки");
  }
  if (state.id !== "photo-pause" && state.captionEnabled) {
  assert.ok(state.layout.visibleLines > 10, "не удалось проверить расположение видимых строк");
  assert.ok(state.layout.minGap > 0, `текст не под логотипом: ${JSON.stringify(state.layout.closest)}`);
  assert.ok(state.layout.maxCenterOffset < 0.02, `текст не по центру: ${JSON.stringify(state.layout.mostOffset)}`);
  // Запрос заказчика: знак крупный, титр опущен в нижнюю треть, внизу нет пустого поля.
  assert.ok(state.layout.logoHeight > 0.41, `знак слишком мал: ${state.layout.logoHeight.toFixed(3)} высоты кадра`);
  assert.ok(state.layout.titleCenter > 0.60, `титр слишком высоко: ${state.layout.titleCenter.toFixed(3)}`);
  }
  if (state.id === "brand") {
    assert.ok(state.motion.every((sample) => sample.decorVisible), "нет построительной окружности");
    assert.notEqual(state.motion[0].decorAngle, state.motion[1].decorAngle, "разметка не вращается");
  } else {
    assert.ok(state.motion.every((sample) => !sample.decorVisible), "декор должен быть только в сцене 02");
  }
  if (state.id === "photo-pause") {
    assert.ok(state.motion.every((sample) => sample.waveVisible && sample.captionSafe && sample.centerRing &&
        sample.waves.some((wave) => wave.visible && wave.opacity > 0.02)),
      "в фотопаузе отсутствуют контурные волны");
  } else {
    assert.ok(state.motion.every((sample) => !sample.waveVisible && sample.waves.length === 0),
      "волны от логотипа должны быть только в фотопаузе");
  }
  for (let i = 1; i < state.motion.length; i++) {
    const a = state.motion[i - 1], b = state.motion[i];
    assert.ok(b.backgroundTime > a.backgroundTime && b.particleTime > a.particleTime && b.tickAngle !== a.tickAngle,
      "фон, пыль и кольца должны постоянно двигаться");
    if (state.id === "photo-pause") assert.ok(Math.abs(b.waves[0].distance - a.waves[0].distance) > 0.001, "контурная волна не движется");
  }
}

async function countSeamDifferences(page, cycle) {
  const { PNG } = require("pngjs");
  // boot-ready уже включает сцену, но загрузочный экран ещё 0,45 с исчезает.
  // Сравниваем именно кадры ролика, а не случайную фазу исчезновения интерфейса.
  await page.waitForSelector("#boot-screen", { hidden: true, timeout: 10000 });
  const capture = async (time) => {
    await page.evaluate((t) => window.__logo.renderAt(t), time);
    return PNG.sync.read(Buffer.from(await page.screenshot({ type: "png" })));
  };
  const first = await capture(0);
  const last = await capture(cycle - 1 / 60);
  let changed = 0;
  for (let i = 0; i < first.data.length; i += 4) {
    const delta = Math.abs(first.data[i] - last.data[i]) +
      Math.abs(first.data[i + 1] - last.data[i + 1]) +
      Math.abs(first.data[i + 2] - last.data[i + 2]);
    if (delta > 3) changed++;
  }
  return changed;
}

module.exports = { inspectSceneDesign, assertSceneDesign, countSeamDifferences };
