import { contourShape, contoursReady } from './contour-fonts.js';
import { transformGlyph, lineBaseline } from './caption-compositor.js';

const NS = 'http://www.w3.org/2000/svg';
/** SVG пути лежат поверх невидимой обводки DOM-текста, не меняя разметку строки. */
export function refreshContours(fontId) {
  const cap = document.getElementById('caption');
  if (!cap || !contoursReady()) return;
  for (const line of cap.querySelectorAll('[data-text]')) {
    const style = getComputedStyle(line);
    const lang = line.closest('[lang]')?.getAttribute('lang') || 'ru';
    // Скрытые строки не имеют размеров, восстановим их при переключении сцены.
    if (style.display === 'none') continue;
    const lineRect = line.getBoundingClientRect();
    const baseline = lineRect.top + lineRect.height / 2 + lineBaseline(line, style, lang);
    const size = parseFloat(style.fontSize);
    const weight = Number(style.fontWeight);
    for (const span of line.querySelectorAll('.cap-glyph')) {
      span.querySelector('svg')?.remove();
      span.classList.remove('has-contour');
      const glyph = transformGlyph(span.dataset.glyph, style.textTransform, lang);
      const shape = contourShape(line.dataset.font || fontId, weight, glyph);
      if (!shape) continue;
      const rect = span.getBoundingClientRect();
      if (!rect.width || !rect.height) continue;
      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`);
      svg.setAttribute('aria-hidden', 'true');
      svg.classList.add('glyph-contour');
      const group = document.createElementNS(NS, 'g');
      group.setAttribute('transform', `translate(0 ${baseline - rect.top}) scale(${size / 1000})`);
      for (const [offset, opacity, width] of [[-10, .3, 4], [10, .3, 4], [0, 1, 9]]) {
        const path = document.createElementNS(NS, 'path');
        path.setAttribute('d', shape.d);
        path.setAttribute('pathLength', '1');
        path.setAttribute('transform', `translate(${offset} 0)`);
        path.setAttribute('opacity', String(opacity));
        path.setAttribute('stroke-width', String(width));
        group.appendChild(path);
      }
      svg.appendChild(group);
      span.appendChild(svg);
      span.classList.add('has-contour');
    }
  }
  cap.classList.add('contours-ready');
}
