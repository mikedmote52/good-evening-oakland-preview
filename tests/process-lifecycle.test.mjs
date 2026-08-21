import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import test from "node:test";

import { terminateAndWait } from "../scripts/process-lifecycle.mjs";

test("browser cleanup waits until the child process has exited", async () => {
  const child = spawn(process.execPath, [
    "-e",
    "process.on('SIGTERM', () => setTimeout(() => process.exit(0), 120)); console.log('ready'); setInterval(() => {}, 1000);",
  ], { stdio: ["ignore", "pipe", "inherit"] });

  await once(child.stdout, "data");
  const startedAt = Date.now();
  await terminateAndWait(child);

  assert.equal(child.exitCode, 0);
  assert.ok(Date.now() - startedAt >= 90, "cleanup returned before the child finished shutting down");
});
