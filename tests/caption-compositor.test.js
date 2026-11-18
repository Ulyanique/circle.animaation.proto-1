import test from "node:test";
import assert from "node:assert/strict";
import { transformGlyph } from "../src/caption-compositor.js";

test("canvas повторяет CSS-регистр, сохраняя исходный регистр названия", () => {
  const glyphs = (text) => [...new Intl.Segmenter("ru", { granularity: "grapheme" }).segment(text)]
    .map(({ segment }) => segment);
  const transform = (text, rule) => glyphs(text).map((glyph) => transformGlyph(glyph, rule, "ru")).join("");
  assert.equal(transform("Вечер ретроспектива", "uppercase"), "ВЕЧЕР РЕТРОСПЕКТИВА");
  assert.equal(transform("20 ноября 2026 года", "uppercase"), "20 НОЯБРЯ 2026 ГОДА");
  assert.equal(transform("История продолжается", "uppercase"), "ИСТОРИЯ ПРОДОЛЖАЕТСЯ");
  assert.equal(transform("Янтарный циркуль", "none"), "Янтарный циркуль");
  assert.equal(transform("Фотопауза", "none"), "Фотопауза");
});

test("преобразование сохраняет число анимируемых графем и учитывает язык", () => {
  const source = ["ß", "\u00a0", "е\u0308", "👩‍🚀"];
  const rendered = source.map((glyph) => transformGlyph(glyph, "uppercase", "ru"));
  assert.deepEqual(rendered, ["SS", " ", "Е\u0308", "👩‍🚀"]);
  assert.equal(rendered.length, source.length);
  assert.equal(transformGlyph("i", "uppercase", "tr"), "İ");
  assert.equal(transformGlyph("Ё", "lowercase", "ru"), "ё");
});

test("геометрия строки титра: центрирование и хвостовой интервал", async () => {
  const { captionLineLayout } = await import("../src/caption-compositor.js");
  const measure = (text) => text.length * 10;
  // Канвас с letterSpacing: графема меряется целиком, интервал уже в ширине.
  const line = captionLineLayout({ glyphs: ["Я", "Н", "Т"], measure, spacing: 5, centerX: 960 });
  assert.deepEqual(line.items.map((item) => item.width), [10, 10, 10]);
  // Хвост после последней графемы не входит: 30 + 5 + 5 − 5 = 35? Нет:
  // ширины уже включают интервал, строка теряет только один хвостовой.
  assert.equal(line.width, 25);
  assert.equal(line.startX, 960 - 12.5);
  assert.deepEqual(line.items.map((item) => item.x), [947.5, 957.5, 967.5]);
  // Строка центрирована относительно своей оси.
  assert.equal(line.startX + line.width / 2, 960);
  // Пустая строка не сдвигает ось и не даёт отрицательной ширины.
  const empty = captionLineLayout({ glyphs: [], measure, spacing: 5, centerX: 960 });
  assert.equal(empty.width, 0);
  assert.equal(empty.startX, 960);
});

test("геометрия строки титра: канвас без letterSpacing раскрывает графемы по частям", async () => {
  const { captionLineLayout } = await import("../src/caption-compositor.js");
  const measure = (text) => text.length * 10;
  // «SS» после uppercase — одна графема из двух частей: части рисуются раздельно,
  // но reveal и ширина считаются по графеме целиком.
  const line = captionLineLayout({
    glyphs: ["SS", "A"],
    measure,
    spacing: 4,
    centerX: 100,
    split: (glyph) => (glyph === "SS" ? ["S", "S"] : [glyph]),
  });
  const [ss, a] = line.items;
  assert.deepEqual(ss.runs.map((run) => run.offset), [0, 14]);
  assert.equal(ss.width, 10 + 4 + 10 + 4, "внутри графемы интервал после каждой части");
  // Ширина графемы включает хвостовой интервал: он и есть зазор до следующей.
  assert.equal(a.width, 10 + 4);
  assert.equal(line.width, ss.width + a.width - 4, "хвостовой интервал строки вычитается один раз");
  assert.equal(a.x, ss.x + ss.width, "следующая графема встает за раскрытой");
  const native = captionLineLayout({ glyphs: ["SS"], measure, spacing: 4, centerX: 100 });
  assert.equal(native.items[0].runs, null, "без split графема рисуется целиком");
});
