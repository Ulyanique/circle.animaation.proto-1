import test from 'node:test';
import assert from 'node:assert/strict';
import { workspaceWidths, setWorkspaceWidth, resetWorkspaceWidth } from '../src/editor-workspace.js';
import { editorViewport } from '../src/editor-layers.js';

test('разделители ограничены и сохраняют место кадру при изменении ширины окна', () => {
  setWorkspaceWidth('layers', 999, 1130);
  setWorkspaceWidth('inspector', 999, 1130);
  assert.deepEqual(workspaceWidths(1130), { layers: 420, inspector: 350 });
  let view = editorViewport(1130, 950, true);
  assert.equal(view.width, 320);
  const narrow = workspaceWidths(781);
  assert.ok(narrow.layers >= 160 && narrow.inspector >= 200);
  view = editorViewport(781, 700, true);
  assert.ok(view.width >= 320);
  assert.deepEqual(workspaceWidths(1130), { layers: 420, inspector: 350 });
  setWorkspaceWidth('layers', -100, 1130);
  assert.equal(workspaceWidths(1130).layers, 160);
  setWorkspaceWidth('layers', 250, 700); // узкий режим не меняет предпочтения
  assert.equal(workspaceWidths(1130).layers, 160);
  resetWorkspaceWidth('layers'); resetWorkspaceWidth('inspector');
  assert.deepEqual(workspaceWidths(1130), { layers: 176, inspector: 226 });
});
