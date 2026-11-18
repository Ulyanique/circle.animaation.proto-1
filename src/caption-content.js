import { METALLIC_TITLE_CSS } from './caption-material.js';
import { CUSTOM_TEXT_IDS, customTextOrder } from './custom-text.js';
import { FONTS, fontName } from './fonts.js';

/** Применение текста и цветов к DOM и общим настройкам canvas-экспорта. */
export function validCustomColor(value) {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : null;
}

export function syncCaptionContent(cap, caption, custom = {}) {
  if (!cap) return false;
  let changed = false;
  // A user's explicit color remains authoritative, even in the metallic mode.
  cap.dataset.titleMetallic = String(caption?.titleMetallic === true && !validCustomColor(caption?.titleColor));
  cap.style.setProperty('--title-metallic-gradient', METALLIC_TITLE_CSS);
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
      // Временное размещение; сохранённый порядок восстанавливается ниже.
      const next = CUSTOM_TEXT_IDS.slice(index + 1).map(key => cap.querySelector(`[data-custom="${key}"]`)).find(Boolean);
      cap.insertBefore(el, next ?? null); changed = true;
    }
    el.dataset.independent = String(custom[`${id}TimingMode`] === 'custom');
    const color = validCustomColor(custom[`${id}Color`]) ?? '#ecd08c';
    el.style.setProperty('--custom-color', color);
    el.style.visibility = custom[`${id}Visible`] === false ? 'hidden' : '';
    const number = (value, fallback, min, max) => typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
    el.style.left = `${(0.5 + number(custom[`${id}X`], 0, -0.45, 0.45)) * 100}%`;
    el.style.top = `${(0.5 + number(custom[`${id}Y`], 0.25, -0.45, 0.45)) * 100}%`;
    el.style.setProperty('--custom-opacity', String(number(custom[`${id}Opacity`], 1, 0, 1)));
    el.dataset.revealStyle = ['fade', 'fade-up'].includes(custom[`${id}RevealStyle`]) ? custom[`${id}RevealStyle`] : 'draw';
    const requestedCase = custom[`${id}Case`];
    const textCase = requestedCase === 'uppercase' || requestedCase === 'lowercase' ? requestedCase : 'none';
    if (el.style.textTransform !== textCase) { el.style.textTransform = textCase; changed = true; }
    const requestedFont = custom[`${id}Font`];
    const font = FONTS.some(item => item.id === requestedFont) ? requestedFont : '';
    if ((el.dataset.font || '') !== font) { changed = true; }
    if (font) { el.dataset.font = font; el.style.fontFamily = `"${fontName(font)}", Georgia, serif`; }
    else { delete el.dataset.font; el.style.removeProperty('font-family'); }
    const scale = number(custom[`${id}Scale`], 1, 0.5, 2);
    if (el.dataset.scale !== String(scale)) { el.dataset.scale = String(scale); changed = true; }
    el.style.setProperty('--custom-scale', scale);
    const tracking = number(custom[`${id}Tracking`], 0, 0, 0.6);
    if (el.dataset.tracking !== String(tracking)) { el.dataset.tracking = String(tracking); changed = true; }
    el.style.setProperty('--custom-tracking', `${tracking}em`);
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
  // Слои размещаются в порядке рисования: последний находится поверх остальных.
  // Canvas-композитор обходит те же DOM-элементы в этом порядке.
  const ordered = customTextOrder(custom, true);
  const existing = [...cap.querySelectorAll('.cap-custom')].map(el => el.dataset.custom);
  if (ordered.length === existing.length && ordered.some((id, i) => existing[i] !== id)) {
    for (const id of ordered) cap.appendChild(cap.querySelector(`[data-custom="${id}"]`));
  }
  return changed;
}
