import assert from "node:assert/strict";
import test from "node:test";

import { waitForEndpoint } from "../scripts/wait-for-endpoint.mjs";

test("endpoint startup tolerates more than eighty unsuccessful polls", async () => {
  let attempts = 0;
  await waitForEndpoint("http://example.test", {
    intervalMs: 0,
    fetchImpl: async () => {
      attempts += 1;
      if (attempts <= 80) throw new Error("not ready");
      return { ok: true };
    },
  });

  assert.equal(attempts, 81);
});
