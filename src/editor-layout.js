import { editorViewport } from './editor-layers.js';
import { applyEditorWorkspace } from './editor-workspace.js';
import { applyPreviewLayout } from './editor-preview.js';

/** Адаптер браузерного UI: размеры предпросмотра не меняют внутренний рендер. */
export function layoutEditorPreview(canvas, caption) {
  const editing = document.body.classList.contains('editor-on');
  const focus = editing && document.body.classList.contains('editor-focus');
  const view = editorViewport(innerWidth, innerHeight, editing, focus);
  applyEditorWorkspace(innerWidth, innerHeight, editing, view);
  return applyPreviewLayout(view, editing, canvas, caption);
}
