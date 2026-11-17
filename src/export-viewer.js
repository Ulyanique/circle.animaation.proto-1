/**
 * Полноэкранный просмотр готового экспорта.
 *
 * Раньше запись молча уходила в загрузки: пользователь не видел результата и
 * не мог выбрать, куда его положить. Теперь после кодирования поверх всего
 * кадра открывается диалог с видео: его можно посмотреть, сохранить кнопкой
 * с правильным именем файлом, сохранить как через контекстное меню браузера
 * или развернуть на весь экран штатным Fullscreen API. Закрытие — кнопкой,
 * клавишей Esc; объект-URL при этом освобождается.
 *
 * Модуль лёгкий и приходит ленивым чанком вместе с кодировщиком, поэтому
 * загрузку заставки не утяжеляет.
 */

/**
 * @param {object} options
 * @param {Blob} options.blob готовый видеофайл
 * @param {string} options.filename имя для сохранения кнопкой
 * @param {string} [options.meta] строка с параметрами записи
 * @param {() => void} [options.onDownload] сохранить файл правильным именем
 * @returns {{ close: () => void, root: HTMLElement }}
 */
export function openExportViewer({ blob, filename, meta = "", onDownload }) {
  const root = document.createElement("div");
  root.className = "export-viewer";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-label", "Готовое видео");
  const url = URL.createObjectURL(blob);
  root.innerHTML = `
    <header class="export-viewer-head">
      <div class="export-viewer-title">
        <strong></strong>
        <span></span>
      </div>
      <div class="export-viewer-actions">
        <button type="button" data-viewer="fullscreen" title="Развернуть видео на весь экран штатным режимом браузера">Во весь экран</button>
        <button type="button" data-viewer="download" title="Сохранить файл предложенным именем">Скачать файл</button>
        <button type="button" data-viewer="close" aria-label="Закрыть просмотр" title="Закрыть просмотр (Esc)">×</button>
      </div>
    </header>
    <video controls loop playsinline autoplay muted src=""></video>
    <p class="export-viewer-hint">Правая кнопка по видео — «Сохранить видео как…». Звук включается кнопкой на плеере. Esc — закрыть.</p>`;
  root.querySelector(".export-viewer-title strong").textContent = filename;
  root.querySelector(".export-viewer-title span").textContent = meta;
  const video = /** @type {HTMLVideoElement} */ (root.querySelector("video"));
  video.src = url;

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    document.removeEventListener("keydown", onKey, true);
    // Из штатного fullscreen выходим до снятия узла: иначе браузер держит
    // пустой чёрный экран поверх страницы.
    if (document.fullscreenElement === root) document.exitFullscreen?.().catch?.(() => {});
    video.pause();
    video.removeAttribute("src");
    video.load();
    root.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };
  const onKey = (event) => {
    if (event.key === "Escape") {
      // В штатном fullscreen Esc сначала выходит из fullscreen у браузера;
      // диалог закрываем только когда оверлей снова в окне.
      if (document.fullscreenElement === root) return;
      event.stopPropagation();
      close();
    }
  };
  document.addEventListener("keydown", onKey, true);

  root.querySelector("[data-viewer=close]").addEventListener("click", close);
  root.querySelector("[data-viewer=download]").addEventListener("click", () => onDownload?.());
  root.querySelector("[data-viewer=fullscreen]").addEventListener("click", () => {
    if (document.fullscreenElement === root) document.exitFullscreen?.().catch?.(() => {});
    else root.requestFullscreen?.().catch?.(() => {});
  });

  document.body.appendChild(root);
  return { close, root };
}
