import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// Композиция кадра проверяется по исходнику сцены: элементы, которые в кадре
// центрированы, не должны получать разные x. Смещение заголовка на 60 px влево
// (было 900 при оси 960) читалось как небрежность и находилось только глазами.
const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "..", "src", "partners-scene.js"), "utf8");

test("ось композиции задана одной константой, а не литералом", () => {
  assert.match(source, /const CONTENT_CENTER = BASE_FRAME\.width \/ 2;/);
  // Заголовок, подзаголовок, линия и разделитель — на одной оси.
  const centered = source.match(/CONTENT_CENTER/g) || [];
  assert.ok(centered.length >= 7, `ось используется ${centered.length} раз, ожидалось не меньше 7`);
});

test("в текстовых вызовах не осталось смещённой оси 900", () => {
  // 900 — прежний центр верхнего блока. В градиентах он допустим, в
  // позиционировании текста и линий — нет.
  const textCalls = source.split("\n").filter((line) =>
    /(drawFoilTitle|text\(|ornament\(|label\()/.test(line) && !line.trim().startsWith("//")
  );
  for (const line of textCalls) {
    assert.ok(!/,\s*900,/.test(line), `смещённая ось вернулась: ${line.trim()}`);
  }
});

test("колонки ярусов симметричны относительно оси", () => {
  const left = source.match(/const COLUMN_LEFT = (\d+);/);
  const right = source.match(/const COLUMN_RIGHT = (\d+);/);
  assert.ok(left && right, "колонки должны быть заданы константами");
  const center = (Number(left[1]) + Number(right[1])) / 2;
  assert.equal(center, 960, `центр колонок ${center}, а ось кадра 960`);
  // Расстояние от оси до каждой колонки одинаковое — иначе ярус «поедет».
  assert.equal(960 - Number(left[1]), Number(right[1]) - 960);
});

test("заголовок и подпись не заходят под занавес и в листву", async () => {
  // Предел ширины больше не константа: он считается из ширины занавеса,
  // который лежит поверх кадра. Проверяем само правило.
  const { textSafeLeft, fitFontSize } = await import("../src/text-safe-area.js");
  const safe = textSafeLeft({ curtainVisible: true, curtainWidth: 476 });
  // Плотная ткань заканчивается раньше, чем весь PNG: берём её долю и качание.
  assert.ok(safe > 350 && safe < 460, `зона начинается в подозрительном месте: ${safe}`);
  // Самая длинная строка программы: «ЯНТАРНЫЙ ЦИРКУЛЬ» при 96 px ≈ 998 px.
  const measure = (size) => size * 10.4;
  const fit = fitFontSize({ size: 96, min: 44, measure }, safe);
  const left = 960 - fit.width / 2, right = 960 + fit.width / 2;
  assert.ok(left >= safe + 24, `левый край ${left} заходит под занавес`);
  assert.ok(right <= 1560, `правый край ${right} заходит в листву`);
  assert.ok(fit.size >= 44, "кегль не должен схлопываться");
  // Широкий занавес ужимает строку сильнее, выключенный — не мешает вовсе.
  assert.equal(textSafeLeft({ curtainVisible: false }), 0);
  assert.ok(fitFontSize({ size: 96, min: 44, measure }, 0).size === 96);
  assert.ok(fitFontSize({ size: 96, min: 44, measure },
    textSafeLeft({ curtainVisible: true, curtainWidth: 760 })).size < fit.size);
});
