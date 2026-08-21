import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createReadStream, existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";

import { terminateAndWait } from "./process-lifecycle.mjs";

const chromeCandidates = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter(Boolean);
const chromePath = chromeCandidates.find(existsSync);
if (!chromePath) throw new Error("Chrome or Chromium was not found. Set CHROME_PATH to its executable.");
const previewPort = 4174;
const origin = process.env.PREVIEW_ORIGIN || `http://127.0.0.1:${previewPort}`;
const proofDirectory = process.env.PROOF_DIRECTORY || "/tmp/good-evening-browser-proof";
const debugPort = 9337;
const profileDirectory = await mkdtemp(path.join(os.tmpdir(), "good-evening-chrome-"));
const projectRoot = process.cwd();

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".mp4": "video/mp4",
  ".png": "image/png",
};

const previewServer = createServer(async (request, response) => {
  try {
    const requestPath = decodeURIComponent(new URL(request.url, origin).pathname);
    let filePath = path.join(projectRoot, requestPath);
    if (!filePath.startsWith(projectRoot)) throw new Error("unsafe path");
    let fileStats = await stat(filePath);
    if (fileStats.isDirectory()) {
      filePath = path.join(filePath, "index.html");
      fileStats = await stat(filePath);
    }

    const headers = {
      "Accept-Ranges": "bytes",
      "Content-Type": contentTypes[path.extname(filePath)] || "application/octet-stream",
    };
    const range = request.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
    if (range) {
      const start = Number(range[1]);
      const end = range[2] ? Math.min(Number(range[2]), fileStats.size - 1) : fileStats.size - 1;
      response.writeHead(206, {
        ...headers,
        "Content-Length": end - start + 1,
        "Content-Range": `bytes ${start}-${end}/${fileStats.size}`,
      });
      createReadStream(filePath, { start, end }).pipe(response);
      return;
    }

    response.writeHead(200, { ...headers, "Content-Length": fileStats.size });
    createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
});

if (!process.env.PREVIEW_ORIGIN) {
  await new Promise((resolve) => previewServer.listen(previewPort, "127.0.0.1", resolve));
}

await mkdir(proofDirectory, { recursive: true });

const chrome = spawn(chromePath, [
  "--headless=new",
  `--remote-debugging-port=${debugPort}`,
  `--user-data-dir=${profileDirectory}`,
  "--hide-scrollbars",
  "--mute-audio",
  "--disable-background-networking",
  "--disable-default-apps",
  "--disable-extensions",
  "--no-first-run",
  "--no-default-browser-check",
  "about:blank",
], { stdio: "ignore" });

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function waitForDebugging() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${debugPort}/json/version`);
      if (response.ok) return;
    } catch {}
    await wait(100);
  }
  throw new Error("Chrome debugging endpoint did not start");
}

class CdpSession {
  constructor(url) {
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
    this.socket = new WebSocket(url);
  }

  async connect() {
    await new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const request = this.pending.get(message.id);
        if (!request) return;
        this.pending.delete(message.id);
        if (message.error) request.reject(new Error(message.error.message));
        else request.resolve(message.result);
        return;
      }
      for (const listener of this.listeners.get(message.method) || []) listener(message.params);
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  once(method) {
    return new Promise((resolve) => {
      const listener = (params) => {
        this.listeners.set(method, (this.listeners.get(method) || []).filter((item) => item !== listener));
        resolve(params);
      };
      this.listeners.set(method, [...(this.listeners.get(method) || []), listener]);
    });
  }

  on(method, listener) {
    this.listeners.set(method, [...(this.listeners.get(method) || []), listener]);
  }

  close() {
    this.socket.close();
  }
}

async function evaluate(session, expression) {
  const result = await session.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || "Browser evaluation failed");
  return result.result.value;
}

async function load(session, url) {
  const loaded = session.once("Page.loadEventFired");
  await session.send("Page.navigate", { url });
  await loaded;
  await evaluate(session, `new Promise((resolve) => {
    const finish = () => resolve(true);
    if (document.fonts?.ready) document.fonts.ready.then(finish);
    else finish();
  })`);
}

async function capture(session, name) {
  const result = await session.send("Page.captureScreenshot", { format: "png", fromSurface: true });
  await writeFile(path.join(proofDirectory, `${name}.png`), Buffer.from(result.data, "base64"));
}

async function verifyRoute(session, slug, width, height) {
  const errors = [];
  session.on("Runtime.exceptionThrown", ({ exceptionDetails }) => errors.push(exceptionDetails.text));
  session.on("Log.entryAdded", ({ entry }) => {
    if (entry.level === "error") errors.push(`${entry.url || "unknown"}: ${entry.text}`);
  });

  await session.send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width < 760,
  });
  await session.send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "no-preference" }],
  });
  await load(session, `${origin}/${slug}/`);

  await evaluate(session, `new Promise((resolve, reject) => {
    const video = document.querySelector('[data-scroll-video]');
    if (video?.readyState >= 1 && Number.isFinite(video.duration)) return resolve(true);
    const timeout = setTimeout(() => reject(new Error('video metadata timeout')), 8000);
    video?.addEventListener('loadedmetadata', () => { clearTimeout(timeout); resolve(true); }, { once: true });
  })`);

  const initial = await evaluate(session, `(() => {
    const video = document.querySelector('[data-scroll-video]');
    return {
      title: document.title,
      textLength: document.body.innerText.trim().length,
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      videoWidth: video.videoWidth,
      videoHeight: video.videoHeight,
      duration: video.duration,
      readyState: video.readyState,
      phase: document.querySelector('[data-film-story]').dataset.phase,
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    };
  })()`);

  assert.ok(initial.textLength > 600, `${slug} has too little meaningful content`);
  assert.ok(initial.overflow <= 1, `${slug} overflows horizontally by ${initial.overflow}px`);
  assert.equal(initial.videoWidth, 1280, `${slug} video width`);
  assert.equal(initial.videoHeight, 720, `${slug} video height`);
  assert.ok(initial.duration > 12 && initial.duration < 12.1, `${slug} video duration`);
  assert.equal(initial.phase, "arrival", `${slug} begins in the arrival phase`);
  await capture(session, `${slug}-${width}-start`);

  const timeline = [];
  for (const progress of [0.3, 0.62, 0.94]) {
    const point = await evaluate(session, `new Promise((resolve) => {
      const story = document.querySelector('[data-film-story]');
      const distance = story.offsetHeight - innerHeight;
      window.scrollTo(0, story.offsetTop + distance * ${progress});
      setTimeout(() => {
        const video = document.querySelector('[data-scroll-video]');
        resolve({
          phase: story.dataset.phase,
          currentTime: video.currentTime,
          duration: video.duration,
          progress: ${progress},
          seeking: video.seeking,
          readyState: video.readyState,
          networkState: video.networkState,
          paused: video.paused,
        });
      }, 900);
    })`);
    timeline.push(point);
    if (progress === 0.62) await capture(session, `${slug}-${width}-focus`);
  }

  assert.deepEqual(timeline.map(({ phase }) => phase), ["opening", "focus", "explain"]);
  assert.ok(timeline[0].currentTime > 1, `${slug} video advances on scroll`);
  assert.ok(timeline[1].currentTime > timeline[0].currentTime, `${slug} video continues forward`);
  assert.ok(timeline[2].currentTime > timeline[1].currentTime, `${slug} video reaches the product focus`);
  await capture(session, `${slug}-${width}-reveal`);

  const navigation = await evaluate(session, `new Promise((resolve) => {
    window.scrollTo(0, 0);
    document.querySelector('.experience-menu summary').click();
    const opened = document.querySelector('.experience-menu').open;
    document.querySelector('.experience-menu a[href="#flavors"]').click();
    setTimeout(() => resolve({ opened, hash: location.hash, menuOpen: document.querySelector('.experience-menu').open }), 250);
  })`);
  assert.deepEqual(navigation, { opened: true, hash: "#flavors", menuOpen: false });

  assert.deepEqual(errors, [], `${slug} browser errors: ${errors.join(" | ")}`);
  return { slug, viewport: `${width}x${height}`, initial, timeline, navigation };
}

async function verifyReducedMotion(session, slug) {
  await session.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await session.send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "reduce" }],
  });
  await load(session, `${origin}/${slug}/`);
  const state = await evaluate(session, `(() => {
    const story = document.querySelector('[data-film-story]');
    const viewport = document.querySelector('.film-viewport');
    return {
      storyHeight: story.getBoundingClientRect().height,
      viewportPosition: getComputedStyle(viewport).position,
      middleDisplay: getComputedStyle(document.querySelector('.copy-middle')).display,
      overflow: document.documentElement.scrollWidth - window.innerWidth,
    };
  })()`);
  assert.equal(state.viewportPosition, "relative");
  assert.equal(state.middleDisplay, "none");
  assert.ok(state.storyHeight < 1900, `${slug} reduced-motion story should not retain the 500vh scrub track`);
  assert.ok(state.overflow <= 1, `${slug} reduced-motion layout overflows`);
  return state;
}

let session;
try {
  await waitForDebugging();
  const page = await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: "PUT" }).then((response) => response.json());
  session = new CdpSession(page.webSocketDebuggerUrl);
  await session.connect();
  await session.send("Page.enable");
  await session.send("Runtime.enable");
  await session.send("Log.enable");

  const results = [];
  for (const slug of ["sunlit-garden", "golden-hour", "warm-dusk"]) {
    results.push(await verifyRoute(session, slug, 390, 844));
  }
  for (const slug of ["sunlit-garden", "golden-hour", "warm-dusk"]) {
    results.push(await verifyRoute(session, slug, 1440, 900));
  }
  const reducedMotion = [];
  for (const slug of ["sunlit-garden", "golden-hour", "warm-dusk"]) {
    reducedMotion.push({ slug, state: await verifyReducedMotion(session, slug) });
  }
  console.log(JSON.stringify({ results, reducedMotion, proofDirectory }, null, 2));
} finally {
  session?.close();
  await terminateAndWait(chrome);
  if (!process.env.PREVIEW_ORIGIN) await new Promise((resolve) => previewServer.close(resolve));
  await rm(profileDirectory, { recursive: true, force: true });
}
