import * as THREE from 'three';
import { timelineCycle, timelineCursor, timelineRange, moveTimelineEdge, movePhaseBoundary } from './editor-timeline.js';
import { canDuplicate, duplicateTarget, duplicatePlan } from './editor-duplicate.js';
import { DECOR_SLOTS, DECOR_IDS, decorSection } from './brand-decor-config.js';
import { PARTICLE_CLOUD_IDS } from './particle-cloud-config.js';
import { BACKGROUND_GLOW_IDS } from './background-glow-config.js';
import { moveLogo, moveTitle, moveWorldOffset, snapRect, resizeFromDistance } from './editor-math.js';
import { EditorHistory } from './editor-history.js';
import { validCustomColor } from './caption-content.js';
import { EDITOR_LAYERS, layersForScene, layerVisible } from './editor-layers.js';
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
  const hint = document.createElement('div');
  hint.className = 'editor-hint'; hint.textContent = 'Тяните уголок для размера · Alt — без прилипания';
  layer.appendChild(hint);
  const history = new EditorHistory();
  const historyBar = document.createElement('div');
  historyBar.className = 'editor-history';
  historyBar.innerHTML = '<button type="button" data-history="undo" title="Отменить (Ctrl+Z)" aria-label="Отменить">↶ Отменить</button><button type="button" data-history="redo" title="Повторить (Ctrl+Shift+Z или Ctrl+Y)" aria-label="Повторить">↷ Повторить</button><button type="button" class="editor-panel-toggle" data-panel="layers" aria-expanded="false">Слои</button><button type="button" class="editor-panel-toggle" data-panel="inspector" aria-expanded="false">Свойства</button>';
  layer.appendChild(historyBar);
  const undoButton = historyBar.querySelector('[data-history="undo"]');
  const redoButton = historyBar.querySelector('[data-history="redo"]');
  const guides = {};
  for (const axis of ['x', 'y']) {
    const guide = document.createElement('div');
    guide.className = `editor-guide editor-guide-${axis}`; guide.hidden = true;
    layer.appendChild(guide); guides[axis] = guide;
  }
  const boxes = {};
  for (const {id, label} of EDITOR_LAYERS) {
    const box = document.createElement('button');
    box.type = 'button'; box.className = 'editor-box'; box.dataset.element = id;
    box.setAttribute('aria-label', `${label}: перетащить, переместить стрелками или изменить размер клавишами плюс и минус`);
    box.innerHTML = `<span class="editor-label">${label}</span><span class="editor-resize" title="Изменить размер" aria-hidden="true"></span>`;
    if (id === 'photoAperture' || id === 'constructionGuides' || id === 'topIllumination' || id === 'photoLabel' || DECOR_IDS.includes(id) || PARTICLE_CLOUD_IDS.includes(id) || BACKGROUND_GLOW_IDS.includes(id) || id === 'ringLeft' || id === 'ringRight') box.classList.add('editor-handle');
    if (id === 'ringLeft' || id === 'ringRight') box.classList.add('editor-center-handle');
    layer.appendChild(box); boxes[id] = box;
  }
  const layersPanel = document.createElement('aside');
  layersPanel.className = 'editor-sidebar editor-layers';
  layersPanel.setAttribute('aria-label', 'Элементы сцены');
  layersPanel.innerHTML = '<div class="editor-sidebar-heading"><span>СЦЕНА</span><h2>Элементы</h2></div><div class="editor-layers-list"></div><button type="button" class="editor-add-text" data-add-text>＋ Добавить текст</button><button type="button" class="editor-add-text" data-add-decor>＋ Добавить окружность</button><button type="button" class="editor-add-text" data-add-cloud>＋ Добавить облако частиц</button><button type="button" class="editor-add-text" data-add-glow>＋ Добавить свечение</button><p class="editor-sidebar-note">До 8 надписей и по 4 окружности, облака и свечения в каждой сцене</p>';
  const layerList = layersPanel.querySelector('.editor-layers-list');
  const rows = {}, visibilityButtons = {}, entries = {};
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
    entry.append(button, visibility); layerList.appendChild(entry);
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
  menu.innerHTML = `<div class="editor-selected-label" data-selected-label></div><p class="editor-hidden-note" hidden>Элемент скрыт. Включите его кнопкой справа от названия в списке.</p><div class="editor-appearance">
    <label data-field="text">Текст <input type="text" data-appearance="text" maxlength="120" autocomplete="off"></label>
    <label data-field="color"><span data-color-label>Цвет</span> <input type="color" data-appearance="color"></label>
    <div class="editor-appearance-reset"><button type="button" data-action="reset-text">Исходный текст</button><button type="button" data-action="reset-color">Исходный цвет</button></div>
  </div><label class="editor-follow-logo" hidden><input type="checkbox" data-follow-logo> Привязать окружность к логотипу</label><label class="editor-ring-scale" hidden><span>Размер круга <output data-ring-scale-output></output></span><input type="range" min="0.3" max="2.5" step="0.01" data-ring-scale></label><section class="editor-timing" hidden>
    <h3 data-timing-title>Время надписи</h3>
    <label class="editor-timing-mode">Анимация <select data-timing-mode><option value="scene">Вместе с названием</option><option value="custom">Своё время</option></select></label>
    <div class="editor-timing-fields" hidden>
      <label><span>Появление <output data-timing-output="Start"></output></span><input type="range" data-timing="Start" min="0" max="99" step="1"></label>
      <label><span>Уход <output data-timing-output="End"></output></span><input type="range" data-timing="End" min="1" max="100" step="1"></label>
      <label><span>Плавность <output data-timing-output="Fade"></output></span><input type="range" data-timing="Fade" min="5" max="50" step="1"></label>
      <p>Время — доля цикла после стартовой задержки; секунды указаны по таймлайну. Плавность — доля выбранного интервала. Чтобы увидеть элемент, перемотайте воспроизведение внутрь интервала.</p>
    </div>
  </section><section class="editor-text-order" hidden><h3>Порядок своих надписей</h3><p>Выше в списке — поверх других надписей. Фон и штатные элементы имеют фиксированный порядок.</p><div><button type="button" data-action="text-front" aria-label="Поднять надпись выше">↑ Выше</button><button type="button" data-action="text-back" aria-label="Опустить надпись ниже">↓ Ниже</button></div></section><div class="editor-actions"><button type="button" data-action="duplicate" hidden>Дублировать</button><button type="button" data-action="align-x" aria-label="По центру по горизонтали">По центру X</button><button type="button" data-action="align-y" aria-label="По центру по вертикали">По центру Y</button><button type="button" data-action="settings">Все настройки</button><button type="button" data-action="reset">Сброс положения</button><button type="button" data-action="reset-size">Сброс размера</button></div><button type="button" class="editor-delete-text" data-action="delete-text" hidden>Удалить текст</button><button type="button" class="editor-delete-text" data-action="delete-decor" hidden>Удалить окружность</button><button type="button" class="editor-delete-text" data-action="delete-cloud" hidden>Удалить облако</button><button type="button" class="editor-delete-text" data-action="delete-glow" hidden>Удалить свечение</button>`;
  const textInput = menu.querySelector('[data-appearance="text"]');
  const colorInput = menu.querySelector('[data-appearance="color"]');
  const textRow = menu.querySelector('[data-field="text"]');
  const resetTextButton = menu.querySelector('[data-action="reset-text"]');
  const followRow = menu.querySelector('.editor-follow-logo');
  const followInput = menu.querySelector('[data-follow-logo]');
  const ringScaleRow = menu.querySelector('.editor-ring-scale');
  const ringScale = menu.querySelector('[data-ring-scale]');
  const timing = menu.querySelector('.editor-timing');
  const timingMode = menu.querySelector('[data-timing-mode]');
  const timingFields = menu.querySelector('.editor-timing-fields');
  inspector.appendChild(menu); layer.appendChild(inspector); document.body.appendChild(layer);
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
    { ids: DECOR_IDS, button: 'decor', title: 'Добавить построительную окружность', add: '＋ Добавить окружность', limit: 'Лимит: 4 окружности', max: 'Максимум 4 окружности' },
    { ids: PARTICLE_CLOUD_IDS, button: 'cloud', title: 'Добавить облако частиц', add: '＋ Добавить облако частиц', limit: 'Лимит: 4 облака', max: 'Максимум 4 облака' },
    { ids: BACKGROUND_GLOW_IDS, button: 'glow', title: 'Добавить фоновое свечение', add: '＋ Добавить свечение', limit: 'Лимит: 4 свечения', max: 'Максимум 4 свечения' },
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
  function populateAppearance(id) {
    const info = appearance[id], cfg = getState().config;
    menu.querySelector('[data-color-label]').textContent = id === 'logo' ? 'Общий цвет золота' : id === 'topIllumination' ? 'Цвет ореола' : ringSide(id) ? 'Цвет свечения' : 'Цвет';
    ringScaleRow.hidden = !ringSide(id);
    if (!ringScaleRow.hidden) { ringScale.value = cfg.rings[`${ringSide(id)}Scale`]; menu.querySelector('[data-ring-scale-output]').textContent = `${Number(ringScale.value).toFixed(2)}×`; }
    const duplicate = menu.querySelector('[data-action=duplicate]');
    duplicate.hidden = !canDuplicate(id);
    duplicate.disabled = !duplicate.hidden && !duplicateTarget(cfg, id);
    duplicate.title = duplicate.disabled ? 'Все слоты этого типа заняты' : 'Создать копию элемента';
    menu.querySelector('[data-action=delete-text]').hidden = !CUSTOM_TEXT_IDS.includes(id);
    const orderSection = menu.querySelector('.editor-text-order');
    orderSection.hidden = !CUSTOM_TEXT_IDS.includes(id);
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
      const isText = CUSTOM_TEXT_IDS.includes(id);
      timing.querySelector('[data-timing-title]').textContent = isText ? 'Время надписи' : 'Время эффекта';
      timingMode.querySelector('[value=scene]').textContent = isText ? 'Вместе с названием' : 'По фазам сцены';
      populateTiming(id);
    }
    textRow.hidden = !info.text; resetTextButton.hidden = !info.text;
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
  function timingSpec(id) {
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
    const tl = config.timeline;
    const cycle = tl ? tl.drawDuration + tl.emergeDuration + tl.holdDuration + tl.fadeDuration + tl.restDuration : 0;
    for (const [kind, fallback] of [['Start', 25], ['End', 90], ['Fade', 15]]) {
      const input = timingFields.querySelector(`[data-timing="${kind}"]`);
      input.value = Number.isFinite(values[keys[kind]]) ? values[keys[kind]] : fallback;
      const value = Number(input.value);
      timingFields.querySelector(`[data-timing-output="${kind}"]`).textContent = kind === 'Fade' ? `${value}%` : `${value}% · ${(cycle * value / 100).toFixed(1)} с`;
    }
  }
  timingMode.addEventListener('change', () => {
    const spec = timingSpec(selected);
    if (!spec) return;
    finishInput();
    const state = getState(), key = spec.keys.TimingMode;
    const before = snapshot(state.config, [{section: spec.section, key}]);
    state.config[spec.section][key] = timingMode.value;
    record(state.id, state.config, before); onChange(); populateTiming(selected);
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
      if (kind === 'Start' && values[keys.Start] >= values[keys.End]) values[keys.End] = values[keys.Start] + 1;
      if (kind === 'End' && values[keys.End] <= values[keys.Start]) values[keys.Start] = values[keys.End] - 1;
      onChange(); populateTiming(id);
    });
    input.addEventListener('change', finishInput);
    input.addEventListener('blur', finishInput);
  }
  // Строки создаются один раз: обновления кадров не сбрасывают фокус и захват указателя.
  const trackPanel = document.createElement('section');
  trackPanel.className = 'editor-track-panel'; trackPanel.setAttribute('aria-label', 'Таймлайн элементов');
  trackPanel.innerHTML = `<div class="editor-track-head"><strong>Таймлайн</strong><small>Время от начала цикла после задержки · затенение — сценарий сцены</small><output data-track-time></output></div>
    <div class="editor-track-scale"><span>Элементы</span><div class="editor-track-ruler" data-track-ruler role="slider" tabindex="0" aria-label="Перемотка цикла" aria-valuemin="0" aria-valuemax="100"><span>0</span><span data-tick="25"></span><span data-tick="50"></span><span data-tick="75"></span><span data-tick="100"></span></div></div>
    <div class="editor-phase-row"><span title="Базовые фазы; в интро дополнительные такты продолжаются в удержании">Фазы сцены</span><div class="editor-phase-lane" data-phase-lane>
      <div class="editor-phase-entry" title="Базовые прорисовка и проявление">Вступление</div><div class="editor-phase-hold">Удержание</div><div class="editor-phase-exit">Завершение</div>
      <button type="button" class="editor-phase-marker" data-phase="entry" role="slider" aria-label="Конец базового вступления"></button>
      <button type="button" class="editor-phase-marker" data-phase="exit" role="slider" aria-label="Начало завершения"></button>
    </div></div>
    <div class="editor-track-list"><p class="editor-track-empty">Добавьте текст или эффект, чтобы увидеть его на таймлайне.</p></div>`;
  layer.appendChild(trackPanel);
  const trackList = trackPanel.querySelector('.editor-track-list');
  const ruler = trackPanel.querySelector('[data-track-ruler]');
  const trackRows = {};
  for (const item of EDITOR_LAYERS.filter(item => timingSpec(item.id))) {
    const row = document.createElement('div'); row.className = 'editor-track-row'; row.dataset.track = item.id;
    const label = document.createElement('button'); label.type = 'button'; label.className = 'editor-track-label';
    label.textContent = item.label; label.title = item.label;
    const lane = document.createElement('div'); lane.className = 'editor-track-lane';
    const automatic = document.createElement('button'); automatic.type = 'button'; automatic.className = 'editor-track-auto';
    automatic.textContent = 'По сценарию · задать своё время'; automatic.title = 'Включить собственный интервал';
    const range = document.createElement('div'); range.className = 'editor-track-range';
    for (const edge of ['start', 'end']) {
      const grip = document.createElement('button'); grip.type = 'button'; grip.className = 'editor-track-grip';
      grip.dataset.edge = edge; grip.setAttribute('role', 'slider'); grip.setAttribute('aria-label', `${item.label}: ${edge === 'start' ? 'начало' : 'конец'} интервала`);
      range.appendChild(grip);
    }
    lane.append(automatic, range); row.append(label, lane); trackList.append(row);
    trackRows[item.id] = {row, label, lane, automatic, range};
    label.addEventListener('click', () => select(item.id, true));
    range.addEventListener('click', event => { if (!event.target.closest('.editor-track-grip')) select(item.id, true); });
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
      const show = available.has(id) && (id !== 'constructionGuides' || cfg.constructionGuides.enabled !== false); if (entry.row.hidden === show) entry.row.hidden = !show;
      if (!show) continue;
      count++;
      entry.row.classList.toggle('selected', id === selected);
      entry.row.classList.toggle('is-hidden', !layerVisible(cfg, EDITOR_LAYERS.find(item => item.id === id)));
      const spec = timingSpec(id), values = cfg[spec.section], keys = spec.keys;
      const custom = values[keys.TimingMode] === 'custom';
      if (entry.automatic.hidden !== custom) entry.automatic.hidden = custom;
      if (entry.range.hidden === custom) entry.range.hidden = !custom;
      if (!custom) continue;
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
    if (!grip || event.button !== 0 || timelineDrag) return;
    const row = grip.closest('[data-track]'), id = row.dataset.track, state = getState(), spec = timingSpec(id);
    if (state.config[spec.section][spec.keys.TimingMode] !== 'custom') return;
    select(id, false); finishInput();
    const fields = [spec.keys.Start, spec.keys.End].map(key => ({section: spec.section, key}));
    timelineDrag = {id, sceneId: state.id, config: state.config, before: snapshot(state.config, fields), spec,
      edge: grip.dataset.edge, lane: trackRows[id].lane, pointerId: event.pointerId};
    grip.setPointerCapture(event.pointerId); event.preventDefault(); event.stopPropagation();
  });
  trackPanel.addEventListener('pointermove', event => {
    if (!timelineDrag || timelineDrag.pointerId !== event.pointerId) return;
    const rect = timelineDrag.lane.getBoundingClientRect();
    if (!(rect.width > 0)) return;
    setTrackEdge(timelineDrag.config, timelineDrag.spec, timelineDrag.edge, (event.clientX - rect.left) / rect.width * 100);
    onChange(); refresh(); event.preventDefault();
  });
  function finishTimelineDrag(cancel) {
    if (!timelineDrag) return;
    const current = timelineDrag; timelineDrag = null;
    if (cancel) {
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
    const grip = event.target.closest('.editor-track-grip');
    if (!grip || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    const id = grip.closest('[data-track]').dataset.track, state = getState(), spec = timingSpec(id);
    const keys = spec.keys, values = state.config[spec.section], edge = grip.dataset.edge;
    const before = snapshot(state.config, [keys.Start, keys.End].map(key => ({section: spec.section, key})));
    const range = timelineRange(values[keys.Start], values[keys.End]);
    setTrackEdge(state.config, spec, edge, range[edge] + (event.key === 'ArrowRight' ? 1 : -1) * (event.shiftKey ? 5 : 1));
    record(state.id, state.config, before); onChange(); select(id, false);
  });
  function seekPercent(percent) {
    const state = getState(), cycle = timelineCycle(state.config.timeline);
    if (!onSeek || !cycle) return;
    const local = Math.min(Math.max(0, cycle - 1 / 60), Math.max(0, percent / 100 * cycle));
    onSeek(state.config.timeline.startDelay + local); refresh();
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
    const state = getState(), current = timelineCursor(state.time, state.config.timeline);
    seekPercent(event.key === 'Home' ? 0 : event.key === 'End' ? 100 : current + (event.key === 'ArrowRight' ? 1 : -1) * (event.shiftKey ? 5 : 1));
  });
  followInput.addEventListener('change', () => {
    if (!DECOR_IDS.includes(selected)) return;
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
    menu.querySelector('[data-selected-label]').textContent = EDITOR_LAYERS.find(item => item.id === id).label;
    populateAppearance(id);
    if (showMenu && window.matchMedia('(max-width: 780px)').matches) setCompactPanel('inspector');
    refresh();
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
    reorderNodes(layerList, front.map(key => entries[key]));
    reorderNodes(trackList, front.map(key => trackRows[key].row));
    reorderNodes(layer, [...front].reverse().map(key => boxes[key]));
    refreshTracks(getState(), available);
    for (const item of EDITOR_LAYERS) {
      const row = rows[item.id];
      row.hidden = entries[item.id].hidden = !available.has(item.id);
      const visible = layerVisible(config, item);
      const visibility = visibilityButtons[item.id];
      visibility.setAttribute('aria-pressed', String(visible));
      const visibilityLabel = ringSide(item.id) && config.rings?.enabled === false ? `Включить общий эффект: ${item.label}` : `${visible ? 'Скрыть' : 'Показать'}: ${item.label}`;
      visibility.setAttribute('aria-label', `Видимость: ${item.label}`); visibility.title = visibilityLabel;
      const status = ringSide(item.id) && config.rings?.enabled === false ? `${item.kind} · общий эффект выключен` : visible ? item.kind : `${item.kind} · скрыт`;
      if (row.querySelector('small').textContent !== status) row.querySelector('small').textContent = status;
    }
    if (selected && !available.has(selected)) {
      finishInput(); selected = null; menu.hidden = true; empty.hidden = false;
      for (const row of Object.values(rows)) row.setAttribute('aria-pressed', 'false');
      for (const box of Object.values(boxes)) box.classList.remove('selected');
    }
    if (selected) menu.querySelector('.editor-hidden-note').hidden = layerVisible(config, EDITOR_LAYERS.find(item => item.id === selected));
    if (selected && !inputSession && !menu.contains(document.activeElement)) populateAppearance(selected);
    const addButton = layersPanel.querySelector('[data-add-text]');
    addButton.disabled = CUSTOM_TEXT_IDS.every(key => config.textLayers?.[`${key}Present`] === true);
    addButton.title = addButton.disabled ? 'Максимум 8 дополнительных надписей' : 'Добавить надпись в сцену';
    addButton.textContent = addButton.disabled ? 'Лимит: 8 надписей' : '＋ Добавить текст';
    for (const effect of multiEffects) {
      const button = layersPanel.querySelector(`[data-add-${effect.button}]`);
      button.disabled = effect.ids.every(key => config[decorSection(key) || key]?.present === true);
      button.title = button.disabled ? effect.max : effect.title;
      button.textContent = button.disabled ? effect.limit : effect.add;
    }
    snapRects = {};
    const rect = canvas.getBoundingClientRect();
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
        place(boxes[name], { left: r.left - 5, top: r.top - 5, width: r.width + 10, height: r.height + 10 });
      }
    }
    for (const customId of CUSTOM_TEXT_IDS) {
      const line = document.querySelector(`#caption [data-custom="${customId}"]`);
      boxes[customId].hidden = !available.has(customId) || !line || config.textLayers?.[`${customId}Visible`] === false;
      if (!boxes[customId].hidden) {
        const r = line.getBoundingClientRect();
        snapRects[customId] = { left: r.left, top: r.top, width: r.width, height: r.height };
        place(boxes[customId], { left: r.left - 5, top: r.top - 5, width: r.width + 10, height: r.height + 10 });
      }
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
    document.body.classList.remove('editor-on');
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
    const before = snapshot(cfg, fields);
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
    const before = snapshot(cfg, [...fields, ...orderChanges.filter(change => change.key !== `${id}Order`)]);
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
    box.addEventListener('contextmenu', (event) => { event.preventDefault(); select(id, true); });
    const handleElementKey = (event) => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); select(id, true); return; }
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
  menu.addEventListener('click', (event) => {
    const action = event.target.closest('button')?.dataset.action;
    if (!selected || !action) return;
    finishInput();
    const state = getState();
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
      const before = snapshot(state.config, plan.changes);
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
