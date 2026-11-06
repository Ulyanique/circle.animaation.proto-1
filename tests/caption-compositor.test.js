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
