import test from "node:test";
import assert from "node:assert/strict";
import { createSceneDefaults } from "../src/scenes/defaults.js";
import { computePhase, introCaptionDelay, introLogoLift, INTRO_CAPTION_DELAY } from "../src/timeline.js";
import { captionProgress } from "../src/caption.js";

test("circle-first intro starts the logo at center and delays the caption", () => {
  const cfg = createSceneDefaults("waiting");
  const tl = cfg.timeline;
  assert.equal(cfg.intro.preset, "circle-first");
  assert.equal(introCaptionDelay(cfg), INTRO_CAPTION_DELAY);

  const early = tl.startDelay + tl.drawDuration * 0.1;
  const lifted = tl.startDelay + tl.drawDuration + tl.emergeDuration * 0.4;
  assert.ok(introLogoLift(computePhase(early, tl), tl) < 0.1);
  assert.ok(introLogoLift(computePhase(lifted, tl), tl) > 0.9);

  const captionStart = tl.drawDuration + tl.emergeDuration / 2;
  assert.equal(captionProgress(tl.startDelay + captionStart, tl, INTRO_CAPTION_DELAY), 0);
  assert.ok(captionProgress(tl.startDelay + captionStart + 0.5, tl, INTRO_CAPTION_DELAY) > 0);
});
