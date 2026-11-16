import test from 'node:test';
import assert from 'node:assert/strict';
import { previewState, setPreviewZoom, panPreview, resetPreview, previewLayout } from '../src/editor-preview.js';

test('масштаб и перемещение ограничены окном и не влияют на обычный просмотр', () => {
  resetPreview();
  const view = {left: 200, top: 100, width: 800, height: 600};
  const fit = previewLayout(view, true);
  assert.equal(fit.width, 800); assert.equal(fit.height, 450);
  setPreviewZoom(2); panPreview(9999, -9999);
  const zoomed = previewLayout(view, true);
  assert.deepEqual(previewState(), {zoom:2, panX:400, panY:-225});
  assert.equal(zoomed.width, 1600); assert.equal(zoomed.height, 900);
  assert.deepEqual(zoomed.clip, fit.clip);
  const ordinary = previewLayout(view, false);
  assert.equal(ordinary.width, fit.width); assert.equal(ordinary.centerX, fit.centerX);
  setPreviewZoom(.5); assert.deepEqual(previewState(), {zoom:.5, panX:0, panY:0});
  setPreviewZoom(100); assert.equal(previewState().zoom, 4);
  resetPreview(); assert.deepEqual(previewState(), {zoom:1, panX:0, panY:0});
});
