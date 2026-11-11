import test from 'node:test';
import assert from 'node:assert/strict';
import { EDITOR_LAYERS, layerDisplayName, layerNameField } from '../src/editor-layers.js';
import { WAITING_DEFAULTS } from '../src/scenes/waiting.js';
import { BRAND_DEFAULTS } from '../src/scenes/brand.js';
import { parseConfigJSON, configToJSON } from '../src/config.js';
import { duplicatePlan } from '../src/editor-duplicate.js';

test('имена добавленных элементов независимы, копируются и совместимы со старыми данными', () => {
  const a = parseConfigJSON('{}', WAITING_DEFAULTS), b = parseConfigJSON('{}', BRAND_DEFAULTS);
  const ids = ['text1', 'brandDecor', 'particleCloud', 'backgroundGlow'];
  for (const id of ids) {
    const layer = EDITOR_LAYERS.find(l => l.id === id), field = layerNameField(layer);
    assert.equal(a[field.section][field.key], '');
    assert.equal(layerDisplayName(a, layer), layer.label);
    a[field.section][field.key] = ' Свой слой ';
    assert.equal(layerDisplayName(a, layer), 'Свой слой');
    assert.equal(layerDisplayName(b, layer), layer.label);
    if (layer.custom) a.textLayers.text1Present = true;
    else a[field.section].present = true;
    const plan = duplicatePlan(a, WAITING_DEFAULTS, id);
    const name = plan.changes.find(c => c.key === (layer.custom ? 'text2Name' : 'name'));
    assert.equal(name.value, ' Свой слой ');
    const restored = parseConfigJSON(configToJSON(a), WAITING_DEFAULTS);
    assert.equal(restored[field.section][field.key], ' Свой слой ');
    a[field.section][field.key] = {invalid:true};
    assert.equal(layerDisplayName(a, layer), layer.label);
  }
  assert.equal(layerNameField(EDITOR_LAYERS.find(l => l.id === 'logo')), null);
});
