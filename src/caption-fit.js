/** Масштаб без увеличения для строки, центр которой сдвинут в долях кадра.
 * Отступ 5% — только ориентир; предел 0,1 не даёт строке пропасть совсем.
 * @param {number} frameWidth @param {number} lineWidth @param {number} offset */
export function captionFitFactor(frameWidth, lineWidth, offset = 0) {
  if (!Number.isFinite(frameWidth) || !Number.isFinite(lineWidth) || frameWidth <= 0 || lineWidth <= 0) return 1;
  const x = Number.isFinite(offset) ? offset : 0;
  const available = Math.max(0, 2 * frameWidth * (.45 - Math.abs(x)));
  return Math.max(.1, Math.min(1, available / lineWidth));
}

/** Применяется после загрузки шрифта и раскладки текста, одинаково для DOM и canvas.
 * Меняет только служебные CSS-переменные, исходный пользовательский размер не затрагивает.
 * @param {HTMLElement} cap @param {Record<string, any>} caption @param {Record<string, any>} [custom] */
export function applyCaptionFit(cap, caption, custom = {}) {
  const names = [['title', '.cap-title'], ['subtitle', '.cap-sub'], ['date', '.cap-date']];
  // Сначала восстанавливаем пользовательский масштаб, чтобы повторный вызов
  // не суммировал погрешности и позволял тексту снова увеличиться при изменении.
  for (const [name] of names) cap.style.setProperty(`--${name}-fit`, '1');
  const customLines = [...cap.querySelectorAll('.cap-custom[data-custom]')];
  for (const line of customLines) line.style.setProperty('--custom-fit', '1');
  const frameWidth = cap.getBoundingClientRect().width;
  const result = [];
  for (const [name, selector] of names) {
    const line = cap.querySelector(selector);
    let fit = 1;
    if (caption?.[`${name}AutoFit`] === true && line && getComputedStyle(line).display !== 'none') {
      fit = captionFitFactor(frameWidth, line.getBoundingClientRect().width, caption?.[`${name}X`]);
    }
    // Меньшая погрешность необходима для попадания в поля и согласования Canvas.
    const rounded = Math.floor(fit * 100000) / 100000;
    cap.style.setProperty(`--${name}-fit`, String(rounded));
    result.push(rounded);
  }
  for (const line of customLines) {
    const id = line.dataset.custom;
    let fit = 1;
    if (custom[`${id}AutoFit`] === true && getComputedStyle(line).display !== 'none') {
      fit = captionFitFactor(frameWidth, line.getBoundingClientRect().width, custom[`${id}X`]);
    }
    const rounded = Math.floor(fit * 100000) / 100000;
    line.style.setProperty('--custom-fit', String(rounded));
    result.push(`${id}:${rounded}`);
  }
  return result;
}
