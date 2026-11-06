import { CUSTOM_TEXT_IDS } from './custom-text.js';

/** Применение текста и цветов к DOM и общим настройкам canvas-экспорта. */
export function validCustomColor(value) {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : null;
}

export function syncCaptionContent(cap, caption, custom = {}) {
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
  for (const [index, id] of CUSTOM_TEXT_IDS.entries()) {
    let el = cap.querySelector(`[data-custom="${id}"]`);
    if (custom[`${id}Present`] !== true) {
      if (el) { el.remove(); changed = true; }
      continue;
    }
    if (!el) {
      el = document.createElement('div'); el.className = 'cap-custom'; el.dataset.custom = id;
      // Постоянный порядок слотов одинаков до и после импорта/перезагрузки.
      const next = CUSTOM_TEXT_IDS.slice(index + 1).map(key => cap.querySelector(`[data-custom="${key}"]`)).find(Boolean);
      cap.insertBefore(el, next ?? null); changed = true;
    }
    const color = validCustomColor(custom[`${id}Color`]) ?? '#ecd08c';
    el.style.setProperty('--custom-color', color);
    el.style.visibility = custom[`${id}Visible`] === false ? 'hidden' : '';
    const number = (value, fallback, min, max) => typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
    el.style.left = `${(0.5 + number(custom[`${id}X`], 0, -0.45, 0.45)) * 100}%`;
    el.style.top = `${(0.5 + number(custom[`${id}Y`], 0.25, -0.45, 0.45)) * 100}%`;
    const scale = number(custom[`${id}Scale`], 1, 0.5, 2);
    if (el.dataset.scale !== String(scale)) { el.dataset.scale = String(scale); changed = true; }
    el.style.setProperty('--custom-scale', scale);
    const value = custom[`${id}Text`];
    const text = typeof value === 'string' ? value : '';
    if (el.dataset.renderedText === text) continue;
    el.dataset.renderedText = text; el.dataset.text = text;
    const letters = typeof Intl.Segmenter === 'function'
      ? [...new Intl.Segmenter('ru', {granularity: 'grapheme'}).segment(text)].map(part => part.segment) : Array.from(text);
    el.replaceChildren(...letters.map(letter => {
      const span = document.createElement('span'); span.className = 'cap-glyph';
      span.textContent = letter === ' ' ? '\u00a0' : letter; span.dataset.glyph = span.textContent;
      return span;
    }));
    changed = true;
  }
  return changed;
}
