import * as THREE from 'three';
import { moveLogo, moveTitle } from './editor-math.js';

/** Рамки редактора находятся только в DOM и не попадают в экспорт. */
export function createFrameEditor({ getState, onEnable, onChange, onSettings }) {
  const toggle = document.createElement('button');
  toggle.type = 'button'; toggle.className = 'editor-toggle';
  toggle.textContent = 'Редактировать'; toggle.setAttribute('aria-pressed', 'false');
  toggle.title = 'Переместить элементы на кадре';
  document.body.appendChild(toggle);

  const layer = document.createElement('div');
  layer.className = 'editor-layer'; layer.hidden = true;
  const boxes = {};
  for (const [id, label] of [['logo', 'Логотип'], ['title', 'Название'], ['subtitle', 'Подзаголовок'], ['date', 'Дата'], ['photoLabel', 'Надпись по кругу'], ['brandDecor', 'Построительная окружность']]) {
    const box = document.createElement('button');
    box.type = 'button'; box.className = 'editor-box'; box.dataset.element = id;
    box.setAttribute('aria-label', `${label}: перетащить или переместить стрелками`);
    box.innerHTML = `<span>${label}</span>`;
    if (id === 'photoLabel' || id === 'brandDecor') box.classList.add('editor-handle');
    layer.appendChild(box); boxes[id] = box;
  }
  const menu = document.createElement('div');
  menu.className = 'editor-menu'; menu.hidden = true;
  menu.innerHTML = '<button type="button" data-action="settings">Настройки элемента</button><button type="button" data-action="reset">Сбросить положение</button>';
  layer.appendChild(menu); document.body.appendChild(layer);

  const bbox = new THREE.Box3(), point = new THREE.Vector3(), ray = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  let enabled = false, selected = null, drag = null;
  const place = (el, r) => {
    el.style.left = `${r.left}px`; el.style.top = `${r.top}px`;
    el.style.width = `${Math.max(1, r.width)}px`; el.style.height = `${Math.max(1, r.height)}px`;
  };
  const worldSection = { logo: 'logo', photoLabel: 'photo', brandDecor: 'decor' };
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
    const { scene, canvas, id } = getState();
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
    if (!boxes.logo.hidden) place(boxes.logo, { left: minX - 5, top: minY - 5, width: maxX - minX + 10, height: maxY - minY + 10 });
    for (const [name, selector] of [['title', '.cap-title'], ['subtitle', '.cap-sub'], ['date', '.cap-date']]) {
      const line = document.querySelector(`#caption ${selector}`);
      boxes[name].hidden = id === 'photo-pause' || !line || getComputedStyle(line).display === 'none';
      if (!boxes[name].hidden) {
        const r = line.getBoundingClientRect();
        place(boxes[name], { left: r.left - 5, top: r.top - 5, width: r.width + 10, height: r.height + 10 });
      }
    }
    // Для круглых элементов используется небольшая ручка на верхней кромке,
    // чтобы не перекрывать возможность выбрать находящийся внутри логотип.
    const handle = (name, visible, position, radius) => {
      boxes[name].hidden = !visible;
      if (!visible) return;
      point.set(position.x, position.y + radius, position.z).project(scene.camera);
      const x = rect.left + (point.x + 1) * rect.width / 2;
      const y = rect.top + (1 - point.y) * rect.height / 2;
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
      menu.style.top = `${Math.max(4, Math.min(window.innerHeight - 90, r.bottom + 6))}px`;
    }
  }
  function disable() {
    enabled = false; selected = null; drag = null; layer.hidden = true; menu.hidden = true;
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
      drag = { id, pointerId: event.pointerId, x: event.clientX, y: event.clientY, world,
        start: section ? { x: cfg[section].offsetX, y: cfg[section].offsetY } : { x: cfg.caption[`${id}X`], y: cfg.caption[`${id}Y`] }, moved: false };
      box.setPointerCapture(event.pointerId); event.preventDefault();
    });
    box.addEventListener('pointermove', (event) => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      const state = getState(), cfg = state.config, rect = state.canvas.getBoundingClientRect();
      const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
      if (Math.hypot(dx, dy) > 3) drag.moved = true;
      if (worldSection[id]) {
        const section = worldSection[id];
        const now = worldPoint(event, state, depth(id, state.scene));
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
      const moved = drag.moved; drag = null;
      if (!moved) select(id, true);
    });
    box.addEventListener('pointercancel', () => { drag = null; });
    box.addEventListener('contextmenu', (event) => { event.preventDefault(); select(id, true); });
    box.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); select(id, true); return; }
      const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
      if (!direction) return;
      event.preventDefault(); event.stopPropagation();
      const cfg = getState().config, step = event.shiftKey ? 0.1 : 0.01;
      if (worldSection[id]) {
        const section = worldSection[id];
        const p = moveLogo({ x: cfg[section].offsetX, y: cfg[section].offsetY }, direction[0] * step, -direction[1] * step);
        cfg[section].offsetX = p.x; cfg[section].offsetY = p.y;
      } else {
        const p = moveTitle({ x: cfg.caption[`${id}X`], y: cfg.caption[`${id}Y`] }, direction[0] * step, direction[1] * step, 1, 1);
        cfg.caption[`${id}X`] = p.x; cfg.caption[`${id}Y`] = p.y;
      }
      select(id, false); onChange();
    });
  }
  menu.addEventListener('click', (event) => {
    const action = event.target.closest('button')?.dataset.action;
    if (!selected || !action) return;
    const state = getState();
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
    menu.hidden = true;
  });
  window.addEventListener('keydown', (event) => { if (enabled && event.key === 'Escape') disable(); });
  return { refresh, disable, get enabled() { return enabled; } };
}
