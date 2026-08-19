import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const script = await readFile(new URL("../script.js", import.meta.url), "utf8");

test("the first viewport identifies the product and status", () => {
  assert.match(html, /Psilocybin mushroom chocolate/i);
  assert.match(html, /Concept preview\. Not currently available\./i);
  assert.match(html, /Bring something better to the table\./i);
});

test("the menu exposes five real destinations", () => {
  for (const [href, label] of [
    ["#product-explained", "What it is"],
    ["#collection", "Flavors"],
    ["#making", "Making"],
    ["#responsibility", "Responsibility"],
    ["#release", "Release"],
  ]) {
    assert.match(html, new RegExp(`href="${href}"[^>]*>${label}`));
    assert.match(html, new RegExp(`id="${href.slice(1)}"`));
  }
});

test("the public release chapter collects nothing", () => {
  assert.match(html, /Release list opens later\./i);
  assert.match(html, /does not collect information/i);
  assert.doesNotMatch(html, /<form|type="email"|type="submit"/i);
  assert.doesNotMatch(script, /fetch\(|XMLHttpRequest|sendBeacon/i);
});
