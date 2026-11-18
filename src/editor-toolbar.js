/** DOM-only toolbar; state and event handling remain with the editor. */
export function createEditorToolbar() {
  const historyBar = document.createElement('div');
  historyBar.className = 'editor-history';
  historyBar.innerHTML = '<button type="button" data-history="undo" title="Отменить (Ctrl+Z)" aria-label="Отменить">↶ Отменить</button><button type="button" data-history="redo" title="Повторить (Ctrl+Shift+Z или Ctrl+Y)" aria-label="Повторить">↷ Повторить</button><button type="button" data-safe-toggle aria-pressed="true" title="Показать ориентир безопасных полей">Поля 5%</button><button type="button" class="editor-panel-toggle" data-panel="layers" aria-expanded="false">Слои</button><button type="button" class="editor-panel-toggle" data-panel="inspector" aria-expanded="false">Свойства</button>';
  return {
    historyBar,
    undoButton: historyBar.querySelector('[data-history="undo"]'),
    redoButton: historyBar.querySelector('[data-history="redo"]'),
    safeToggle: historyBar.querySelector('[data-safe-toggle]'),
  };
}
