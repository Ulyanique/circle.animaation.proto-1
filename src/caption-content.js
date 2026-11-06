/** Применение текста и цветов к DOM и общим настройкам canvas-экспорта. */
export function validCustomColor(value) {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : null;
}

export function syncCaptionContent(cap, caption) {
  if (!cap) return false;
  let changed = false;
  for (const [name, selector] of [['title', '.cap-title'], ['subtitle', '.cap-sub'], ['date', '.cap-date']]) {
    const el = cap.querySelector(selector);
    if (!el) continue;
    const value = caption?.[`${name}Text`];
    const text = typeof value === 'string' ? value : '';
    const color = validCustomColor(caption?.[`${name}Color`]);
    el.style.visibility = caption?.[`${name}Visible`] === false ? "hidden" : "";
    const property = `--${name}-color`;
    if (color) cap.style.setProperty(property, color);
    else cap.style.removeProperty(property);
    if (el.dataset.renderedText === text) continue;
    el.dataset.renderedText = text;
    el.dataset.text = text;
    const letters = typeof Intl.Segmenter === 'function'
      ? [...new Intl.Segmenter('ru', {granularity: 'grapheme'}).segment(text)].map(part => part.segment)
      : Array.from(text);
    el.replaceChildren(...letters.map(letter => {
      const span = document.createElement('span');
      span.className = 'cap-glyph';
      span.textContent = letter === ' ' ? '\u00a0' : letter;
      span.dataset.glyph = span.textContent;
      return span;
    }));
    changed = true;
  }
  return changed;
}
