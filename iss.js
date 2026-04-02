// ==========================================================================
// ORBITAL WATCH — ISS Live Tracking Module
// Canvas map with NASA Blue Marble Earth texture + telemetry
// ==========================================================================

(function () {
  const canvas = document.getElementById('iss-map-canvas');
  const ctx = canvas.getContext('2d');

  // ── Earth texture loading ──
  // NASA Blue Marble "Land Shallow Topo" — 2048×1024 equirectangular
  // Public domain, bundled locally to avoid CORS and CDN dependency
  let earthImg = null;
  let earthLoaded = false;
  let earthFailed = false;

  function loadEarthTexture() {
    const img = new Image();
    img.onload = function () {
      earthImg = img;
      earthLoaded = true;
      drawMap(); // redraw once texture is ready
    };
    img.onerror = function () {
      earthFailed = true;
      console.warn('Earth texture failed to load, using fallback');
    };
    img.src = './earth-2048.jpg';
  }

  loadEarthTexture();

  // ── Fallback continents (used only if texture fails to load) ──
  const CONTINENTS = [
    { cx: 0.22, cy: 0.28, rx: 0.12, ry: 0.14 },
    { cx: 0.30, cy: 0.58, rx: 0.06, ry: 0.16 },
    { cx: 0.52, cy: 0.24, rx: 0.06, ry: 0.08 },
    { cx: 0.53, cy: 0.48, rx: 0.07, ry: 0.16 },
    { cx: 0.68, cy: 0.28, rx: 0.14, ry: 0.14 },
    { cx: 0.82, cy: 0.62, rx: 0.06, ry: 0.06 },
  ];

  // ── ISS orbital constants (public, fixed values) ──
  // Inclination 51.6°, period 92.68 min, Earth sidereal day 1436 min
  const ISS_INC_RAD = 51.6 * Math.PI / 180;  // inclination in radians
  const ISS_SIN_INC = Math.sin(ISS_INC_RAD); // sin(51.6°) ≈ 0.7826
  const ISS_T_MIN   = 92.68;                 // orbital period, minutes
  // Net eastward longitude drift of ground track per minute:
  // ISS angular velocity minus Earth's rotation rate
  const ISS_LON_RATE = (360 / ISS_T_MIN) - (360 / 1436); // ≈ +3.636 °/min eastward

  // ── State for first-load and ascending/descending detection ──
  let issReady = false;  // true after first successful fetch
  let prevLat  = null;   // previous latitude for direction detection
  let issHits  = [];     // rebuilt each drawMap: [{x, y, r, html}]

  // ── Compute approximate ISS ground track ──
  // Returns an array of {x, y} canvas pixel coordinates.
  // Points span ~±2 orbits from current position (t = ±185 min).
  // Splits into past (lower opacity) and future (higher opacity) segments.
  function computeGroundTrack(lat0, lon0, w, h) {
    // Determine ascending (northward) or descending (southward) pass
    const ascending = (prevLat === null) ? true : (lat0 > prevLat);

    // Derive orbit phase angle u0 from current latitude
    // lat = arcsin(sin(INC) × sin(u))  →  sin(u) = sin(lat) / sin(INC)
    let sinU0 = Math.sin(lat0 * Math.PI / 180) / ISS_SIN_INC;
    // Clamp to [-1, 1] to guard against float rounding at extreme latitudes
    sinU0 = Math.max(-1, Math.min(1, sinU0));
    let u0 = Math.asin(sinU0); // radians, in [-π/2, π/2]
    if (!ascending) {
      u0 = Math.PI - u0; // flip to descending quadrant [π/2, 3π/2]
    }

    const uRate = (2 * Math.PI) / ISS_T_MIN; // radians per minute

    // Generate N evenly-spaced sample points across the time window
    const N      = 200;
    const T_SPAN = 185; // minutes on each side of current position
    const points = [];

    for (let i = 0; i <= N; i++) {
      const t = -T_SPAN + (2 * T_SPAN * i / N); // minutes from now

      const u   = u0 + uRate * t;
      const lat = Math.asin(ISS_SIN_INC * Math.sin(u)) * 180 / Math.PI;
      let lon   = lon0 + ISS_LON_RATE * t;

      // Normalise longitude to [-180, 180]
      lon = ((lon + 180) % 360 + 360) % 360 - 180;

      const x = ((lon + 180) / 360) * w;
      const y = ((90 - lat) / 180) * h;

      points.push({ x, y, past: t < 0 });
    }

    return points;
  }

  // ── Draw the ground track from a points array ──
  // Past portion: dashed, low opacity. Future portion: dashed, higher opacity.
  // Breaks the path at ±180° meridian crossings to prevent canvas-spanning lines.
  function drawGroundTrack(points, w) {
    // Draw past track
    ctx.save();
    ctx.strokeStyle = 'rgba(83, 247, 238, 0.20)';
    ctx.lineWidth   = 1.5;
    ctx.setLineDash([3, 7]);
    ctx.beginPath();
    let penDown = false;
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      if (!p.past) break; // stop at current position
      if (!penDown) {
        ctx.moveTo(p.x, p.y);
        penDown = true;
      } else {
        // Break path at meridian wrap (consecutive x-diff > half canvas width)
        const prev = points[i - 1];
        if (Math.abs(p.x - prev.x) > w / 2) {
          ctx.moveTo(p.x, p.y);
        } else {
          ctx.lineTo(p.x, p.y);
        }
      }
    }
    ctx.stroke();
    ctx.restore();

    // Draw future track
    ctx.save();
    ctx.strokeStyle = 'rgba(83, 247, 238, 0.45)';
    ctx.lineWidth   = 1.5;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    penDown = false;
    for (let j = 0; j < points.length; j++) {
      const q = points[j];
      if (q.past) continue; // skip past portion
      if (!penDown) {
        ctx.moveTo(q.x, q.y);
        penDown = true;
      } else {
        const qprev = points[j - 1];
        // Guard: qprev might still be in past segment — use moveTo to start clean
        if (qprev.past || Math.abs(q.x - qprev.x) > w / 2) {
          ctx.moveTo(q.x, q.y);
        } else {
          ctx.lineTo(q.x, q.y);
        }
      }
    }
    ctx.stroke();
    ctx.restore();
  }

  function initISS() {
    canvas.width = canvas.clientWidth || canvas.offsetWidth || 600;
    canvas.height = canvas.clientHeight || canvas.offsetHeight || 220;
    drawMap();
  }

  function drawMap() {
    const w = canvas.width;
    const h = canvas.height;
    const isMobile = w < 500;
    ctx.clearRect(0, 0, w, h);
    issHits = [];

    // ── Layer 1: Earth base ──
    if (earthLoaded && earthImg) {
      // Draw the NASA Blue Marble texture, stretched to fill the canvas
      ctx.drawImage(earthImg, 0, 0, w, h);

      // Dark overlay — keeps the space-noir aesthetic
      // Slightly stronger on mobile for readability
      ctx.fillStyle = isMobile ? 'rgba(3, 8, 14, 0.62)' : 'rgba(3, 8, 14, 0.55)';
      ctx.fillRect(0, 0, w, h);

      // Atmospheric edge glow (skip on mobile for perf)
      if (!isMobile) {
        // Top edge — subtle blue atmospheric haze
        const topGlow = ctx.createLinearGradient(0, 0, 0, h * 0.15);
        topGlow.addColorStop(0, 'rgba(40, 120, 200, 0.12)');
        topGlow.addColorStop(1, 'rgba(40, 120, 200, 0)');
        ctx.fillStyle = topGlow;
        ctx.fillRect(0, 0, w, h * 0.15);

        // Bottom edge — same atmospheric haze
        const botGlow = ctx.createLinearGradient(0, h * 0.85, 0, h);
        botGlow.addColorStop(0, 'rgba(40, 120, 200, 0)');
        botGlow.addColorStop(1, 'rgba(40, 120, 200, 0.10)');
        ctx.fillStyle = botGlow;
        ctx.fillRect(0, h * 0.85, w, h * 0.15);
      }
    } else {
      // Fallback: original gradient + ellipse continents
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, '#06111a');
      bg.addColorStop(1, '#091722');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = 'rgba(200, 235, 245, 0.12)';
      for (const c of CONTINENTS) {
        ctx.beginPath();
        ctx.ellipse(w * c.cx, h * c.cy, w * c.rx, h * c.ry, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // ── Layer 2: Coordinate grid ──
    // Reduced opacity over the texture — just enough to read as a grid
    ctx.strokeStyle = earthLoaded
      ? 'rgba(120, 220, 255, 0.04)'
      : 'rgba(120, 220, 255, 0.06)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 12; i++) {
      const y = (h / 12) * i;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    for (let i = 0; i <= 18; i++) {
      const x = (w / 18) * i;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }

    // ── Layer 3 & 4: Ground track + ISS marker (suppressed until first fetch) ──
    if (!issReady) {
      // First-load state — position not yet known
      ctx.fillStyle = 'rgba(83, 247, 238, 0.35)';
      ctx.font = "11px 'Share Tech Mono'";
      ctx.textAlign = 'center';
      ctx.fillText('Acquiring position\u2026', w / 2, h / 2);
    } else {
      const lat = owData.iss.lat;
      const lon = owData.iss.lon;

      // Compute and draw the orbital ground track
      const trackPoints = computeGroundTrack(lat, lon, w, h);
      drawGroundTrack(trackPoints, w);

      // ISS current position
      const px = ((lon + 180) / 360) * w;
      const py = ((90 - lat) / 180) * h;

      // Glow
      const glow = ctx.createRadialGradient(px, py, 0, px, py, 24);
      glow.addColorStop(0, 'rgba(83, 247, 238, 0.5)');
      glow.addColorStop(1, 'rgba(83, 247, 238, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(px - 24, py - 24, 48, 48);

      // Dot
      ctx.fillStyle = '#53f7ee';
      ctx.strokeStyle = '#d7fffd';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px, py, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Label
      ctx.fillStyle = 'rgba(83, 247, 238, 0.7)';
      ctx.font = "9px 'Share Tech Mono'";
      ctx.textAlign = 'left';
      ctx.fillText('ISS', px + 10, py + 3);

      const iss = owData.iss;
      issHits = [{
        x: px, y: py, r: 20,
        html: '<strong>ISS</strong>' +
              '<div>' + iss.lat.toFixed(2) + '° ' + (iss.lat >= 0 ? 'N' : 'S') +
              ' / ' + iss.lon.toFixed(2) + '° ' + (iss.lon >= 0 ? 'E' : 'W') + '</div>' +
              '<div>Alt ' + iss.alt.toFixed(1) + ' km</div>' +
              '<div>Vel ' + iss.vel.toFixed(2) + ' km/s</div>',
      }];
    }
  }

  // ── Fetch ISS position ──
  async function fetchISS() {
    try {
      const r = await fetch('https://api.wheretheiss.at/v1/satellites/25544');
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const d = await r.json();

      const lat = parseFloat(d.latitude || 0);
      const lon = parseFloat(d.longitude || 0);
      const alt = Number(d.altitude || 0).toFixed(1);
      const vel = (Number(d.velocity || 0) / 3600).toFixed(2);

      // Update ascending/descending detection before marking ready
      prevLat = issReady ? owData.iss.lat : null;
      issReady = true;

      owData.iss = { lat, lon, alt: parseFloat(alt), vel: parseFloat(vel) };

      document.getElementById('iss-lat').textContent = lat.toFixed(1) + '°';
      document.getElementById('iss-lon').textContent = lon.toFixed(1) + '°';
      document.getElementById('iss-alt').textContent = alt + ' km';
      document.getElementById('iss-vel').textContent = vel + ' km/s';

      const region = getRegionLabel(lat, lon);
      document.getElementById('iss-meta').textContent = region;

      // Last updated timestamp
      const now = new Date();
      const updEl = document.getElementById('iss-updated');
      if (updEl) {
        updEl.textContent = 'Updated ' + pad(now.getUTCHours()) + ':' + pad(now.getUTCMinutes()) + ' UTC';
      }

      drawMap();
    } catch (e) {
      document.getElementById('iss-meta').textContent = 'Signal unavailable';
    }
  }

  // ── Hit testing — click/tap on ISS dot ──
  canvas.addEventListener('click', function (e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width  / rect.width;
    const scaleY = canvas.height / rect.height;
    const cx = (e.clientX - rect.left) * scaleX;
    const cy = (e.clientY - rect.top)  * scaleY;

    let hit = null;
    for (const h of issHits) {
      const dx = cx - h.x;
      const dy = cy - h.y;
      if (Math.sqrt(dx * dx + dy * dy) <= h.r) { hit = h; break; }
    }

    if (hit) {
      OW.tooltip.show(e.clientX, e.clientY, hit.html);
    } else {
      OW.tooltip.hide();
    }
  });

  // Register
  OW.initFns.push(initISS);

  // Fetch immediately, then every 8s
  fetchISS();
  setInterval(fetchISS, 8000);
})();
