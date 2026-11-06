import test from "node:test";
import assert from "node:assert/strict";
import { createSceneDefaults, sceneRenderTimeline } from "../src/scenes/defaults.js";
import { computePhase } from "../src/timeline.js";
import { decorState } from "../src/decor-layer.js";
import { photoPauseState } from "../src/photo-pause-decor.js";
import { finaleSequence } from "../src/finale-sequence.js";
import { captionFrameState } from "../src/caption-renderer.js";

const TAU = Math.PI * 2;

test("№2: декор детерминирован и гаснет на обоих краях цикла", () => {
  const cfg = createSceneDefaults("brand");
  const cycle = cfg.timeline.holdDuration;
  const tl = sceneRenderTimeline(cycle, cfg.timeline.speed ?? 1);
  const envelope = (t) => computePhase(t, tl).rings;
  assert.equal(cfg.decor.preset, "blueprint-arcs");
  assert.equal(decorState(0, cfg, cycle, envelope(0)).opacity, 0);
  assert.equal(decorState(cycle - 1 / 60, cfg, cycle, envelope(cycle - 1 / 60)).opacity, 0);
  const mid = decorState(8, cfg, cycle, envelope(8));
  assert.ok(mid.opacity > 0);
  assert.deepEqual(mid, decorState(8, cfg, cycle, envelope(8)));
});

test("№8: лого в центре, уголки по краям и целое число оборотов круговой строки", () => {
  const cfg = createSceneDefaults("photo-pause");
  const cycle = cfg.timeline.holdDuration;
  const tl = sceneRenderTimeline(cycle, cfg.timeline.speed ?? 1);
  const envelope = (t) => computePhase(t, tl).rings;
  assert.equal(cfg.layout.logoY, 0);
  assert.equal(cfg.layout.cornerBrackets, true);
  assert.equal(cfg.layout.viewfinderOpacity, 0);
  assert.equal(photoPauseState(0, cfg, cycle, envelope(0)).opacity, 0);
  assert.equal(photoPauseState(cycle - 1 / 60, cfg, cycle, envelope(cycle - 1 / 60)).cornerOpacity, 0);
  const mid = photoPauseState(8, cfg, cycle, envelope(8));
  assert.ok(mid.opacity > 0 && mid.cornerOpacity > 0 && mid.edgeCorners);
  const turn = photoPauseState(cycle, cfg, cycle, 1);
  assert.ok(Math.abs(((turn.rotation % TAU) + TAU) % TAU) < 1e-9);
});

test("№9: порядок стирания, перемещения, удаления, контура и финального круга", () => {
  const cfg = createSceneDefaults("finale");
  const at = (t) => finaleSequence(t, cfg);
  assert.equal(cfg.finale.finalCircle, "center-construction");
  assert.equal(at(0).captionErase, 0);
  assert.equal(at(0).finalCircle, 0);
  assert.equal(at(18 - 1 / 60).finalCircle, 0);
  assert.equal(at(18).finalCircle, 0);
  assert.ok(at(15.4).captionErase > 0);
  assert.ok(at(15.8).logoCenter > at(15.4).logoCenter);
  assert.ok(at(16.4).depth > at(15.8).depth);
  assert.ok(at(16.8).contour > at(16.4).contour);
  assert.ok(at(16.9).finalCircle > 0);
});

test("№9: титр в экспортном кадре стирается справа налево и теряет заливку", () => {
  const cfg = createSceneDefaults("finale");
  const hold = captionFrameState(8, cfg, "finale").lines[0];
  const erasing = captionFrameState(15.5, cfg, "finale").lines[0];
  assert.equal(hold.erase, 0);
  assert.ok(erasing.erase > 0);
  assert.ok(erasing.fill < hold.fill);
});
