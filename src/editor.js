import { createEditorToolbar } from './editor-toolbar.js';
import { createEditorContextMenu } from './editor-context-menu.js';
import * as THREE from 'three';
import { OUTPUT } from './scenes/catalog.js';
import { createExtraPropertyControls } from './editor-inspector-controls.js';
import { captionMaskRange, scenarioCueRange } from './editor-caption-range.js';
import { timelineCycle, timelineCursor, timelineRange, moveTimelineEdge, moveTimelineRange, timelineEdgeSeconds, movePhaseBoundary, timelineTimecode, timelineStepFrame, timelineCursorFrame, parseTimelineTimecode } from './editor-timeline.js';
import { canDuplicate, duplicateTarget, duplicatePlan } from './editor-duplicate.js';
import { DECOR_SLOTS, DECOR_IDS, decorSection } from './brand-decor-config.js';
import { PARTICLE_CLOUD_IDS } from './particle-cloud-config.js';
import { BACKGROUND_GLOW_IDS } from './background-glow-config.js';
import { moveLogo, moveTitle, moveWorldOffset, snapRect, resizeFromDistance } from './editor-math.js';
import { EditorHistory } from './editor-history.js';
import { layerLocked } from './editor-locks.js';
import { ORDERABLE_EFFECTS, orderedEffects, effectOrderChanges } from './effect-order.js';
import { FONTS } from './fonts.js';
import { validCustomColor } from './caption-content.js';
import { EDITOR_LAYERS, layersForScene, layerVisible, layerNameField, layerDisplayName, editorViewport } from './editor-layers.js';
import { safeArea, textBoundsStatus } from './editor-safe-area.js';
import { workspaceWidths, setWorkspaceWidth, resetWorkspaceWidth } from './editor-workspace.js';
import { PREVIEW_ZOOMS, previewState, setPreviewZoom, panPreview, resetPreview, previewLayout } from './editor-preview.js';
import { CUSTOM_TEXT_IDS, customTextKeys, customTextOrder, customTextInsertion, customTextReorder } from './custom-text.js';

/** Рамки редактора находятся только в DOM и не попадают в экспорт. */
export function createFrameEditor({ getState, onEnable, onChange, onSeek, onLayoutChange, onSettings, onHistoryConflict }) {
  const toggle = document.createElement('button');
  toggle.type = 'button'; toggle.className = 'editor-toggle';
  toggle.textContent = 'Редактировать'; toggle.setAttribute('aria-pressed', 'false');
  toggle.title = 'Переместить элементы на кадре';
  document.body.appendChild(toggle);

  const layer = document.createElement('div');
  layer.className = 'editor-layer'; layer.hidden = true;
  const previewClip = document.createElement('div');
  previewClip.className = 'editor-preview-clip'; layer.appendChild(previewClip);
  const history = new EditorHistory();
  const { historyBar, undoButton, redoButton, safeToggle } = createEditorToolbar();
  layer.appendChild(historyBar);
  const safeFrame = document.createElement('div');
  safeFrame.className = 'editor-safe-frame'; safeFrame.setAttribute('aria-hidden', 'true');
  const safeNotice = document.createElement('div');
  safeNotice.className = 'editor-safe-notice'; safeNotice.setAttribute('role', 'status');
  safeNotice.setAttribute('aria-live', 'polite'); safeNotice.hidden = true;
  previewClip.append(safeFrame, safeNotice);
  let safeEnabled = true;
  safeToggle.addEventListener('click', () => {
    safeEnabled = !safeEnabled; safeToggle.setAttribute('aria-pressed', String(safeEnabled));
    refresh();
  });
  const guides = {};
  for (const axis of ['x', 'y']) {
    const guide = document.createElement('div');
    guide.className = `editor-guide editor-guide-${axis}`; guide.hidden = true;
    previewClip.appendChild(guide); guides[axis] = guide;
  }
  const boxes = {};
  for (const {id, label} of EDITOR_LAYERS) {
    const box = document.createElement('button');
    box.type = 'button'; box.className = 'editor-box'; box.dataset.element = id;
    box.setAttribute('aria-label', `${label}: перетащить, переместить стрелками или изменить размер клавишами плюс и минус`);
    box.innerHTML = `<span class="editor-label">${label}</span><span class="editor-resize" title="Изменить размер" aria-hidden="true"></span>`;
    if (id === 'photoAperture' || id === 'constructionGuides' || id === 'topIllumination' || id === 'photoLabel' || DECOR_IDS.includes(id) || PARTICLE_CLOUD_IDS.includes(id) || BACKGROUND_GLOW_IDS.includes(id) || id === 'ringLeft' || id === 'ringRight') box.classList.add('editor-handle');
    if (id === 'ringLeft' || id === 'ringRight') box.classList.add('editor-center-handle');
    previewClip.appendChild(box); boxes[id] = box;
  }
  const layersPanel = document.createElement('aside');
  layersPanel.className = 'editor-sidebar editor-layers';
  layersPanel.setAttribute('aria-label', 'Элементы сцены');
  layersPanel.innerHTML = `<div class="editor-sidebar-heading"><div><span>КОМПОЗИЦИЯ</span><h2>Слои</h2></div><output data-layer-count aria-label="Число слоёв"></output></div>
    <div class="editor-layer-tools"><label class="editor-layer-search"><span aria-hidden="true">⌕</span><input type="search" data-layer-search placeholder="Найти слой" aria-label="Поиск слоёв" autocomplete="off"></label>
    <div class="editor-layer-filters" role="group" aria-label="Фильтр слоёв"><button type="button" data-layer-filter="all" aria-pressed="true">Все</button><button type="button" data-layer-filter="text" aria-pressed="false">Текст</button><button type="button" data-layer-filter="effect" aria-pressed="false">Эффекты</button></div></div>
    <details class="editor-effect-order-mode"><summary>Порядок эффектов <span>ЭКСПЕРИМЕНТ</span></summary><label><input type="checkbox" data-effect-order-mode> Управлять порядком</label><p>Эффекты рисуются после других прозрачных объектов. Проверка глубины сохраняется; смешивание со штатными элементами может измениться.</p></details>
    <div class="editor-layers-list"></div><p class="editor-no-layers" data-layer-empty hidden>Слои не найдены. Измените поиск или фильтр.</p>
    <div class="editor-add-heading">ДОБАВИТЬ</div><div class="editor-add-grid"><button type="button" class="editor-add-text" data-add-text>+ Текст</button><button type="button" class="editor-add-text" data-add-decor>+ Окружность</button><button type="button" class="editor-add-text" data-add-cloud>+ Частицы</button><button type="button" class="editor-add-text" data-add-glow>+ Свечение</button></div><p class="editor-sidebar-note">До 8 надписей и по 4 окружности, облака и свечения в каждой сцене</p>`;
  const layerList = layersPanel.querySelector('.editor-layers-list');
  const layerSearch = layersPanel.querySelector('[data-layer-search]');
  const layerCount = layersPanel.querySelector('[data-layer-count]');
  const layerEmpty = layersPanel.querySelector('[data-layer-empty]');
  let layerFilter = 'all';
  layerSearch.addEventListener('input', () => refresh());
  for (const button of layersPanel.querySelectorAll('[data-layer-filter]')) button.addEventListener('click', () => {
    layerFilter = button.dataset.layerFilter;
    for (const other of layersPanel.querySelectorAll('[data-layer-filter]')) other.setAttribute('aria-pressed', String(other === button));
    refresh();
  });
  const effectOrderMode = layersPanel.querySelector('[data-effect-order-mode]');
  effectOrderMode.addEventListener('change', () => {
    finishInput(); const state = getState(), field = {section:'effectOrder', key:'enabled'};
    const before = snapshot(state.config, [field]);
    state.config.effectOrder.enabled = effectOrderMode.checked;
    record(state.id, state.config, before); onChange(); refresh(); if (selected) populateAppearance(selected);
  });
  const rows = {}, visibilityButtons = {}, lockButtons = {}, entries = {};
  for (const item of EDITOR_LAYERS) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'editor-layer-row'; button.dataset.layer = item.id;
    button.setAttribute('aria-pressed', 'false');
    const icon = document.createElement('span'); icon.className = 'editor-layer-icon';
    icon.textContent = item.kind === 'Текст' ? 'Т' : item.kind === 'Декор' ? '◯' : '◇';
    const text = document.createElement('span'); text.className = 'editor-layer-name';
    const title = document.createElement('strong'); title.textContent = item.label;
    const kind = document.createElement('small'); kind.textContent = item.kind;
    text.append(title, kind); button.append(icon, text);
    const entry = document.createElement('div'); entry.className = 'editor-layer-entry';
    const visibility = document.createElement('button');
    visibility.type = 'button'; visibility.className = 'editor-visibility'; visibility.dataset.visibility = item.id;
    visibility.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-6.5 10-6.5 10 6.5 10 6.5-3.5 6.5-10 6.5S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/><path class="eye-slash" d="M4 4l16 16"/></svg>';
    const lock = document.createElement('button');
    lock.type = 'button'; lock.className = 'editor-lock'; lock.dataset.lock = item.id;
    lock.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/><path d="M12 14v3"/></svg>';
    entry.append(button, lock, visibility); layerList.appendChild(entry);
    lockButtons[item.id] = lock;
    lock.addEventListener('click', () => {
      finishInput();
      const state = getState(), field = {section: 'editorLocks', key: item.id};
      const before = snapshot(state.config, [field]);
      state.config.editorLocks[item.id] = !layerLocked(state.config, item.id);
      record(state.id, state.config, before); onChange(); refresh();
    });
    rows[item.id] = button; visibilityButtons[item.id] = visibility; entries[item.id] = entry;
    visibility.addEventListener('click', () => {
      finishInput();
      const state = getState(), field = item.visibility;
      const masterOff = (item.id === 'ringLeft' || item.id === 'ringRight') && state.config.rings.enabled === false;
      const fields = masterOff ? [field, {section: 'rings', key: 'enabled'}] : [field];
      const before = snapshot(state.config, fields);
      if (masterOff) { state.config.rings.enabled = true; state.config.rings[field.key] = true; }
      else state.config[field.section][field.key] = !layerVisible(state.config, item);
      record(state.id, state.config, before);
      onChange(); refresh();
    });
    button.addEventListener('click', () => select(item.id, true));
  }
  layer.appendChild(layersPanel);
  const inspector = document.createElement('aside');
  inspector.className = 'editor-sidebar editor-inspector';
  inspector.setAttribute('aria-label', 'Свойства элемента');
  inspector.innerHTML = '<div class="editor-sidebar-heading"><span>РЕДАКТОР</span><h2>Свойства</h2></div><p class="editor-empty">Выберите элемент на кадре или в списке слева</p>';
  const empty = inspector.querySelector('.editor-empty');
  const menu = document.createElement('div');
  menu.className = 'editor-menu'; menu.hidden = true;
  menu.innerHTML = `<div class="editor-selected-label" data-selected-label></div><p class="editor-hidden-note" hidden>Элемент скрыт. Включите его кнопкой справа от названия в списке.</p><details class="editor-property-group" data-property-group="appearance" open><summary>Оформление</summary><div class="editor-appearance">
    <label data-field="name" hidden>Имя слоя <input type="text" data-layer-name maxlength="48" autocomplete="off" placeholder="По умолчанию"></label>
    <label data-field="text">Текст <input type="text" data-appearance="text" maxlength="120" autocomplete="off"></label>
    <label data-field="color"><span data-color-label>Цвет</span> <input type="color" data-appearance="color"></label>
    <label data-field="case" hidden>Регистр <select data-custom-case aria-label="Регистр надписи"><option value="none">Как написано</option><option value="uppercase">ПРОПИСНЫЕ</option><option value="lowercase">строчные</option></select></label>
    <label data-field="font" hidden>Шрифт <select data-custom-font aria-label="Шрифт надписи"><option value="">Шрифт сцены</option></select></label>
    <label class="editor-custom-tracking" data-field="opacity" hidden><span>Непрозрачность <output data-custom-opacity-output></output></span><input type="range" min="0" max="1" step="0.01" data-custom-opacity></label>
    <label class="editor-custom-tracking" data-field="tracking" hidden><span>Интервал букв <output data-custom-tracking-output></output></span><input type="range" min="0" max="0.6" step="0.01" data-custom-tracking></label>
    <label data-field="auto-fit" hidden>Вписать в поля 5% <input type="checkbox" data-custom-autofit></label>
    <div class="editor-appearance-reset"><button type="button" data-action="reset-text">Исходный текст</button><button type="button" data-action="reset-color">Исходный цвет</button></div>
  </div><section class="editor-effect-intensity" hidden>
    <h3>Интенсивность эффекта</h3>
    <label><span><span data-effect-label></span> <output data-effect-output></output></span><input type="range" min="0" max="1" step="0.01" data-effect-intensity></label>
    <label data-effect-dust-row hidden><span>Яркость орбитальной пыли <output data-effect-dust-output></output></span><input type="range" min="0" max="1" step="0.01" data-effect-dust></label>
    <details class="editor-tip"><summary>Подсказка</summary><p data-effect-hint></p></details>
  </section></details><details class="editor-property-group" data-property-group="geometry" open><summary>Геометрия</summary><section class="editor-geometry">
    <div class="editor-geometry-fields"><label><span data-geometry-x-label>X</span><input type="number" step="0.01" data-geometry="x"></label><label><span data-geometry-y-label>Y</span><input type="number" step="0.01" data-geometry="y"></label><label><span data-geometry-size-label>Размер</span><input type="number" step="0.01" data-geometry="size"></label></div>
    <details class="editor-tip"><summary>Единицы и привязка</summary><p data-geometry-hint></p></details>
  </section><label class="editor-follow-logo" hidden><input type="checkbox" data-follow-logo> Привязать окружность к логотипу</label><label class="editor-ring-scale" hidden><span>Размер круга <output data-ring-scale-output></output></span><input type="range" min="0.3" max="2.5" step="0.01" data-ring-scale></label><div class="editor-actions editor-geometry-actions"><button type="button" data-action="align-x" aria-label="По центру по горизонтали">По центру X</button><button type="button" data-action="align-y" aria-label="По центру по вертикали">По центру Y</button><button type="button" data-action="reset">Сброс положения</button><button type="button" data-action="reset-size">Сброс размера</button></div></details><details class="editor-property-group" data-property-group="animation" open><summary>Анимация</summary><div class="editor-appearance editor-reveal-control">
    <label data-field="reveal" hidden>Проявление <select data-custom-reveal aria-label="Проявление надписи"><option value="draw">Обрисовка</option><option value="fade">Плавное появление</option><option value="fade-up">Плавно снизу</option></select></label>
  </div><section class="editor-timing" hidden>
    <h3 data-timing-title>Время надписи</h3>
    <label class="editor-timing-mode">Анимация <select data-timing-mode><option value="scene">Вместе с названием</option><option value="custom">Своё время</option></select></label>
    <details class="editor-tip"><summary>Ограничения времени логотипа</summary><p data-logo-timing-note hidden>Своё время управляет прорисовкой и проявлением знака. Камера, свет, шторка и связанные эффекты остаются по сценарию и могут заслонить знак.</p></details>
    <details class="editor-tip"><summary>Ограничения времени титра</summary><p data-caption-timing-note hidden>Своё время меняет маску только этой строки. Линии, затемнение и движение финального титра остаются по сценарию.</p></details>
    <div class="editor-timing-fields" hidden>
      <label><span>Появление <output data-timing-output="Start"></output></span><input type="range" data-timing="Start" min="0" max="99" step="0.01"></label>
      <label><span>Уход <output data-timing-output="End"></output></span><input type="range" data-timing="End" min="1" max="100" step="0.01"></label>
      <div class="editor-timing-seconds"><label>Начало, с<input type="number" data-timing-seconds="start" min="0" step="0.001" aria-label="Начало интервала в секундах"></label><label>Конец, с<input type="number" data-timing-seconds="end" min="0" step="0.001" aria-label="Конец интервала в секундах"></label></div>
      <div class="editor-timing-cursor"><button type="button" data-timing-cursor="start">Начало = курсор</button><button type="button" data-timing-cursor="end">Конец = курсор</button></div>
      <p data-timing-error role="status" hidden>Укажите секунды внутри цикла. Минимальная длина — 1% цикла.</p>
      <label><span>Плавность <output data-timing-output="Fade"></output></span><input type="range" data-timing="Fade" min="5" max="50" step="1"></label>
      <label data-effect-curve-row hidden>Характер проявления <select data-effect-curve><option value="normal">Обычный</option><option value="soft">Мягкий</option><option value="bright">Яркий</option></select></label>
      <details class="editor-tip"><summary>Как задать время</summary><p>Время — доля цикла после стартовой задержки; секунды указаны по таймлайну. Плавность — доля выбранного интервала. Кнопки устанавливают границу на ближайший кадр к курсору. Введите секунды и нажмите Enter. После изменения длины цикла проценты сохраняются, секунды пересчитываются. Чтобы увидеть элемент, перемотайте воспроизведение внутрь интервала.</p></details>
    </div>
  </section></details><details class="editor-property-group" data-property-group="advanced" open><summary>Параметры объекта</summary><div class="editor-extra-properties"></div></details><details class="editor-property-group" data-property-group="order" open><summary>Порядок</summary><section class="editor-effect-order" hidden><h3>Порядок эффектов</h3><p>Выше — рисуется позже. Видимые непрозрачные объекты могут перекрывать эффекты; добавление света аддитивно, поэтому перестановка не всегда заметна.</p><div><button type="button" data-action="effect-front">↑ Выше</button><button type="button" data-action="effect-back">↓ Ниже</button></div></section><section class="editor-text-order" hidden><h3>Порядок своих надписей</h3><p>Выше в списке — поверх других надписей. Фон и штатные элементы имеют фиксированный порядок.</p><div><button type="button" data-action="text-front" aria-label="Поднять надпись выше">↑ Выше</button><button type="button" data-action="text-back" aria-label="Опустить надпись ниже">↓ Ниже</button></div></section></details><div class="editor-actions editor-primary-actions"><button type="button" data-action="duplicate" hidden>Дублировать</button><button type="button" data-action="settings">Настройки сцены…</button></div><button type="button" class="editor-delete-text" data-action="delete-text" hidden>Удалить текст</button><button type="button" class="editor-delete-text" data-action="delete-decor" hidden>Удалить окружность</button><button type="button" class="editor-delete-text" data-action="delete-cloud" hidden>Удалить облако</button><button type="button" class="editor-delete-text" data-action="delete-glow" hidden>Удалить свечение</button>`;
  const nameInput = menu.querySelector('[data-layer-name]');
  const nameRow = menu.querySelector('[data-field="name"]');
  const effectPanel = menu.querySelector('.editor-effect-intensity');
  const effectInput = menu.querySelector('[data-effect-intensity]');
  const effectOutput = menu.querySelector('[data-effect-output]');
  const dustRow = menu.querySelector('[data-effect-dust-row]');
  const dustInput = menu.querySelector('[data-effect-dust]');
  const dustOutput = menu.querySelector('[data-effect-dust-output]');
  const geometryInputs = Object.fromEntries([...menu.querySelectorAll('[data-geometry]')].map(input => [input.dataset.geometry, input]));
  const textInput = menu.querySelector('[data-appearance="text"]');
  const colorInput = menu.querySelector('[data-appearance="color"]');
  const textRow = menu.querySelector('[data-field="text"]');
  const revealRow = menu.querySelector('[data-field="reveal"]');
  const revealInput = menu.querySelector('[data-custom-reveal]');
  const caseRow = menu.querySelector('[data-field="case"]');
  const caseInput = menu.querySelector('[data-custom-case]');
  const fontRow = menu.querySelector('[data-field="font"]');
  const fontInput = menu.querySelector('[data-custom-font]');
  for (const font of FONTS) { const option = document.createElement('option'); option.value = font.id; option.textContent = font.name; fontInput.appendChild(option); }
  const opacityRow = menu.querySelector('[data-field="opacity"]');
  const opacityInput = menu.querySelector('[data-custom-opacity]');
  const opacityOutput = menu.querySelector('[data-custom-opacity-output]');
  const trackingRow = menu.querySelector('[data-field="tracking"]');
  const trackingInput = menu.querySelector('[data-custom-tracking]');
  const textTrackingOutput = menu.querySelector('[data-custom-tracking-output]');
  const autoFitRow = menu.querySelector('[data-field="auto-fit"]');
  const autoFitInput = menu.querySelector('[data-custom-autofit]');
  const resetTextButton = menu.querySelector('[data-action="reset-text"]');
  const followRow = menu.querySelector('.editor-follow-logo');
  const followInput = menu.querySelector('[data-follow-logo]');
  const ringScaleRow = menu.querySelector('.editor-ring-scale');
  const ringScale = menu.querySelector('[data-ring-scale]');
  const timing = menu.querySelector('.editor-timing');
  const timingMode = menu.querySelector('[data-timing-mode]');
  const timingFields = menu.querySelector('.editor-timing-fields');
  inspector.appendChild(menu); layer.appendChild(inspector); document.body.appendChild(layer);
  const previewTools = document.createElement('div');
  previewTools.className = 'editor-preview-tools'; previewTools.setAttribute('role', 'group');
  previewTools.setAttribute('aria-label', 'Просмотр композиции');
  previewTools.innerHTML = `<button type="button" data-preview="out" aria-label="Уменьшить просмотр" title="Уменьшить просмотр">−</button><output data-preview-zoom aria-live="polite"></output><button type="button" data-preview="in" aria-label="Увеличить просмотр" title="Увеличить просмотр">+</button><button type="button" data-preview="fit" title="Вписать композицию в окно и сбросить перемещение">Вписать</button><button type="button" data-preview="pan" aria-pressed="false" title="Переместить увеличенный кадр">Рука</button><button type="button" data-preview="focus" aria-pressed="false" aria-label="Увеличить рабочую область холста" title="Холст: скрыть панели и таймлайн">▣</button><button type="button" data-preview-help aria-expanded="false" aria-controls="editor-quick-help" aria-label="Помощь по редактору" title="Помощь по редактору">?</button>`;
  layer.appendChild(previewTools);
  const helpButton = previewTools.querySelector('[data-preview-help]');
  const quickHelp = document.createElement('section'); quickHelp.className = 'editor-quick-help';
  quickHelp.id = 'editor-quick-help'; quickHelp.hidden = true;
  quickHelp.setAttribute('aria-label', 'Помощь по редактору');
  quickHelp.innerHTML = `<div class="editor-quick-help-head"><strong>Как работать</strong><button type="button" data-help-close aria-label="Закрыть помощь">×</button></div>
    <dl><dt>Выбор и перемещение</dt><dd>Выберите слой или рамку и перетащите. Alt отключает привязку; тяните уголок для изменения размера.</dd>
    <dt>Точная настройка</dt><dd>На выбранной строке или рамке стрелки перемещают объект, Shift увеличивает шаг, + и − меняют размер.</dd>
    <dt>Копирование и удаление</dt><dd>Ctrl/Cmd+D и Delete работают для добавленных элементов, когда выделенная строка или рамка в фокусе.</dd>
    <dt>История</dt><dd>Ctrl/Cmd+Z — отмена; Ctrl/Cmd+Shift+Z или Ctrl+Y — повтор.</dd>
    <dt>Просмотр</dt><dd>Кнопка ▣ скрывает панели и таймлайн, чтобы увеличить холст; повторное нажатие возвращает их. Кнопки − и + меняют масштаб; «Вписать» сбрасывает вид. «Рука» перемещает увеличенный кадр, Escape выключает её.</dd>
    <dt>Таймлайн</dt><dd>Тяните середину полосы для перемещения, края — для изменения длительности. Линейка перематывает; −1 и +1 переходят по кадрам, Alt со стрелками — на линейке. Введите таймкод и нажмите Enter. Перетащите метки фаз или включите «Своё время» у поддерживаемого слоя. Строки «Сценарий» не показывают точный интервал.</dd></dl>`;
  layer.appendChild(quickHelp);
  function setHelp(open, restoreFocus = false) {
    quickHelp.hidden = !open; helpButton.setAttribute('aria-expanded', String(open));
    if (restoreFocus) helpButton.focus({preventScroll: true});
  }
  helpButton.addEventListener('click', () => setHelp(quickHelp.hidden));
  quickHelp.querySelector('[data-help-close]').addEventListener('click', () => setHelp(false, true));
  for (const element of [quickHelp, helpButton]) element.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !quickHelp.hidden) { event.preventDefault(); event.stopPropagation(); setHelp(false, true); }
  });
  const panSurface = document.createElement('div'); panSurface.className = 'editor-pan-surface'; panSurface.hidden = true;
  panSurface.tabIndex = 0; panSurface.setAttribute('role', 'region');
  panSurface.setAttribute('aria-label', 'Перемещение просмотра: перетащите кадр или используйте стрелки');
  previewClip.appendChild(panSurface);
  const zoomOutput = previewTools.querySelector('[data-preview-zoom]');
  const panButton = previewTools.querySelector('[data-preview=pan]');
  let panMode = false, panDrag = null;
  function updatePreviewControls() {
    const {zoom} = previewState();
    zoomOutput.textContent = `${Math.round(zoom * 100)}%`;
    zoomOutput.setAttribute('aria-label', `Масштаб просмотра ${Math.round(zoom * 100)} процентов от размера окна`);
    previewTools.querySelector('[data-preview=out]').disabled = zoom <= PREVIEW_ZOOMS[0];
    previewTools.querySelector('[data-preview=in]').disabled = zoom >= PREVIEW_ZOOMS.at(-1);
    panButton.disabled = zoom <= 1;
    if (panButton.disabled) panMode = false;
    panButton.setAttribute('aria-pressed', String(panMode)); panSurface.hidden = !panMode;
  }
  function updatePreview(kind = 'zoom') { onLayoutChange?.(kind); updatePreviewControls(); refresh(); }
  previewTools.addEventListener('click', event => {
    const action = event.target.closest('[data-preview]')?.dataset.preview;
    if (!action) return;
    if (action === 'focus') {
      const focus = document.body.classList.toggle('editor-focus');
      const button = previewTools.querySelector('[data-preview=focus]');
      button.setAttribute('aria-pressed', String(focus));
      button.setAttribute('aria-label', focus ? 'Вернуть панели редактора' : 'Увеличить рабочую область холста');
      button.title = focus ? 'Вернуть панели и таймлайн' : 'Холст: скрыть панели и таймлайн';
      updatePreview();
      return;
    }
    if (action === 'pan') {
      panMode = !panMode; updatePreviewControls();
      if (panMode) panSurface.focus({preventScroll: true});
      return;
    }
    if (action === 'fit') { resetPreview(); panMode = false; }
    else {
      const zoom = previewState().zoom;
      const next = action === 'in' ? PREVIEW_ZOOMS.find(value => value > zoom + .001) : [...PREVIEW_ZOOMS].reverse().find(value => value < zoom - .001);
      if (next) setPreviewZoom(next);
    }
    updatePreview();
  });
  panSurface.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    const {panX, panY} = previewState();
    panDrag = {id: event.pointerId, x: event.clientX, y: event.clientY, panX, panY};
    panSurface.focus({preventScroll: true}); panSurface.setPointerCapture(event.pointerId);
    panSurface.classList.add('dragging'); event.preventDefault();
  });
  panSurface.addEventListener('pointermove', event => {
    if (panDrag?.id !== event.pointerId) return;
    panPreview(panDrag.panX + event.clientX - panDrag.x, panDrag.panY + event.clientY - panDrag.y);
    updatePreview('pan'); event.preventDefault();
  });
  const finishPan = (cancel) => {
    if (!panDrag) return;
    const start = panDrag; panDrag = null; panSurface.classList.remove('dragging');
    if (cancel) { panPreview(start.panX, start.panY); updatePreview('pan'); }
  };
  panSurface.addEventListener('pointerup', event => { if (panDrag?.id === event.pointerId) finishPan(false); });
  panSurface.addEventListener('pointercancel', event => { if (panDrag?.id === event.pointerId) finishPan(true); });
  panSurface.addEventListener('lostpointercapture', () => finishPan(true));
  panSurface.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.preventDefault(); event.stopPropagation(); finishPan(true); panMode = false; updatePreviewControls(); panButton.focus(); return;
    }
    const direction = {ArrowLeft:[-1,0], ArrowRight:[1,0], ArrowUp:[0,-1], ArrowDown:[0,1]}[event.key];
    if (!direction) return;
    event.preventDefault(); event.stopPropagation();
    const {panX, panY} = previewState(), step = event.shiftKey ? 80 : 20;
    panPreview(panX + direction[0] * step, panY + direction[1] * step); updatePreview('pan');
  });
  updatePreviewControls();
  // Разделители управляют только рабочим пространством, не конфигурацией сцены.
  for (const side of ['layers', 'inspector']) {
    const handle = document.createElement('div');
    handle.className = `editor-workspace-resize editor-workspace-resize-${side}`;
    handle.dataset.workspaceResize = side;
    handle.tabIndex = 0;
    handle.setAttribute('role', 'separator');
    handle.setAttribute('aria-orientation', 'vertical');
    handle.setAttribute('aria-label', side === 'layers' ? 'Ширина панели слоёв' : 'Ширина панели свойств');
    handle.title = 'Перетащите или используйте стрелки; двойной щелчок сбрасывает ширину';
    layer.appendChild(handle);
    const update = value => { setWorkspaceWidth(side, value, innerWidth); onLayoutChange?.(); refresh(); };
    let pointer = null;
    handle.addEventListener('pointerdown', event => {
      if (event.button !== 0 || innerWidth <= 780) return;
      pointer = { id: event.pointerId, startX: event.clientX, startWidth: workspaceWidths(innerWidth)[side] };
      handle.focus({preventScroll: true});
      handle.setPointerCapture(event.pointerId); event.preventDefault();
    });
    handle.addEventListener('pointermove', event => {
      if (pointer?.id !== event.pointerId) return;
      const delta = (event.clientX - pointer.startX) * (side === 'layers' ? 1 : -1);
      update(pointer.startWidth + delta);
    });
    handle.addEventListener('pointerup', event => { if (pointer?.id === event.pointerId) pointer = null; });
    handle.addEventListener('pointercancel', event => {
      if (pointer?.id !== event.pointerId) return;
      const initial = pointer.startWidth; pointer = null; update(initial);
    });
    handle.addEventListener('lostpointercapture', () => { pointer = null; });
    handle.addEventListener('keydown', event => {
      if (event.key === 'Escape' && pointer) {
        event.preventDefault(); event.stopPropagation();
        const initial = pointer.startWidth, id = pointer.id; pointer = null;
        if (handle.hasPointerCapture(id)) handle.releasePointerCapture(id);
        update(initial); return;
      }
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      const delta = (event.key === 'ArrowRight' ? 1 : -1) * (side === 'layers' ? 1 : -1) * (event.shiftKey ? 40 : 10);
      update(workspaceWidths(innerWidth)[side] + delta);
    });
    handle.addEventListener('dblclick', () => { resetWorkspaceWidth(side); onLayoutChange?.(); refresh(); });
  }
  const panelToggles = Object.fromEntries([...historyBar.querySelectorAll('[data-panel]')].map(button => [button.dataset.panel, button]));
  function setCompactPanel(name) {
    for (const [key, panel] of [['layers', layersPanel], ['inspector', inspector]]) {
      const open = key === name;
      panel.classList.toggle('compact-open', open);
      panelToggles[key].setAttribute('aria-expanded', String(open));
    }
  }
  for (const [name, button] of Object.entries(panelToggles)) {
    button.addEventListener('click', () => setCompactPanel(button.getAttribute('aria-expanded') === 'true' ? null : name));
  }

  const bbox = new THREE.Box3(), point = new THREE.Vector3(), ray = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  let enabled = false, selected = null, drag = null, timelineDrag = null, phaseDrag = null, rulerPointer = null, inputSession = null, snapRects = {};
  const place = (el, r) => {
    el.style.left = `${r.left}px`; el.style.top = `${r.top}px`;
    el.style.width = `${Math.max(1, r.width)}px`; el.style.height = `${Math.max(1, r.height)}px`;
  };
  const multiEffects = [
    { ids: DECOR_IDS, button: 'decor', title: 'Добавить построительную окружность', add: '+ Окружность', limit: 'Лимит: 4 окружности', max: 'Максимум 4 окружности' },
    { ids: PARTICLE_CLOUD_IDS, button: 'cloud', title: 'Добавить облако частиц', add: '+ Частицы', limit: 'Лимит: 4 облака', max: 'Максимум 4 облака' },
    { ids: BACKGROUND_GLOW_IDS, button: 'glow', title: 'Добавить фоновое свечение', add: '+ Свечение', limit: 'Лимит: 4 свечения', max: 'Максимум 4 свечения' },
  ];
  const worldSection = { photoAperture: 'photo', constructionGuides: 'constructionGuides', topIllumination: 'topIllumination', logo: 'logo', photoLabel: 'photo', ringLeft: 'rings', ringRight: 'rings' };
  const ringSide = id => id === 'ringLeft' ? 'left' : id === 'ringRight' ? 'right' : null;
  const worldKeys = id => id === 'photoAperture' ? ['apertureOffsetX', 'apertureOffsetY'] : ringSide(id) ? [`${ringSide(id)}OffsetX`, `${ringSide(id)}OffsetY`] : ['offsetX', 'offsetY'];
  const textSection = id => CUSTOM_TEXT_IDS.includes(id) ? 'textLayers' : 'caption';
  const sizeInfo = {
    photoAperture: { section: 'photo', key: 'apertureRadius', min: 0.5, max: 2.5 },
    constructionGuides: { section: 'constructionGuides', key: 'scale', min: 0.2, max: 3 },
    topIllumination: { section: 'topIllumination', key: 'scale', min: 0.2, max: 2.5 },
    logo: { section: 'logo', key: 'scale', min: 0.3, max: 2.5 },
    photoLabel: { section: 'photo', key: 'radius', min: 1.1, max: 2.15 },
    ringLeft: { section: 'rings', key: 'leftScale', min: 0.3, max: 2.5 },
    ringRight: { section: 'rings', key: 'rightScale', min: 0.3, max: 2.5 },
    title: { section: 'caption', key: 'titleScale', min: 0.5, max: 2 },
    subtitle: { section: 'caption', key: 'subtitleScale', min: 0.5, max: 2 },
    date: { section: 'caption', key: 'dateScale', min: 0.5, max: 2 },
  };
  const appearance = {
    photoAperture: { color: {section: 'photo', key: 'apertureColor'}, fallback: '#e8c77e' },
    constructionGuides: { color: {section: 'constructionGuides', key: 'color'}, fallback: '#d9b268' },
    topIllumination: { color: {section: 'topIllumination', key: 'color'}, fallback: '#ffd98a' },
    logo: { color: {section: 'colors', key: 'gold'}, fallback: '#c8962e' },
    photoLabel: { text: {section: 'photo', key: 'text'}, color: {section: 'photo', key: 'textColor'}, fallback: '#e8c77e', maxLength: 40 },
    ringLeft: { color: {section: 'colors', key: 'lightLeft'}, fallback: '#ffb55c' },
    ringRight: { color: {section: 'colors', key: 'lightRight'}, fallback: '#ffcf7a' },
    title: { text: {section: 'caption', key: 'titleText'}, color: {section: 'caption', key: 'titleColor'}, fallback: '#e0b25a' },
    subtitle: { text: {section: 'caption', key: 'subtitleText'}, color: {section: 'caption', key: 'subtitleColor'}, fallback: '#ecd08c' },
    date: { text: {section: 'caption', key: 'dateText'}, color: {section: 'caption', key: 'dateColor'}, fallback: '#d9b061' },
  };
  for (const {id, section} of DECOR_SLOTS) {
    worldSection[id] = section;
    sizeInfo[id] = { section, key: 'radius', min: 0.4, max: 2.5 };
    appearance[id] = { color: {section, key: 'color'}, fallback: '#d9b268' };
  }
  for (const id of PARTICLE_CLOUD_IDS) {
    worldSection[id] = id;
    sizeInfo[id] = { section: id, key: 'radius', min: 0.3, max: 3 };
    appearance[id] = { color: {section: id, key: 'color'}, fallback: '#e8c77e' };
  }
  for (const id of BACKGROUND_GLOW_IDS) {
    worldSection[id] = id;
    sizeInfo[id] = { section: id, key: 'radius', min: 0.3, max: 5 };
    appearance[id] = { color: {section: id, key: 'color'}, fallback: '#ffbd68' };
  }
  for (const id of CUSTOM_TEXT_IDS) {
    sizeInfo[id] = { section: 'textLayers', key: `${id}Scale`, min: 0.5, max: 2 };
    appearance[id] = { text: {section: 'textLayers', key: `${id}Text`},
      color: {section: 'textLayers', key: `${id}Color`}, fallback: '#ecd08c' };
  }
  function appearanceFields(id, kind) {
    const field = appearance[id]?.[kind];
    return field ? [field] : [];
  }
  function finishInput() {
    if (!inputSession) return;
    const current = inputSession; inputSession = null;
    record(current.sceneId, current.config, current.before);
  }
  // Контролы инспектора — отдельный UI-модуль; история остаётся общей для всех редакторских жестов.
  const extraControls = createExtraPropertyControls({
    menu, getState, isLocked: layerLocked, onChange, refresh,
    begin: prop => {
      if (inputSession) return;
      const current = getState();
      inputSession = {sceneId: current.id, config: current.config, before: snapshot(current.config, [prop]), field: prop};
    },
    session: () => inputSession,
    finish: finishInput,
  });
  function populateAppearance(id) {
    const info = appearance[id], cfg = getState().config;
    extraControls.populate(id);
    menu.querySelector('[data-color-label]').textContent = id === 'logo' ? 'Общий цвет золота' : id === 'topIllumination' ? 'Цвет ореола' : ringSide(id) ? 'Цвет свечения' : 'Цвет';
    ringScaleRow.hidden = !ringSide(id);
    if (!ringScaleRow.hidden) { ringScale.value = cfg.rings[`${ringSide(id)}Scale`]; menu.querySelector('[data-ring-scale-output]').textContent = `${Number(ringScale.value).toFixed(2)}×`; }
    const locked = layerLocked(cfg, id);
    populateEffectIntensity(id);
    populateGeometry(id, true);
    for (const action of ['align-x', 'align-y', 'reset', 'reset-size']) menu.querySelector(`[data-action=${action}]`).disabled = locked;
    followInput.disabled = locked; ringScale.disabled = locked;
    const duplicate = menu.querySelector('[data-action=duplicate]');
    duplicate.hidden = !canDuplicate(id);
    duplicate.disabled = !duplicate.hidden && !duplicateTarget(cfg, id);
    duplicate.title = duplicate.disabled ? 'Все слоты этого типа заняты' : 'Создать копию элемента (Ctrl/Cmd+D на выбранном слое)';
    menu.querySelector('[data-action=delete-text]').hidden = !CUSTOM_TEXT_IDS.includes(id);
    const effectOrderSection = menu.querySelector('.editor-effect-order');
    effectOrderSection.hidden = !ORDERABLE_EFFECTS.includes(id);
    if (!effectOrderSection.hidden) {
      const order = orderedEffects(cfg, true), index = order.indexOf(id), enabled = cfg.effectOrder?.enabled === true;
      effectOrderSection.querySelector('[data-action=effect-front]').disabled = !enabled || index < 0 || index === order.length - 1;
      effectOrderSection.querySelector('[data-action=effect-back]').disabled = !enabled || index <= 0;
    }
    const orderSection = menu.querySelector('.editor-text-order');
    orderSection.hidden = !CUSTOM_TEXT_IDS.includes(id);
    menu.querySelector('[data-property-group="order"]').hidden = effectOrderSection.hidden && orderSection.hidden;
    menu.querySelector('[data-property-group="animation"]').hidden = !timingSpec(id) && !CUSTOM_TEXT_IDS.includes(id);
    if (!orderSection.hidden) {
      const order = customTextOrder(cfg.textLayers, true), index = order.indexOf(id);
      menu.querySelector('[data-action=text-front]').disabled = index < 0 || index === order.length - 1;
      menu.querySelector('[data-action=text-back]').disabled = index <= 0;
    }
    for (const effect of multiEffects) menu.querySelector(`[data-action=delete-${effect.button}]`).hidden = !effect.ids.includes(id);
    followRow.hidden = !DECOR_IDS.includes(id);
    if (!followRow.hidden) followInput.checked = cfg[decorSection(id)].followLogo !== false;
    menu.querySelector('[data-action=settings]').hidden = CUSTOM_TEXT_IDS.includes(id);
    timing.hidden = !timingSpec(id);
    if (!timing.hidden) {
      const isText = CUSTOM_TEXT_IDS.includes(id) || isBuiltinCaption(id);
      timing.querySelector('[data-timing-title]').textContent = id === 'logo' ? 'Время логотипа' : isText ? 'Время надписи' : 'Время эффекта';
      timingMode.querySelector('[value=scene]').textContent = isBuiltinCaption(id) || id === 'logo' ? 'По сценарию' : isText ? 'Вместе с названием' : 'По фазам сцены';
      timing.querySelector('[data-caption-timing-note]').hidden = !isBuiltinCaption(id);
      timing.querySelector('[data-logo-timing-note]').hidden = id !== 'logo';
      populateTiming(id);
    }
    const nameField = layerNameField(EDITOR_LAYERS.find(item => item.id === id));
    nameRow.hidden = !nameField;
    if (nameField) {
      const value = cfg[nameField.section]?.[nameField.key];
      nameInput.value = typeof value === 'string' ? value.slice(0, 48) : '';
    }
    textRow.hidden = !info.text; resetTextButton.hidden = !info.text;
    const builtinReveal = ['title','subtitle','date'].includes(id);
    revealRow.hidden = !CUSTOM_TEXT_IDS.includes(id) && !builtinReveal;
    if (!revealRow.hidden) {
      const value = builtinReveal ? cfg.captionTiming?.[`${id}RevealStyle`] : cfg.textLayers[`${id}RevealStyle`];
      revealInput.value = ['fade', 'fade-up', 'draw'].includes(value) ? value : builtinReveal ? 'fade' : 'draw';
    }
    caseRow.hidden = !CUSTOM_TEXT_IDS.includes(id);
    if (!caseRow.hidden) { const value = cfg.textLayers[`${id}Case`]; caseInput.value = ['uppercase', 'lowercase'].includes(value) ? value : 'none'; }
    fontRow.hidden = !CUSTOM_TEXT_IDS.includes(id);
    if (!fontRow.hidden) { const value = cfg.textLayers[`${id}Font`]; fontInput.value = FONTS.some(font => font.id === value) ? value : ''; }
    opacityRow.hidden = !CUSTOM_TEXT_IDS.includes(id);
    if (!opacityRow.hidden) {
      const value = cfg.textLayers[`${id}Opacity`];
      opacityInput.value = Number.isFinite(value) ? value : 1;
      opacityOutput.textContent = `${Math.round(Number(opacityInput.value) * 100)}%`;
    }
    trackingRow.hidden = !CUSTOM_TEXT_IDS.includes(id);
    if (!trackingRow.hidden) {
      const value = cfg.textLayers[`${id}Tracking`];
      trackingInput.value = Number.isFinite(value) ? value : 0;
      textTrackingOutput.textContent = `${Number(trackingInput.value).toFixed(2)} em`;
    }
    autoFitRow.hidden = !CUSTOM_TEXT_IDS.includes(id);
    if (!autoFitRow.hidden) autoFitInput.checked = cfg.textLayers[`${id}AutoFit`] === true;
    if (info.text) {
      textInput.value = cfg[info.text.section][info.text.key] ?? '';
      textInput.maxLength = info.maxLength ?? 120;
    }
    const value = cfg[info.color.section][info.color.key];
    colorInput.value = validCustomColor(value) ??
      (id === 'photoLabel' ? validCustomColor(cfg.photo.color) : null) ?? info.fallback;
  }
  for (const input of [textInput, colorInput]) {
    const begin = () => {
      if (inputSession || !selected) return;
      const state = getState();
      const field = appearanceFields(selected, input.dataset.appearance);
      inputSession = { sceneId: state.id, config: state.config, before: snapshot(state.config, field), field: field[0] };
    };
    input.addEventListener('focus', begin);
    input.addEventListener('input', () => {
      begin();
      if (!inputSession?.field) return;
      const {section, key} = inputSession.field;
      inputSession.config[section][key] = input.value;
      onChange();
    });
    input.addEventListener('change', finishInput);
    input.addEventListener('blur', finishInput);
  }
  function effectIntensitySpec(id) {
    if (DECOR_IDS.includes(id)) return {section:decorSection(id), key:'opacity', label:'Прозрачность линий', hint:'Орбитальная пыль управляется отдельно.'};
    if (PARTICLE_CLOUD_IDS.includes(id)) return {section:id, key:'opacity', label:'Яркость облака', hint:'Ноль уменьшает яркость, но не удаляет слой.'};
    if (BACKGROUND_GLOW_IDS.includes(id)) return {section:id, key:'intensity', label:'Яркость свечения', hint:'Ноль уменьшает яркость, но не удаляет слой.'};
    return null;
  }
  function populateEffectIntensity(id) {
    const spec = effectIntensitySpec(id), cfg = getState().config;
    effectPanel.hidden = !spec;
    if (!spec) return;
    effectPanel.querySelector('[data-effect-label]').textContent = spec.label;
    effectPanel.querySelector('[data-effect-hint]').textContent = spec.hint;
    effectInput.value = cfg[spec.section][spec.key];
    effectOutput.textContent = `${Math.round(Number(effectInput.value) * 100)}%`;
    dustRow.hidden = !DECOR_IDS.includes(id);
    if (!dustRow.hidden) {
      dustInput.value = cfg[spec.section].dustOpacity;
      dustOutput.textContent = `${Math.round(Number(dustInput.value) * 100)}%`;
    }
  }
  for (const [input, dust] of [[effectInput, false], [dustInput, true]]) {
    const begin = () => {
      if (inputSession || !selected) return;
      const spec = effectIntensitySpec(selected);
      if (!spec || (dust && !DECOR_IDS.includes(selected))) return;
      const state = getState(), field = {section: spec.section, key: dust ? 'dustOpacity' : spec.key};
      inputSession = {sceneId: state.id, config: state.config, before: snapshot(state.config, [field]), field};
    };
    input.addEventListener('focus', begin);
    input.addEventListener('input', () => {
      begin();
      if (!inputSession?.field) return;
      const {section, key} = inputSession.field;
      inputSession.config[section][key] = Number(input.value);
      (dust ? dustOutput : effectOutput).textContent = `${Math.round(Number(input.value) * 100)}%`;
      onChange();
    });
    input.addEventListener('change', finishInput);
    input.addEventListener('blur', finishInput);
  }
  const beginName = () => {
    if (inputSession || !selected) return;
    const field = layerNameField(EDITOR_LAYERS.find(item => item.id === selected));
    if (!field) return;
    const state = getState();
    inputSession = {sceneId: state.id, config: state.config, before: snapshot(state.config, [field]), field};
  };
  nameInput.addEventListener('focus', beginName);
  nameInput.addEventListener('input', () => {
    beginName();
    if (!inputSession?.field) return;
    const {section, key} = inputSession.field;
    inputSession.config[section][key] = nameInput.value.slice(0, 48);
    onChange(); refresh();
  });
  nameInput.addEventListener('change', finishInput);
  nameInput.addEventListener('blur', finishInput);
  revealInput.addEventListener('change', () => {
    const builtin = ['title','subtitle','date'].includes(selected);
    if (!builtin && !CUSTOM_TEXT_IDS.includes(selected)) return;
    finishInput();
    const state = getState(), field = {section: builtin ? 'captionTiming' : 'textLayers', key:`${selected}RevealStyle`};
    const before = snapshot(state.config, [field]);
    state.config[field.section][field.key] = ['fade', 'fade-up'].includes(revealInput.value) ? revealInput.value : 'draw';
    record(state.id, state.config, before); onChange(); refresh();
  });
  caseInput.addEventListener('change', () => {
    if (!CUSTOM_TEXT_IDS.includes(selected)) return;
    finishInput();
    const state = getState(), field = {section:'textLayers', key:`${selected}Case`};
    const before = snapshot(state.config, [field]);
    state.config.textLayers[field.key] = ['uppercase', 'lowercase'].includes(caseInput.value) ? caseInput.value : 'none';
    record(state.id, state.config, before); onChange(); refresh();
  });
  fontInput.addEventListener('change', () => {
    if (!CUSTOM_TEXT_IDS.includes(selected)) return;
    finishInput();
    const state = getState(), field = {section:'textLayers', key:`${selected}Font`};
    const before = snapshot(state.config, [field]);
    state.config.textLayers[field.key] = FONTS.some(font => font.id === fontInput.value) ? fontInput.value : '';
    record(state.id, state.config, before); onChange(); refresh();
  });
  const beginOpacity = () => {
    if (inputSession || !CUSTOM_TEXT_IDS.includes(selected)) return;
    const state = getState(), field = {section:'textLayers', key:`${selected}Opacity`};
    inputSession = {sceneId: state.id, config: state.config, before: snapshot(state.config, [field]), field};
  };
  opacityInput.addEventListener('focus', beginOpacity);
  opacityInput.addEventListener('input', () => {
    beginOpacity();
    if (!inputSession?.field) return;
    const {section, key} = inputSession.field;
    inputSession.config[section][key] = Number(opacityInput.value);
    opacityOutput.textContent = `${Math.round(Number(opacityInput.value) * 100)}%`;
    onChange();
  });
  opacityInput.addEventListener('change', finishInput);
  opacityInput.addEventListener('blur', finishInput);
  const beginTracking = () => {
    if (inputSession || !CUSTOM_TEXT_IDS.includes(selected)) return;
    const state = getState(), field = {section:'textLayers', key:`${selected}Tracking`};
    inputSession = {sceneId: state.id, config: state.config, before: snapshot(state.config, [field]), field};
  };
  trackingInput.addEventListener('focus', beginTracking);
  trackingInput.addEventListener('input', () => {
    beginTracking();
    if (!inputSession?.field) return;
    const {section, key} = inputSession.field;
    inputSession.config[section][key] = Number(trackingInput.value);
    textTrackingOutput.textContent = `${Number(trackingInput.value).toFixed(2)} em`;
    onChange();
  });
  trackingInput.addEventListener('change', finishInput);
  trackingInput.addEventListener('blur', finishInput);
  autoFitInput.addEventListener('change', () => {
    if (!CUSTOM_TEXT_IDS.includes(selected)) return;
    finishInput();
    const state = getState(), field = {section:'textLayers', key:`${selected}AutoFit`};
    const before = snapshot(state.config, [field]);
    state.config.textLayers[field.key] = autoFitInput.checked;
    record(state.id, state.config, before); onChange(); refresh();
  });
  const isBuiltinCaption = id => ['title', 'subtitle', 'date'].includes(id);
  function timingSpec(id) {
    if (id === 'logo') return {section: 'logoTiming', keys: {TimingMode:'timingMode', Start:'timingStart', End:'timingEnd', Fade:'timingFade'}};
    if (isBuiltinCaption(id)) return {section: 'captionTiming', keys: {TimingMode: `${id}TimingMode`, Start: `${id}Start`, End: `${id}End`, Fade: `${id}Fade`}};
    if (CUSTOM_TEXT_IDS.includes(id)) return {section: 'textLayers', keys: {
      TimingMode: `${id}TimingMode`, Start: `${id}Start`, End: `${id}End`, Fade: `${id}Fade`,
    }};
    const section = decorSection(id) || (id === 'constructionGuides' ? id : null) || (PARTICLE_CLOUD_IDS.includes(id) || BACKGROUND_GLOW_IDS.includes(id) ? id : null);
    return section ? {section, keys: {TimingMode: 'timingMode', Start: 'timingStart', End: 'timingEnd', Fade: 'timingFade'}} : null;
  }
  function populateTiming(id) {
    const config = getState().config, spec = timingSpec(id);
    if (!spec) return;
    const values = config[spec.section], keys = spec.keys;
    const mode = values[keys.TimingMode] === 'custom' ? 'custom' : 'scene';
    timingMode.value = mode; timingFields.hidden = mode !== 'custom';
    const curveRow = timingFields.querySelector('[data-effect-curve-row]');
    const curveSupported = !!(decorSection(id) || PARTICLE_CLOUD_IDS.includes(id) || BACKGROUND_GLOW_IDS.includes(id));
    curveRow.hidden = !curveSupported;
    timingFields.querySelector('[data-effect-curve]').value = ['soft', 'bright'].includes(values.timingCurve) ? values.timingCurve : 'normal';
    const tl = config.timeline;
    const cycle = tl ? tl.drawDuration + tl.emergeDuration + tl.holdDuration + tl.fadeDuration + tl.restDuration : 0;
    for (const [kind, fallback] of [['Start', 25], ['End', 90], ['Fade', 15]]) {
      const input = timingFields.querySelector(`[data-timing="${kind}"]`);
      input.value = Number.isFinite(values[keys[kind]]) ? values[keys[kind]] : fallback;
      const value = Number(input.value);
      const actual = Number.isFinite(values[keys[kind]]) ? values[keys[kind]] : fallback;
      timingFields.querySelector(`[data-timing-output="${kind}"]`).textContent = kind === 'Fade' ? `${actual}%` : `${Number(actual.toFixed(2))}% · ${(cycle * actual / 100).toFixed(1)} с`;
    }
    const range = timelineRange(values[keys.Start], values[keys.End]);
    for (const edge of ['start', 'end']) {
      const field = timingFields.querySelector(`[data-timing-seconds="${edge}"]`);
      if (field !== document.activeElement) field.value = (cycle * range[edge] / 100).toFixed(3);
      field.max = String(cycle);
    }
  }
  function changeTimingMode(id, mode) {
    const spec = timingSpec(id);
    if (!spec) return;
    finishInput();
    const state = getState(), values = state.config[spec.section], keys = spec.keys;
    const fields = [{section:spec.section, key:keys.TimingMode}];
    const initKey = `${id}TimingInitialized`;
    const initialize = isBuiltinCaption(id) && mode === 'custom' && values[initKey] !== true;
    if (initialize) for (const key of [keys.Start, keys.End, initKey]) fields.push({section:spec.section, key});
    const before = snapshot(state.config, fields);
    if (initialize) {
      const mask = captionMaskRange(state.id, id, state.config);
      if (mask && mask.end > mask.start) {
        const range = timelineRange(Math.round(mask.start / mask.cycle * 100), Math.round(mask.end / mask.cycle * 100));
        values[keys.Start] = range.start; values[keys.End] = range.end;
      }
      values[initKey] = true;
    }
    values[keys.TimingMode] = mode;
    record(state.id, state.config, before); onChange(); populateTiming(id); refresh();
  }
  timingMode.addEventListener('change', () => changeTimingMode(selected, timingMode.value));
  timingFields.querySelector('[data-effect-curve]').addEventListener('change', event => {
    const spec = timingSpec(selected);
    if (!spec || !(decorSection(selected) || PARTICLE_CLOUD_IDS.includes(selected) || BACKGROUND_GLOW_IDS.includes(selected))) return;
    finishInput();
    const state = getState(), field = {section: spec.section, key: 'timingCurve'};
    const before = snapshot(state.config, [field]);
    state.config[spec.section].timingCurve = event.target.value;
    record(state.id, state.config, before); onChange(); refresh();
  });
  for (const input of timingFields.querySelectorAll('[data-timing]')) {
    const begin = () => {
      const spec = timingSpec(selected);
      if (inputSession || !spec) return;
      const state = getState(), kind = input.dataset.timing;
      const keys = kind === 'Fade' ? [spec.keys.Fade] : [spec.keys.Start, spec.keys.End];
      inputSession = {sceneId: state.id, config: state.config, before: snapshot(state.config, keys.map(key => ({section: spec.section, key}))), timingId: selected, timingSpec: spec};
    };
    input.addEventListener('focus', begin);
    input.addEventListener('input', () => {
      begin();
      if (!inputSession?.timingId) return;
      const id = inputSession.timingId, spec = inputSession.timingSpec;
      const values = inputSession.config[spec.section], keys = spec.keys, kind = input.dataset.timing;
      values[keys[kind]] = Number(input.value);
      if (kind === 'Start' && values[keys.Start] + 1 > values[keys.End]) values[keys.End] = values[keys.Start] + 1;
      if (kind === 'End' && values[keys.End] - 1 < values[keys.Start]) values[keys.Start] = values[keys.End] - 1;
      onChange(); populateTiming(id);
    });
    input.addEventListener('change', finishInput);
    input.addEventListener('blur', finishInput);
  }
  for (const button of timingFields.querySelectorAll('[data-timing-cursor]')) {
    button.addEventListener('click', () => {
      finishInput();
      const state = getState(), spec = timingSpec(selected);
      if (!spec || state.config[spec.section][spec.keys.TimingMode] !== 'custom') return;
      const values = state.config[spec.section], keys = spec.keys, tl = state.config.timeline;
      const local = timelineCursorFrame(state.time, tl, OUTPUT.fps);
      const next = local === null ? null : timelineEdgeSeconds(values[keys.Start], values[keys.End], button.dataset.timingCursor, local, timelineCycle(tl));
      const error = timingFields.querySelector('[data-timing-error]');
      if (!next) { error.textContent = 'Курсор должен оставлять интервал не короче 1% цикла.'; error.hidden = false; return; }
      const before = snapshot(state.config, [keys.Start, keys.End].map(key => ({section:spec.section, key})));
      values[keys.Start] = next.start; values[keys.End] = next.end;
      error.hidden = true; record(state.id, state.config, before); onChange(); populateTiming(selected); refresh();
    });
  }
  for (const input of timingFields.querySelectorAll('[data-timing-seconds]')) {
    let cancelChange = false;
    const error = timingFields.querySelector('[data-timing-error]');
    const reset = () => { input.removeAttribute('aria-invalid'); error.hidden = true; if (selected) populateTiming(selected); };
    const commit = () => {
      const state = getState(), spec = timingSpec(selected);
      if (!spec || state.config[spec.section][spec.keys.TimingMode] !== 'custom') return false;
      const values = state.config[spec.section], keys = spec.keys, raw = input.value.trim();
      const next = timelineEdgeSeconds(values[keys.Start], values[keys.End], input.dataset.timingSeconds, raw === '' ? NaN : Number(raw), timelineCycle(state.config.timeline));
      if (!next) { input.setAttribute('aria-invalid', 'true'); error.textContent = 'Укажите секунды внутри цикла. Минимальная длина — 1% цикла.'; error.hidden = false; return false; }
      const before = snapshot(state.config, [keys.Start, keys.End].map(key => ({section:spec.section, key})));
      values[keys.Start] = next.start; values[keys.End] = next.end;
      record(state.id, state.config, before); input.removeAttribute('aria-invalid'); error.hidden = true;
      onChange(); refresh(); return true;
    };
    input.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); cancelChange = true; input.blur(); }
      else if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); if (commit()) input.blur(); }
    });
    input.addEventListener('input', () => { input.removeAttribute('aria-invalid'); error.hidden = true; });
    input.addEventListener('change', () => { if (!cancelChange) commit(); });
    input.addEventListener('blur', () => { reset(); cancelChange = false; });
  }
  // Строки создаются один раз: обновления кадров не сбрасывают фокус и захват указателя.
  const trackPanel = document.createElement('section');
  trackPanel.className = 'editor-track-panel'; trackPanel.setAttribute('aria-label', 'Таймлайн элементов');
  trackPanel.innerHTML = `<div class="editor-track-head"><strong>Таймлайн</strong><small>Сценарий — без правки на шкале · «задать своё время» — доступно · цветная полоса — свой интервал</small><span class="editor-track-readout"><button type="button" data-frame-step="-1" title="Предыдущий кадр" aria-label="Предыдущий кадр">−1</button><button type="button" data-frame-step="1" title="Следующий кадр" aria-label="Следующий кадр">+1</button><input data-track-timecode type="text" spellcheck="false" aria-label="Локальный таймкод цикла" title="ЧЧ:ММ:СС:КК — введите время цикла и нажмите Enter. Escape отменяет ввод"><output data-track-time></output></span></div>
    <div class="editor-track-scale"><span>Элементы</span><div class="editor-track-ruler" data-track-ruler role="slider" tabindex="0" aria-label="Перемотка цикла" aria-valuemin="0" aria-valuemax="100"><span>0</span><span data-tick="25"></span><span data-tick="50"></span><span data-tick="75"></span><span data-tick="100"></span></div></div>
    <div class="editor-phase-row"><span title="Базовые фазы; в интро дополнительные такты продолжаются в удержании">Фазы сцены</span><div class="editor-phase-lane" data-phase-lane>
      <div class="editor-phase-entry" title="Базовые прорисовка и проявление">Вступление</div><div class="editor-phase-hold">Удержание</div><div class="editor-phase-exit">Завершение</div>
      <button type="button" class="editor-phase-marker" data-phase="entry" role="slider" aria-label="Конец базового вступления"></button>
      <button type="button" class="editor-phase-marker" data-phase="exit" role="slider" aria-label="Начало завершения"></button>
    </div></div>
    <div class="editor-track-list"><p class="editor-track-empty">Для этой сцены нет доступных элементов.</p></div>`;
  layer.appendChild(trackPanel);
  const trackList = trackPanel.querySelector('.editor-track-list');
  // Вертикальная полоса прокрутки уменьшает ширину дорожек, но не линейки.
  // Измеряем реальную ширину полосы (включая overlay=0), а не предполагаем её.
  const updateTrackScrollbar = () => {
    const width = Math.max(0, trackList.offsetWidth - trackList.clientWidth);
    const value = `${width}px`;
    if (trackPanel.style.getPropertyValue('--timeline-scrollbar') !== value) trackPanel.style.setProperty('--timeline-scrollbar', value);
  };
  new ResizeObserver(updateTrackScrollbar).observe(trackList);
  const ruler = trackPanel.querySelector('[data-track-ruler]');
  const timecodeInput = trackPanel.querySelector('[data-track-timecode]');
  const trackRows = {};
  let suppressRangeClick = false;
  for (const item of EDITOR_LAYERS) {
    const row = document.createElement('div'); row.className = 'editor-track-row'; row.dataset.track = item.id;
    const label = document.createElement('button'); label.type = 'button'; label.className = 'editor-track-label';
    label.textContent = item.label; label.title = item.label;
    const lane = document.createElement('div'); lane.className = 'editor-track-lane';
    if (!timingSpec(item.id) || isBuiltinCaption(item.id)) {
      // Для штатных элементов не рисуем выдуманные границы появления/ухода.
      const scenario = document.createElement('button'); scenario.type = 'button'; scenario.className = 'editor-track-scenario';
      scenario.textContent = 'Сценарий · без правки на шкале';
      scenario.title = 'Время этого элемента определяется сценой и не редактируется на таймлайне';
      const mask = document.createElement('span'); mask.className = 'editor-track-caption-mask'; mask.hidden = true;
      let range = null;
      if (isBuiltinCaption(item.id)) {
        range = document.createElement('div'); range.className = 'editor-track-range'; range.hidden = true;
        range.tabIndex = 0; range.setAttribute('role', 'group'); range.setAttribute('aria-label', `${item.label}: перемещение интервала`); range.title = 'Перетащите интервал целиком; стрелки сдвигают на 1%, Shift — на 5%';
        for (const edge of ['start', 'end']) {
          const grip = document.createElement('button'); grip.type = 'button'; grip.className = 'editor-track-grip';
          grip.dataset.edge = edge; grip.setAttribute('role', 'slider'); grip.setAttribute('aria-label', `${item.label}: ${edge === 'start' ? 'начало' : 'конец'} интервала`);
          range.appendChild(grip);
        }
        range.addEventListener('click', event => { if (!event.target.closest('.editor-track-grip') && !suppressRangeClick) select(item.id, true); });
      }
      lane.classList.add('is-scenario'); lane.append(mask, scenario); if (range) lane.appendChild(range);
      row.append(label, lane); trackList.append(row);
      trackRows[item.id] = {row, label, lane, scenario, mask, automatic: null, range};
      label.addEventListener('click', () => select(item.id, true));
      scenario.addEventListener('click', () => { if (isBuiltinCaption(item.id)) changeTimingMode(item.id, 'custom'); select(item.id, true); });
      continue;
    }
    const automatic = document.createElement('button'); automatic.type = 'button'; automatic.className = 'editor-track-auto';
    automatic.textContent = 'По сценарию · задать своё время'; automatic.title = 'Включить собственный интервал';
    const mask = document.createElement('span'); mask.className = 'editor-track-caption-mask is-cue-bar'; mask.hidden = true;
    const range = document.createElement('div'); range.className = 'editor-track-range';
    range.tabIndex = 0; range.setAttribute('role', 'group'); range.setAttribute('aria-label', `${item.label}: перемещение интервала`); range.title = 'Перетащите интервал целиком; стрелки сдвигают на 1%, Shift — на 5%';
    for (const edge of ['start', 'end']) {
      const grip = document.createElement('button'); grip.type = 'button'; grip.className = 'editor-track-grip';
      grip.dataset.edge = edge; grip.setAttribute('role', 'slider'); grip.setAttribute('aria-label', `${item.label}: ${edge === 'start' ? 'начало' : 'конец'} интервала`);
      range.appendChild(grip);
    }
    lane.append(mask, automatic, range); row.append(label, lane); trackList.append(row);
    trackRows[item.id] = {row, label, lane, automatic, mask, range};
    label.addEventListener('click', () => select(item.id, true));
    range.addEventListener('click', event => { if (!event.target.closest('.editor-track-grip') && !suppressRangeClick) select(item.id, true); });
    automatic.addEventListener('click', () => {
      finishInput(); const state = getState(), spec = timingSpec(item.id), key = spec.keys.TimingMode;
      const before = snapshot(state.config, [{section: spec.section, key}]);
      state.config[spec.section][key] = 'custom';
      record(state.id, state.config, before); onChange(); select(item.id, true);
    });
  }
  function refreshTracks(state, available) {
    const setText = (element, value) => { if (element.textContent !== value) element.textContent = value; };
    const setAttribute = (element, name, value) => { if (element.getAttribute(name) !== value) element.setAttribute(name, value); };
    const cfg = state.config, cycle = timelineCycle(cfg.timeline), cursor = timelineCursor(state.time, cfg.timeline);
    const cursorStyle = `${cursor}%`;
    if (trackPanel.style.getPropertyValue('--timeline-cursor') !== cursorStyle) trackPanel.style.setProperty('--timeline-cursor', cursorStyle);
    if (document.activeElement !== timecodeInput) timecodeInput.value = timelineTimecode(cycle * cursor / 100, OUTPUT.fps);
    setText(trackPanel.querySelector('[data-track-time]'), `${(cycle * cursor / 100).toFixed(1)} / ${cycle.toFixed(1)} с`);
    setAttribute(ruler, 'aria-valuenow', String(Math.round(cursor)));
    setAttribute(ruler, 'aria-valuetext', `${(cycle * cursor / 100).toFixed(1)} секунд`);
    for (const tick of trackPanel.querySelectorAll('[data-tick]')) setText(tick, `${(cycle * Number(tick.dataset.tick) / 100).toFixed(1)} с`);
    const entryTime = cfg.timeline.drawDuration + cfg.timeline.emergeDuration;
    const exitTime = entryTime + cfg.timeline.holdDuration;
    const lane = trackPanel.querySelector('[data-phase-lane]');
    lane.style.setProperty('--phase-entry', `${cycle ? entryTime / cycle * 100 : 0}%`);
    lane.style.setProperty('--phase-exit', `${cycle ? exitTime / cycle * 100 : 100}%`);
    for (const marker of lane.querySelectorAll('[data-phase]')) {
      const isEntry = marker.dataset.phase === 'entry', seconds = isEntry ? entryTime : exitTime;
      setAttribute(marker, 'aria-valuemin', '0'); setAttribute(marker, 'aria-valuemax', String(cycle.toFixed(2)));
      setAttribute(marker, 'aria-valuenow', seconds.toFixed(2));
      setAttribute(marker, 'aria-valuetext', `${seconds.toFixed(1)} секунд`);
      marker.title = `${isEntry ? 'Конец базового вступления' : 'Начало завершения'}: ${seconds.toFixed(1)} с`;
    }
    let count = 0;
    for (const [id, entry] of Object.entries(trackRows)) {
      const show = available.has(id); if (entry.row.hidden === show) entry.row.hidden = !show;
      if (!show) continue;
      count++;
      entry.row.classList.toggle('selected', id === selected);
      const visible = layerVisible(cfg, EDITOR_LAYERS.find(item => item.id === id));
      entry.row.classList.toggle('is-hidden', !visible);
      setAttribute(entry.label, 'aria-pressed', String(id === selected));
      const captionCustom = isBuiltinCaption(id) && cfg.captionTiming?.[`${id}TimingMode`] === 'custom';
      if (entry.scenario && !captionCustom) {
        if (entry.range) entry.range.hidden = true;
        entry.scenario.hidden = false;
        const maskRange = captionMaskRange(state.id, id, cfg) || scenarioCueRange(state.id, id, cfg);
        const isCaptionBar = isBuiltinCaption(id);
        const hasMask = maskRange && maskRange.end > maskRange.start;
        entry.lane.classList.add('is-scenario');
        entry.mask.hidden = !hasMask;
        entry.mask.classList.toggle('is-cue-bar', !isCaptionBar);
        entry.lane.classList.toggle('has-caption-mask', Boolean(hasMask));
        if (hasMask) {
          const left = `${maskRange.start / cycle * 100}%`, width = `${(maskRange.end - maskRange.start) / cycle * 100}%`;
          if (entry.mask.style.left !== left) entry.mask.style.left = left;
          if (entry.mask.style.width !== width) entry.mask.style.width = width;
          const local = cycle * cursor / 100;
          entry.row.classList.toggle('is-timing-active', visible && state.time >= cfg.timeline.startDelay && local > maskRange.start && local < maskRange.end);
          const description = isCaptionBar
            ? `Маска титра: ${maskRange.start.toFixed(2)}–${maskRange.end.toFixed(2)} с цикла; нажмите, чтобы задать своё время`
            : `${maskRange.label || 'Сценарий'}: ${maskRange.start.toFixed(2)}–${maskRange.end.toFixed(2)} с цикла (по сценарию)`;
          if (entry.scenario.title !== description) entry.scenario.title = description;
          setText(entry.scenario, isCaptionBar
            ? (visible ? 'Маска титра · задать своё время' : 'Скрыт · задать своё время')
            : (visible ? `Сценарий · ${maskRange.start.toFixed(1)}–${maskRange.end.toFixed(1)} с` : 'Скрыт · время по сценарию'));
        } else {
          entry.row.classList.remove('is-timing-active');
          entry.scenario.title = isCaptionBar && maskRange ? 'Маска титра не проявляется при текущем сценарии' : 'Время этого элемента определяется сценой и не редактируется на таймлайне';
          setText(entry.scenario, isCaptionBar && maskRange ? 'Маска не проявляется · задать своё время' : visible ? 'Сценарий · без правки на шкале' : 'Скрыт · время по сценарию');
        }
        continue;
      }
      if (captionCustom) {
        entry.scenario.hidden = true; entry.mask.hidden = true;
        entry.lane.classList.remove('has-caption-mask', 'is-scenario');
        entry.row.classList.remove('is-timing-active');
      }
      const spec = timingSpec(id), values = cfg[spec.section], keys = spec.keys;
      const custom = values[keys.TimingMode] === 'custom';
      if (entry.automatic && entry.automatic.hidden !== custom) entry.automatic.hidden = custom;
      if (entry.range.hidden === custom) entry.range.hidden = !custom;
      if (!custom) {
        const cueRange = scenarioCueRange(state.id, id, cfg);
        const hasCue = Boolean(cueRange && cueRange.end > cueRange.start);
        if (entry.mask) {
          entry.mask.hidden = !hasCue;
          entry.lane.classList.toggle('has-caption-mask', hasCue);
          if (hasCue) {
            const left = `${cueRange.start / cycle * 100}%`, width = `${(cueRange.end - cueRange.start) / cycle * 100}%`;
            if (entry.mask.style.left !== left) entry.mask.style.left = left;
            if (entry.mask.style.width !== width) entry.mask.style.width = width;
            const local = cycle * cursor / 100;
            entry.row.classList.toggle('is-timing-active', visible && state.time >= cfg.timeline.startDelay && local > cueRange.start && local < cueRange.end);
          } else {
            entry.row.classList.remove('is-timing-active');
          }
        }
        continue;
      }
      if (entry.mask) { entry.mask.hidden = true; entry.lane.classList.remove('has-caption-mask'); }
      const range = timelineRange(values[keys.Start], values[keys.End]);
      const left = `${range.start}%`, width = `${range.end - range.start}%`;
      if (entry.range.style.left !== left) entry.range.style.left = left;
      if (entry.range.style.width !== width) entry.range.style.width = width;
      for (const grip of entry.range.querySelectorAll('[data-edge]')) {
        const value = grip.dataset.edge === 'start' ? range.start : range.end;
        setAttribute(grip, 'aria-valuemin', String(grip.dataset.edge === 'start' ? 0 : range.start + 1));
        setAttribute(grip, 'aria-valuemax', String(grip.dataset.edge === 'start' ? range.end - 1 : 100));
        setAttribute(grip, 'aria-valuenow', String(value));
        setAttribute(grip, 'aria-valuetext', `${value} процентов, ${(cycle * value / 100).toFixed(1)} секунд`);
        const title = `${grip.dataset.edge === 'start' ? 'Начало' : 'Конец'}: ${value}% · ${(cycle * value / 100).toFixed(1)} с`;
        if (grip.title !== title) grip.title = title;
      }
    }
    const emptyTrack = trackPanel.querySelector('.editor-track-empty');
    if (emptyTrack.hidden !== (count !== 0)) emptyTrack.hidden = count !== 0;
  }
  const phaseFields = ['drawDuration', 'emergeDuration', 'holdDuration', 'fadeDuration', 'restDuration'].map(key => ({section: 'timeline', key}));
  const phaseLane = trackPanel.querySelector('[data-phase-lane]');
  function setPhaseBoundary(state, initial, edge, seconds) {
    const next = movePhaseBoundary(initial, edge, seconds, state.id === 'waiting' ? 1 : 4);
    if (!next) return;
    Object.assign(state.config.timeline, next); onChange(); refresh();
  }
  function finishPhaseDrag(cancel) {
    if (!phaseDrag) return;
    const current = phaseDrag; phaseDrag = null;
    if (cancel) {
      for (const field of current.before) current.state.config[field.section][field.key] = field.before;
      onChange(); refresh();
    } else record(current.state.id, current.state.config, current.before);
  }
  phaseLane.addEventListener('pointerdown', event => {
    const marker = event.target.closest('[data-phase]');
    if (!marker || event.button !== 0 || phaseDrag) return;
    finishInput(); const state = getState();
    phaseDrag = {state, before: snapshot(state.config, phaseFields), initial: {...state.config.timeline}, edge: marker.dataset.phase, pointerId: event.pointerId};
    marker.setPointerCapture(event.pointerId); event.preventDefault(); event.stopPropagation();
  });
  phaseLane.addEventListener('pointermove', event => {
    if (!phaseDrag || phaseDrag.pointerId !== event.pointerId) return;
    const rect = phaseLane.getBoundingClientRect(); if (!(rect.width > 0)) return;
    setPhaseBoundary(phaseDrag.state, phaseDrag.initial, phaseDrag.edge, (event.clientX - rect.left) / rect.width * timelineCycle(phaseDrag.initial));
    event.preventDefault(); event.stopPropagation();
  });
  phaseLane.addEventListener('pointerup', event => { if (phaseDrag?.pointerId === event.pointerId) { finishPhaseDrag(false); event.stopPropagation(); } });
  phaseLane.addEventListener('pointercancel', event => { if (phaseDrag?.pointerId === event.pointerId) finishPhaseDrag(true); });
  phaseLane.addEventListener('lostpointercapture', event => { if (phaseDrag?.pointerId === event.pointerId) finishPhaseDrag(true); });
  phaseLane.addEventListener('keydown', event => {
    const marker = event.target.closest('[data-phase]');
    if (!marker || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation(); finishInput();
    const state = getState(), tl = {...state.config.timeline}, edge = marker.dataset.phase;
    const before = snapshot(state.config, phaseFields);
    const current = tl.drawDuration + tl.emergeDuration + (edge === 'exit' ? tl.holdDuration : 0);
    setPhaseBoundary(state, tl, edge, current + (event.key === 'ArrowRight' ? 1 : -1) * (event.shiftKey ? 1 : .1));
    record(state.id, state.config, before);
  });
  function setTrackEdge(config, spec, edge, percent) {
    const values = config[spec.section], keys = spec.keys;
    const next = moveTimelineEdge(values[keys.Start], values[keys.End], edge, percent);
    values[keys.Start] = next.start; values[keys.End] = next.end;
  }
  trackPanel.addEventListener('pointerdown', event => {
    const grip = event.target.closest('.editor-track-grip');
    const bar = event.target.closest('.editor-track-range');
    suppressRangeClick = false;
    if (!bar || event.button !== 0 || timelineDrag) return;
    const row = bar.closest('[data-track]'), id = row.dataset.track, state = getState(), spec = timingSpec(id);
    if (state.config[spec.section][spec.keys.TimingMode] !== 'custom') return;
    select(id, false); finishInput();
    const keys = spec.keys, values = state.config[spec.section];
    const fields = [keys.Start, keys.End].map(key => ({section: spec.section, key}));
    const lane = trackRows[id].lane, rect = lane.getBoundingClientRect();
    if (!(rect.width > 0)) return;
    timelineDrag = {id, sceneId: state.id, config: state.config, before: snapshot(state.config, fields), spec,
      edge: grip?.dataset.edge ?? null, initial: timelineRange(values[keys.Start], values[keys.End]),
      startX: event.clientX, lane, pointerId: event.pointerId};
    (grip || bar).setPointerCapture(event.pointerId); event.preventDefault(); event.stopPropagation();
  });
  trackPanel.addEventListener('pointermove', event => {
    if (!timelineDrag || timelineDrag.pointerId !== event.pointerId) return;
    const rect = timelineDrag.lane.getBoundingClientRect();
    if (!(rect.width > 0)) return;
    if (Math.abs(event.clientX - timelineDrag.startX) > 3) suppressRangeClick = true;
    if (timelineDrag.edge) setTrackEdge(timelineDrag.config, timelineDrag.spec, timelineDrag.edge, (event.clientX - rect.left) / rect.width * 100);
    else {
      const keys = timelineDrag.spec.keys, values = timelineDrag.config[timelineDrag.spec.section];
      const next = moveTimelineRange(timelineDrag.initial.start, timelineDrag.initial.end, (event.clientX - timelineDrag.startX) / rect.width * 100);
      values[keys.Start] = next.start; values[keys.End] = next.end;
    }
    onChange(); refresh(); event.preventDefault();
  });
  function finishTimelineDrag(cancel) {
    if (!timelineDrag) return;
    const current = timelineDrag; timelineDrag = null;
    if (cancel) {
      suppressRangeClick = true;
      for (const c of current.before) current.config[c.section][c.key] = c.before;
      onChange(); refresh();
    } else record(current.sceneId, current.config, current.before);
  }
  trackPanel.addEventListener('pointerup', event => {
    if (timelineDrag?.pointerId === event.pointerId) { finishTimelineDrag(false); event.stopPropagation(); }
  });
  trackPanel.addEventListener('pointercancel', event => { if (timelineDrag?.pointerId === event.pointerId) finishTimelineDrag(true); });
  trackPanel.addEventListener('lostpointercapture', event => { if (timelineDrag?.pointerId === event.pointerId) finishTimelineDrag(true); });
  trackPanel.addEventListener('keydown', event => {
    const grip = event.target.closest('.editor-track-grip'), bar = event.target.closest('.editor-track-range');
    if (!bar || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    const id = bar.closest('[data-track]').dataset.track, state = getState(), spec = timingSpec(id);
    const keys = spec.keys, values = state.config[spec.section], edge = grip?.dataset.edge;
    const before = snapshot(state.config, [keys.Start, keys.End].map(key => ({section: spec.section, key})));
    const range = timelineRange(values[keys.Start], values[keys.End]);
    const delta = (event.key === 'ArrowRight' ? 1 : -1) * (event.shiftKey ? 5 : 1);
    if (edge) setTrackEdge(state.config, spec, edge, range[edge] + delta);
    else {
      const next = moveTimelineRange(range.start, range.end, delta);
      values[keys.Start] = next.start; values[keys.End] = next.end;
    }
    record(state.id, state.config, before); onChange(); select(id, false);
  });
  function seekPercent(percent) {
    const state = getState(), cycle = timelineCycle(state.config.timeline);
    if (!onSeek || !cycle) return;
    const local = Math.min(Math.max(0, cycle - 1 / 60), Math.max(0, percent / 100 * cycle));
    onSeek(state.config.timeline.startDelay + local); refresh();
  }
  timecodeInput.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== 'Escape') return;
    event.preventDefault(); event.stopPropagation();
    if (event.key === 'Escape') { timecodeInput.blur(); return; }
    const state = getState(), tl = state.config.timeline;
    const local = parseTimelineTimecode(timecodeInput.value, OUTPUT.fps, timelineCycle(tl));
    if (local === null || !Number.isFinite(tl.startDelay) || !onSeek) {
      timecodeInput.setAttribute('aria-invalid', 'true'); return;
    }
    timecodeInput.removeAttribute('aria-invalid');
    onSeek(tl.startDelay + local);
    timecodeInput.blur();
  });
  timecodeInput.addEventListener('input', () => timecodeInput.removeAttribute('aria-invalid'));
  timecodeInput.addEventListener('blur', () => { timecodeInput.removeAttribute('aria-invalid'); refresh(); });
  function stepFrame(direction) {
    const state = getState();
    const time = timelineStepFrame(state.time, state.config.timeline, OUTPUT.fps, direction);
    if (onSeek && time !== null) { onSeek(time); refresh(); }
  }
  for (const button of trackPanel.querySelectorAll('[data-frame-step]')) {
    button.addEventListener('click', () => stepFrame(button.dataset.frameStep === '-1' ? -1 : 1));
  }
  function seekFromPointer(event) {
    const rect = ruler.getBoundingClientRect();
    if (rect.width > 0) seekPercent((event.clientX - rect.left) / rect.width * 100);
  }
  ruler.addEventListener('pointerdown', event => {
    if (event.button !== 0 || !onSeek) return;
    rulerPointer = event.pointerId; ruler.setPointerCapture(event.pointerId); seekFromPointer(event); event.preventDefault();
  });
  ruler.addEventListener('pointermove', event => { if (rulerPointer === event.pointerId) seekFromPointer(event); });
  for (const eventName of ['pointerup', 'pointercancel', 'lostpointercapture']) ruler.addEventListener(eventName, event => { if (rulerPointer === event.pointerId) rulerPointer = null; });
  ruler.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    if (event.altKey && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
      stepFrame(event.key === 'ArrowLeft' ? -1 : 1); return;
    }
    const state = getState(), current = timelineCursor(state.time, state.config.timeline);
    seekPercent(event.key === 'Home' ? 0 : event.key === 'End' ? 100 : current + (event.key === 'ArrowRight' ? 1 : -1) * (event.shiftKey ? 5 : 1));
  });
  followInput.addEventListener('change', () => {
    if (!DECOR_IDS.includes(selected) || layerLocked(getState().config, selected)) return;
    finishInput();
    const state = getState(), section = decorSection(selected), decor = state.config[section], root = state.scene.logo.root.position;
    const fields = ['followLogo', 'offsetX', 'offsetY'].map(key => ({section, key}));
    const before = snapshot(state.config, fields);
    const followed = decor.followLogo !== false, follow = followInput.checked;
    if (followed !== follow) {
      decor.offsetX += follow ? -root.x : root.x;
      decor.offsetY += follow ? -root.y : root.y;
      decor.followLogo = follow;
    }
    record(state.id, state.config, before); onChange(); refresh();
  });
  const beginRingScale = () => {
    if (inputSession || !selected || !ringSide(selected)) return;
    const state = getState(), field = sizeFields(selected)[0];
    inputSession = {sceneId: state.id, config: state.config, before: snapshot(state.config, [field]), field};
  };
  ringScale.addEventListener('focus', beginRingScale);
  ringScale.addEventListener('input', () => {
    if (layerLocked(getState().config, selected)) return;
    beginRingScale();
    if (!inputSession?.field) return;
    const {section, key} = inputSession.field;
    inputSession.config[section][key] = Number(ringScale.value);
    menu.querySelector('[data-ring-scale-output]').textContent = `${Number(ringScale.value).toFixed(2)}×`;
    onChange();
  });
  ringScale.addEventListener('change', finishInput);
  ringScale.addEventListener('blur', finishInput);
  function positionFields(id) {
    const section = worldSection[id];
    return section ? worldKeys(id).map(key => ({section, key}))
      : [{section: textSection(id), key: `${id}X`}, {section: textSection(id), key: `${id}Y`}];
  }
  const sizeFields = (id) => [{ section: sizeInfo[id].section, key: sizeInfo[id].key }];
  function geometrySpec(id, kind) {
    if (kind === 'size') return {...sizeInfo[id], factor: 1};
    const field = positionFields(id)[kind === 'x' ? 0 : 1];
    const text = !worldSection[id];
    const limit = text ? 45 : (id === 'logo' || id === 'photoAperture' || id === 'photoLabel' ? 2 : 10);
    return {...field, min: -limit, max: limit, factor: text ? 100 : 1};
  }
  function populateGeometry(id, force = false) {
    const cfg = getState().config, locked = layerLocked(cfg, id), text = !worldSection[id];
    for (const [kind, input] of Object.entries(geometryInputs)) {
      const spec = geometrySpec(id, kind);
      input.disabled = locked; input.min = spec.min; input.max = spec.max;
      input.step = text && kind !== 'size' ? '0.1' : '0.01';
      if (force || document.activeElement !== input) {
        const value = cfg[spec.section]?.[spec.key];
        input.value = Number.isFinite(value) ? String(Math.round(value * spec.factor * 10000) / 10000) : '';
      }
    }
    const radius = sizeInfo[id].key.toLowerCase().includes('radius');
    menu.querySelector('[data-geometry-x-label]').textContent = text ? 'X · %' : 'X · ед.';
    menu.querySelector('[data-geometry-y-label]').textContent = text ? 'Y · %' : 'Y · ед.';
    menu.querySelector('[data-geometry-size-label]').textContent = radius ? 'Радиус · ед.' : 'Масштаб · ×';
    geometryInputs.x.setAttribute('aria-label', text ? 'X, процент ширины кадра' : 'X, единицы сцены');
    geometryInputs.y.setAttribute('aria-label', text ? 'Y, процент высоты кадра' : 'Y, единицы сцены');
    geometryInputs.size.setAttribute('aria-label', radius ? 'Радиус, единицы сцены' : 'Масштаб, множитель');
    menu.querySelector('[data-geometry-hint]').textContent = text
      ? 'X и Y — смещение в % кадра; положительный Y — вниз.'
      : 'X и Y — смещение в единицах сцены; положительный Y — вверх. Для привязанных элементов — относительно опоры.';
  }
  for (const [kind, input] of Object.entries(geometryInputs)) {
    input.addEventListener('change', () => {
      if (!selected) return;
      const state = getState(), spec = geometrySpec(selected, kind);
      const number = input.value.trim() === '' ? NaN : Number(input.value);
      if (layerLocked(state.config, selected) || !Number.isFinite(number)) { populateGeometry(selected, true); return; }
      const value = Math.max(spec.min, Math.min(spec.max, number)) / spec.factor;
      const before = snapshot(state.config, [spec]);
      state.config[spec.section][spec.key] = value;
      record(state.id, state.config, before); onChange(); populateGeometry(selected, true); refresh();
    });
  }
  function snapshot(config, fields) {
    return fields.map(({section, key}) => ({section, key, before: config[section][key]}));
  }
  function record(id, config, before) {
    history.record(id, before.map(c => ({...c, after: config[c.section][c.key]})));
    updateHistory();
  }
  function updateHistory() {
    const state = history.state(getState().id);
    undoButton.disabled = state.undo.length === 0;
    redoButton.disabled = state.redo.length === 0;
  }
  function historyAction(direction) {
    if (!enabled || drag || timelineDrag || phaseDrag) return;
    finishInput();
    const state = getState();
    const result = history.apply(state.id, state.config, direction);
    if (result === 'applied') { onChange(); if (selected) populateAppearance(selected); refresh(); }
    if (result === 'conflict') onHistoryConflict?.();
    updateHistory();
  }
  function cancelDrag() {
    if (timelineDrag) finishTimelineDrag(true);
    if (phaseDrag) finishPhaseDrag(true);
    if (!drag) return;
    for (const c of drag.before) drag.config[c.section][c.key] = c.before;
    drag = null; guides.x.hidden = guides.y.hidden = true;
    onChange(); updateHistory();
  }
  historyBar.addEventListener('click', event => {
    const direction = event.target.closest('button')?.dataset.history;
    if (direction === 'undo' || direction === 'redo') historyAction(direction);
  });
  function depth(id, scene) {
    if (id === 'photoAperture') return scene.aperture.group.position.z;
    if (id === 'constructionGuides') return scene.constructionGuides.group.position.z;
    if (id === 'topIllumination') return scene.topGlow.position.z;
    if (id === 'photoLabel') return scene.circularLabel.position.z;
    if (DECOR_IDS.includes(id)) return scene.brandDecors[id].group.position.z;
    if (PARTICLE_CLOUD_IDS.includes(id)) return scene.particleClouds[id].group.position.z;
    if (BACKGROUND_GLOW_IDS.includes(id)) return scene.backgroundGlows[id].group.position.z;
    return 0;
  }
  function worldPoint(event, state, z = 0) {
    const r = state.canvas.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    ray.setFromCamera({ x: ((event.clientX - r.left) / r.width) * 2 - 1,
      y: 1 - ((event.clientY - r.top) / r.height) * 2 }, state.scene.camera);
    plane.constant = -z;
    return ray.ray.intersectPlane(plane, new THREE.Vector3());
  }
  function select(id, showMenu) {
    if (!layersForScene(getState().id, getState().config).some(item => item.id === id)) return;
    finishInput();
    selected = id;
    for (const [name, box] of Object.entries(boxes)) box.classList.toggle('selected', name === id);
    for (const [name, row] of Object.entries(rows)) row.setAttribute('aria-pressed', String(name === id));
    menu.hidden = false; empty.hidden = true;
    menu.querySelector('[data-selected-label]').textContent = layerDisplayName(getState().config, EDITOR_LAYERS.find(item => item.id === id));
    populateAppearance(id);
    if (showMenu && window.matchMedia('(max-width: 780px)').matches) setCompactPanel('inspector');
    refresh();
    const track = trackRows[id]?.row;
    if (track && !track.hidden) {
      const listRect = trackList.getBoundingClientRect(), rowRect = track.getBoundingClientRect();
      if (rowRect.top < listRect.top) trackList.scrollTop -= listRect.top - rowRect.top;
      else if (rowRect.bottom > listRect.bottom) trackList.scrollTop += rowRect.bottom - listRect.bottom;
    }
  }
  function refresh() {
    if (!enabled) return;
    updateHistory();
    const { scene, canvas, id, config } = getState();
    const available = new Set(layersForScene(id, config).map(item => item.id));
    // Только собственные надписи имеют управляемый порядок. Список и таймлайн
    // показывают передние первыми, а рамки — как DOM-контент, сзади наперёд.
    const front = customTextOrder(config.textLayers).reverse();
    const reorderNodes = (parent, nodes) => {
      const desired = nodes.map(node => node);
      const current = [...parent.children].filter(node => desired.includes(node));
      if (desired.some((node, index) => current[index] !== node)) for (const node of desired) parent.appendChild(node);
    };
    effectOrderMode.checked = config.effectOrder?.enabled === true;
    const effectsFront = effectOrderMode.checked ? orderedEffects(config).reverse() : [...DECOR_IDS, ...PARTICLE_CLOUD_IDS, ...BACKGROUND_GLOW_IDS];
    reorderNodes(layerList, effectsFront.map(key => entries[key]));
    reorderNodes(trackList, effectsFront.map(key => trackRows[key].row));
    reorderNodes(layerList, front.map(key => entries[key]));
    reorderNodes(trackList, front.map(key => trackRows[key].row));
    reorderNodes(previewClip, [...front].reverse().map(key => boxes[key]));
    refreshTracks(getState(), available);
    let visibleRows = 0;
    const query = layerSearch.value.trim().toLocaleLowerCase('ru');
    for (const item of EDITOR_LAYERS) {
      const row = rows[item.id];
      const label = layerDisplayName(config, item);
      if (row.querySelector('strong').textContent !== label) row.querySelector('strong').textContent = label;
      if (boxes[item.id].querySelector('.editor-label').textContent !== label) boxes[item.id].querySelector('.editor-label').textContent = label;
      const boxLabel = `${label}: перетащить, переместить стрелками или изменить размер клавишами плюс и минус`;
      if (boxes[item.id].getAttribute('aria-label') !== boxLabel) boxes[item.id].setAttribute('aria-label', boxLabel);
      const track = trackRows[item.id];
      if (track) {
        if (track.label.textContent !== label) track.label.textContent = label;
        track.label.title = label;
        for (const grip of track.range?.querySelectorAll('[data-edge]') || []) {
          const gripLabel = `${label}: ${grip.dataset.edge === 'start' ? 'начало' : 'конец'} интервала`;
          if (grip.getAttribute('aria-label') !== gripLabel) grip.setAttribute('aria-label', gripLabel);
        }
      }
      const matchesKind = layerFilter === 'all' || (layerFilter === 'text' ? item.kind === 'Текст' : item.kind === 'Эффект' || item.kind === 'Декор');
      const matchesText = !query || `${label} ${item.kind}`.toLocaleLowerCase('ru').includes(query);
      const showRow = available.has(item.id) && matchesKind && matchesText;
      if (row.hidden === showRow) row.hidden = !showRow;
      if (entries[item.id].hidden === showRow) entries[item.id].hidden = !showRow;
      if (showRow) visibleRows++;
      const locked = layerLocked(config, item.id), lock = lockButtons[item.id];
      const pressed = String(locked), lockLabel = `${locked ? 'Разблокировать' : 'Заблокировать'} положение и размер: ${label}`;
      const lockTitle = locked ? 'Разблокировать положение и размер' : 'Заблокировать положение и размер';
      if (lock.getAttribute('aria-pressed') !== pressed) lock.setAttribute('aria-pressed', pressed);
      if (lock.getAttribute('aria-label') !== lockLabel) lock.setAttribute('aria-label', lockLabel);
      if (lock.title !== lockTitle) lock.title = lockTitle;
      boxes[item.id].classList.toggle('is-locked', locked);
      const visible = layerVisible(config, item);
      const visibility = visibilityButtons[item.id];
      if (visibility.getAttribute('aria-pressed') !== String(visible)) visibility.setAttribute('aria-pressed', String(visible));
      const visibilityLabel = ringSide(item.id) && config.rings?.enabled === false ? `Включить общий эффект: ${item.label}` : `${visible ? 'Скрыть' : 'Показать'}: ${label}`;
      const visibilityAria = `Видимость: ${label}`;
      if (visibility.getAttribute('aria-label') !== visibilityAria) visibility.setAttribute('aria-label', visibilityAria);
      if (visibility.title !== visibilityLabel) visibility.title = visibilityLabel;
      const status = ringSide(item.id) && config.rings?.enabled === false ? `${item.kind} · общий эффект выключен` : visible ? item.kind : `${item.kind} · скрыт`;
      if (row.querySelector('small').textContent !== status) row.querySelector('small').textContent = status;
    }
    const countText = `${visibleRows} / ${available.size}`;
    if (layerCount.textContent !== countText) layerCount.textContent = countText;
    if (layerEmpty.hidden !== (visibleRows > 0)) layerEmpty.hidden = visibleRows > 0;
    if (selected && !available.has(selected)) {
      finishInput(); selected = null; menu.hidden = true; empty.hidden = false;
      for (const row of Object.values(rows)) row.setAttribute('aria-pressed', 'false');
      for (const box of Object.values(boxes)) box.classList.remove('selected');
    }
    if (selected) {
      const locked = layerLocked(config, selected);
      for (const action of ['align-x', 'align-y', 'reset', 'reset-size']) menu.querySelector(`[data-action=${action}]`).disabled = locked;
      followInput.disabled = locked; ringScale.disabled = locked;
      populateGeometry(selected);
    }
    if (selected) menu.querySelector('[data-selected-label]').textContent = layerDisplayName(config, EDITOR_LAYERS.find(item => item.id === selected));
    if (selected) menu.querySelector('.editor-hidden-note').hidden = layerVisible(config, EDITOR_LAYERS.find(item => item.id === selected));
    if (selected && !inputSession && !menu.contains(document.activeElement)) populateAppearance(selected);
    const addButton = layersPanel.querySelector('[data-add-text]');
    addButton.disabled = CUSTOM_TEXT_IDS.every(key => config.textLayers?.[`${key}Present`] === true);
    const addTextTitle = addButton.disabled ? 'Максимум 8 дополнительных надписей' : 'Добавить надпись в сцену';
    const addTextLabel = addButton.disabled ? 'Лимит: 8 текстов' : '+ Текст';
    if (addButton.title !== addTextTitle) addButton.title = addTextTitle;
    if (addButton.textContent !== addTextLabel) addButton.textContent = addTextLabel;
    for (const effect of multiEffects) {
      const button = layersPanel.querySelector(`[data-add-${effect.button}]`);
      button.disabled = effect.ids.every(key => config[decorSection(key) || key]?.present === true);
      const title = button.disabled ? effect.max : effect.title, label = button.disabled ? effect.limit : effect.add;
      if (button.title !== title) button.title = title;
      if (button.textContent !== label) button.textContent = label;
    }
    snapRects = {};
    const rect = canvas.getBoundingClientRect();
    safeFrame.hidden = !safeEnabled;
    if (safeEnabled) place(safeFrame, safeArea(rect));
    const warnings = [];
    const inspectText = (name, line, bounds) => {
      if (!safeEnabled || !line.textContent.trim()) return;
      const status = textBoundsStatus(bounds, rect);
      if (status === 'outside' || status === 'margin') warnings.push({name, status});
    };
    scene.logo.root.updateWorldMatrix(true, true);
    scene.camera.updateMatrixWorld();
    bbox.setFromObject(scene.logo.mesh);
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const x of [bbox.min.x, bbox.max.x]) for (const y of [bbox.min.y, bbox.max.y]) for (const z of [bbox.min.z, bbox.max.z]) {
      point.set(x, y, z).project(scene.camera);
      const px = rect.left + (point.x + 1) * rect.width / 2;
      const py = rect.top + (1 - point.y) * rect.height / 2;
      minX = Math.min(minX, px); maxX = Math.max(maxX, px);
      minY = Math.min(minY, py); maxY = Math.max(maxY, py);
    }
    boxes.logo.hidden = config.logo?.visible === false || !Number.isFinite(minX);
    if (!boxes.logo.hidden) {
      snapRects.logo = { left: minX, top: minY, width: maxX - minX, height: maxY - minY };
      place(boxes.logo, { left: minX - 5, top: minY - 5, width: maxX - minX + 10, height: maxY - minY + 10 });
    }
    for (const [name, selector] of [['title', '.cap-title'], ['subtitle', '.cap-sub'], ['date', '.cap-date']]) {
      const line = document.querySelector(`#caption ${selector}`);
      boxes[name].hidden = id === 'photo-pause' || !line || getComputedStyle(line).display === 'none' || config.caption?.[`${name}Visible`] === false;
      if (!boxes[name].hidden) {
        const r = line.getBoundingClientRect();
        snapRects[name] = { left: r.left, top: r.top, width: r.width, height: r.height };
        inspectText(EDITOR_LAYERS.find(item => item.id === name).label, line, r);
        place(boxes[name], { left: r.left - 5, top: r.top - 5, width: r.width + 10, height: r.height + 10 });
      }
    }
    for (const customId of CUSTOM_TEXT_IDS) {
      const line = document.querySelector(`#caption [data-custom="${customId}"]`);
      boxes[customId].hidden = !available.has(customId) || !line || config.textLayers?.[`${customId}Visible`] === false;
      if (!boxes[customId].hidden) {
        const r = line.getBoundingClientRect();
        snapRects[customId] = { left: r.left, top: r.top, width: r.width, height: r.height };
        inspectText(layerDisplayName(config, EDITOR_LAYERS.find(item => item.id === customId)), line, r);
        place(boxes[customId], { left: r.left - 5, top: r.top - 5, width: r.width + 10, height: r.height + 10 });
      }
    }
    safeNotice.hidden = !safeEnabled || warnings.length === 0;
    if (!safeNotice.hidden) {
      const names = status => warnings.filter(item => item.status === status).map(item => item.name).join(', ');
      const outside = names('outside'), margin = names('margin');
      const message = [outside && `За кадром: ${outside}`, margin && `За полями 5%: ${margin}`].filter(Boolean).join(' · ');
      if (safeNotice.textContent !== message) safeNotice.textContent = message;
      const clip = previewLayout(editorViewport(innerWidth, innerHeight, true, document.body.classList.contains('editor-focus')), true).clip;
      const noticeLeft = Math.max(rect.left, clip.left), noticeTop = Math.max(rect.top, clip.top);
      const noticeRight = Math.min(rect.right, clip.left + clip.width);
      safeNotice.style.left = `${noticeLeft + 6}px`;
      safeNotice.style.top = `${noticeTop + 6}px`;
      safeNotice.style.maxWidth = `${Math.max(0, noticeRight - noticeLeft - 12)}px`;
    }
    // Для круглых элементов используется небольшая ручка на верхней кромке,
    // чтобы не перекрывать возможность выбрать находящийся внутри логотип.
    const handle = (name, visible, position, radius) => {
      boxes[name].hidden = !visible;
      if (!visible) return;
      let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
      for (const [dx, dy] of [[-radius, 0], [radius, 0], [0, -radius], [0, radius]]) {
        point.set(position.x + dx, position.y + dy, position.z).project(scene.camera);
        const x = rect.left + (point.x + 1) * rect.width / 2;
        const y = rect.top + (1 - point.y) * rect.height / 2;
        left = Math.min(left, x); right = Math.max(right, x);
        top = Math.min(top, y); bottom = Math.max(bottom, y);
      }
      snapRects[name] = { left, top, width: right - left, height: bottom - top };
      const x = (left + right) / 2, y = top;
      place(boxes[name], { left: x - 9, top: y - 9, width: 18, height: 18 });
    };
    for (const [name, side] of [['ringLeft', 'left'], ['ringRight', 'right']]) {
      const group = scene.corners?.sides?.[side]?.group;
      boxes[name].hidden = !group?.visible || config.rings?.[`${side}Visible`] === false || config.rings?.enabled === false;
      if (!boxes[name].hidden) {
        point.copy(group.position).project(scene.camera);
        const x = rect.left + (point.x + 1) * rect.width / 2, y = rect.top + (1 - point.y) * rect.height / 2;
        snapRects[name] = { left: x - 9, top: y - 9, width: 18, height: 18 };
        place(boxes[name], snapRects[name]);
      }
    }
    handle('photoAperture', id === 'photo-pause' && config.photo?.apertureEnabled !== false && !!scene.aperture?.group.visible, scene.aperture?.group.position, config.photo?.apertureRadius ?? 0);
    handle('constructionGuides', config.constructionGuides?.enabled !== false && !!scene.constructionGuides?.group.visible, scene.constructionGuides?.group.position, .25);
    handle('topIllumination', config.topIllumination?.enabled !== false && !!scene.topGlow?.visible, scene.topGlow?.position, 0.2);
    const photoLabel = scene.circularLabel;
    handle('photoLabel', (id === 'photo-pause' || id === 'brand') && config.photo?.textEnabled !== false && !!photoLabel?.visible,
      photoLabel?.position, getState().config.photo?.radius ?? 0);
    for (const glowId of BACKGROUND_GLOW_IDS) {
      const glow = scene.backgroundGlows?.[glowId];
      handle(glowId, available.has(glowId) && config[glowId]?.enabled !== false && !!glow?.group.visible,
        glow?.group.position, config[glowId]?.radius ?? 0);
    }
    for (const cloudId of PARTICLE_CLOUD_IDS) {
      const cloud = scene.particleClouds?.[cloudId];
      handle(cloudId, available.has(cloudId) && config[cloudId]?.enabled !== false && !!cloud?.group.visible,
        cloud?.group.position, config[cloudId]?.radius ?? 0);
    }
    for (const {id: decorId, section} of DECOR_SLOTS) {
      const decor = scene.brandDecors?.[decorId];
      handle(decorId, available.has(decorId) && config[section]?.enabled !== false && !!decor?.group.visible,
        decor?.group.position, config[section]?.radius ?? 0);
    }

  }
  function disable() {
    if (timelineDrag) finishTimelineDrag(false);
    if (phaseDrag) finishPhaseDrag(false);
    rulerPointer = null;
    finishInput();
    if (drag) {
      record(drag.sceneId, drag.config, drag.before);
      drag = null;
    }
    if (!enabled) return;
    enabled = false; selected = null; drag = null; layer.hidden = true; menu.hidden = true; empty.hidden = false;
    contextMenu?.close();
    panDrag = null; panMode = false; resetPreview(); updatePreviewControls(); setHelp(false);
    document.body.classList.remove('editor-on', 'editor-focus');
    previewTools.querySelector('[data-preview=focus]').setAttribute('aria-pressed', 'false');
    previewTools.querySelector('[data-preview=focus]').setAttribute('aria-label', 'Увеличить рабочую область холста');
    previewTools.querySelector('[data-preview=focus]').title = 'Холст: скрыть панели и таймлайн';
    setCompactPanel(null);
    for (const row of Object.values(rows)) row.setAttribute('aria-pressed', 'false');
    for (const box of Object.values(boxes)) box.classList.remove('selected');
    onLayoutChange?.();
    guides.x.hidden = guides.y.hidden = true;
    toggle.textContent = 'Редактировать'; toggle.setAttribute('aria-pressed', 'false');
  }
  for (const effect of multiEffects) layersPanel.querySelector(`[data-add-${effect.button}]`).addEventListener('click', () => {
    finishInput();
    const state = getState(), cfg = state.config;
    const id = effect.ids.find(key => cfg[decorSection(key) || key].present !== true);
    if (!id) return;
    const section = decorSection(id) || id;
    const fields = Object.keys(state.defaults[section]).map(key => ({section, key}));
    const orderChanges = effectOrderChanges(cfg, id, 'top');
    const before = snapshot(cfg, [...fields, {section:'editorLocks', key:id}, ...orderChanges]);
    cfg.editorLocks[id] = false;
    for (const change of orderChanges) cfg.effectOrder[change.key] = change.value;
    for (const {key} of fields) cfg[section][key] = state.defaults[section][key];
    cfg[section].present = true; cfg[section].enabled = true;
    record(state.id, cfg, before); onChange(); select(id, true);
  });
  layersPanel.querySelector('[data-add-text]').addEventListener('click', () => {
    finishInput();
    const state = getState(), cfg = state.config;
    const id = CUSTOM_TEXT_IDS.find(key => cfg.textLayers[`${key}Present`] !== true);
    if (!id) return;
    const fields = customTextKeys(id).map(key => ({section: 'textLayers', key}));
    const orderChanges = customTextInsertion(cfg.textLayers, id);
    const before = snapshot(cfg, [...fields, ...orderChanges.filter(change => change.key !== `${id}Order`), {section:'editorLocks', key:id}]);
    cfg.editorLocks[id] = false;
    for (const {key} of fields) cfg.textLayers[key] = state.defaults.textLayers[key];
    for (const {key, value} of orderChanges) cfg.textLayers[key] = value;
    cfg.textLayers[`${id}Present`] = true;
    record(state.id, cfg, before); onChange(); select(id, true);
  });
  toggle.addEventListener('click', () => {
    if (enabled) { disable(); return; }
    if (!onEnable()) return;
    enabled = true; layer.hidden = false;
    document.body.classList.add('editor-on');
    onLayoutChange?.();
    toggle.textContent = 'Готово'; toggle.setAttribute('aria-pressed', 'true');
    select('logo', false);
  });
  for (const [id, box] of Object.entries(boxes)) {
    box.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      const state = getState(), cfg = state.config;
      if (layerLocked(cfg, id)) { select(id, true); event.preventDefault(); return; }
      const section = worldSection[id];
      const world = section ? worldPoint(event, state, depth(id, state.scene)) : null;
      if (section && !world) return;
      select(id, false);
      const resizing = !!event.target.closest('.editor-resize');
      const bounds = snapRects[id];
      const centerX = bounds.left + bounds.width / 2, centerY = bounds.top + bounds.height / 2;
      const size = sizeInfo[id];
      const frame = state.canvas.getBoundingClientRect();
      const targets = [{ left: frame.left, top: frame.top, width: frame.width, height: frame.height },
        ...Object.entries(snapRects).filter(([name]) => name !== id &&
          !(id === 'logo' && (name === 'photoLabel' || DECOR_IDS.includes(name)))).map(([, rect]) => ({ ...rect }))];
      drag = { id, resizing, sceneId: state.id, config: cfg,
        before: snapshot(cfg, resizing ? sizeFields(id) : positionFields(id)), centerX, centerY,
        startDistance: Math.hypot(event.clientX - centerX, event.clientY - centerY),
        startSize: cfg[size.section][size.key],
        rect: { ...bounds }, targets, frame: { left: frame.left, top: frame.top, width: frame.width, height: frame.height }, pointerId: event.pointerId, x: event.clientX, y: event.clientY, world,
        start: section ? { x: cfg[section][worldKeys(id)[0]], y: cfg[section][worldKeys(id)[1]] } : { x: cfg[textSection(id)][`${id}X`], y: cfg[textSection(id)][`${id}Y`] }, moved: false };
      box.setPointerCapture(event.pointerId); event.preventDefault();
    });
    box.addEventListener('pointermove', (event) => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      const state = getState(), cfg = state.config, rect = state.canvas.getBoundingClientRect();
      const rawX = event.clientX - drag.x, rawY = event.clientY - drag.y;
      if (Math.hypot(rawX, rawY) > 3) drag.moved = true;
      if (drag.resizing) {
        const size = sizeInfo[id];
        const distance = Math.hypot(event.clientX - drag.centerX, event.clientY - drag.centerY);
        cfg[size.section][size.key] = resizeFromDistance(drag.startSize, drag.startDistance, distance, size.min, size.max);
        onChange();
        return;
      }
      const snap = event.altKey ? { dx: rawX, dy: rawY, guideX: null, guideY: null }
        : snapRect(drag.rect, rawX, rawY, drag.targets);
      const { dx, dy, guideX, guideY } = snap;
      guides.x.hidden = guideX === null; guides.y.hidden = guideY === null;
      if (guideX !== null) place(guides.x, { left: guideX, top: drag.frame.top, width: 1, height: drag.frame.height });
      if (guideY !== null) place(guides.y, { left: drag.frame.left, top: guideY, width: drag.frame.width, height: 1 });
      if (worldSection[id]) {
        const section = worldSection[id];
        const now = worldPoint({ clientX: drag.x + dx, clientY: drag.y + dy }, state, depth(id, state.scene));
        if (!now) return;
        const next = (id === 'constructionGuides' || id === 'topIllumination' || ringSide(id) || DECOR_IDS.includes(id) || PARTICLE_CLOUD_IDS.includes(id) || BACKGROUND_GLOW_IDS.includes(id)) ? moveWorldOffset(drag.start, now.x - drag.world.x, now.y - drag.world.y) : moveLogo(drag.start, now.x - drag.world.x, now.y - drag.world.y);
        const [xKey, yKey] = worldKeys(id);
        cfg[section][xKey] = next.x; cfg[section][yKey] = next.y;
      } else {
        const next = moveTitle(drag.start, dx, dy, rect.width, rect.height);
        cfg[textSection(id)][`${id}X`] = next.x; cfg[textSection(id)][`${id}Y`] = next.y;
      }
      onChange();
    });
    box.addEventListener('pointerup', (event) => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      const moved = drag.moved;
      record(drag.sceneId, drag.config, drag.before);
      drag = null;
      guides.x.hidden = guides.y.hidden = true;
      if (!moved) select(id, true);
    });
    box.addEventListener('pointercancel', cancelDrag);
    box.addEventListener('lostpointercapture', () => { if (drag) cancelDrag(); });
    box.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      select(id, true);
      contextMenu.open(id, event.clientX, event.clientY);
    });
    rows[id].addEventListener('contextmenu', (event) => {
      event.preventDefault();
      select(id, true);
      contextMenu.open(id, event.clientX, event.clientY);
    });
    const handleElementKey = (event) => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); select(id, true); return; }
      if (layerLocked(getState().config, id) && ['+', '=', '-', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) { event.preventDefault(); event.stopPropagation(); return; }
      if (event.key === '+' || event.key === '=' || event.key === '-') {
        event.preventDefault(); event.stopPropagation();
        const state = getState(), size = sizeInfo[id], cfg = state.config;
        const before = snapshot(cfg, sizeFields(id));
        const multiplier = event.key === '-' ? 0.95 : 1.05;
        cfg[size.section][size.key] = resizeFromDistance(cfg[size.section][size.key], 100, 100 * multiplier, size.min, size.max);
        record(state.id, cfg, before); select(id, false); onChange(); return;
      }
      const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
      if (!direction) return;
      event.preventDefault(); event.stopPropagation();
      const state = getState(), cfg = state.config, step = event.shiftKey ? 0.1 : 0.01;
      const before = snapshot(cfg, positionFields(id));
      if (worldSection[id]) {
        const section = worldSection[id];
        const [xKey, yKey] = worldKeys(id);
        const start = { x: cfg[section][xKey], y: cfg[section][yKey] };
        const p = (id === 'constructionGuides' || id === 'topIllumination' || ringSide(id) || DECOR_IDS.includes(id) || PARTICLE_CLOUD_IDS.includes(id) || BACKGROUND_GLOW_IDS.includes(id)) ? moveWorldOffset(start, direction[0] * step, -direction[1] * step) : moveLogo(start, direction[0] * step, -direction[1] * step);
        cfg[section][xKey] = p.x; cfg[section][yKey] = p.y;
      } else {
        const target = cfg[textSection(id)];
        const p = moveTitle({ x: target[`${id}X`], y: target[`${id}Y`] }, direction[0] * step, direction[1] * step, 1, 1);
        target[`${id}X`] = p.x; target[`${id}Y`] = p.y;
      }
      record(state.id, cfg, before); select(id, false); onChange();
    };
    box.addEventListener('keydown', handleElementKey);
    rows[id].addEventListener('keydown', handleElementKey);
  }
  const contextMenu = createEditorContextMenu({
    root: layer,
    getLayerState(layerId) {
      const state = getState();
      const item = EDITOR_LAYERS.find((l) => l.id === layerId);
      if (!item) return null;
      const deleteEffect = multiEffects.find((group) => group.ids.includes(layerId));
      return {
        name: layerDisplayName(state.config, item),
        visible: layerVisible(state.config, item),
        locked: layerLocked(state.config, layerId),
        hasSize: Boolean(sizeInfo[layerId]),
        canDuplicate: canDuplicate(layerId),
        canDuplicateNow: Boolean(duplicateTarget(state.config, layerId)),
        canDelete: CUSTOM_TEXT_IDS.includes(layerId) || Boolean(deleteEffect),
      };
    },
    onAction(layerId, action) {
      select(layerId, true);
      if (action === 'toggle-visible') {
        visibilityButtons[layerId]?.click();
        return;
      }
      if (action === 'toggle-lock') {
        lockButtons[layerId]?.click();
        return;
      }
      if (action === 'delete') {
        const effect = multiEffects.find((group) => group.ids.includes(layerId));
        const btnKey = CUSTOM_TEXT_IDS.includes(layerId) ? 'delete-text' : effect ? `delete-${effect.button}` : null;
        if (btnKey) menu.querySelector(`[data-action="${btnKey}"]`)?.click();
        return;
      }
      menu.querySelector(`[data-action="${action}"]`)?.click();
    },
  });

  menu.addEventListener('click', (event) => {
    const action = event.target.closest('button')?.dataset.action;
    if (!selected || !action) return;
    finishInput();
    const state = getState();
    if ((action === 'effect-front' || action === 'effect-back') && ORDERABLE_EFFECTS.includes(selected)) {
      if (state.config.effectOrder.enabled !== true) return;
      const changes = effectOrderChanges(state.config, selected, action === 'effect-front' ? 'front' : 'back');
      if (!changes.length) return;
      const before = snapshot(state.config, changes);
      for (const {key, value} of changes) state.config.effectOrder[key] = value;
      record(state.id, state.config, before); onChange(); populateAppearance(selected); refresh(); return;
    }
    if ((action === 'text-front' || action === 'text-back') && CUSTOM_TEXT_IDS.includes(selected)) {
      const changes = customTextReorder(state.config.textLayers, selected, action === 'text-front' ? 'front' : 'back');
      if (!changes.length) return;
      const before = snapshot(state.config, changes);
      for (const {key, value} of changes) state.config.textLayers[key] = value;
      record(state.id, state.config, before); onChange(); populateAppearance(selected); refresh();
      return;
    }
    if (action === 'duplicate') {
      const plan = duplicatePlan(state.config, state.defaults, selected);
      if (!plan) return;
      const orderChanges = ORDERABLE_EFFECTS.includes(plan.target) ? effectOrderChanges(state.config, plan.target, 'top') : [];
      const before = snapshot(state.config, [...plan.changes, {section:'editorLocks', key:plan.target}, ...orderChanges]);
      state.config.editorLocks[plan.target] = false;
      for (const change of orderChanges) state.config.effectOrder[change.key] = change.value;
      for (const {section, key, value} of plan.changes) state.config[section][key] = value;
      record(state.id, state.config, before); onChange(); select(plan.target, true);
      return;
    }
    const multiToDelete = multiEffects.some(effect => action === `delete-${effect.button}` && effect.ids.includes(selected));
    if (multiToDelete) {
      const section = decorSection(selected) || selected;
      const before = snapshot(state.config, [{section, key: 'present'}]);
      state.config[section].present = false;
      record(state.id, state.config, before); onChange(); refresh();
      return;
    }
    if (action === 'delete-text' && CUSTOM_TEXT_IDS.includes(selected)) {
      const key = `${selected}Present`, before = snapshot(state.config, [{section: 'textLayers', key}]);
      state.config.textLayers[key] = false;
      record(state.id, state.config, before); onChange(); refresh();
      return;
    }
    if (layerLocked(state.config, selected) && ['align-x', 'align-y', 'reset', 'reset-size'].includes(action)) return;
    const fields = action === 'reset-size' ? sizeFields(selected)
      : action === 'reset-color' ? appearanceFields(selected, 'color')
      : action === 'reset-text' ? appearanceFields(selected, 'text') : positionFields(selected);
    const before = snapshot(state.config, fields);
    if (action === 'align-x' || action === 'align-y') {
      const xAxis = action === 'align-x';
      if (worldSection[selected]) {
        const section = worldSection[selected];
        const key = worldKeys(selected)[xAxis ? 0 : 1];
        const side = ringSide(selected);
        const position = side ? state.scene.corners.sides[side].group.position : state.scene.logo.root.position;
        const axisPosition = xAxis ? position.x : position.y;
        // Боковые круги хранят сдвиг от исходной позиции, свободные эффекты — абсолютную позицию.
        const value = side || selected === 'logo' ? state.config[section][key] - axisPosition
          : (selected === 'topIllumination' || PARTICLE_CLOUD_IDS.includes(selected) || BACKGROUND_GLOW_IDS.includes(selected) || (DECOR_IDS.includes(selected) && state.config[decorSection(selected)].followLogo === false)) ? 0 : -axisPosition;
        const limit = selected === 'constructionGuides' || selected === 'topIllumination' || side || DECOR_IDS.includes(selected) || PARTICLE_CLOUD_IDS.includes(selected) || BACKGROUND_GLOW_IDS.includes(selected) ? 10 : 2;
        state.config[section][key] = Math.max(-limit, Math.min(limit, value));
      } else {
        const selector = CUSTOM_TEXT_IDS.includes(selected) ? `[data-custom="${selected}"]` : { title: '.cap-title', subtitle: '.cap-sub', date: '.cap-date' }[selected];
        const element = document.querySelector(`#caption ${selector}`);
        const cap = document.getElementById('caption');
        const size = xAxis ? cap.clientWidth : cap.clientHeight;
        const current = parseFloat(getComputedStyle(element)[xAxis ? 'left' : 'top']);
        const key = `${selected}${xAxis ? 'X' : 'Y'}`;
        if (size > 0 && Number.isFinite(current)) {
          const target = state.config[textSection(selected)];
          target[key] = Math.max(-0.45, Math.min(0.45, target[key] + 0.5 - current / size));
        }
      }
      onChange();
    }
    if (action === 'reset-size') {
      const size = sizeInfo[selected];
      state.config[size.section][size.key] = state.defaults[size.section][size.key];
      onChange();
    }
    if (action === 'reset-text' || action === 'reset-color') {
      const field = fields[0];
      if (field) {
        state.config[field.section][field.key] = state.defaults[field.section][field.key];
        onChange();
      }
    }
    if (action === 'settings') onSettings(worldSection[selected] || 'caption');
    if (action === 'reset') {
      if (worldSection[selected]) {
        const section = worldSection[selected];
        for (const key of worldKeys(selected)) state.config[section][key] = state.defaults[section][key];
      } else {
        const section = textSection(selected);
        state.config[section][`${selected}X`] = state.defaults[section][`${selected}X`];
        state.config[section][`${selected}Y`] = state.defaults[section][`${selected}Y`];
      }
      onChange();
    }
    if (action !== 'settings') { record(state.id, state.config, before); populateAppearance(selected); }
  });
  window.addEventListener('keydown', (event) => {
    if (!enabled) return;
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement || event.target.isContentEditable) return;
    if (event.key === 'Escape') { if (drag || timelineDrag || phaseDrag) cancelDrag(); else disable(); return; }
    const modifier = event.ctrlKey || event.metaKey;
    // Команды удаления и копирования действуют только на выделенной строке или
    // рамке в фокусе; в полях ввода и на таймлайне клавиши остаются обычными.
    const target = event.target instanceof Element ? event.target.closest('[data-layer], [data-element]') : null;
    const targetId = target?.dataset.layer || target?.dataset.element;
    if (selected && targetId === selected && !drag && !timelineDrag && !phaseDrag && !event.altKey) {
      const duplicateKey = modifier && !event.shiftKey && event.key.toLowerCase() === 'd';
      const deleteKey = !modifier && !event.shiftKey && (event.key === 'Delete' || event.key === 'Backspace');
      if (duplicateKey && canDuplicate(selected)) {
        event.preventDefault(); event.stopPropagation();
        if (!event.repeat) {
          const button = menu.querySelector('[data-action=duplicate]');
          if (!button.disabled) button.click();
        }
        return;
      }
      if (deleteKey) {
        const effect = multiEffects.find(group => group.ids.includes(selected));
        const action = CUSTOM_TEXT_IDS.includes(selected) ? 'delete-text' : effect ? `delete-${effect.button}` : null;
        if (action) {
          event.preventDefault(); event.stopPropagation();
          if (!event.repeat) menu.querySelector(`[data-action=${action}]`).click();
          return;
        }
      }
    }
    if (modifier && !event.altKey && (event.key.toLowerCase() === 'z' || event.key.toLowerCase() === 'y')) {
      event.preventDefault(); event.stopPropagation();
      historyAction(event.key.toLowerCase() === 'y' || event.shiftKey ? 'redo' : 'undo');
    }
  });
  return {
    refresh, disable, cancelDrag,
    clearHistory(id) { if (getState().id === id) finishInput(); history.clear(id); updateHistory(); },
    invalidateHistory(id, section, key) { history.invalidate(id, section, key); updateHistory(); },
    get enabled() { return enabled; },
  };
}
