import test from 'node:test';
import assert from 'node:assert/strict';

test('загрузка фактуры ожидает изображение и повторно использует одну текстуру', async () => {
  const original = globalThis.Image;
  let image;
  try {
    globalThis.Image = class { constructor() { image = this; } set src(value) { this.url = value; } };
    const {loadFabricTexture, fabricTexture, fabricState} = await import('../src/fabric-texture.js?success');
    const loading = loadFabricTexture();
    assert.equal(loadFabricTexture(), loading);
    assert.equal(fabricState.ready, false);
    assert.match(image.url, /graphite-stone\.jpg$/);
    image.onload();
    assert.equal(await loading, true);
    assert.equal(fabricState.ready, true);
    assert.equal(fabricTexture.image, image);
  } finally { if (original === undefined) delete globalThis.Image; else globalThis.Image = original; }
});

test('отказ загрузки оставляет процедурный фон и не меняет его позже', async () => {
  const original = globalThis.Image;
  let image;
  try {
    globalThis.Image = class { constructor() { image = this; } set src(value) { this.url = value; } };
    const {loadFabricTexture, fabricState} = await import('../src/fabric-texture.js?failure');
    const loading = loadFabricTexture();
    const lateLoad = image.onload;
    image.onerror();
    assert.equal(await loading, false);
    lateLoad();
    assert.equal(fabricState.ready, false);
  } finally { if (original === undefined) delete globalThis.Image; else globalThis.Image = original; }
});
