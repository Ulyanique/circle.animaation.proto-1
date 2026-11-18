import test from "node:test";
import assert from "node:assert/strict";
import {
  easeOutCubic, easeInOutCubic, easeOutBack, easeOutExpo, window01, glintSpan, reveal,
  framePathMetrics, framePathPoint, frameGlint, frameGold, framePathSpan, curvatureAt, frameContour,
  frameGoldSteps, goldColor, glintFalloff, goldSegmentCount,
} from "../src/partners-motion.js";

// Кривые движения проверяются числами, а не «на глаз»: от них зависит,
// дёргается ли анимация в конкретном кадре, и расходится ли экспорт с
// предпросмотром (вся сцена считается от времени кадра).

test("кривые начинаются в 0 и заканчиваются в 1", () => {
  for (const ease of [easeOutCubic, easeInOutCubic, easeOutExpo]) {
    assert.equal(ease(0), 0, ease.name);
    assert.equal(ease(1), 1, ease.name);
  }
  // easeOutBack намеренно перелетает 1 в середине, но на границах точен.
  assert.equal(easeOutBack(0), 0);
  assert.equal(easeOutBack(1), 1);
});

test("движение монотонно: кадр не откатывается назад", () => {
  for (const ease of [easeOutCubic, easeInOutCubic, easeOutExpo]) {
    let prev = -Infinity;
    for (let i = 0; i <= 100; i++) {
      const v = ease(i / 100);
      assert.ok(v >= prev - 1e-12, `${ease.name} откатилась на ${i / 100}`);
      prev = v;
    }
  }
});

test("easeOutBack даёт перелёт, но не вылет за разумные пределы", () => {
  let max = 0;
  for (let i = 0; i <= 100; i++) max = Math.max(max, easeOutBack(i / 100));
  assert.ok(max > 1, "перелёт нужен для «доезда» знака");
  assert.ok(max < 1.12, `перелёт ${max.toFixed(3)} слишком велик`);
});

test("значения вне диапазона зажимаются", () => {
  assert.equal(easeOutCubic(-1), 0);
  assert.equal(easeOutCubic(2), 1);
  assert.equal(window01(-5, 0, 1), 0);
  assert.equal(window01(5, 0, 1), 1);
});

test("окно нулевой длины не залипает в середине", () => {
  // Если span не задан, событие либо не началось, либо уже произошло —
  // промежуточного состояния быть не должно, иначе элемент «зависнет» посередине.
  assert.equal(window01(0.5, 1, 0), 0);
  assert.equal(window01(1.5, 1, 0), 1);
});

test("блик проходит слева направо и гаснет за пределами окна", () => {
  assert.equal(glintSpan(0.5, { start: 2, span: 1 }), null, "до начала — нет блика");
  assert.equal(glintSpan(3.5, { start: 2, span: 1 }), null, "после — нет блика");

  let prev = -Infinity;
  const xs = [];
  for (let t = 2; t <= 3; t += 0.02) {
    const x = glintSpan(t, { start: 2, span: 1 });
    if (x === null) continue;
    assert.ok(x >= prev - 1e-9, "блик не должен ходить назад");
    prev = x;
    xs.push(x);
  }
  assert.ok(xs.length > 10, "внутри окна блик должен быть виден");
  assert.ok(xs[0] < 0.1, `блик должен входить слева, а вошёл в ${xs[0]}`);
  assert.ok(xs.at(-1) > 0.9, `блик должен уходить вправо, а ушёл в ${xs.at(-1)}`);
});

test("появление включает подъём и масштаб, которые сходят на нет", () => {
  const before = reveal(0, 1, 1);
  assert.equal(before.alpha, 0);
  assert.ok(before.offsetY > 0, "до появления элемент ниже своего места");
  assert.ok(before.scale < 1, "до появления элемент чуть меньше");

  const after = reveal(2, 1, 1);
  assert.equal(after.alpha, 1);
  assert.equal(after.offsetY, 0);
  assert.equal(after.scale, 1);
});

test("расчёты не зависят от текущего времени — экспорт совпадёт с превью", () => {
  // Одна и та же секунда сцены обязана давать одно и то же значение, сколько
  // бы раз её ни запросили: иначе покадровая запись разойдётся с предпросмотром.
  const times = [0, 0.37, 1.42, 2.9, 5.3, 8, 9.5, 12];
  for (const t of times) {
    const a = reveal(t, 0.5, 1.2);
    const b = reveal(t, 0.5, 1.2);
    assert.deepEqual(a, b);
    assert.equal(glintSpan(t, { start: 2, span: 1 }), glintSpan(t, { start: 2, span: 1 }));
  }
});

// Раскладка событий сцены: вход, блики, удержание. Проверяется численно,
// потому что «на глаз» легко принять одинаковое проявление за анимацию.
import { partnersCues } from "../src/partners-graphics.js";

const PARTNERS_TIMELINE = Object.freeze({
  drawDuration: 2.6, emergeDuration: 2.4, holdDuration: 10.6, fadeDuration: 2.3,
});
const cueAt = (local) => partnersCues({ local, beforeStart: false, cycle: 20 }, PARTNERS_TIMELINE, 1);

test("знаки входят очередью, а не все сразу", () => {
  const at = cueAt(2.9);
  assert.ok(at.organizer > 0.9, "первый организатор уже на месте");
  assert.ok(at.organizerSecond < at.organizer, "второй отстаёт от первого");
  assert.equal(at.partner, 0, "спонсоры ещё не начались");
});

test("вход решительный: знак появляется за секунду, а не за две", () => {
  // Окна входа заданы в долях drawDuration (0.65 → 1.03), то есть 1.69–2.68 с.
  // Считаем от самого таймлайна, а не от магических чисел: если кто-то снова
  // растянет вход до 2,3 с, тест это поймает.
  const span = (1.03 - 0.65) * PARTNERS_TIMELINE.drawDuration;
  assert.ok(span < 1.2, `вход занимает ${span.toFixed(2)} с — это снова «выползание»`);

  const start = 0.65 * PARTNERS_TIMELINE.drawDuration;
  assert.equal(cueAt(start - 0.4).organizer, 0, "до входа знака нет вовсе");
  // Середина окна: знак уже заметно проявлен, а не «чуть-чуть».
  assert.ok(cueAt(start + span / 2).organizer > 0.4, "в середине окна знак уже виден");
  assert.ok(cueAt(start + span + 0.1).organizer > 0.99, "после окна знак на месте");
});

test("на удержании есть жизнь: дыхание и второй блик включены", () => {
  const hold = cueAt(9);
  assert.ok(hold.idle > 0.9, "дыхание работает — иначе кадр статичен");
  assert.ok(hold.holdGlint > 0.5, "второй проход блика запланирован");
  assert.ok(hold.shadow > 0.5, "тень под знаками держится");
  // Дыхание не должно превращаться в качку.
  assert.ok(hold.idle <= 1);
});

test("к уходу сцены движение гаснет вместе с кадром", () => {
  const exitStart = 2.6 + 2.4 + 10.6;
  const late = cueAt(exitStart + 2.2);
  assert.ok(late.visible < 0.05, "сцена ушла");
  assert.ok(late.idle < 0.05, "движение тоже погасло, а не дёргается на выходе");
});

test("блик не задевает края строки заголовка — там металл должен быть ровным", () => {
  // Полоса идёт внутри надписи; на самом краю она обязана быть нулевой,
  // иначе по краям букв появляются «швы» из светлых пикселей.
  for (const t of [5.7, 6.2, 6.7, 7.2]) {
    const span = glintSpan(t, { start: 5.6, span: 1.9, from: -0.12, to: 1.12 });
    if (span === null) continue;
    assert.ok(span > -0.2 && span < 1.2, `полоса блика вышла за строку: ${span.toFixed(3)}`);
  }
});

// Раскладка пары: центрирование по колонкам не спасало, потому что знаки разной
// ширины. Проверяем симметрию полей и зазора численно.
import { pairLayout } from "../src/partners-motion.js";

test("пара строится симметрично при знаках разной ширины", () => {
  // Реальные ширины ярусов: 411 и 500 px у организаторов, 376 и 498 у спонсоров.
  for (const [leftWidth, rightWidth] of [[411, 500], [376, 498], [300, 300]]) {
    const l = pairLayout({ center: 960, leftWidth, rightWidth, container: 1010, gap: 90 });
    // Внешние поля равны по построению: контейнер стоит по центру кадра.
    const leftField = l.leftX - l.leftWidth / 2 - (960 - 450);
    const rightField = 960 + 450 - (l.rightX + l.rightWidth / 2);
    assert.ok(Math.abs(leftField - rightField) <= 1, `поля ${leftField} и ${rightField}`);
    // Зазор не меньше заданного — знаки не срастаются.
    assert.ok(l.innerGap >= 90 - 1, `зазор ${l.innerGap} вместо 90`);
    // Середина пары — ось кадра.
    assert.ok(Math.abs((l.leftX - l.leftWidth / 2 + l.rightX + l.rightWidth / 2) / 2 - 960) <= 1);
  }
});

test("свободное место уходит в зазор, знаки не растягиваются", () => {
  // Реальный ярус организаторов: 411 + 500 + 90 = 1001 — влезает в 1010.
  const l = pairLayout({ center: 960, leftWidth: 411, rightWidth: 500, container: 1010, gap: 90 });
  assert.equal(l.fit, 1, "места хватает — ужимать нечего");
  assert.equal(Math.round(l.leftWidth), 411);
  assert.equal(Math.round(l.rightWidth), 500);
  // Спонсоры уже: свободное место уходит в зазор, а не в растягивание знаков.
  const wide = pairLayout({ center: 960, leftWidth: 376, rightWidth: 498, container: 1010, gap: 90 });
  assert.equal(wide.fit, 1);
  assert.equal(Math.round(wide.leftWidth), 376);
  assert.equal(wide.innerGap, 136, "свободные 136 px — зазор");
  // Внешние края обоих ярусов совпадают: 960 ± 505 (±1 px на округление центра).
  const outerLeft = (p) => p.leftX - p.leftWidth / 2;
  assert.ok(Math.abs(outerLeft(l) - 455) <= 1, `левый край ${outerLeft(l)} вместо 455`);
  assert.ok(Math.abs(outerLeft(wide) - 455) <= 1, `левый край ${outerLeft(wide)} вместо 455`);
});

test("при нехватке места оба знака ужимаются ОДНИМ коэффициентом", () => {
  // Пропорции логотипов священны: fit общий, отношение ширин сохраняется.
  const l = pairLayout({ center: 960, leftWidth: 600, rightWidth: 500, container: 900, gap: 90 });
  assert.ok(l.fit < 1, "должен включиться ужим");
  assert.ok(Math.abs(l.innerGap - 90) <= 1, `зазор ${l.innerGap} вместо 90`);
  assert.ok(Math.abs(l.leftWidth / l.rightWidth - 600 / 500) < 1e-6, "отношение ширин изменилось");
  assert.ok(Math.abs(l.leftWidth + l.rightWidth + 90 - 900) <= 1, "пара должна ровно заполнить контейнер");
  assert.ok(Math.abs(l.leftX - l.leftWidth / 2 - 510) <= 1, `левый край ${l.leftX - l.leftWidth / 2} вместо 510`);
  assert.ok(Math.abs(l.rightX + l.rightWidth / 2 - 1410) <= 1, `правый край ${l.rightX + l.rightWidth / 2} вместо 1410`);
});

test("вырожденный случай не роняет раскладку", () => {
  const empty = pairLayout({ center: 960, leftWidth: 0, rightWidth: 0, container: 1010, gap: 90 });
  assert.equal(empty.leftX, 960);
  assert.equal(empty.rightX, 960);
  // Один знак без второго: он остаётся у своего края, кадр не ломается.
  const single = pairLayout({ center: 960, leftWidth: 440, rightWidth: 0, container: 1010, gap: 90 });
  assert.equal(Math.round(single.leftWidth), 440);
  assert.equal(single.fit, 1);
  assert.ok(Number.isFinite(single.rightX));
});

// --- Рамка: контур, блик и переливание золота -------------------------------
// Эти проверки закрывают две жалобы: блик читался игрушечным (ездил размытым
// пятном по верхней кромке), а рамка вообще не переливалась золотом.

test("контур рамки замкнут и не выходит за кадр", () => {
  const m = framePathMetrics(0);
  // Периметр рамки габаритом ~1812×996 со скруглением 38.
  assert.ok(m.total > 5400 && m.total < 5700, `периметр ${m.total}`);
  const first = framePathPoint(0), last = framePathPoint(1);
  assert.ok(Math.abs(first.x - last.x) < .01 && Math.abs(first.y - last.y) < .01,
    `контур не замкнут: ${first.x},${first.y} → ${last.x},${last.y}`);
  // Ни одна точка не вылезает за пределы базового кадра.
  for (let i = 0; i <= 400; i++) {
    const p = framePathPoint(i / 400);
    assert.ok(p.x >= 53 && p.x <= 1867, `x=${p.x} на ${i / 400}`);
    assert.ok(p.y >= 41 && p.y <= 1039, `y=${p.y} на ${i / 400}`);
  }
});

test("точка контура идёт по периметру монотонно, без скачков", () => {
  // Скачок означал бы разрыв обхода: блик прыгал бы через полкадра.
  const steps = 600;
  let prev = framePathPoint(0);
  let minStep = Infinity, maxStep = 0;
  for (let i = 1; i <= steps; i++) {
    const p = framePathPoint(i / steps);
    const d = Math.hypot(p.x - prev.x, p.y - prev.y);
    minStep = Math.min(minStep, d); maxStep = Math.max(maxStep, d);
    prev = p;
  }
  // Средний шаг = периметр / 600 ≈ 9.25 px; допускаем разброс на скруглениях,
  // но не разрыв в разы.
  const mean = framePathMetrics(0).total / steps;
  assert.ok(maxStep < mean * 3, `максимальный шаг ${maxStep.toFixed(2)} при среднем ${mean.toFixed(2)}`);
  assert.ok(minStep > mean * .1, `минимальный шаг ${minStep.toFixed(2)} при среднем ${mean.toFixed(2)}`);
});

test("касательная контура повёрнута по сторонам кадра", () => {
  const m = framePathMetrics(0);
  const contour = frameContour(0);
  // Находим середины сторон по фактическим координатам, а не по долям:
  // доли зависят от длины скруглений, и подгонять их в тесте бессмысленно.
  const mid = (predicate) => {
    let best = null;
    for (let i = 0; i < 2000; i++) {
      const at = i / 2000;
      const p = framePathPoint(at);
      if (!predicate(p)) continue;
      // Берём точку, у которой касательная ровно по стороне.
      const a = Math.abs(p.angle);
      const score = a < 5 ? a : (Math.abs(a - 90) < 5 ? Math.abs(a - 90) : 999);
      if (score < 999 && (!best || score < best.score)) best = { at, p, score };
    }
    return best;
  };
  const top = mid(p => p.y < 45);
  assert.ok(top, "не нашлась вертикальная точка на верхней кромке");
  assert.ok(Math.abs(top.p.angle) < 5, `касательная сверху ${top.p.angle}`);

  // Правая сторона: касательная вертикальна.
  let rightOk = false;
  for (let i = 0; i < 2000; i++) {
    const p = framePathPoint(i / 2000);
    if (p.x > 1860 && Math.abs(p.angle - 90) < 5) { rightOk = true; break; }
  }
  assert.ok(rightOk, "на правой стороне нет вертикальной касательной");

  // Нижняя сторона: касательная горизонтальна.
  let bottomOk = false;
  for (let i = 0; i < 2000; i++) {
    const p = framePathPoint(i / 2000);
    if (p.y > 1035 && Math.abs(Math.abs(p.angle) - 180) < 5) { bottomOk = true; break; }
  }
  assert.ok(bottomOk, "на нижней стороне нет горизонтальной касательной");
});

test("блик идёт по контуру и повторяет его повороты", () => {
  // Блик — участок самой линии, а не повёрнутая плашка: он обязан состоять из
  // точек контура. Раньше на угле наружу торчала диагональная полоса.
  const glint = frameGlint(.317, { strength: 1 });
  assert.ok(glint.parts.length >= 1);
  const points = [];
  for (const part of glint.parts) {
    for (let i = 0; i <= 20; i++) {
      points.push(framePathPoint(part.from + (part.to - part.from) * i / 20));
    }
  }
  // Все точки лежат на контуре. Допуск 3.5 px, а не 2: обход контура в тесте
  // идёт по 800 точкам, а на верхней стороне шаг между ними ~2.2 px, так что
  // погрешность поиска ближайшей точки сама по себе достигает ~1.1 px.
  for (const p of points) {
    let best = Infinity;
    for (let i = 0; i < 3000; i++) {
      const c = framePathPoint(i / 3000);
      best = Math.min(best, Math.hypot(c.x - p.x, c.y - p.y));
    }
    assert.ok(best < 1.5, `точка блика (${p.x.toFixed(1)},${p.y.toFixed(1)}) вне контура на ${best.toFixed(1)} px`);
  }
  // Решающая проверка формы: на угле участок блика огибает его, то есть в нём
  // есть и горизонтальные, и вертикальные точки. Повёрнутая плашка такого не
  // даёт — она остаётся прямой линией под углом 45°.
  const angles = points.map(p => Math.abs(p.angle));
  assert.ok(angles.some(a => a < 10), "в блике на угле нет горизонтального участка");
  assert.ok(angles.some(a => a > 80), "в блике на угле нет вертикального участка");
  // Через стык контура блик делится на два куска, а не обрывается.
  const wrapped = frameGlint(.005, { strength: 1, length: 400 });
  assert.equal(wrapped.parts.length, 2, "блик на стыке контура должен делиться на два куска");
});

test("блик сжимается и ярчает на скруглении", () => {
  // На прямом участке отражение вытянуто, на скруглении собирается в пятно.
  const straight = frameGlint(.12, { strength: 1 });
  const corner = frameGlint(.318, { strength: 1 });
  const px = (g) => g.parts.reduce((sum, p) => sum + (p.to - p.from), 0) * framePathMetrics(0).total;
  assert.ok(px(corner) < px(straight), `на угле ${px(corner).toFixed(0)} px против ${px(straight).toFixed(0)} на прямой`);
  assert.ok(corner.halo > straight.halo, "на скруглении блик должен быть ярче");
  assert.ok(curvatureAt(.318) > curvatureAt(.12), "кривизна угла должна быть выше прямой");
  assert.ok(curvatureAt(.12) < .01, `прямой участок имеет кривизну ${curvatureAt(.12)}`);
  // Слабый блик короче сильного — он «разгорается», а не появляется целиком.
  const weak = frameGlint(.12, { strength: .2 });
  assert.ok(px(weak) < px(straight), `слабый ${px(weak).toFixed(0)} px против сильного ${px(straight).toFixed(0)}`);
});

test("участок контура не выходит за границы при любых долях", () => {
  // framePathSpan обязан возвращать корректные куски: им рисуется блик, и
  // ошибка в долях дала бы обводку через полкадра.
  for (const [from, to] of [[0, .1], [.95, 1.05], [-.1, .1], [.5, .5], [0, 1]]) {
    const parts = framePathSpan(from, to);
    for (const part of parts) {
      assert.ok(part.from >= 0 && part.from <= 1 + 1e-9, `from=${part.from}`);
      assert.ok(part.to >= part.from - 1e-9, `to=${part.to} < from=${part.from}`);
      assert.ok(part.to <= 1 + 1e-9, `to=${part.to}`);
    }
  }
});

test("золото рамки переливается по длине и во времени", () => {
  // По длине контура в один момент тон обязан различаться — иначе рамка
  // выглядит залитой одним цветом плашкой.
  const tones = Array.from({ length: 16 }, (_, i) => frameGold(6, i / 16).tone);
  assert.ok(Math.max(...tones) - Math.min(...tones) > 1, `разброс тона по контуру ${Math.max(...tones) - Math.min(...tones)}`);
  // И меняться во времени в одной и той же точке.
  const over = [4, 6, 8, 10, 12].map(t => frameGold(t, .3).tone);
  assert.ok(Math.max(...over) - Math.min(...over) > .1, `разброс тона во времени ${Math.max(...over) - Math.min(...over)}`);
  // Тон ограничен -1…1: за этими пределами цвет уходит в клиппинг.
  for (let t = 0; t <= 20; t += .5) {
    for (let at = 0; at <= 1; at += .05) {
      const g = frameGold(t, at);
      assert.ok(g.tone >= -1 && g.tone <= 1, `тон ${g.tone}`);
      assert.ok(g.light > 0 && g.light < 1.3, `свет ${g.light}`);
    }
  }
  // Свет почти не дышит: колебание яркости не больше 13 %, иначе рамка «качает».
  const lights = Array.from({ length: 40 }, (_, i) => frameGold(i * .5, 0).light);
  assert.ok(Math.max(...lights) - Math.min(...lights) < .25);
});

test("переливание и блик детерминированы: один кадр — один результат", () => {
  // От детерминированности зависит совпадение предпросмотра и экспорта.
  for (const at of [0, .13, .5, .87]) {
    assert.equal(frameGold(7.25, at).tone, frameGold(7.25, at).tone);
    const a = frameGlint(at, { strength: .7 }), b = frameGlint(at, { strength: .7 });
    assert.deepEqual(a, b);
  }
});

// --- Детерминированность отрисовки рамки -----------------------------------
// Два самых дорогих дефекта, найденных при работе над бликом: накопление
// цвета в 2D-canvas не воспроизводится, поэтому длинные градиентные обводки
// давали другой пиксель при повторной отрисовке того же кадра. Живое золото и
// блик строятся только флэт-сегментами.

test("ступени золота детерминированы и покрывают весь контур", () => {
  const a = frameGoldSteps(7.5, 96), b = frameGoldSteps(7.5, 96);
  assert.deepEqual(a, b, "два вызова с одним временем дали разные ступени");
  // Ступени идут по всему периметру без разрывов и наложений.
  for (let i = 1; i < a.length; i++) assert.ok(a[i].at > a[i - 1].at);
  assert.ok(Math.abs(a[0].at - 0) < 1e-9);
  assert.ok(a[a.length - 1].at < 1);
  // Цвета — целые каналы: с ними флэт-заливка даёт побитово один результат.
  for (const step of a) {
    assert.equal(step.color.length, 3);
    for (const c of step.color) assert.ok(Number.isInteger(c) && c >= 0 && c <= 255, `канал ${c}`);
  }
});

test("цвет золота: бронза темнее базового, светлое золото ярче", () => {
  const lum = (c) => .3 * c[0] + .6 * c[1] + .1 * c[2];
  const dark = lum(goldColor(-1)), base = lum(goldColor(0)), light = lum(goldColor(1));
  assert.ok(dark < base && base < light, `${dark} < ${base} < ${light}`);
  // За пределами -1…1 цвет не уходит в клиппинг по краям диапазона.
  assert.deepEqual(goldColor(-5), goldColor(-1));
  assert.deepEqual(goldColor(5), goldColor(1));
});

test("шаг золота держит ступени мелкими и не раздувает кадр", () => {
  // Периметр рамки ~5559 px: ступень должна быть около 8 px, то есть ~695,
  // но их число ограничено, чтобы кадр не превращался в тысячи обводок.
  const count = goldSegmentCount(5559);
  assert.ok(count >= 24 && count <= 160, `ступеней ${count}`);
  assert.ok(5559 / count <= 60, `ступень ${(5559 / count).toFixed(1)} px — видно бандинг`);
  // Вырожденные значения не ломают счёт.
  assert.ok(goldSegmentCount(0) >= 24);
  assert.ok(goldSegmentCount(NaN) >= 24);
});

test("затухание блика: ноль на концах, максимум в середине", () => {
  // Math.sin(π) не ноль, а 1.2e-16, поэтому на концах проверяем допуск, а не
  // строгое равенство: с погрешностью 1e-24 разницы в кадре не видно.
  assert.ok(glintFalloff(0) < 1e-12);
  assert.ok(glintFalloff(1) < 1e-12);
  assert.ok(glintFalloff(.5) > .99);
  // Симметрично по длине: блик не «съезжает» в одну сторону.
  for (const u of [.1, .25, .4]) {
    assert.ok(Math.abs(glintFalloff(u) - glintFalloff(1 - u)) < 1e-9, `асимметрия на ${u}`);
  }
  // За пределами 0…1 не даёт NaN.
  for (const bad of [-2, 2, NaN]) assert.ok(Number.isFinite(glintFalloff(bad)));
  // Чем выше sharpness, тем резче блик.
  assert.ok(glintFalloff(.2, 4) < glintFalloff(.2, 1));
});

test('глиттер — это россыпь мелких искр, а не звёзды и не луч-прожектор', async () => {
  // Проверка рисует светлый слой в буфер и смотрит на распределение ярких
  // пятен: у звёзд были бы лучи (длинные цепочки ярких пикселей), у прожектора —
  // сплошная засветка. Глиттер — мелкие, редкие, разбросанные точки.
  const { drawAmberAtmosphere } = await import('../src/partners-graphics.js');
  // В node нет canvas: строим минимальную заглушку с нужным API. Спрайт искры
  // создаётся через document.createElement — подменяем его на пустышку.
  globalThis.document = globalThis.document || {
    createElement() {
      return { width: 0, height: 0, getContext: () => ctxStub() };
    },
  };
  const calls = [];
  function ctxStub() {
    return {
      createRadialGradient: () => ({ addColorStop() {} }),
      fillRect() {}, save() {}, restore() {}, translate() {}, rotate() {}, scale() {},
    };
  }
  const ctx = {
    canvas: { width: 1920, height: 1080 },
    globalAlpha: 1, globalCompositeOperation: 'source-over', fillStyle: '',
    save() {}, restore() {}, translate() {}, rotate() {}, scale() {},
    createRadialGradient() { return { addColorStop() {} }; },
    createLinearGradient() { return { addColorStop() {} }; },
    fillRect(...args) { calls.push(['fillRect', args]); },
    drawImage(_img, x, y, w) { calls.push(['drawImage', [x, y, w]]); },
  };
  drawAmberAtmosphere(ctx, 6, 1, 16, []);
  const grains = calls.filter(([kind]) => kind === 'drawImage');
  // Искр много и они мелкие: крупный спрайт давал бы «блямбы».
  assert.ok(grains.length > 120, `слишком мало искр: ${grains.length}`);
  assert.ok(grains.every(([, [, , w]]) => w <= 14), 'искра крупнее 14 px — это уже блямба');
  // Искры занимают небольшую долю кадра и распределены по площади, а не
  // выстроены в одну диагональ или в луч.
  const xs = grains.map(([, [x]]) => x), ys = grains.map(([, [, y]]) => y);
  const spanX = Math.max(...xs) - Math.min(...xs);
  const spanY = Math.max(...ys) - Math.min(...ys);
  assert.ok(spanX > 1200 && spanY > 700, `россыпь сжалась в полосу: ${spanX}×${spanY}`);
  // Мерцание: два разных момента дают разные наборы искр.
  const first = new Set(grains.map(([, [x, y]]) => `${Math.round(x)},${Math.round(y)}`));
  calls.length = 0;
  drawAmberAtmosphere(ctx, 6.7, 1, 16, []);
  const second = new Set(calls.filter(([k]) => k === 'drawImage').map(([, [x, y]]) => `${Math.round(x)},${Math.round(y)}`));
  assert.notDeepEqual([...first], [...second], 'искры не мерцают');
});

test("дыхание фона: цикличность на шве, запас масштаба и дрейфа", async () => {
  const { drawBreathingBackground } = await import("../src/partners-graphics.js");
  const calls = [];
  const ctx = {
    fillStyle: "",
    fillRect: (...a) => calls.push(["fill", ...a]),
    drawImage: (...a) => calls.push(["draw", ...a]),
  };
  const bg = { width: 1920, height: 1080 };
  const shot = (local) => {
    calls.length = 0;
    drawBreathingBackground(ctx, bg, 1920, 1080, local, 26);
    const [, , x, y, dw, dh] = calls[0];
    return { x, y, dw, dh };
  };
  // Без фото — непрозрачная базовая подложка, иначе прошлый кадр просвечивает.
  calls.length = 0;
  drawBreathingBackground(ctx, null, 1920, 1080, 5, 26);
  assert.equal(calls[0][0], "fill");
  assert.equal(ctx.fillStyle, "#22070b");
  // На шве кадр совпадает с первым: фаза берётся по длине цикла.
  const seamA = shot(0), seamB = shot(26);
  // sin(2π) даёт машинный хвост, поэтому сравниваем с эпсилоном, а не побитово.
  for (const key of ["x", "y", "dw", "dh"]) {
    assert.ok(Math.abs(seamA[key] - seamB[key]) < 1e-9, `шов по ${key}: ${seamA[key]} vs ${seamB[key]}`);
  }
  // Масштаб всегда больше единицы с запасом над дрейфом: кромка не оголяется.
  for (let local = 0; local < 26; local += 0.5) {
    const { x, y, dw, dh } = shot(local);
    assert.ok(dw > 1920 && dh > 1080, `масштаб меньше кадра на ${local}`);
    const marginY = (dh - 1080) / 2;
    assert.ok(Math.abs(y - (1080 - dh) / 2) <= marginY, `дрейф оголил кромку на ${local}`);
    assert.ok(dw < 1920 * 1.03, "наезд заметен невооружённым глазом");
  }
  // Половина цикла даёт противоположную фазу: фон действительно движется.
  assert.notEqual(shot(6.5).dw, shot(19.5).dw);
});
