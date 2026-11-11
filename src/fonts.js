export const FONTS = [
  { id: "cormorant-garamond", name: "Cormorant Garamond" },
  { id: "playfair-display", name: "Playfair Display" },
  { id: "prata", name: "Prata" },
  { id: "pt-serif", name: "PT Serif" },
  { id: "manrope", name: "Manrope" },
  { id: "unbounded", name: "Unbounded" },
];
export function fontName(id) {
  return (FONTS.find((font) => font.id === id) || FONTS[0]).name;
}
export function loadFonts() {
  if (!document.fonts) return Promise.resolve();
  const sample = "Янтарный циркуль Фотопауза Вечер ретроспектива История продолжается 2026 ABC abc";
  return Promise.all(FONTS.flatMap(({ name }) => [400, 600].map((weight) =>
    document.fonts.load(`${weight} 72px "${name}"`, sample))));
}
