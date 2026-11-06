import test from 'node:test';
import assert from 'node:assert/strict';
import { FONTS, fontName } from '../src/fonts.js';
import { mergeConfig, configToJSON, parseConfigJSON, projectToJSON, parseProjectJSON } from '../src/config.js';
import { WAITING_DEFAULTS } from '../src/scenes/waiting.js';
import { BRAND_DEFAULTS } from '../src/scenes/brand.js';

test('шесть шрифтов имеют стабильные идентификаторы и безопасный запасной вариант', () => {
  assert.deepEqual(FONTS.map(f => f.id), ['cormorant-garamond','playfair-display','prata','pt-serif','manrope','unbounded']);
  assert.equal(fontName('unknown'), 'Cormorant Garamond');
});
test('типографика независима у сцен, старый JSON получает шрифт по умолчанию', () => {
  const intro = mergeConfig(WAITING_DEFAULTS, {logo: {scale: 0.5}});
  const brand = mergeConfig(BRAND_DEFAULTS, {typography: {font: 'prata'}});
  assert.equal(intro.typography.font, 'cormorant-garamond');
  assert.equal(brand.typography.font, 'prata');
  assert.equal(parseConfigJSON(configToJSON(brand), BRAND_DEFAULTS).typography.font, 'prata');
  const project = parseProjectJSON(projectToJSON({waiting: intro, brand}, ['waiting','brand']), ['waiting','brand']);
  assert.equal(project.scenes.waiting.typography.font, 'cormorant-garamond');
  assert.equal(project.scenes.brand.typography.font, 'prata');
});
