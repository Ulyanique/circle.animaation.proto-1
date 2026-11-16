import test from 'node:test';
import assert from 'node:assert/strict';
import { METALLIC_TITLE_STOPS, METALLIC_TITLE_CSS, metallicTitleGradient } from '../src/caption-material.js';
import { WAITING_DEFAULTS } from '../src/scenes/waiting.js';
import { BRAND_DEFAULTS } from '../src/scenes/brand.js';
import { PHOTO_PAUSE_DEFAULTS } from '../src/scenes/photo-pause.js';
import { FINALE_DEFAULTS } from '../src/scenes/finale.js';
import { SCHEMA, parseConfigJSON, configToJSON } from '../src/config.js';

test('металлический титр по умолчанию в интро и фоне и доступен в JSON', () => {
  assert.equal(WAITING_DEFAULTS.caption.titleMetallic, true);
  assert.equal(BRAND_DEFAULTS.caption.titleMetallic, true);
  for (const cfg of [PHOTO_PAUSE_DEFAULTS, FINALE_DEFAULTS]) assert.equal(cfg.caption.titleMetallic, false);
  assert.ok(SCHEMA.find(s => s.id === 'caption').fields.some(f => f.key === 'titleMetallic' && f.type === 'bool'));
  const cfg = parseConfigJSON('{"caption":{"titleMetallic":false,"titleColor":"#123456"}}', WAITING_DEFAULTS);
  assert.equal(parseConfigJSON(configToJSON(cfg), WAITING_DEFAULTS).caption.titleMetallic, false);
  assert.equal(cfg.caption.titleColor, '#123456');
});

test('одинаковая палитра для DOM и canvas', () => {
  let coords, stops = [];
  const gradient = {addColorStop:(at, color) => stops.push([at, color])};
  const ctx = {createLinearGradient:(...args) => {coords = args; return gradient;}};
  assert.equal(metallicTitleGradient(ctx, 400, 100), gradient);
  assert.deepEqual(coords, [0,350,0,450]); assert.deepEqual(stops, METALLIC_TITLE_STOPS);
  for (const [at, color] of stops) assert.ok(METALLIC_TITLE_CSS.includes(`${color} ${at * 100}%`));
});

test('отражение титра следует за бликом знака и совпадает в CSS и canvas', async () => {
  const {metallicTitleStops, metallicTitleCSS, titleGlintAtGlyph} = await import('../src/caption-material.js');
  assert.deepEqual(metallicTitleStops(0), METALLIC_TITLE_STOPS);
  assert.equal(titleGlintAtGlyph(0, 0, 2, 5), 0);
  assert.ok(titleGlintAtGlyph(1, 0, 2, 5) > titleGlintAtGlyph(1, 0, 0, 5));
  assert.ok(titleGlintAtGlyph(1, 1, 4, 5) > titleGlintAtGlyph(1, 1, 0, 5));
  const shine = .5, stops = [], gradient = {addColorStop:(at,color)=>stops.push([at,color])};
  metallicTitleGradient({createLinearGradient:()=>gradient}, 100, 50, shine);
  assert.deepEqual(stops, metallicTitleStops(shine));
  for (const [,color] of stops) assert.ok(metallicTitleCSS(shine).includes(color));
});
