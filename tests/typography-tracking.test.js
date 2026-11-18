import test from 'node:test';
import assert from 'node:assert/strict';
import { SCHEMA, mergeConfig, configToJSON, parseConfigJSON, projectToJSON, parseProjectJSON } from '../src/config.js';
import { SCENES } from '../src/scenes/catalog.js';

test('интервалы независимы по строкам и сценам, старые настройки сохраняют прежний вид', () => {
  const scenes = SCENES.filter(s=>s.defaults && s.status === "ready"), ids = scenes.map(s=>s.id);
  const configs = Object.fromEntries(scenes.map(s=>[s.id, parseConfigJSON('{"typography":{"font":"prata"}}',s.defaults)]));
  // 0,32em разрывал подзаголовок на буквы — для зала он слишком широкий.
  assert.deepEqual(ids.map(id => configs[id].typography.subtitleTracking), [.18,.18,.18,.18]);
  for (const id of ids) { assert.equal(configs[id].typography.titleTracking, .02); }
  assert.deepEqual(ids.map(id => configs[id].typography.dateTracking), [.24,.24,.24,.24]);
  Object.assign(configs.waiting.typography, {titleTracking:.08, subtitleTracking:.12, dateTracking:.2});
  assert.equal(configs.finale.typography.titleTracking, .02);
  assert.deepEqual(parseConfigJSON(configToJSON(configs.waiting), scenes[0].defaults).typography, configs.waiting.typography);
  assert.deepEqual(parseProjectJSON(projectToJSON(configs,ids),ids).scenes.waiting.typography, configs.waiting.typography);
  assert.equal(mergeConfig(scenes[0].defaults, {}).typography.subtitleTracking, .18);
  const fields = SCHEMA.find(section=>section.id==='typography').fields;
  for (const name of ['titleTracking','subtitleTracking','dateTracking']) assert.ok(fields.some(field=>field.key===name));
});
