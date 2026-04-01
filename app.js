// ==========================================================================
// ORBITAL WATCH — Core Application
// Clock, starfield, animation loop, module orchestration
// ==========================================================================

// ── Global app namespace — modules register their draw/init functions ──
const OW = {
  drawFns: [],   // functions called every animation frame: fn(timeSec, dt)
  initFns: [],   // functions called on init and resize: fn()
  dataReady: {}, // signals for cross-module data availability
};

// ── Shared data store — modules write here, others read ──
window.owData = {
  neo: { objects: [], totalCount: 0, hazardousCount: 0, lastUpdated: null },
  iss: { lat: 0, lon: 0, alt: 0, vel: 0 },
};

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
// ==========================================================================
const starCanvas = document.getElementById('starfield');
const starCtx = starCanvas.getContext('2d');
let stars = [];

function initStarfield() {
  starCanvas.width = window.innerWidth;
  starCanvas.height = window.innerHeight;
  stars = [];
  // Reduce star count on mobile for performance
  const density = window.innerWidth < 600 ? 6000 : 3000;
  const count = Math.floor((starCanvas.width * starCanvas.height) / density);
  for (let i = 0; i < count; i++) {
    stars.push({
      x: Math.random() * starCanvas.width,
      y: Math.random() * starCanvas.height,
      size: Math.random() * 1.4 + 0.3,
      brightness: Math.random() * 0.5 + 0.2,
      twinkleSpeed: Math.random() * 1.5 + 0.5,
      twinklePhase: Math.random() * Math.PI * 2,
    });
  }
}

function drawStarfield(time) {
  const ctx = starCtx;
  const w = starCanvas.width;
  const h = starCanvas.height;
  ctx.clearRect(0, 0, w, h);
  for (const s of stars) {
    const twinkle = Math.sin(time * s.twinkleSpeed + s.twinklePhase) * 0.3 + 0.7;
    const alpha = s.brightness * twinkle;
    ctx.fillStyle = `rgba(180, 210, 240, ${alpha})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
    ctx.fill();
  }
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

function loop(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.1); // cap dt to avoid spiral
  lastTime = now;
  const timeSec = now / 1000;

  drawStarfield(timeSec);

  for (const fn of OW.drawFns) {
    try { fn(timeSec, dt); } catch (e) { console.warn('Draw fn error:', e); }
  }

  requestAnimationFrame(loop);
}

// ==========================================================================
// Init
// ==========================================================================
function init() {
  resizeAll();
  requestAnimationFrame(loop);
}

window.addEventListener('load', init);
