import { flavors, getStoryState } from "./model.mjs";

const story = document.querySelector(".scroll-story");
const tabs = document.querySelector(".flavor-tabs");
const image = document.querySelector("#flavor-image");
const number = document.querySelector("#product-number");
const copy = document.querySelector("#flavor-copy");
let activeIndex = 0;

function selectFlavor(index, focus = false) {
  const safeIndex = (index + flavors.length) % flavors.length;
  const flavor = flavors[safeIndex];
  activeIndex = safeIndex;
  image.src = flavor.image;
  image.alt = `${flavor.name} chocolate concept package`;
  number.textContent = `0${safeIndex + 1}`;
  copy.innerHTML = `<p class="flavor-note">${flavor.note}</p><p class="flavor-occasion">${flavor.occasion}</p><p class="concept-price">$${flavor.conceptPrice} <span>concept price</span></p>`;
  document.documentElement.style.setProperty("--flavor-accent", flavor.accent);
  [...tabs.children].forEach((tab, tabIndex) => {
    tab.setAttribute("aria-selected", String(tabIndex === safeIndex));
    tab.tabIndex = tabIndex === safeIndex ? 0 : -1;
  });
  if (focus) tabs.children[safeIndex].focus();
}

flavors.forEach((flavor, index) => {
  const tab = document.createElement("button");
  tab.type = "button";
  tab.role = "tab";
  tab.id = `tab-${flavor.id}`;
  tab.textContent = flavor.name;
  tab.addEventListener("click", () => selectFlavor(index));
  tab.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    selectFlavor(activeIndex + (event.key === "ArrowRight" ? 1 : -1), true);
  });
  tabs.append(tab);
});

selectFlavor(0);

document.querySelectorAll(".menu-sheet a").forEach((link) => {
  link.addEventListener("click", () => link.closest("details").removeAttribute("open"));
});

const cssProperties = {
  flourish: "--flourish",
  sceneOpacity: "--scene-opacity",
  sceneShift: "--scene-shift",
  panelShift: "--panel-shift",
  seamOpacity: "--seam-opacity",
  headlineOpacity: "--headline-opacity",
  headlineShift: "--headline-shift",
  secondOpacity: "--second-opacity",
  secondShift: "--second-shift",
  thirdOpacity: "--third-opacity",
  thirdShift: "--third-shift",
};

let framePending = false;

function updateStory() {
  const rect = story.getBoundingClientRect();
  const distance = Math.max(1, story.offsetHeight - window.innerHeight);
  const state = getStoryState(-rect.top / distance);

  story.dataset.phase = state.phase;
  for (const [key, property] of Object.entries(cssProperties)) {
    const suffix = key === "sceneShift" ? "%" : key.includes("Shift") ? "px" : "";
    const value = key === "panelShift" ? state.panelShiftCss : `${state[key]}${suffix}`;
    story.style.setProperty(property, value);
  }
  framePending = false;
}

function requestStoryUpdate() {
  if (framePending) return;
  framePending = true;
  requestAnimationFrame(updateStory);
}

window.addEventListener("scroll", requestStoryUpdate, { passive: true });
window.addEventListener("resize", requestStoryUpdate);
updateStory();
