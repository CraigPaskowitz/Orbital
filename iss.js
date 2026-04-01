// ==========================================================================
// ORBITAL WATCH — ISS Live Tracking Module
// Ported from Mission Control — canvas map + telemetry
// ==========================================================================

(function () {
  const canvas = document.getElementById('iss-map-canvas');
  const ctx = canvas.getContext('2d');

  function initISS() {
    canvas.width = canvas.clientWidth || canvas.offsetWidth || 600;
    canvas.height = canvas.clientHeight || canvas.offsetHeight || 220;
    drawMap();
  }

  // ── Simplified continent outlines (equirectangular projection) ──
  const CONTINENTS = [
    // North America
    { cx: 0.22, cy: 0.28, rx: 0.12, ry: 0.14 },
    // South America
    { cx: 0.30, cy: 0.58, rx: 0.06, ry: 0.16 },
    // Europe
    { cx: 0.52, cy: 0.24, rx: 0.06, ry: 0.08 },
    // Africa
    { cx: 0.53, cy: 0.48, rx: 0.07, ry: 0.16 },
    // Asia
    { cx: 0.68, cy: 0.28, rx: 0.14, ry: 0.14 },
    // Australia
    { cx: 0.82, cy: 0.62, rx: 0.06, ry: 0.06 },
  ];

  function drawMap() {
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Background gradient (ocean)
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#06111a');
    bg.addColorStop(1, '#091722');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Grid
    ctx.strokeStyle = 'rgba(120, 220, 255, 0.06)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 12; i++) {
      const y = (h / 12) * i;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    for (let i = 0; i <= 18; i++) {
      const x = (w / 18) * i;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }

    // Continent masses
    ctx.fillStyle = 'rgba(200, 235, 245, 0.12)';
    for (const c of CONTINENTS) {
      ctx.beginPath();
      ctx.ellipse(w * c.cx, h * c.cy, w * c.rx, h * c.ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // ISS approximate ground track (sinusoidal)
    ctx.strokeStyle = 'rgba(83, 247, 238, 0.35)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    for (let i = 0; i <= 120; i++) {
      const x = (w / 120) * i;
      const y = h * 0.5 + Math.sin((i / 120) * Math.PI * 2 - 1.2) * (h * 0.22);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // ISS marker
    const lat = owData.iss.lat || 0;
    const lon = owData.iss.lon || 0;
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
  }

  // ── Fetch ISS position ──
  async function fetchISS() {
    try {
      const r = await fetch('https://api.wheretheiss.at/v1/satellites/25544');
      const d = await r.json();

      const lat = parseFloat(d.latitude || 0);
      const lon = parseFloat(d.longitude || 0);
      const alt = Number(d.altitude || 0).toFixed(1);
      const vel = (Number(d.velocity || 0) / 3600).toFixed(2);

      owData.iss = { lat, lon, alt: parseFloat(alt), vel: parseFloat(vel) };

      document.getElementById('iss-lat').textContent = lat.toFixed(1) + '°';
      document.getElementById('iss-lon').textContent = lon.toFixed(1) + '°';
      document.getElementById('iss-alt').textContent = alt + ' km';
      document.getElementById('iss-vel').textContent = vel + ' km/s';

      const region = getRegionLabel(lat, lon);
      document.getElementById('iss-meta').textContent = region;

      drawMap();
    } catch (e) {
      document.getElementById('iss-meta').textContent = 'Signal unavailable';
    }
  }

  // Register
  OW.initFns.push(initISS);

  // Fetch immediately, then every 8s
  fetchISS();
  setInterval(fetchISS, 8000);
})();
