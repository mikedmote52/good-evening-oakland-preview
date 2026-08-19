import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pages = await readFile(new URL("../.github/workflows/pages.yml", import.meta.url), "utf8");
const takedown = await readFile(new URL("../.github/workflows/takedown.yml", import.meta.url), "utf8");

test("Pages deploys the tested static root", () => {
  assert.match(pages, /actions\/upload-pages-artifact@v3/);
  assert.match(pages, /path:\s*\./);
  assert.match(pages, /actions\/deploy-pages@v4/);
});

test("takedown disables Pages once at the approved Pacific time", () => {
  assert.match(takedown, /cron:\s*["']0 16 19 8 \*["']/);
  assert.match(takedown, /2026-08-19/);
  assert.match(takedown, /DELETE/);
  assert.match(takedown, /repos\/\$\{\{ github\.repository \}\}\/pages/);
  assert.doesNotMatch(
    takedown,
    /gh\s+repo\s+delete|--method DELETE\s+"repos\/\$\{\{ github\.repository \}\}"\s*$/im,
  );
});
