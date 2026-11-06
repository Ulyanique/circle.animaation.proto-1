import test from "node:test";
import assert from "node:assert/strict";
import { cycleDuration } from "../src/runtime.js";
import { createDefaultProject, createSceneDefaults, SCENE_IDS } from "../src/scenes/defaults.js";
import {
  mergeProject, parseProjectJSON, projectToJSON, projectToURL, resetProjectScene, loadProject,
} from "../src/config.js";

test("project v2 contains all four ready scenes with current cycle lengths", () => {
  const project = createDefaultProject();
  assert.equal(project.version, 2);
  assert.deepEqual(Object.keys(project.scenes).sort(), [...SCENE_IDS].sort());
  assert.equal(cycleDuration(project.scenes.waiting.timeline), 15.3);
  assert.equal(cycleDuration(project.scenes.brand.timeline), 24);
  assert.equal(cycleDuration(project.scenes["photo-pause"].timeline), 24);
  assert.equal(cycleDuration(project.scenes.finale.timeline), 18);
  assert.equal(project.scenes.waiting.caption.fontFamily, "Cormorant Garamond");
  assert.equal(project.scenes.brand.intro.preset, "circle-first");
  assert.equal(project.scenes.finale.finale.finalCircle, "center-construction");
});

test("mergeProject keeps existing scene objects and applies partial JSON", () => {
  const project = createDefaultProject();
  project.scenes.waiting.caption.title = "Мой заголовок";
  const waitingRef = project.scenes.waiting;
  mergeProject(project, { version: 2, scenes: { brand: { post: { bloomIntensity: 0.91 } } } });
  assert.equal(project.scenes.waiting, waitingRef);
  assert.equal(project.scenes.waiting.caption.title, "Мой заголовок");
  assert.equal(project.scenes.brand.post.bloomIntensity, 0.91);
  assert.equal(project.scenes.waiting.post.bloomIntensity, 0.4);
});

test("mergeProject migrates legacy v1 config into the intro scene", () => {
  const project = createDefaultProject();
  mergeProject(project, { timeline: { holdDuration: 9 }, colors: { gold: "#abcdef" } });
  assert.equal(project.scenes.waiting.timeline.holdDuration, 9);
  assert.equal(project.scenes.waiting.colors.gold, "#abcdef");
  assert.equal(project.scenes.brand.timeline.holdDuration, 24);
  assert.equal(project.version, 2);
});

test("parseProjectJSON and projectToJSON round-trip in place", () => {
  const project = createDefaultProject();
  const edited = JSON.parse(projectToJSON(project));
  edited.activeScene = "finale";
  edited.scenes["photo-pause"].caption.title = "Пауза";
  const parsed = parseProjectJSON(projectToJSON(edited), project);
  assert.equal(parsed, project);
  assert.equal(project.activeScene, "finale");
  assert.equal(project.scenes["photo-pause"].caption.title, "Пауза");
  assert.equal(project.version, 2);
});

test("resetProjectScene restores defaults without replacing the object", () => {
  const project = createDefaultProject();
  const ref = project.scenes.brand;
  ref.post.bloomIntensity = 3;
  ref.layout.logoScale = 2;
  resetProjectScene(project, "brand");
  assert.equal(project.scenes.brand, ref);
  assert.equal(ref.post.bloomIntensity, createSceneDefaults("brand").post.bloomIntensity);
  assert.equal(ref.layout.logoScale, createSceneDefaults("brand").layout.logoScale);
});

test("projectToURL embeds a readable project and loadProject stays safe in Node", () => {
  const project = createDefaultProject();
  project.scenes.waiting.caption.title = "Тест";
  const url = new URL(projectToURL(project, "https://example.test/?scene=intro"));
  assert.equal(url.searchParams.get("scene"), "intro");
  const embedded = JSON.parse(url.searchParams.get("config"));
  assert.equal(embedded.version, 2);
  assert.equal(embedded.scenes.waiting.caption.title, "Тест");
  assert.equal(loadProject().version, 2);
});
