// ==========================================================================
// ORBITAL WATCH — Solar System Orrery (Hero)
// Ported from NEO Watch orrery.js — oblique 3D inner solar system
// ==========================================================================

(function () {
  const canvas = document.getElementById('orrery-canvas');
  const ctx = canvas.getContext('2d');

  const TILT = 0.28;
  const SCALE_FACTOR = 0.9;
  const MAX_AU = 2.0;

  const PLANETS = [
    { name: 'Mercury', au: 0.387, period: 0.2408, ecc: 0.2056, color: '#a89070', size: 3, labelColor: '#c8aa80' },
    { name: 'Venus',   au: 0.723, period: 0.6152, ecc: 0.0068, color: '#e8c870', size: 4, labelColor: '#f0d888' },
    { name: 'Earth',   au: 1.000, period: 1.0000, ecc: 0.0167, color: '#40b0ff', size: 4.5, labelColor: '#60d0ff' },
    { name: 'Mars',    au: 1.524, period: 1.8809, ecc: 0.0934, color: '#e06030', size: 3.5, labelColor: '#ff7040' },
  ];

  let neoTrajectories = [];
  let orreryTime = 0;
  let planetAngles = [];
  let orreryHits = []; // rebuilt each frame: [{x, y, r, html}]

  // ── Init ──
  function initOrrery() {
    canvas.width = canvas.clientWidth || canvas.offsetWidth || 300;
    canvas.height = canvas.clientHeight || canvas.offsetHeight || 300;

    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
    planetAngles = PLANETS.map((p, i) => {
      const baseAngle = [4.4, 3.2, 1.75, 6.0][i];
      const elapsed = dayOfYear / (p.period * 365.25);
      return (baseAngle + elapsed * Math.PI * 2) % (Math.PI * 2);
    });

    generateTrajectories();
  }

  // ── Generate NEO trajectory paths ──
  function generateTrajectories() {
    neoTrajectories = [];
    const objects = (owData.neo && owData.neo.objects) ? owData.neo.objects : [];
    const sources = objects.length > 0 ? objects.slice(0, 8) : [];

    function hashStr(s) {
      let h = 0;
      for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
      return h;
    }

    for (let i = 0; i < Math.max(sources.length, 5); i++) {
      const obj = sources[i];
      const seed = obj ? hashStr(obj.name) : (i * 7919 + 1301);
      const srand = (offset) => {
        const x = Math.sin(seed + offset * 9973) * 43758.5453;
        return x - Math.floor(x);
      };

      const entryAngle = srand(0) * Math.PI * 2;
      const perihelion = 0.15 + srand(1) * 0.8;
      const exitAngle = entryAngle + Math.PI * (0.6 + srand(2) * 0.8);
      const isHazardous = obj ? obj.hazardous : (srand(3) > 0.7);
      const speed = 0.3 + srand(4) * 0.7;
      const phase = srand(5);

      let trailColor, headColor;
      if (isHazardous) {
        trailColor = 'rgba(255, 80, 60, 0.6)';
        headColor = '#ff5040';
      } else {
        const hue = 80 + srand(6) * 100;
        trailColor = `hsla(${hue}, 70%, 50%, 0.5)`;
        headColor = hslToHex(hue, 80, 60);
      }

      const steps = 120;
      const cachedPoints = new Array(steps + 1);
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const angle = entryAngle + (exitAngle - entryAngle) * t;
        const distFactor = 4 * perihelion / (1 + 3 * Math.pow(2 * t - 1, 2));
        const dist = Math.max(perihelion, distFactor);
        cachedPoints[s] = { auX: dist * Math.cos(angle), auY: dist * Math.sin(angle), t, dist };
      }

      neoTrajectories.push({
        name: obj ? obj.name.replace(/[()]/g, '') : `NEO-${i + 1}`,
        entryAngle, exitAngle, perihelion, speed, phase,
        isHazardous, trailColor, headColor,
        cachedPoints, cachedScale: null, projectedPoints: null,
      });
    }

    const trackEl = document.getElementById('orrery-track-count');
    if (trackEl) trackEl.textContent = `TRACKS: ${neoTrajectories.length}`;
  }

  function project(auX, auY, cx, cy, scale) {
    return { x: cx + auX * scale, y: cy + auY * scale * TILT };
  }

  // ── Draw ──
  function drawOrrery(timeSec, dt) {
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h * 0.48;
    const scale = (Math.min(w, h / TILT) / 2) * SCALE_FACTOR / MAX_AU;

    orreryTime += dt;
    orreryHits = [];

    // Orbit paths
    for (const p of PLANETS) {
      const a = p.au * scale;
      const b = a * TILT;
      ctx.beginPath();
      ctx.ellipse(cx, cy, a, b, 0, 0, Math.PI * 2);
      ctx.strokeStyle = hexToRgba(p.color, 0.18);
      ctx.lineWidth = 0.8;
      ctx.stroke();
      if (p.name === 'Earth') {
        ctx.beginPath();
        ctx.ellipse(cx, cy, a, b, 0, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(64, 176, 255, 0.06)';
        ctx.lineWidth = 4;
        ctx.stroke();
      }
    }

    // Sun
    const sunGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 35);
    sunGlow.addColorStop(0, 'rgba(255, 220, 100, 0.25)');
    sunGlow.addColorStop(0.5, 'rgba(255, 180, 50, 0.08)');
    sunGlow.addColorStop(1, 'rgba(255, 150, 30, 0.0)');
    ctx.fillStyle = sunGlow;
    ctx.beginPath();
    ctx.arc(cx, cy, 35, 0, Math.PI * 2);
    ctx.fill();

    const sunGrad = ctx.createRadialGradient(cx - 1, cy - 1, 0, cx, cy, 8);
    sunGrad.addColorStop(0, '#ffffcc');
    sunGrad.addColorStop(0.4, '#ffdd44');
    sunGrad.addColorStop(0.8, '#ffaa00');
    sunGrad.addColorStop(1, '#cc7700');
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 220, 100, 0.55)';
    ctx.font = "bold 9px 'Share Tech Mono'";
    ctx.textAlign = 'center';
    ctx.fillText('Sun', cx, cy + 18);

    // NEO trajectories
    for (const traj of neoTrajectories) {
      drawTrajectory(ctx, traj, cx, cy, scale);
    }

    // Planets — set shared label font once here; drawTrajectory may have changed it
    ctx.font = "bold 9px 'Share Tech Mono'";
    ctx.textAlign = 'center';

    for (let i = 0; i < PLANETS.length; i++) {
      const p = PLANETS[i];
      planetAngles[i] += dt * (0.15 / p.period);
      if (planetAngles[i] > Math.PI * 2) planetAngles[i] -= Math.PI * 2;

      const angle = planetAngles[i];
      const r = p.au * (1 - p.ecc * p.ecc) / (1 + p.ecc * Math.cos(angle));
      const pos = project(r * Math.cos(angle), r * Math.sin(angle), cx, cy, scale);

      const glowGrad = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, p.size * 4);
      glowGrad.addColorStop(0, hexToRgba(p.color, 0.2));
      glowGrad.addColorStop(1, hexToRgba(p.color, 0));
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, p.size * 4, 0, Math.PI * 2);
      ctx.fill();

      const planetGrad = ctx.createRadialGradient(pos.x - 1, pos.y - 1, 0, pos.x, pos.y, p.size);
      planetGrad.addColorStop(0, lightenColor(p.color, 40));
      planetGrad.addColorStop(0.7, p.color);
      planetGrad.addColorStop(1, darkenColor(p.color, 40));
      ctx.fillStyle = planetGrad;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, p.size, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = p.labelColor;
      ctx.fillText(p.name, pos.x, pos.y + p.size + 13);

      const au = p.au * (1 - p.ecc * p.ecc) / (1 + p.ecc * Math.cos(angle));
      orreryHits.push({
        x: pos.x, y: pos.y, r: 16,
        html: '<strong>' + p.name + '</strong>' +
              '<div>' + au.toFixed(3) + ' AU from Sun</div>' +
              '<div>Period ' + p.period.toFixed(2) + ' yr</div>',
      });
    }
  }

  function drawTrajectory(ctx, traj, cx, cy, scale) {
    if (!traj.cachedPoints) return;
    if (traj.cachedScale !== scale || !traj.projectedPoints) {
      traj.projectedPoints = traj.cachedPoints.map(p => {
        const pos = project(p.auX, p.auY, cx, cy, scale);
        return { x: pos.x, y: pos.y, t: p.t, dist: p.dist };
      });
      traj.cachedScale = scale;
    }
    const points = traj.projectedPoints;
    const headT = (traj.phase + orreryTime * traj.speed * 0.05) % 1.0;

    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      if (prev.x < -50 || prev.x > canvas.width + 50 || prev.y < -50 || prev.y > canvas.height + 50) continue;

      let distFromHead = curr.t - headT;
      if (distFromHead < 0) distFromHead += 1;
      let alpha = 0;
      if (distFromHead < 0.5) {
        alpha = 0.03 + (0.5 - distFromHead) * 0.04;
      } else {
        alpha = Math.max(0, 0.6 * (1 - (1 - distFromHead) / 0.5));
      }
      if (alpha < 0.01) continue;

      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(curr.x, curr.y);
      ctx.strokeStyle = traj.trailColor.replace(/[\d.]+\)$/, `${alpha})`);
      ctx.stroke();
    }

    const headIdx = Math.floor(headT * (points.length - 1));
    if (headIdx >= 0 && headIdx < points.length) {
      const hp = points[headIdx];
      if (hp.x > -20 && hp.x < canvas.width + 20 && hp.y > -20 && hp.y < canvas.height + 20) {
        const glowR = traj.isHazardous ? 10 : 7;
        const hg = ctx.createRadialGradient(hp.x, hp.y, 0, hp.x, hp.y, glowR);
        hg.addColorStop(0, hexToRgba(traj.headColor, 0.3));
        hg.addColorStop(1, hexToRgba(traj.headColor, 0));
        ctx.fillStyle = hg;
        ctx.beginPath();
        ctx.arc(hp.x, hp.y, glowR, 0, Math.PI * 2);
        ctx.fill();

        const sz = traj.isHazardous ? 3 : 2;
        ctx.fillStyle = traj.headColor;
        ctx.beginPath();
        ctx.arc(hp.x, hp.y, sz, 0, Math.PI * 2);
        ctx.fill();

        const neoObj = (owData.neo && owData.neo.objects)
          ? owData.neo.objects.find(function (o) { return o.name === traj.name; })
          : null;
        const neoLd   = neoObj ? neoObj.ld.toFixed(2) + ' LD' : null;
        const neoDate = neoObj ? humanDateUTC(neoObj.date) : null;
        orreryHits.push({
          x: hp.x, y: hp.y, r: 12,
          html: '<strong>' + esc(traj.name) + '</strong>' +
                '<div>' + (traj.isHazardous ? '⚠ Potentially hazardous' : 'Nominal') + '</div>' +
                (neoLd   ? '<div>Miss dist ' + neoLd + '</div>'       : '') +
                (neoDate ? '<div>Approach ' + neoDate + '</div>' : ''),
        });

        if (traj.isHazardous || hp.dist < traj.perihelion * 1.5) {
          ctx.fillStyle = hexToRgba(traj.headColor, 0.8);
          ctx.font = "7px 'Share Tech Mono'";
          ctx.textAlign = 'left';
          const label = traj.name.length > 16 ? traj.name.slice(0, 14) + '..' : traj.name;
          ctx.fillText(label, hp.x + sz + 5, hp.y - 4);
        }
      }
    }
  }

  // ── Hit testing — click/tap on planets and NEO heads ──
  canvas.addEventListener('click', function (e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width  / rect.width;
    const scaleY = canvas.height / rect.height;
    const cx = (e.clientX - rect.left) * scaleX;
    const cy = (e.clientY - rect.top)  * scaleY;

    let best = null;
    let bestDist = Infinity;
    for (const hit of orreryHits) {
      const dx = cx - hit.x;
      const dy = cy - hit.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= hit.r && dist < bestDist) {
        best = hit;
        bestDist = dist;
      }
    }

    if (best) {
      OW.tooltip.show(e.clientX, e.clientY, best.html);
    } else {
      OW.tooltip.hide();
    }
  });

  // Register refresh hook — neo.js calls OW.hooks.neoRefresh() after each fetch
  OW.hooks.neoRefresh = generateTrajectories;

  OW.initFns.push(initOrrery);
  OW.drawFns.push(drawOrrery);
})();
