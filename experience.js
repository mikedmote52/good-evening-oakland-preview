import { getExperienceState } from "./experience-model.mjs";

const story = document.querySelector("[data-film-story]");
const video = document.querySelector("[data-scroll-video]");
const menu = document.querySelector(".experience-menu");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const cssProperties = {
  bloom: "--bloom",
  sceneOpacity: "--scene-opacity",
  panelShift: "--panel-shift",
  introOpacity: "--intro-opacity",
  introShift: "--intro-shift",
  middleOpacity: "--middle-opacity",
  middleShift: "--middle-shift",
  focusOpacity: "--focus-opacity",
  focusShift: "--focus-shift",
};

let updatePending = false;
let seekPending = false;
let targetTime = 0;
let renderedTime = 0;

function applyStoryState() {
  if (!story) return;
  const rect = story.getBoundingClientRect();
  const distance = Math.max(1, story.offsetHeight - window.innerHeight);
  const state = getExperienceState(-rect.top / distance);

  story.dataset.phase = state.phase;
  for (const [key, property] of Object.entries(cssProperties)) {
    const suffix = key.includes("Shift") ? (key === "panelShift" ? "%" : "px") : "";
    story.style.setProperty(property, `${state[key]}${suffix}`);
  }

  if (video?.duration && !reduceMotion.matches) {
    targetTime = state.videoProgress * Math.max(0, video.duration - 0.04);
    requestSeek();
  }
  updatePending = false;
}

function requestUpdate() {
  if (updatePending) return;
  updatePending = true;
  requestAnimationFrame(applyStoryState);
}

function renderSeek() {
  seekPending = false;
  if (!video?.duration || reduceMotion.matches) return;

  const difference = targetTime - renderedTime;
  if (Math.abs(difference) < 0.025) {
    renderedTime = targetTime;
  } else {
    renderedTime += difference * (Math.abs(difference) > 1 ? 0.38 : 0.24);
  }

  if (!video.seeking && Math.abs(video.currentTime - renderedTime) > 0.018) {
    video.currentTime = renderedTime;
  }

  if (Math.abs(targetTime - renderedTime) >= 0.025 || video.seeking) requestSeek();
}

function requestSeek() {
  if (seekPending) return;
  seekPending = true;
  requestAnimationFrame(renderSeek);
}

if (video) {
  video.pause();
  video.addEventListener("loadedmetadata", () => {
    story.dataset.mediaReady = "true";
    renderedTime = Math.min(targetTime, Math.max(0, video.duration - 0.04));
    video.currentTime = renderedTime;
    requestUpdate();
  });
  video.addEventListener("seeked", requestSeek);
  video.addEventListener("error", () => {
    story.dataset.mediaError = "true";
  });
}

document.querySelectorAll(".experience-menu a").forEach((link) => {
  link.addEventListener("click", () => menu?.removeAttribute("open"));
});

window.addEventListener("scroll", requestUpdate, { passive: true });
window.addEventListener("resize", requestUpdate);
reduceMotion.addEventListener?.("change", requestUpdate);
applyStoryState();
