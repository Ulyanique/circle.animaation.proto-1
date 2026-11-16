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

test("предел ширины заголовка оставляет равные поля и не лезет в листву", () => {
  const match = source.match(/const TITLE_MAX_WIDTH = (\d+);/);
  assert.ok(match, "предел ширины заголовка должен быть явной константой");
  const maxWidth = Number(match[1]);
  // При оси 960 строка займёт (960 - w/2)..(960 + w/2); правое поле должно
  // оставаться заметно больше нуля, иначе текст подойдёт к рамке и листве.
  const rightEdge = 960 + maxWidth / 2;
  assert.ok(rightEdge <= 1560, `правый край ${rightEdge} заходит в листву`);
  assert.ok(rightEdge <= 1866, "правый край выходит за рамку кадра");
});
