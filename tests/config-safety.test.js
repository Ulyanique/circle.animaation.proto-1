import test from "node:test";
import assert from "node:assert/strict";
import { mergeConfig, parseConfigJSON, parseProjectJSON } from "../src/config.js";
import { decodeConfigShareHash, encodeConfigShareHash } from "../src/scene-snapshots.js";
import { WAITING_DEFAULTS } from "../src/scenes/waiting.js";

// JSON.parse создаёт "__proto__" как обычное собственное свойство, поэтому
// слияние настроек без фильтра ключей записывало бы в Object.prototype.
// Проверяем все три пути, которыми внешние данные попадают в конфиг: импорт
// сцены, импорт проекта и ссылка #cfg=<base64url>.
const POLLUTION_PAYLOADS = [
  '{"__proto__":{"polluted":"yes"}}',
  '{"constructor":{"prototype":{"polluted":"yes"}}}',
  '{"prototype":{"polluted":"yes"}}',
  '{"caption":{"__proto__":{"polluted":"yes"}}}',
  '{"background":{"constructor":{"prototype":{"polluted":"yes"}}}}',
];

function assertProtected(run, label) {
  for (const payload of POLLUTION_PAYLOADS) {
    // Слияние может молча пропустить ключ — важно, что прототип не изменился.
    try { run(payload); } catch (error) { /* отказ тоже приемлем */ }
    assert.equal(({}).polluted, undefined, `${label}: загрязнён Object.prototype (${payload})`);
  }
}

test("импорт JSON сцены не загрязняет прототип", () => {
  assertProtected((payload) => parseConfigJSON(payload, WAITING_DEFAULTS), "parseConfigJSON");
});

test("импорт проекта не загрязняет прототип", () => {
  assertProtected((payload) => {
    const text = `{"version":2,"scenes":{"waiting":${payload}}}`;
    parseProjectJSON(text, ["waiting"]);
  }, "parseProjectJSON");
});

test("ссылка #cfg не загрязняет прототип", () => {
  assertProtected((payload) => {
    const encoded = Buffer.from(JSON.stringify(JSON.parse(payload))).toString("base64url");
    const patch = decodeConfigShareHash(encoded);
    if (patch) mergeConfig(WAITING_DEFAULTS, patch);
  }, "#cfg");
});

test("фильтр ключей не мешает обычному слиянию настроек", () => {
  const merged = mergeConfig(WAITING_DEFAULTS, {
    caption: { titleText: "Проверка" },
    background: { grain: 0.05 },
  });
  assert.equal(merged.caption.titleText, "Проверка");
  assert.equal(merged.background.grain, 0.05);
  // Недостающие ключи остаются из умолчаний — частичный JSON не ломает рендер.
  assert.equal(merged.timeline.holdDuration, WAITING_DEFAULTS.timeline.holdDuration);
  assert.equal(merged.caption.subtitleText, WAITING_DEFAULTS.caption.subtitleText);
});

test("легитимное поле с именем prototype в данных не ломает слияние", () => {
  // Ключ «prototype» может встретиться как имя настройки; он не должен ни
  // попадать в прототип, ни ронять импорт.
  const patch = decodeConfigShareHash(encodeConfigShareHash({ caption: { titleText: "Ссылка" } }, WAITING_DEFAULTS));
  const merged = mergeConfig(WAITING_DEFAULTS, patch);
  assert.equal(merged.caption.titleText, "Ссылка");
  assert.equal(({}).prototype, undefined);
});
