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
  const background = document.createElement("canvas");
  background.width = frame.width; background.height = frame.height;
  background.getContext("2d").drawImage(document.querySelector("#stage"), 0, 0);

  const a = frame.getContext("2d").getImageData(300, 490, 1320, 390).data;
  const b = background.getContext("2d").getImageData(300, 490, 1320, 390).data;
  let captionPixels = 0;
  for (let i = 0; i < a.length; i += 4) {
    if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) +
        Math.abs(a[i + 2] - b[i + 2]) > 30) captionPixels++;
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
  const state = {
    id: L.activeScene.id,
    cycle: L.runtime.cycle,
    format: [frame.width, frame.height],
    captionPixels,
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
    photoRing: scene.circularLabel ? {
      visible: scene.circularLabel.visible,
      opacity: scene.circularLabel.material.opacity,
      aligned: scene.circularLabel.position.distanceTo(scene.logo.root.position) < 1,
      painted: scene.labelCanvas.getContext("2d").getImageData(0, 0, 1024, 1024).data.some((v, i) => i % 4 === 3 && v > 0),
      parent: scene.viewfinder.parent === scene.camera && scene.camera.parent === scene.scene,
      titleHidden: getComputedStyle(title).display === "none",
    } : null,
  };

  const tl = L.cfg.timeline;
  const start = tl.startDelay || 0;
  if (state.id === "finale") {
    // Тот же посимвольный порядок, что у первой заставки.
    scene.update(start + tl.drawDuration + tl.emergeDuration / 2 + 1.2, 1 / 60);
    state.phraseInProgress = parseFloat(subtitle.style.getPropertyValue("--p")) > 0 &&
      parseFloat(subtitle.style.getPropertyValue("--f")) === 0;
  }
  scene.update(start + tl.drawDuration * 0.45, 1 / 60);
  const intro = { plotter: scene.plotter.group.visible, sweep: scene.plotter.uniforms.uSweep.value,
    logoStillHidden: scene.logo.outlineU.uDraw.value === 0, isIntro: scene.isIntro,
    openingBeams: scene.background.uniforms.uIntroLight.value, cameraZ: scene.camera.position.z };
  const fadeStart = start + tl.drawDuration + tl.emergeDuration + tl.holdDuration;
  scene.update(fadeStart + tl.fadeDuration * 0.92, 1 / 60);
  const retire = scene.logo.outlineU.uRetire.value;
  const u = Math.max(0, Math.min(1, (retire - 0.27) / 0.73));
  const pathTime = 1 - u * u * (3 - 2 * u);
  const point = scene.logo.parsed.subPaths[0].getPointAt(pathTime);
  const anchor = scene.logo.outline.localToWorld(scene.logo.root.position.clone().set(
    point.x - scene.logo.parsed.cx, point.y - scene.logo.parsed.cy, 0));
  const tip = scene.plotter.head.getWorldPosition(anchor.clone());
  const exit = { reverse: scene.logo.outline.visible && scene.logo.outlineU.uReverse.value === 1 && retire > 0,
    titleGone: parseFloat(title.style.getPropertyValue("--p")) === 0,
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
      captionSafe: !scene.contourWaves || scene.contourWaves.layers.every(({ material }) => material.uniforms.uCaptionSafe.value === 1),
      centerRing: scene.corners.centerRing.visible,
      waves: scene.contourWaves?.layers.map(({ layer, material }) => ({
        scale: layer.scale.x, opacity: material.uniforms.uOpacity.value, visible: layer.visible,
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
    for (const element of document.querySelectorAll("#caption [data-text]")) {
      if (getComputedStyle(element).display === "none" ||
          parseFloat(element.style.getPropertyValue("--p")) <= 0.001) continue;
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
  state.exit = exit;
  state.rewind = rewind;
  state.motion = motion;
  return state;
}

function assertSceneDesign(state) {
  const assert = require("node:assert/strict");
  assert.deepEqual(state.format, [1920, 1080], "размер экспортного кадра");
  if (state.id === "photo-pause") {
    assert.ok(state.photoRing?.visible && state.photoRing.opacity > 0 && state.photoRing.aligned &&
      state.photoRing.painted && state.photoRing.parent && state.photoRing.titleHidden,
      "круговой текст или уголки фотопаузы не подготовлены");
  } else assert.ok(state.captionPixels > 1000, "титр отсутствует в экспортном canvas");
  assert.ok(state.sharedBackground, "не видны кольца, частицы или угловой свет");
  assert.ok(state.warmCorners.every((ratio) => ratio > 0.05), "золотой фон не попал в WebGL-кадр");
  assert.ok(state.noPlotter, "вступительный циркуль не должен оставаться на удержании");
  assert.ok(state.intro.plotter && state.intro.sweep > 0 && state.intro.logoStillHidden,
    "вступление не рисуется как в первой заставке");
  assert.ok(!state.intro.isIntro && state.intro.openingBeams === 0 && state.intro.cameraZ === 9,
    "эффектный свет и подъезд камеры должны быть только в интро");
  assert.ok(state.exit.reverse && state.exit.titleGone && state.exit.pointOnContour,
    "точка не подхватывает обратный уход контура после титра");
  const { transfer, early, late, closed, seekStable } = state.rewind;
  assert.ok(transfer.visible && transfer.head > 0 && transfer.transfer > 0 && transfer.transfer < 1,
    "нет плавной передачи с контура на орбиту");
  assert.ok(early.visible && early.opacity > 0 && early.sweep > late.sweep && late.sweep > 0 &&
    early.curtain === 0 && seekStable, "обратная орбита не отматывается или зависит от seek");
  assert.equal(closed.curtain, 1, "шов не закрылся после отмотки");
  if (state.id !== "photo-pause") {
  assert.ok(state.layout.visibleLines > 10, "не удалось проверить расположение видимых строк");
  assert.ok(state.layout.minGap > 0, `текст не под логотипом: ${JSON.stringify(state.layout.closest)}`);
  assert.ok(state.layout.maxCenterOffset < 0.02, `текст не по центру: ${JSON.stringify(state.layout.mostOffset)}`);
  // Запрос заказчика: знак крупный, титр опущен в нижнюю треть, внизу нет пустого поля.
  assert.ok(state.layout.logoHeight > 0.41, `знак слишком мал: ${state.layout.logoHeight.toFixed(3)} высоты кадра`);
  assert.ok(state.layout.titleCenter > 0.60, `титр слишком высоко: ${state.layout.titleCenter.toFixed(3)}`);
  }
  assert.ok(state.motion.every((sample) => sample.waveVisible && sample.captionSafe && sample.centerRing &&
      sample.waves.some((wave) => wave.visible && wave.opacity > 0.04)),
    "контурные волны отсутствуют или не освобождают область титров");
  for (let i = 1; i < state.motion.length; i++) {
    const a = state.motion[i - 1], b = state.motion[i];
    assert.ok(b.backgroundTime > a.backgroundTime && b.particleTime > a.particleTime && b.tickAngle !== a.tickAngle,
      "фон, пыль и кольца должны постоянно двигаться");
    assert.ok(Math.abs(b.waves[0].scale - a.waves[0].scale) > 0.01, "контурная волна не движется");
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
