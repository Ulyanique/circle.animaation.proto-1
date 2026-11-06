import * as THREE from 'three';
import { moveLogo, moveTitle, snapRect, resizeFromDistance } from './editor-math.js';
import { EditorHistory } from './editor-history.js';

/** Рамки редактора находятся только в DOM и не попадают в экспорт. */
export function createFrameEditor({ getState, onEnable, onChange, onSettings, onHistoryConflict }) {
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
  historyBar.innerHTML = '<button type="button" data-history="undo" title="Отменить (Ctrl+Z)" aria-label="Отменить">↶ Отменить</button><button type="button" data-history="redo" title="Повторить (Ctrl+Shift+Z или Ctrl+Y)" aria-label="Повторить">↷ Повторить</button>';
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
  for (const [id, label] of [['logo', 'Логотип'], ['title', 'Название'], ['subtitle', 'Подзаголовок'], ['date', 'Дата'], ['photoLabel', 'Надпись по кругу'], ['brandDecor', 'Построительная окружность']]) {
    const box = document.createElement('button');
    box.type = 'button'; box.className = 'editor-box'; box.dataset.element = id;
    box.setAttribute('aria-label', `${label}: перетащить, переместить стрелками или изменить размер клавишами плюс и минус`);
    box.innerHTML = `<span class="editor-label">${label}</span><span class="editor-resize" title="Изменить размер" aria-hidden="true"></span>`;
    if (id === 'photoLabel' || id === 'brandDecor') box.classList.add('editor-handle');
    layer.appendChild(box); boxes[id] = box;
  }
  const menu = document.createElement('div');
  menu.className = 'editor-menu'; menu.hidden = true;
  menu.innerHTML = '<button type="button" data-action="align-x">По центру по горизонтали</button><button type="button" data-action="align-y">По центру по вертикали</button><button type="button" data-action="settings">Настройки элемента</button><button type="button" data-action="reset">Сбросить положение</button><button type="button" data-action="reset-size">Сбросить размер</button>';
  layer.appendChild(menu); document.body.appendChild(layer);

  const bbox = new THREE.Box3(), point = new THREE.Vector3(), ray = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  let enabled = false, selected = null, drag = null, snapRects = {};
  const place = (el, r) => {
    el.style.left = `${r.left}px`; el.style.top = `${r.top}px`;
    el.style.width = `${Math.max(1, r.width)}px`; el.style.height = `${Math.max(1, r.height)}px`;
  };
  const worldSection = { logo: 'logo', photoLabel: 'photo', brandDecor: 'decor' };
  const sizeInfo = {
    logo: { section: 'logo', key: 'scale', min: 0.3, max: 2.5 },
    photoLabel: { section: 'photo', key: 'radius', min: 1.1, max: 2.15 },
    brandDecor: { section: 'decor', key: 'radius', min: 0.4, max: 2.5 },
    title: { section: 'caption', key: 'titleScale', min: 0.5, max: 2 },
    subtitle: { section: 'caption', key: 'subtitleScale', min: 0.5, max: 2 },
    date: { section: 'caption', key: 'dateScale', min: 0.5, max: 2 },
  };
  function positionFields(id) {
    const section = worldSection[id];
    return section ? [{section, key: 'offsetX'}, {section, key: 'offsetY'}]
      : [{section: 'caption', key: `${id}X`}, {section: 'caption', key: `${id}Y`}];
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
    const state = getState();
    const result = history.apply(state.id, state.config, direction);
    if (result === 'applied') { menu.hidden = true; onChange(); refresh(); }
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
    selected = id;
    for (const [name, box] of Object.entries(boxes)) box.classList.toggle('selected', name === id);
    menu.hidden = !showMenu;
    refresh();
  }
  function refresh() {
    if (!enabled) return;
    updateHistory();
    const { scene, canvas, id } = getState();
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
    boxes.logo.hidden = !Number.isFinite(minX);
    if (!boxes.logo.hidden) {
      snapRects.logo = { left: minX, top: minY, width: maxX - minX, height: maxY - minY };
      place(boxes.logo, { left: minX - 5, top: minY - 5, width: maxX - minX + 10, height: maxY - minY + 10 });
    }
    for (const [name, selector] of [['title', '.cap-title'], ['subtitle', '.cap-sub'], ['date', '.cap-date']]) {
      const line = document.querySelector(`#caption ${selector}`);
      boxes[name].hidden = id === 'photo-pause' || !line || getComputedStyle(line).display === 'none';
      if (!boxes[name].hidden) {
        const r = line.getBoundingClientRect();
        snapRects[name] = { left: r.left, top: r.top, width: r.width, height: r.height };
        place(boxes[name], { left: r.left - 5, top: r.top - 5, width: r.width + 10, height: r.height + 10 });
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
    const photoLabel = scene.circularLabel;
    handle('photoLabel', id === 'photo-pause' && !!photoLabel?.visible,
      photoLabel?.position, getState().config.photo?.radius ?? 0);
    const decor = scene.brandDecor;
    handle('brandDecor', id === 'brand' && !!decor?.group.visible,
      decor?.group.position, getState().config.decor?.radius ?? 0);
    if (selected && !menu.hidden && !boxes[selected].hidden) {
      const r = boxes[selected].getBoundingClientRect();
      menu.style.left = `${Math.min(window.innerWidth - 200, Math.max(4, r.left))}px`;
      menu.style.top = `${Math.max(4, Math.min(window.innerHeight - 205, r.bottom + 6))}px`;
    }
  }
  function disable() {
    if (drag) {
      record(drag.sceneId, drag.config, drag.before);
      drag = null;
    }
    enabled = false; selected = null; drag = null; layer.hidden = true; menu.hidden = true;
    guides.x.hidden = guides.y.hidden = true;
    toggle.textContent = 'Редактировать'; toggle.setAttribute('aria-pressed', 'false');
  }
  toggle.addEventListener('click', () => {
    if (enabled) { disable(); return; }
    if (!onEnable()) return;
    enabled = true; layer.hidden = false;
    toggle.textContent = 'Готово'; toggle.setAttribute('aria-pressed', 'true');
    refresh();
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
        start: section ? { x: cfg[section].offsetX, y: cfg[section].offsetY } : { x: cfg.caption[`${id}X`], y: cfg.caption[`${id}Y`] }, moved: false };
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
        const next = moveLogo(drag.start, now.x - drag.world.x, now.y - drag.world.y);
        cfg[section].offsetX = next.x; cfg[section].offsetY = next.y;
      } else {
        const next = moveTitle(drag.start, dx, dy, rect.width, rect.height);
        cfg.caption[`${id}X`] = next.x; cfg.caption[`${id}Y`] = next.y;
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
    box.addEventListener('keydown', (event) => {
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
        const p = moveLogo({ x: cfg[section].offsetX, y: cfg[section].offsetY }, direction[0] * step, -direction[1] * step);
        cfg[section].offsetX = p.x; cfg[section].offsetY = p.y;
      } else {
        const p = moveTitle({ x: cfg.caption[`${id}X`], y: cfg.caption[`${id}Y`] }, direction[0] * step, direction[1] * step, 1, 1);
        cfg.caption[`${id}X`] = p.x; cfg.caption[`${id}Y`] = p.y;
      }
      record(state.id, cfg, before); select(id, false); onChange();
    });
  }
  menu.addEventListener('click', (event) => {
    const action = event.target.closest('button')?.dataset.action;
    if (!selected || !action) return;
    const state = getState();
    const before = snapshot(state.config, action === 'reset-size' ? sizeFields(selected) : positionFields(selected));
    if (action === 'align-x' || action === 'align-y') {
      const xAxis = action === 'align-x';
      if (worldSection[selected]) {
        const section = worldSection[selected];
        const position = xAxis ? state.scene.logo.root.position.x : state.scene.logo.root.position.y;
        const key = xAxis ? 'offsetX' : 'offsetY';
        // Учитываем небольшое покачивание знака на текущем кадре.
        const value = selected === 'logo' ? state.config.logo[key] - position : -position;
        state.config[section][key] = Math.max(-2, Math.min(2, value));
      } else {
        const selector = { title: '.cap-title', subtitle: '.cap-sub', date: '.cap-date' }[selected];
        const element = document.querySelector(`#caption ${selector}`);
        const cap = document.getElementById('caption');
        const size = xAxis ? cap.clientWidth : cap.clientHeight;
        const current = parseFloat(getComputedStyle(element)[xAxis ? 'left' : 'top']);
        const key = `${selected}${xAxis ? 'X' : 'Y'}`;
        if (size > 0 && Number.isFinite(current)) {
          state.config.caption[key] = Math.max(-0.45, Math.min(0.45, state.config.caption[key] + 0.5 - current / size));
        }
      }
      onChange();
    }
    if (action === 'reset-size') {
      const size = sizeInfo[selected];
      state.config[size.section][size.key] = state.defaults[size.section][size.key];
      onChange();
    }
    if (action === 'settings') onSettings(worldSection[selected] || 'caption');
    if (action === 'reset') {
      if (worldSection[selected]) {
        const section = worldSection[selected];
        state.config[section].offsetX = state.defaults[section].offsetX;
        state.config[section].offsetY = state.defaults[section].offsetY;
      } else {
        state.config.caption[`${selected}X`] = state.defaults.caption[`${selected}X`];
        state.config.caption[`${selected}Y`] = state.defaults.caption[`${selected}Y`];
      }
      onChange();
    }
    if (action !== 'settings') record(state.id, state.config, before);
    menu.hidden = true;
  });
  window.addEventListener('keydown', (event) => {
    if (!enabled) return;
    if (event.key === 'Escape') { if (drag) cancelDrag(); else disable(); return; }
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement || event.target.isContentEditable) return;
    const modifier = event.ctrlKey || event.metaKey;
    if (modifier && !event.altKey && (event.key.toLowerCase() === 'z' || event.key.toLowerCase() === 'y')) {
      event.preventDefault(); event.stopPropagation();
      historyAction(event.key.toLowerCase() === 'y' || event.shiftKey ? 'redo' : 'undo');
    }
  });
  return {
    refresh, disable, cancelDrag,
    clearHistory(id) { history.clear(id); updateHistory(); },
    invalidateHistory(id, section, key) { history.invalidate(id, section, key); updateHistory(); },
    get enabled() { return enabled; },
  };
}
