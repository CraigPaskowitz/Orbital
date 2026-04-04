// ==========================================================================
// ORBITAL WATCH — Core Application
// Clock, starfield, animation loop, module orchestration
// ==========================================================================

// ==========================================================================
// Type definitions — JSDoc only, no build step required.
// VS Code reads these across the entire project when checkJs is enabled.
// ==========================================================================

/**
 * A single Near-Earth Object from the NASA NeoWs feed.
 * @typedef {Object} NEOObject
 * @property {string}  name        - Object designation, parentheses stripped
 * @property {string}  date        - Close approach date "YYYY-MM-DD"
 * @property {number}  ld          - Miss distance in lunar distances
 * @property {number}  missKm      - Miss distance in kilometres
 * @property {number}  size        - Mean estimated diameter in metres
 * @property {number}  velocity    - Relative velocity km/s at close approach
 * @property {boolean} hazardous   - True if NASA classifies as potentially hazardous
 * @property {string|null} nasaUrl - NASA JPL small-body page URL, or null
 * @property {string}  approachTime - Raw close-approach string from API
 * @property {number}  approachMs  - Close-approach time as a UTC millisecond timestamp
 */

/**
 * The live NEO dataset written by neo.js.
 * @typedef {Object} NEOData
 * @property {NEOObject[]} objects        - All NEOs for the 7-day window, sorted by ld ascending
 * @property {number}      totalCount     - Total object count (same as objects.length)
 * @property {number}      hazardousCount - Count of objects where hazardous === true
 * @property {number|null} minMissKm      - Closest miss distance in km, or null if no data
 * @property {Date|null}   lastUpdated    - Timestamp of the most recent successful fetch
 */

/**
 * Live ISS telemetry written by iss.js every ~8 seconds.
 * @typedef {Object} ISSData
 * @property {number} lat - Current latitude in decimal degrees (−90 to +90)
 * @property {number} lon - Current longitude in decimal degrees (−180 to +180)
 * @property {number} alt - Altitude in kilometres above sea level
 * @property {number} vel - Velocity in km/h
 */

/**
 * Next-launch summary written by launches.js after a successful API fetch.
 * @typedef {Object} LaunchData
 * @property {string|null} nextName    - Full mission name, e.g. "Starlink Group 6-35"
 * @property {string|null} nextNet     - ISO 8601 NET (No Earlier Than) timestamp string
 * @property {string|null} nextVehicle - Rocket/vehicle name, e.g. "Falcon 9 Block 5"
 */

/**
 * The shared cross-module data bus. Modules write; others read.
 * All properties start undefined and are populated asynchronously.
 * @typedef {Object} OWData
 * @property {NEOData}     [neo]     - Populated by neo.js after the NASA NeoWs fetch
 * @property {ISSData}     [iss]     - Populated by iss.js, refreshed every ~8 seconds
 * @property {LaunchData}  [launches] - Populated by launches.js after the SpaceDevs fetch
 */

/**
 * The global app namespace. Modules register draw/init functions here.
 * @typedef {Object} OWNamespace
 * @property {Array<function(number, number): void>} drawFns  - Called every RAF frame: fn(timeSec, dt)
 * @property {Array<function(): void>}               initFns  - Called on init and resize
 * @property {Object.<string, boolean>}              dataReady - Cross-module data availability signals
 * @property {Object.<string, function>}             hooks    - Named callbacks, e.g. neoRefresh, neoTimeline
 * @property {{ show: function(number, number, string): void, hide: function(): void }} [tooltip]
 */

// ── Global app namespace — modules register their draw/init functions ──
/** @type {OWNamespace} */
const OW = {
  drawFns: [],   // functions called every animation frame: fn(timeSec, dt)
  initFns: [],   // functions called on init and resize: fn()
  dataReady: {}, // signals for cross-module data availability
  hooks: {},     // named callbacks for cross-module coordination (e.g. neoRefresh)
};

// ── Shared data store — modules write here, others read ──
/** @type {OWData} */
window.owData = {
  neo: { objects: [], totalCount: 0, hazardousCount: 0, lastUpdated: null },
  iss: { lat: 0, lon: 0, alt: 0, vel: 0 },
};

// ==========================================================================
// Shared Tooltip
// Modules call OW.tooltip.show(x, y, html) / OW.tooltip.hide().
// x/y are page coordinates; clamping keeps the box inside the viewport.
// Any click outside a canvas (or on empty canvas space) dismisses it.
// ==========================================================================
OW.tooltip = (function () {
  const el = document.getElementById('ow-tooltip');
  let dismissTimer = null;

  function hide() {
    clearTimeout(dismissTimer);
    dismissTimer = null;
    el.classList.remove('visible');
    el.setAttribute('aria-hidden', 'true');
  }

  function show(clientX, clientY, html) {
    clearTimeout(dismissTimer);
    el.innerHTML = html;
    el.setAttribute('aria-hidden', 'false');

    // Temporarily make visible to measure size
    el.style.left = '0px';
    el.style.top  = '0px';
    el.classList.add('visible');

    const tw = el.offsetWidth;
    const th = el.offsetHeight;
    const margin = 10;

    const cx = Math.min(clientX + 14, window.innerWidth  - tw - margin);
    const cy = Math.min(clientY - th / 2, window.innerHeight - th - margin);

    el.style.left = Math.max(margin, cx) + 'px';
    el.style.top  = Math.max(margin, cy) + 'px';

    // Auto-dismiss after 4 s
    dismissTimer = setTimeout(hide, 4000);
  }

  // Dismiss on any click that is NOT on a tracked canvas
  document.addEventListener('click', function (e) {
    if (el.classList.contains('visible') &&
        !e.target.closest('#orrery-canvas') &&
        !e.target.closest('#iss-map-canvas')) {
      hide();
    }
  });

  return { show: show, hide: hide };
}());

// ==========================================================================
// Clock
// ==========================================================================
function updateClock() {
  const n = new Date();
  document.getElementById('clock').textContent =
    `${pad(n.getUTCHours())}:${pad(n.getUTCMinutes())}:${pad(n.getUTCSeconds())} UTC`;
}
updateClock();
setInterval(updateClock, 1000);

// ==========================================================================
// Starfield Background
// Pre-rendered to an in-memory canvas; composited each frame via drawImage.
// This avoids N arc() calls per frame — stars are static between resizes.
// ==========================================================================
const starCanvas = document.getElementById('starfield');
const starCtx = starCanvas.getContext('2d');

// In-memory canvas that holds the pre-rendered star field
const starBuffer = document.createElement('canvas');
const starBufCtx = starBuffer.getContext('2d');

function initStarfield() {
  const w = window.innerWidth;
  const h = window.innerHeight;

  // Size both canvases
  starCanvas.width = w;
  starCanvas.height = h;
  starBuffer.width = w;
  starBuffer.height = h;

  // Reduce star count on mobile for performance
  const density = w < 600 ? 6000 : 3000;
  const count = Math.floor((w * h) / density);

  // Clear and draw all stars once into the buffer
  starBufCtx.clearRect(0, 0, w, h);
  for (let i = 0; i < count; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const size = Math.random() * 1.4 + 0.3;
    const alpha = Math.random() * 0.5 + 0.2;
    starBufCtx.fillStyle = 'rgba(180, 210, 240, ' + alpha + ')';
    starBufCtx.beginPath();
    starBufCtx.arc(x, y, size, 0, Math.PI * 2);
    starBufCtx.fill();
  }
}

function drawStarfield() {
  // Single compositing call — replaces the per-star arc loop
  starCtx.clearRect(0, 0, starCanvas.width, starCanvas.height);
  starCtx.drawImage(starBuffer, 0, 0);
}

// ==========================================================================
// Resize Handling
// ==========================================================================
let resizeTimeout;

function resizeAll() {
  initStarfield();
  for (const fn of OW.initFns) {
    try { fn(); } catch (e) { console.warn('Init fn error:', e); }
  }
}

function debouncedResize() {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(resizeAll, 150);
}

window.addEventListener('resize', debouncedResize);

// Also observe orientation changes (important for mobile Safari)
if (typeof screen !== 'undefined' && screen.orientation) {
  screen.orientation.addEventListener('change', debouncedResize);
}

// ==========================================================================
// Animation Loop
// ==========================================================================
let lastTime = performance.now();
let rafId = null;
let paused = false;

function loop(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.1); // cap dt to avoid spiral
  lastTime = now;
  const timeSec = now / 1000;

  drawStarfield();

  for (const fn of OW.drawFns) {
    try { fn(timeSec, dt); } catch (e) { console.warn('Draw fn error:', e); }
  }

  rafId = requestAnimationFrame(loop);
}

// ==========================================================================
// Page Visibility — pause RAF when tab is hidden, resume when visible
// Resets lastTime on resume to prevent a large dt spike on the first frame back
// ==========================================================================
document.addEventListener('visibilitychange', function () {
  if (document.hidden) {
    paused = true;
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  } else {
    if (paused) {
      paused = false;
      lastTime = performance.now(); // reset to avoid dt spike on resume
      rafId = requestAnimationFrame(loop);
    }
  }
});

// ==========================================================================
// Init
// ==========================================================================
function init() {
  resizeAll();
  rafId = requestAnimationFrame(loop);
}

window.addEventListener('load', init);
