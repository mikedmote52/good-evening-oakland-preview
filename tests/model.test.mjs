import assert from "node:assert/strict";
import test from "node:test";
import { clamp01, flavors, getStoryState } from "../model.mjs";

test("the public collection has the three approved flavors", () => {
  assert.deepEqual(
    flavors.map(({ name, conceptPrice }) => ({ name, conceptPrice })),
    [
      { name: "Sea Salt + Olive Oil", conceptPrice: 42 },
      { name: "Blood Orange + Cacao Nib", conceptPrice: 42 },
      { name: "Toasted Sesame + Honey", conceptPrice: 42 },
    ],
  );
});

test("story progress is clamped and resolves the four visible phases", () => {
  assert.equal(clamp01(-1), 0);
  assert.equal(clamp01(2), 1);
  assert.equal(getStoryState(0).phase, "arrival");
  assert.equal(getStoryState(0.3).phase, "sharing");
  assert.equal(getStoryState(0.6).phase, "flourish");
  assert.equal(getStoryState(1).phase, "explain");
});

test("scene opacity and panel position finish at the static explanation", () => {
  const state = getStoryState(1);
  assert.equal(state.sceneOpacity, 0);
  assert.equal(state.panelShift, 0);
  assert.ok(Math.abs(state.seamOpacity) < 1e-12);
});
