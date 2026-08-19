export const flavors = [
  {
    id: "sea-salt-olive-oil",
    name: "Sea Salt + Olive Oil",
    note: "Deep cacao, grassy olive oil, and a clean mineral finish.",
    occasion: "For a long table and nowhere else to be.",
    conceptPrice: 42,
    image: "assets/sea-salt-olive-oil.jpg",
    accent: "#6f8668",
  },
  {
    id: "blood-orange-cacao-nib",
    name: "Blood Orange + Cacao Nib",
    note: "Bright citrus against dark chocolate and crisp cacao nib.",
    occasion: "For music on and phones away.",
    conceptPrice: 42,
    image: "assets/blood-orange-cacao-nib.jpg",
    accent: "#dc704d",
  },
  {
    id: "toasted-sesame-honey",
    name: "Toasted Sesame + Honey",
    note: "Nutty sesame, warm honey, and a mellow chocolate finish.",
    occasion: "For one more game before the night ends.",
    conceptPrice: 42,
    image: "assets/toasted-sesame-honey.jpg",
    accent: "#c7944f",
  },
];

export function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function smoothstep(value) {
  const x = clamp01(value);
  return x * x * (3 - 2 * x);
}

function segment(progress, start, end) {
  return smoothstep((progress - start) / (end - start));
}

export function getStoryState(progress) {
  const p = clamp01(progress);
  const sharing = segment(p, 0.16, 0.36);
  const flourish = segment(p, 0.35, 0.66);
  const explain = segment(p, 0.72, 0.96);

  const panelShift = 100 * (1 - explain);

  return {
    phase: p < 0.24 ? "arrival" : p < 0.5 ? "sharing" : p < 0.8 ? "flourish" : "explain",
    flourish,
    sceneOpacity: 1 - explain,
    sceneShift: -4 * explain,
    panelShift,
    panelShiftCss: `${panelShift}%`,
    seamOpacity: Math.sin(Math.PI * explain),
    headlineOpacity: 1 - segment(p, 0.1, 0.27),
    headlineShift: -28 * segment(p, 0.1, 0.27),
    secondOpacity: sharing * (1 - segment(p, 0.38, 0.48)),
    secondShift: 32 * (1 - sharing),
    thirdOpacity: flourish * (1 - segment(p, 0.68, 0.78)),
    thirdShift: 32 * (1 - flourish),
  };
}
