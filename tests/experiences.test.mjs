import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

const experiences = [
  {
    slug: "sunlit-garden",
    title: "The afternoon opens.",
    theme: "sunlit",
    video: "hero-a-sunlit-garden-trip-web.mp4",
  },
  {
    slug: "golden-hour",
    title: "Stay a little longer.",
    theme: "golden",
    video: "hero-b-golden-hour-trip-web.mp4",
  },
  {
    slug: "warm-dusk",
    title: "Let the night become more.",
    theme: "dusk",
    video: "hero-c-warm-dusk-trip-web.mp4",
  },
];

test("each approved film has its own standalone product experience", async () => {
  for (const experience of experiences) {
    const pageUrl = new URL(`${experience.slug}/index.html`, root);
    assert.ok(existsSync(pageUrl), `${experience.slug} route is missing`);

    const html = await readFile(pageUrl, "utf8");
    assert.match(html, new RegExp(`<body[^>]+data-experience="${experience.theme}"`));
    assert.match(html, new RegExp(experience.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(html, /Psilocybin mushroom chocolate/i);
    assert.match(html, /Concept preview\. Not currently available\./i);
    assert.match(html, new RegExp(`assets/concepts/motion/web/${experience.video}`));
    assert.match(html, /<video[^>]+data-scroll-video[^>]+playsinline[^>]+muted/i);
  }
});

test("every experience explains the product before asking for attention", async () => {
  for (const experience of experiences) {
    const html = await readFile(new URL(`${experience.slug}/index.html`, root), "utf8");
    const visibleText = html
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ");
    for (const phrase of [
      "Sea Salt + Olive Oil",
      "Blood Orange + Cacao Nib",
      "Toasted Sesame + Honey",
      "$42 concept price",
      "Oakland",
    ]) {
      assert.match(visibleText, new RegExp(phrase.replace(/[+$]/g, "\\$&"), "i"));
    }

    for (const destination of ["what", "flavors", "making", "responsibility"]) {
      assert.match(html, new RegExp(`href="#${destination}"`));
      assert.match(html, new RegExp(`id="${destination}"`));
    }
  }
});

test("the standalone previews contain no fake commerce or collection behavior", async () => {
  const script = await readFile(new URL("experience.js", root), "utf8");
  assert.doesNotMatch(script, /fetch\(|XMLHttpRequest|sendBeacon/i);

  for (const experience of experiences) {
    const html = await readFile(new URL(`${experience.slug}/index.html`, root), "utf8");
    assert.doesNotMatch(html, /<form|type="email"|type="submit"|checkout|add to cart/i);
  }
});

test("all scroll media and poster assets exist", async () => {
  for (const experience of experiences) {
    const videoUrl = new URL(`assets/concepts/motion/web/${experience.video}`, root);
    const posterUrl = new URL(`assets/concepts/hero-${experience.slug === "sunlit-garden" ? "a-sunlit-garden" : experience.slug === "golden-hour" ? "b-golden-hour" : "c-warm-dusk"}.png`, root);
    assert.ok(existsSync(videoUrl), `${experience.slug} web video is missing`);
    assert.ok(existsSync(posterUrl), `${experience.slug} poster is missing`);
  }
});
