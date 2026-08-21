import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";

const modelUrl = new URL("../experience-model.mjs", import.meta.url);

test("the experience model exposes a continuous four-phase scroll story", async () => {
  assert.ok(existsSync(modelUrl), "experience-model.mjs is missing");
  const { getExperienceState } = await import(modelUrl.href);

  assert.equal(getExperienceState(-1).phase, "arrival");
  assert.equal(getExperienceState(0.36).phase, "opening");
  assert.equal(getExperienceState(0.66).phase, "focus");
  assert.equal(getExperienceState(2).phase, "explain");
});

test("video progress remains clamped and monotonic through the story", async () => {
  assert.ok(existsSync(modelUrl), "experience-model.mjs is missing");
  const { getExperienceState } = await import(modelUrl.href);

  const samples = [-1, 0, 0.1, 0.25, 0.5, 0.75, 1, 2].map(
    (progress) => getExperienceState(progress).videoProgress,
  );
  assert.equal(samples[0], 0);
  assert.equal(samples.at(-1), 1);
  assert.ok(samples.every((value) => value >= 0 && value <= 1));
  assert.ok(samples.every((value, index) => index === 0 || value >= samples[index - 1]));
});

test("the final information panel arrives completely and the scene leaves cleanly", async () => {
  assert.ok(existsSync(modelUrl), "experience-model.mjs is missing");
  const { getExperienceState } = await import(modelUrl.href);
  const final = getExperienceState(1);

  assert.equal(final.panelShift, 0);
  assert.equal(final.sceneOpacity, 0);
  assert.equal(final.introOpacity, 0);
  assert.equal(final.middleOpacity, 0);
  assert.equal(final.focusOpacity, 0);
});
