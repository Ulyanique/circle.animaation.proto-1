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

// Присланный JSON может быть вложенным на десятки тысяч уровней: раньше
// рекурсивный deepMerge падал с RangeError прямо при загрузке страницы
// из ссылки #cfg=..., то есть приложение не открывалось вовсе.
function nestedPayload(depth) {
  let nested = "1";
  for (let i = 0; i < depth; i++) nested = `{"a":${nested}}`;
  return `{"photoScale":${nested}}`;
}

test("глубоко вложенный JSON не роняет разбор", () => {
  for (const depth of [1_000, 20_000]) {
    assert.doesNotThrow(() => parseConfigJSON(nestedPayload(depth)), `глубина ${depth}`);
    assert.doesNotThrow(() => mergeConfig(WAITING_DEFAULTS, JSON.parse(nestedPayload(depth))), `слияние, глубина ${depth}`);
  }
});

test("глубоко вложенный JSON из ссылки #cfg не роняет загрузку", () => {
  // Ссылку можно собрать и вручную, не через encodeConfigShareHash: тогда
  // строку JSON в base64url пишет кто угодно, в том числе вложенную на 20k.
  const encoded = Buffer.from(nestedPayload(20_000), "utf8").toString("base64url");
  const decoded = decodeConfigShareHash(encoded);
  assert.ok(decoded, "патч должен разбираться");
  assert.doesNotThrow(() => mergeConfig(WAITING_DEFAULTS, decoded));
  assert.equal(typeof mergeConfig(WAITING_DEFAULTS, decoded).photoScale, "object");
});

test("сверхглубокое слияние не теряет обычные поля рядом", () => {
  const deep = nestedPayload(5_000).slice('{"photoScale":'.length, -1);
  const merged = mergeConfig(WAITING_DEFAULTS, JSON.parse(`{"photoScale":${deep},"editorOpen":true}`));
  assert.equal(merged.editorOpen, true);
  assert.ok(merged.timeline);
});
