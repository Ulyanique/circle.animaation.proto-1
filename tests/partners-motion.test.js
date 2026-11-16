import test from "node:test";
import assert from "node:assert/strict";
import {
  easeOutCubic, easeInOutCubic, easeOutBack, easeOutExpo, window01, glintSpan, reveal,
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
