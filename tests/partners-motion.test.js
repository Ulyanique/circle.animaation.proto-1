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
