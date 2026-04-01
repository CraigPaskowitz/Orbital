// ==========================================================================
// ORBITAL WATCH — Orbital Awareness Radar
// Reworked from NEO Watch proximity radar — broader scope
// Shows NEOs + ISS position marker
// ==========================================================================

(function () {
  const canvas = document.getElementById('radar-canvas');
  const ctx = canvas.getContext('2d');
  let sweepAngle = 0;

  function initRadar() {
    canvas.width = canvas.clientWidth || canvas.offsetWidth || 300;
    canvas.height = canvas.clientHeight || canvas.offsetHeight || 300;
  }

  const MAX_LD = 200;
  const RINGS = [
    { ld: 1, label: '1 LD' },
    { ld: 5, label: '5 LD' },
    { ld: 20, label: '20 LD' },
    { ld: 100, label: '100 LD' },
  ];

  function ldToRadius(ld, maxR) {
    return (Math.log10(ld + 1) / Math.log10(MAX_LD + 1)) * maxR;
  }

  function drawRadar(timeSec, dt) {
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2;
    const maxR = Math.min(cx, cy) - 20;

    // Sweep
    sweepAngle += dt * 0.8;
    if (sweepAngle > Math.PI * 2) sweepAngle -= Math.PI * 2;
    const sweepEl = document.getElementById('radar-sweep');
    if (sweepEl) sweepEl.textContent = `SWEEP: ${Math.floor((sweepAngle / (Math.PI * 2)) * 360)}°`;

    // Grid rings
    ctx.textAlign = 'left';
    ctx.font = "9px 'Share Tech Mono'";
    for (const ring of RINGS) {
      const r = ldToRadius(ring.ld, maxR);
      ctx.strokeStyle = 'rgba(0, 221, 255, 0.08)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(0, 221, 255, 0.25)';
      ctx.fillText(ring.label, cx + 3, cy - r - 3);
    }

    // Crosshairs
    ctx.strokeStyle = 'rgba(0, 221, 255, 0.06)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(cx - maxR, cy); ctx.lineTo(cx + maxR, cy);
    ctx.moveTo(cx, cy - maxR); ctx.lineTo(cx, cy + maxR);
    ctx.stroke();

    // Diagonal lines
    ctx.beginPath();
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * maxR, cy + Math.sin(a) * maxR);
    }
    ctx.stroke();

    // Sweep beam with gradient trail
    ctx.save();
    for (let i = 0; i < 12; i++) {
      const frac = i / 12;
      const startA = sweepAngle - 1.0 * frac;
      const endA = sweepAngle - 1.0 * (frac + 1 / 12);
      ctx.globalAlpha = 0.08 * (1 - frac);
      ctx.fillStyle = '#00ff88';
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, maxR, endA, startA, false);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // Sweep line
    ctx.strokeStyle = 'rgba(0, 255, 136, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(sweepAngle) * maxR, cy + Math.sin(sweepAngle) * maxR);
    ctx.stroke();

    // Earth center
    const earthGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 18);
    earthGlow.addColorStop(0, 'rgba(32, 144, 192, 0.2)');
    earthGlow.addColorStop(1, 'rgba(32, 144, 192, 0.0)');
    ctx.fillStyle = earthGlow;
    ctx.beginPath();
    ctx.arc(cx, cy, 18, 0, Math.PI * 2);
    ctx.fill();

    const earthGrad = ctx.createRadialGradient(cx - 1, cy - 1, 0, cx, cy, 5);
    earthGrad.addColorStop(0, '#60d0f0');
    earthGrad.addColorStop(0.5, '#2090c0');
    earthGrad.addColorStop(1, '#0a4060');
    ctx.fillStyle = earthGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(0, 221, 255, 0.4)';
    ctx.font = "8px 'Share Tech Mono'";
    ctx.textAlign = 'center';
    ctx.fillText('EARTH', cx, cy + 14);

    // ── Plot NEO objects ──
    const objects = (owData.neo && owData.neo.objects) ? owData.neo.objects : [];
    let plotted = 0;

    for (const o of objects) {
      if (o.missKm == null) continue;
      const distLD = o.missKm / LUNAR_DIST_KM;
      if (distLD > MAX_LD * 1.2) continue;

      const r = Math.min(maxR, ldToRadius(distLD, maxR));
      let nameHash = 0;
      for (let c = 0; c < o.name.length; c++) nameHash = ((nameHash << 5) - nameHash + o.name.charCodeAt(c)) | 0;
      const angle = ((nameHash % 360) / 360) * Math.PI * 2;

      const px = cx + Math.cos(angle) * r;
      const py = cy + Math.sin(angle) * r;

      // Sweep brightness
      let angleDiff = Math.abs(sweepAngle - ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2));
      if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;
      const bright = Math.max(0.2, 1 - angleDiff / 1.5);

      const size = o.hazardous ? 4 : 2.5;
      const color = o.hazardous
        ? `rgba(255, 51, 85, ${bright})`
        : `rgba(0, 255, 136, ${bright})`;

      if (bright > 0.5) {
        ctx.fillStyle = o.hazardous
          ? `rgba(255, 51, 85, ${bright * 0.12})`
          : `rgba(0, 255, 136, ${bright * 0.08})`;
        ctx.beginPath();
        ctx.arc(px, py, size * 3, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(px, py, size, 0, Math.PI * 2);
      ctx.fill();

      if (o.hazardous && bright > 0.6) {
        ctx.fillStyle = `rgba(255, 51, 85, ${bright * 0.7})`;
        ctx.font = "8px 'Share Tech Mono'";
        ctx.textAlign = 'left';
        ctx.fillText(o.name, px + size + 3, py + 3);
      }

      plotted++;
    }

    // ── ISS marker (inside 1 LD ring, ~0.001 LD) ──
    const issR = ldToRadius(0.5, maxR); // visual position near center
    const issAngle = (timeSec * 0.3) % (Math.PI * 2); // orbits around
    const issPx = cx + Math.cos(issAngle) * issR;
    const issPy = cy + Math.sin(issAngle) * issR;

    ctx.fillStyle = 'rgba(83, 247, 238, 0.6)';
    ctx.beginPath();
    ctx.arc(issPx, issPy, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(83, 247, 238, 0.5)';
    ctx.font = "7px 'Share Tech Mono'";
    ctx.textAlign = 'left';
    ctx.fillText('ISS', issPx + 5, issPy + 2);

    const objEl = document.getElementById('radar-objects');
    if (objEl) objEl.textContent = `OBJECTS: ${plotted}`;
  }

  OW.initFns.push(initRadar);
  OW.drawFns.push(drawRadar);
})();
