import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const publicBase = "https://mikedmote52.github.io/good-evening-oakland-preview";

const experiences = [
  {
    slug: "sunlit-garden",
    title: "The afternoon opens.",
    theme: "sunlit",
    video: "hero-a-sunlit-garden-trip-web.mp4",
    poster: "hero-a-sunlit-garden.jpg",
  },
  {
    slug: "golden-hour",
    title: "Stay a little longer.",
    theme: "golden",
    video: "hero-b-golden-hour-trip-web.mp4",
    poster: "hero-b-golden-hour.jpg",
  },
  {
    slug: "warm-dusk",
    title: "Let the night become more.",
    theme: "dusk",
    video: "hero-c-warm-dusk-trip-web.mp4",
    poster: "hero-c-warm-dusk.jpg",
  },
];

function luminance(hex) {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)
    .map((value) => Number.parseInt(value, 16) / 255)
    .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(first, second) {
  const lighter = Math.max(luminance(first), luminance(second));
  const darker = Math.min(luminance(first), luminance(second));
  return (lighter + 0.05) / (darker + 0.05);
}

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
    assert.match(html, new RegExp(`assets/concepts/posters/${experience.poster}`));
    assert.match(html, /<video[^>]+data-scroll-video[^>]+playsinline[^>]+muted[^>]+preload="metadata"/i);
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
    const posterUrl = new URL(`assets/concepts/posters/${experience.poster}`, root);
    assert.ok(existsSync(videoUrl), `${experience.slug} web video is missing`);
    assert.ok(existsSync(posterUrl), `${experience.slug} poster is missing`);
    assert.ok((await stat(posterUrl)).size < 350_000, `${experience.slug} poster should stay under 350 KB`);
  }
});

test("each theme defines an accessible footer palette", async () => {
  const css = await readFile(new URL("experience.css", root), "utf8");
  for (const experience of experiences) {
    const selector = `body[data-experience="${experience.theme}"]`;
    const start = css.indexOf(selector);
    assert.notEqual(start, -1, `${experience.slug} theme is missing`);
    const block = css.slice(start, css.indexOf("}", start));
    const background = block.match(/--footer-bg:\s*(#[\da-f]{6})/i)?.[1];
    const foreground = block.match(/--footer-ink:\s*(#[\da-f]{6})/i)?.[1];
    assert.ok(background && foreground, `${experience.slug} footer colors must be explicit`);
    assert.ok(
      contrastRatio(background, foreground) >= 4.5,
      `${experience.slug} footer text must meet WCAG AA contrast`,
    );
  }
});

test("each route has its own canonical and social sharing metadata", async () => {
  for (const experience of experiences) {
    const html = await readFile(new URL(`${experience.slug}/index.html`, root), "utf8");
    assert.match(html, new RegExp(`<link rel="canonical" href="${publicBase}/${experience.slug}/">`));
    assert.match(html, new RegExp(`<meta property="og:title" content="${experience.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
    assert.match(html, /<meta property="og:description" content="[^"]+">/);
    assert.match(html, /<meta property="og:type" content="website">/);
    assert.match(
      html,
      new RegExp(`<meta property="og:image" content="${publicBase}/assets/concepts/posters/${experience.poster}">`),
    );
  }
});
