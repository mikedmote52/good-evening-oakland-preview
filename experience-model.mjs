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

export function getExperienceState(progress) {
  const p = clamp01(progress);
  const opening = segment(p, 0.18, 0.36);
  const focus = segment(p, 0.46, 0.64);
  const reveal = segment(p, 0.8, 0.98);
  const introExit = segment(p, 0.1, 0.25);
  const middleExit = segment(p, 0.38, 0.5);
  const focusExit = segment(p, 0.7, 0.81);

  return {
    phase: p < 0.22 ? "arrival" : p < 0.52 ? "opening" : p < 0.8 ? "focus" : "explain",
    videoProgress: segment(p, 0, 0.82),
    bloom: segment(p, 0.16, 0.76),
    sceneOpacity: 1 - reveal,
    panelShift: 100 * (1 - reveal),
    introOpacity: 1 - introExit,
    introShift: -34 * introExit,
    middleOpacity: opening * (1 - middleExit),
    middleShift: 42 * (1 - opening) - 24 * middleExit,
    focusOpacity: focus * (1 - focusExit),
    focusShift: 42 * (1 - focus) - 24 * focusExit,
  };
}

