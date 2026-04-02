// ==========================================================================
// ORBITAL WATCH — Core Application
// Clock, starfield, animation loop, module orchestration
// ==========================================================================

// ── Global app namespace — modules register their draw/init functions ──
const OW = {
  drawFns: [],   // functions called every animation frame: fn(timeSec, dt)
  initFns: [],   // functions called on init and resize: fn()
  dataReady: {}, // signals for cross-module data availability
  hooks: {},     // named callbacks for cross-module coordination (e.g. neoRefresh)
};

// ── Shared data store — modules write here, others read ──
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
