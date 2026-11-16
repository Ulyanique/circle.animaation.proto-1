/**
 * Плавающее контекстное меню по правому клику на рамке холста или строке слоя.
 * Делегирует все мутации переданным действиям редактора, чтобы сохранялись undo/redo и блокировки.
 */
export function createEditorContextMenu({ root, getLayerState, onAction }) {
  const el = document.createElement('div');
  el.className = 'editor-context-menu';
  el.setAttribute('role', 'menu');
  el.hidden = true;
  el.innerHTML = `
    <div class="editor-context-title" data-ctx-title></div>
    <button type="button" role="menuitem" data-ctx="toggle-visible"></button>
    <button type="button" role="menuitem" data-ctx="toggle-lock"></button>
    <hr>
    <button type="button" role="menuitem" data-ctx="align-x">По центру X</button>
    <button type="button" role="menuitem" data-ctx="align-y">По центру Y</button>
    <button type="button" role="menuitem" data-ctx="reset">Сбросить положение</button>
    <button type="button" role="menuitem" data-ctx="reset-size">Сбросить размер</button>
    <hr data-ctx-dup-sep>
    <button type="button" role="menuitem" data-ctx="duplicate">Дублировать слой</button>
    <button type="button" role="menuitem" data-ctx="delete" class="is-danger">Удалить слой</button>
  `;
  root.appendChild(el);

  let currentId = null;

  function close() {
    if (el.hidden) return;
    el.hidden = true;
    currentId = null;
  }

  function open(layerId, clientX, clientY) {
    const info = getLayerState(layerId);
    if (!info) { close(); return; }
    currentId = layerId;
    el.querySelector('[data-ctx-title]').textContent = info.name;
    const visBtn = el.querySelector('[data-ctx="toggle-visible"]');
    visBtn.textContent = info.visible ? 'Скрыть слой' : 'Показать слой';
    const lockBtn = el.querySelector('[data-ctx="toggle-lock"]');
    lockBtn.textContent = info.locked ? 'Разблокировать геометрию' : 'Заблокировать геометрию';
    for (const key of ['align-x', 'align-y', 'reset', 'reset-size']) {
      const btn = el.querySelector(`[data-ctx="${key}"]`);
      btn.disabled = Boolean(info.locked) || (key === 'reset-size' && !info.hasSize);
    }
    const dupBtn = el.querySelector('[data-ctx="duplicate"]');
    const delBtn = el.querySelector('[data-ctx="delete"]');
    const sep = el.querySelector('[data-ctx-dup-sep]');
    dupBtn.hidden = !info.canDuplicate;
    dupBtn.disabled = !info.canDuplicateNow;
    delBtn.hidden = !info.canDelete;
    sep.hidden = !info.canDuplicate && !info.canDelete;

    el.hidden = false;
    el.style.left = '0px';
    el.style.top = '0px';
    const rect = el.getBoundingClientRect();
    const x = Math.max(8, Math.min(window.innerWidth - rect.width - 8, clientX));
    const y = Math.max(8, Math.min(window.innerHeight - rect.height - 8, clientY));
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  }

  el.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-ctx]');
    if (!btn || btn.disabled || !currentId) return;
    const id = currentId;
    const action = btn.dataset.ctx;
    close();
    onAction(id, action);
  });

  window.addEventListener('pointerdown', (event) => {
    if (!el.hidden && !el.contains(event.target)) close();
  }, true);
  window.addEventListener('keydown', (event) => {
    if (!el.hidden && event.key === 'Escape') {
      event.stopPropagation();
      close();
    }
  }, true);
  window.addEventListener('resize', close);

  return { element: el, open, close, get isOpen() { return !el.hidden; } };
}
