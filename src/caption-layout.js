/** Смещение титра привязано к высоте кадра, не к размеру окна браузера.
 * @param {number} progress Плавная огибающая появления от 0 до 1.
 * @param {number} centered Переход финальной строки к центру от 0 до 1.
 * @param {number} frameHeight Высота рамки предпросмотра в CSS-пикселях. */
export function captionDrift(progress, centered, frameHeight) {
  return (1 - progress) * (1 - centered) * frameHeight * .008;
}
