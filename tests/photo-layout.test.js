import test from 'node:test';
import assert from 'node:assert/strict';
import { circularGlyphLayout, viewfinderSegments, photoLabelCenter } from '../src/scenes/photo-layout.js';
import { PHOTO_PAUSE_DEFAULTS } from '../src/scenes/photo-pause.js';
import { BRAND_DEFAULTS } from '../src/scenes/brand.js';
import { mergeConfig, parseConfigJSON, configToJSON } from '../src/config.js';

test('фотопауза хранит свою композицию и параметры в JSON', () => {
  const cfg = mergeConfig(PHOTO_PAUSE_DEFAULTS, {photo: { text: 'КАДР', rotationSpeed: -0.05 }});
  assert.equal(cfg.logo.offsetY, 0);
  assert.equal(cfg.photo.frameEnabled, true);
  assert.equal(cfg.photo.text, 'КАДР');
  assert.equal(parseConfigJSON(configToJSON(cfg), PHOTO_PAUSE_DEFAULTS).photo.rotationSpeed, -0.05);
  assert.equal(BRAND_DEFAULTS.photo.text, 'ЯНТАРНЫЙ ЦИРКУЛЬ');
  assert.notEqual(BRAND_DEFAULTS.photo, PHOTO_PAUSE_DEFAULTS.photo);
});

test('круговая надпись распределяет повторы без пересечения даже для длинного текста', () => {
  const radius = 100;
  const text = circularGlyphLayout('ФОТОПАУЗА', 4, radius, () => 10);
  assert.equal(text.filter(g => g.glyph === '•').length, 4);
  assert.ok(text.every((g, i) => i === 0 || text[i - 1].angle < g.angle));
  assert.ok(text.at(-1).angle - text[0].angle < Math.PI * 2);
  assert.ok(text.every(g => g.scale === 1));
  const long = circularGlyphLayout('ФОТОПАУЗА'.repeat(4), 8, radius, () => 10);
  assert.ok(long.every(g => g.scale > 0 && g.scale < 1));
  assert.ok(long.at(-1).angle - long[0].angle < Math.PI * 2);
});

test('четыре уголка равномерно отступают от краёв кадра', () => {
  const v = viewfinderSegments(16, 9, 0.05, 0.08);
  assert.equal(v.length, 48);
  const x = 16 * 0.9, y = 9 * 0.9;
  assert.deepEqual(v.slice(0, 3), [-x, -y, 0]);
  assert.deepEqual(v.slice(36, 39), [x, y, 0]);
  assert.ok(Math.abs(v[3] - (-x + 18 * 0.08)) < 1e-9);
});

test('старое стандартное смещение фотопаузы переносится в центр только один раз', async () => {
  const { loadSceneConfig, saveSceneConfig, sceneStorageKey } = await import('../src/config.js');
  const data = new Map();
  const prev = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (key) => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
  try {
    data.set(sceneStorageKey('photo-pause'), JSON.stringify({logo: {offsetY: 0.86, scale: 0.58}, photo: {text: 'МОЙ ТЕКСТ'}}));
    const cfg = loadSceneConfig('photo-pause', PHOTO_PAUSE_DEFAULTS);
    assert.equal(cfg.logo.offsetY, 0);
    assert.equal(cfg.logo.scale, 0.58);
    assert.equal(cfg.photo.text, 'МОЙ ТЕКСТ');
    assert.equal(JSON.parse(data.get(sceneStorageKey('photo-pause'))).logo.offsetY, 0);
    cfg.logo.offsetY = 0.86;
    saveSceneConfig('photo-pause', cfg);
    assert.equal(loadSceneConfig('photo-pause', PHOTO_PAUSE_DEFAULTS).logo.offsetY, 0.86);
    data.clear();
    data.set(sceneStorageKey('photo-pause'), JSON.stringify({logo: {offsetY: -0.4}}));
    assert.equal(loadSceneConfig('photo-pause', PHOTO_PAUSE_DEFAULTS).logo.offsetY, -0.4);
    data.clear();
    loadSceneConfig('photo-pause', PHOTO_PAUSE_DEFAULTS);
    data.set(sceneStorageKey('photo-pause'), JSON.stringify({logo: {offsetY: 0.86}}));
    assert.equal(loadSceneConfig('photo-pause', PHOTO_PAUSE_DEFAULTS).logo.offsetY, 0.86);
  } finally { globalThis.localStorage = prev; }
});


test('центр круговой надписи сдвигается независимо от логотипа', () => {
  const center = photoLabelCenter({x: 0.5, y: -0.2}, {offsetX: 0.25, offsetY: 0.7});
  assert.equal(center.x, 0.75);
  assert.ok(Math.abs(center.y - 0.5) < 1e-9);
  assert.deepEqual(photoLabelCenter({x: 0.5, y: -0.2}, {}), {x: 0.5, y: -0.2});
  const cfg = mergeConfig(PHOTO_PAUSE_DEFAULTS, {photo: {offsetX: -0.7, offsetY: 0.4}});
  const restored = parseConfigJSON(configToJSON(cfg), PHOTO_PAUSE_DEFAULTS);
  assert.equal(restored.photo.offsetX, -0.7);
  assert.equal(restored.photo.offsetY, 0.4);
});

test('пунктир у текста и пульсация уголков независимы и замкнуты по циклу', async () => {
  const { framePulseScale } = await import('../src/scenes/photo-layout.js');
  const cfg = mergeConfig(PHOTO_PAUSE_DEFAULTS, {}), p = cfg.photo;
  assert.ok(p.ringRadius < p.radius && p.radius - p.ringRadius < .25);
  assert.equal(framePulseScale(0, 24, p.framePulse, p.framePulseCycles), 1);
  assert.equal(framePulseScale(24, 24, p.framePulse, p.framePulseCycles), 1);
  assert.ok(Math.abs(framePulseScale(6, 24, p.framePulse, p.framePulseCycles) - (1 - p.framePulse)) < 1e-12);
  assert.equal(framePulseScale(6, 24, 0, 2), 1);
  for (let i = 0; i <= 240; i++) assert.ok(framePulseScale(i / 10, 24, p.framePulse, 2) >= 1 - p.framePulse);
  const restored = parseConfigJSON(configToJSON(cfg), PHOTO_PAUSE_DEFAULTS);
  assert.equal(restored.photo.ringRadius, p.ringRadius); assert.equal(restored.photo.framePulse, p.framePulse);
});

test('фирменный шаблон переносится в центр один раз без потери пользовательских правок', async () => {
  const { loadSceneConfig, saveSceneConfig, sceneStorageKey } = await import('../src/config.js');
  const data = new Map(), previous = globalThis.localStorage;
  globalThis.localStorage = {getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)), removeItem: key => data.delete(key)};
  try {
    data.set(sceneStorageKey('brand'), JSON.stringify({logo: {offsetY: .86}, caption: {titleText: 'Янтарный циркуль', titleVisible: true}}));
    let cfg = loadSceneConfig('brand', BRAND_DEFAULTS);
    assert.equal(cfg.logo.offsetY, 0); assert.equal(cfg.caption.titleVisible, false);
    assert.equal(cfg.photo.text, 'ЯНТАРНЫЙ ЦИРКУЛЬ');
    cfg.logo.offsetY = .86; cfg.caption.titleVisible = true; saveSceneConfig('brand', cfg);
    cfg = loadSceneConfig('brand', BRAND_DEFAULTS);
    assert.equal(cfg.logo.offsetY, .86); assert.equal(cfg.caption.titleVisible, true);
    data.clear();
    data.set(sceneStorageKey('brand'), JSON.stringify({logo: {offsetY: -.3}, caption: {titleText: 'Моя надпись'}}));
    cfg = loadSceneConfig('brand', BRAND_DEFAULTS);
    assert.equal(cfg.logo.offsetY, -.3); assert.equal(cfg.caption.titleText, 'Моя надпись'); assert.equal(cfg.caption.titleVisible, true);
    const imported = parseConfigJSON('{"logo":{"offsetY":0.86},"caption":{"titleVisible":true}}', BRAND_DEFAULTS);
    assert.equal(imported.logo.offsetY, .86); assert.equal(imported.caption.titleVisible, true);
  } finally { globalThis.localStorage = previous; }
});

test('старый стандартный размер фотопаузы увеличивается один раз, остальные размеры сохраняются', async () => {
  const { loadSceneConfig, saveSceneConfig, sceneStorageKey } = await import('../src/config.js');
  const data = new Map(), previous = globalThis.localStorage;
  globalThis.localStorage = {getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)), removeItem: key => data.delete(key)};
  try {
    assert.equal(PHOTO_PAUSE_DEFAULTS.logo.scale, .58);
    data.set(sceneStorageKey('photo-pause'), JSON.stringify({logo: {scale: .47}, photo: {text: 'СВОЙ'}}));
    let cfg = loadSceneConfig('photo-pause', PHOTO_PAUSE_DEFAULTS);
    assert.equal(cfg.logo.scale, .58); assert.equal(cfg.photo.text, 'СВОЙ');
    assert.equal(JSON.parse(data.get(sceneStorageKey('photo-pause'))).logo.scale, .58);
    cfg.logo.scale = .47; saveSceneConfig('photo-pause', cfg);
    assert.equal(loadSceneConfig('photo-pause', PHOTO_PAUSE_DEFAULTS).logo.scale, .47);
    data.clear(); data.set(sceneStorageKey('photo-pause'), JSON.stringify({logo: {scale: .7}}));
    assert.equal(loadSceneConfig('photo-pause', PHOTO_PAUSE_DEFAULTS).logo.scale, .7);
    const imported = parseConfigJSON('{"logo":{"scale":0.47}}', PHOTO_PAUSE_DEFAULTS);
    assert.equal(imported.logo.scale, .47);
  } finally { globalThis.localStorage = previous; }
});
