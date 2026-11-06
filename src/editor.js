import * as THREE from 'three';
import { moveLogo, moveTitle, moveWorldOffset, snapRect, resizeFromDistance } from './editor-math.js';
import { EditorHistory } from './editor-history.js';
import { validCustomColor } from './caption-content.js';
import { EDITOR_LAYERS, layersForScene, layerVisible } from './editor-layers.js';
import { CUSTOM_TEXT_IDS, customTextKeys } from './custom-text.js';

/** Рамки редактора находятся только в DOM и не попадают в экспорт. */
export function createFrameEditor({ getState, onEnable, onChange, onLayoutChange, onSettings, onHistoryConflict }) {
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
    if (id === 'photoLabel' || id === 'brandDecor' || id === 'ringLeft' || id === 'ringRight') box.classList.add('editor-handle');
    if (id === 'ringLeft' || id === 'ringRight') box.classList.add('editor-center-handle');
    layer.appendChild(box); boxes[id] = box;
  }
  const layersPanel = document.createElement('aside');
  layersPanel.className = 'editor-sidebar editor-layers';
  layersPanel.setAttribute('aria-label', 'Элементы сцены');
  layersPanel.innerHTML = '<div class="editor-sidebar-heading"><span>СЦЕНА</span><h2>Элементы</h2></div><div class="editor-layers-list"></div><button type="button" class="editor-add-text" data-add-text>＋ Добавить текст</button><p class="editor-sidebar-note">До 8 дополнительных надписей в каждой сцене</p>';
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
  </div><label class="editor-ring-scale" hidden><span>Размер круга <output data-ring-scale-output></output></span><input type="range" min="0.3" max="2.5" step="0.01" data-ring-scale></label><section class="editor-timing" hidden>
    <h3>Время надписи</h3>
    <label class="editor-timing-mode">Анимация <select data-timing-mode><option value="scene">Вместе с названием</option><option value="custom">Своё время</option></select></label>
    <div class="editor-timing-fields" hidden>
      <label><span>Появление <output data-timing-output="Start"></output></span><input type="range" data-timing="Start" min="0" max="99" step="1"></label>
      <label><span>Уход <output data-timing-output="End"></output></span><input type="range" data-timing="End" min="1" max="100" step="1"></label>
      <label><span>Плавность <output data-timing-output="Fade"></output></span><input type="range" data-timing="Fade" min="5" max="50" step="1"></label>
      <p>Время — доля цикла после стартовой задержки; секунды указаны по таймлайну. Плавность — доля выбранного интервала.</p>
    </div>
  </section><button type="button" data-action="align-x">По центру по горизонтали</button><button type="button" data-action="align-y">По центру по вертикали</button><button type="button" data-action="settings">Настройки элемента</button><button type="button" data-action="reset">Сбросить положение</button><button type="button" data-action="reset-size">Сбросить размер</button><button type="button" class="editor-delete-text" data-action="delete-text" hidden>Удалить текст</button>`;
  const textInput = menu.querySelector('[data-appearance="text"]');
  const colorInput = menu.querySelector('[data-appearance="color"]');
  const textRow = menu.querySelector('[data-field="text"]');
  const resetTextButton = menu.querySelector('[data-action="reset-text"]');
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
  let enabled = false, selected = null, drag = null, inputSession = null, snapRects = {};
  const place = (el, r) => {
    el.style.left = `${r.left}px`; el.style.top = `${r.top}px`;
    el.style.width = `${Math.max(1, r.width)}px`; el.style.height = `${Math.max(1, r.height)}px`;
  };
  const worldSection = { logo: 'logo', photoLabel: 'photo', brandDecor: 'decor', ringLeft: 'rings', ringRight: 'rings' };
  const ringSide = id => id === 'ringLeft' ? 'left' : id === 'ringRight' ? 'right' : null;
  const worldKeys = id => ringSide(id) ? [`${ringSide(id)}OffsetX`, `${ringSide(id)}OffsetY`] : ['offsetX', 'offsetY'];
  const textSection = id => CUSTOM_TEXT_IDS.includes(id) ? 'textLayers' : 'caption';
  const sizeInfo = {
    logo: { section: 'logo', key: 'scale', min: 0.3, max: 2.5 },
    photoLabel: { section: 'photo', key: 'radius', min: 1.1, max: 2.15 },
    brandDecor: { section: 'decor', key: 'radius', min: 0.4, max: 2.5 },
    ringLeft: { section: 'rings', key: 'leftScale', min: 0.3, max: 2.5 },
    ringRight: { section: 'rings', key: 'rightScale', min: 0.3, max: 2.5 },
    title: { section: 'caption', key: 'titleScale', min: 0.5, max: 2 },
    subtitle: { section: 'caption', key: 'subtitleScale', min: 0.5, max: 2 },
    date: { section: 'caption', key: 'dateScale', min: 0.5, max: 2 },
  };
  const appearance = {
    logo: { color: {section: 'colors', key: 'gold'}, fallback: '#c8962e' },
    photoLabel: { text: {section: 'photo', key: 'text'}, color: {section: 'photo', key: 'textColor'}, fallback: '#e8c77e', maxLength: 40 },
    brandDecor: { color: {section: 'decor', key: 'color'}, fallback: '#d9b268' },
    ringLeft: { color: {section: 'colors', key: 'lightLeft'}, fallback: '#ffb55c' },
    ringRight: { color: {section: 'colors', key: 'lightRight'}, fallback: '#ffcf7a' },
    title: { text: {section: 'caption', key: 'titleText'}, color: {section: 'caption', key: 'titleColor'}, fallback: '#e0b25a' },
    subtitle: { text: {section: 'caption', key: 'subtitleText'}, color: {section: 'caption', key: 'subtitleColor'}, fallback: '#ecd08c' },
    date: { text: {section: 'caption', key: 'dateText'}, color: {section: 'caption', key: 'dateColor'}, fallback: '#d9b061' },
  };
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
    menu.querySelector('[data-color-label]').textContent = id === 'logo' ? 'Общий цвет золота' : ringSide(id) ? 'Цвет свечения' : 'Цвет';
    ringScaleRow.hidden = !ringSide(id);
    if (!ringScaleRow.hidden) { ringScale.value = cfg.rings[`${ringSide(id)}Scale`]; menu.querySelector('[data-ring-scale-output]').textContent = `${Number(ringScale.value).toFixed(2)}×`; }
    menu.querySelector('[data-action=delete-text]').hidden = !CUSTOM_TEXT_IDS.includes(id);
    menu.querySelector('[data-action=settings]').hidden = CUSTOM_TEXT_IDS.includes(id);
    timing.hidden = !CUSTOM_TEXT_IDS.includes(id);
    if (!timing.hidden) populateTiming(id);
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
  function populateTiming(id) {
    const config = getState().config;
    const values = config.textLayers;
    const mode = values[`${id}TimingMode`] === 'custom' ? 'custom' : 'scene';
    timingMode.value = mode; timingFields.hidden = mode !== 'custom';
    const tl = config.timeline;
    const cycle = tl ? tl.drawDuration + tl.emergeDuration + tl.holdDuration + tl.fadeDuration + tl.restDuration : 0;
    for (const [key, fallback] of [['Start', 25], ['End', 90], ['Fade', 15]]) {
      const input = timingFields.querySelector(`[data-timing="${key}"]`);
      input.value = Number.isFinite(values[`${id}${key}`]) ? values[`${id}${key}`] : fallback;
      const value = Number(input.value);
      timingFields.querySelector(`[data-timing-output="${key}"]`).textContent = key === 'Fade' ? `${value}%` : `${value}% · ${(cycle * value / 100).toFixed(1)} с`;
    }
  }
  timingMode.addEventListener('change', () => {
    if (!selected || !CUSTOM_TEXT_IDS.includes(selected)) return;
    finishInput();
    const state = getState(), key = `${selected}TimingMode`;
    const before = snapshot(state.config, [{section: 'textLayers', key}]);
    state.config.textLayers[key] = timingMode.value;
    record(state.id, state.config, before); onChange(); populateTiming(selected);
  });
  for (const input of timingFields.querySelectorAll('[data-timing]')) {
    const begin = () => {
      if (inputSession || !selected || !CUSTOM_TEXT_IDS.includes(selected)) return;
      const state = getState(), kind = input.dataset.timing;
      const keys = kind === 'Fade' ? [`${selected}Fade`] : [`${selected}Start`, `${selected}End`];
      inputSession = {sceneId: state.id, config: state.config, before: snapshot(state.config, keys.map(key => ({section: 'textLayers', key}))), timingId: selected};
    };
    input.addEventListener('focus', begin);
    input.addEventListener('input', () => {
      begin();
      if (!inputSession?.timingId) return;
      const id = inputSession.timingId, values = inputSession.config.textLayers, kind = input.dataset.timing;
      values[`${id}${kind}`] = Number(input.value);
      if (kind === 'Start' && values[`${id}Start`] >= values[`${id}End`]) values[`${id}End`] = values[`${id}Start`] + 1;
      if (kind === 'End' && values[`${id}End`] <= values[`${id}Start`]) values[`${id}Start`] = values[`${id}End`] - 1;
      onChange(); populateTiming(id);
    });
    input.addEventListener('change', finishInput);
    input.addEventListener('blur', finishInput);
  }
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
    if (!enabled || drag) return;
    finishInput();
    const state = getState();
    const result = history.apply(state.id, state.config, direction);
    if (result === 'applied') { onChange(); if (selected) populateAppearance(selected); refresh(); }
    if (result === 'conflict') onHistoryConflict?.();
    updateHistory();
  }
  function cancelDrag() {
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
    if (id === 'photoLabel') return scene.circularLabel.position.z;
    if (id === 'brandDecor') return scene.brandDecor.group.position.z;
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
    if (showMenu && window.matchMedia('(max-width: 999px)').matches) setCompactPanel('inspector');
    refresh();
  }
  function refresh() {
    if (!enabled) return;
    updateHistory();
    const { scene, canvas, id, config } = getState();
    const available = new Set(layersForScene(id, config).map(item => item.id));
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
    const photoLabel = scene.circularLabel;
    handle('photoLabel', id === 'photo-pause' && config.photo?.textEnabled !== false && !!photoLabel?.visible,
      photoLabel?.position, getState().config.photo?.radius ?? 0);
    const decor = scene.brandDecor;
    handle('brandDecor', id === 'brand' && config.decor?.enabled !== false && !!decor?.group.visible,
      decor?.group.position, getState().config.decor?.radius ?? 0);

  }
  function disable() {
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
  layersPanel.querySelector('[data-add-text]').addEventListener('click', () => {
    finishInput();
    const state = getState(), cfg = state.config;
    const id = CUSTOM_TEXT_IDS.find(key => cfg.textLayers[`${key}Present`] !== true);
    if (!id) return;
    const fields = customTextKeys(id).map(key => ({section: 'textLayers', key}));
    const before = snapshot(cfg, fields);
    for (const {key} of fields) cfg.textLayers[key] = state.defaults.textLayers[key];
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
          !(id === 'logo' && (name === 'photoLabel' || name === 'brandDecor'))).map(([, rect]) => ({ ...rect }))];
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
        const next = ringSide(id) ? moveWorldOffset(drag.start, now.x - drag.world.x, now.y - drag.world.y) : moveLogo(drag.start, now.x - drag.world.x, now.y - drag.world.y);
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
        const p = ringSide(id) ? moveWorldOffset(start, direction[0] * step, -direction[1] * step) : moveLogo(start, direction[0] * step, -direction[1] * step);
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
        // Кольцо хранит сдвиг от исходной позиции, остальные — от знака.
        const value = side || selected === 'logo' ? state.config[section][key] - axisPosition : -axisPosition;
        const limit = side ? 10 : 2;
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
    if (event.key === 'Escape') { if (drag) cancelDrag(); else disable(); return; }
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
