import test from 'node:test';
import assert from 'node:assert/strict';
import { validCustomColor } from '../src/caption-content.js';
import { SCENES } from '../src/scenes/catalog.js';
import { mergeConfig, configToJSON, parseConfigJSON, projectToJSON, parseProjectJSON } from '../src/config.js';
import { circularGlyphLayout } from '../src/scenes/photo-layout.js';

test('тексты и цвета независимы по сценам и переживают JSON проекта и отдельной сцены', () => {
  const scenes = SCENES.filter(scene => scene.defaults && scene.status === "ready");
  const configs = Object.fromEntries(scenes.map((scene, index) => [scene.id, mergeConfig(scene.defaults, {
    caption: { titleText: `Сцена ${index}`, titleColor: '#123456', subtitleText: '', dateColor: '#abcdef' },
  })]));
  configs['photo-pause'].photo.text = 'КАДР';
  configs['photo-pause'].photo.textColor = '#12aabb';
  for (const scene of scenes) {
    const restored = parseConfigJSON(configToJSON(configs[scene.id]), scene.defaults);
    assert.deepEqual(restored.caption, configs[scene.id].caption);
    assert.notEqual(scene.defaults.caption.titleText, restored.caption.titleText);
    assert.equal(restored.caption.subtitleText, '');
  }
  const order = scenes.map(scene => scene.id);
  const project = parseProjectJSON(projectToJSON(configs, order), order);
  assert.deepEqual(project.scenes['photo-pause'].photo, configs['photo-pause'].photo);
});

test('старые настройки сохраняют прежние тексты и исходные цвета', () => {
  for (const scene of SCENES.filter(scene => scene.defaults && scene.status === "ready")) {
    const old = parseConfigJSON('{"caption":{"titleX":0.2}}', scene.defaults);
    assert.equal(old.caption.titleText, scene.id === 'photo-pause' ? 'Фотопауза' : 'Янтарный циркуль');
    assert.equal(old.caption.subtitleText, scene.id === 'finale' ? 'История продолжается' : 'Вечер ретроспектива');
    assert.equal(old.caption.titleColor, null);
    if (old.photo) assert.equal(old.photo.textColor, null);
  }
});

test('цвет проверяется, пустая круговая надпись не заменяется фиктивным текстом', () => {
  assert.equal(validCustomColor('#ABC123'), '#ABC123');
  for (const value of [null, '', 'red', '#xyzxyz', 'url(test)']) assert.equal(validCustomColor(value), null);
  assert.deepEqual(circularGlyphLayout('', 4, 100, () => 10), []);
  assert.deepEqual(circularGlyphLayout('   ', 4, 100, () => 10), []);
});
