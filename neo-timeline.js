// ==========================================================================
// ORBITAL WATCH — NEO Approach Timeline
// Compact 7-day scatter: x = time, y = miss distance (log), dot = size
// Redrawn on data refresh and resize only — not in the RAF loop.
// ==========================================================================

(function () {
  const canvas = document.getElementById('neo-timeline');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  // Logarithmic LD scale: map [0.1, 50] LD → [bottom, top] of plot area
  // Closer objects sit lower (visually more urgent).
  const LD_MIN = 0.1;
  const LD_MAX = 50;

  function ldToY(ld, plotTop, plotH) {
    const clamped = Math.max(LD_MIN, Math.min(LD_MAX, ld));
    const t = Math.log(clamped / LD_MIN) / Math.log(LD_MAX / LD_MIN); // 0=close, 1=far
    return plotTop + t * plotH;
  }

  function draw() {
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const objects = (owData.neo && owData.neo.objects) ? owData.neo.objects : [];
    const now = Date.now();
    const DAY_MS = 86400000;
    const windowEnd = now + 7 * DAY_MS;

    // Layout constants
    const padL = 48; // room for y-axis labels
    const padR = 10;
    const padT = 16;
    const padB = 20; // room for day labels
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;

    // ── Background ──
    ctx.fillStyle = 'rgba(3, 8, 14, 0.0)'; // transparent — panel provides bg
    ctx.fillRect(0, 0, w, h);

    // ── Y-axis labels: DISTANT (top) / CLOSE (bottom) ──
    ctx.font = "8px 'Share Tech Mono'";
    ctx.fillStyle = 'rgba(120, 200, 255, 0.35)';
    ctx.textAlign = 'right';
    ctx.fillText('DISTANT', padL - 4, padT + 7);
    ctx.fillText('CLOSE',   padL - 4, padT + plotH);

    // ── Day tick labels along x-axis ──
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(120, 200, 255, 0.3)';
    for (let d = 0; d <= 7; d++) {
      const x = padL + (d / 7) * plotW;
      const dayDate = new Date(now + d * DAY_MS);
      const label = ['SUN','MON','TUE','WED','THU','FRI','SAT'][dayDate.getUTCDay()];
      ctx.fillText(label, x, h - 4);
      // Subtle tick
      ctx.strokeStyle = 'rgba(120, 200, 255, 0.08)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(x, padT);
      ctx.lineTo(x, padT + plotH);
      ctx.stroke();
    }

    // ── Horizontal grid line at 1 LD (Earth–Moon distance) ──
    const oneLD_y = ldToY(1, padT, plotH);
    ctx.strokeStyle = 'rgba(255, 80, 60, 0.12)';
    ctx.lineWidth = 0.8;
    ctx.setLineDash([3, 5]);
    ctx.beginPath();
    ctx.moveTo(padL, oneLD_y);
    ctx.lineTo(padL + plotW, oneLD_y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = "7px 'Share Tech Mono'";
    ctx.fillStyle = 'rgba(255, 80, 60, 0.55)';
    ctx.textAlign = 'right';
    ctx.fillText('1 LD', padL - 4, oneLD_y + 3);

    // ── NOW line ──
    const nowX = padL; // now is always the left edge of the 7-day window
    ctx.strokeStyle = 'rgba(83, 247, 238, 0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(nowX, padT);
    ctx.lineTo(nowX, padT + plotH);
    ctx.stroke();
    ctx.font = "7px 'Share Tech Mono'";
    ctx.fillStyle = 'rgba(83, 247, 238, 0.5)';
    ctx.textAlign = 'left';
    ctx.fillText('NOW', nowX + 3, padT + 8);

    // ── Dots ──
    // Cap at 20 objects (already sorted closest-first from neo.js)
    const visible = objects.slice(0, 20);

    for (const neo of visible) {
      const approachMs = new Date(neo.approachTime || neo.date).getTime();
      if (approachMs < now || approachMs > windowEnd) continue;

      const x = padL + ((approachMs - now) / (7 * DAY_MS)) * plotW;
      const y = ldToY(neo.ld, padT, plotH);

      // Radius: sqrt of size in metres, clamped 2–8px and relative to canvas height
      const r = Math.max(2, Math.min(8, Math.sqrt(neo.size || 1) * 0.4, h * 0.12));

      if (neo.hazardous) {
        // Hazardous: red dot with faint outer ring (static, no animation)
        ctx.beginPath();
        ctx.arc(x, y, r + 4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 60, 40, 0.12)';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = '#ff5040';
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(128, 255, 170, 0.65)';
        ctx.fill();
      }
    }
  }

  function init() {
    const wrap = canvas.parentElement;
    canvas.width  = wrap.clientWidth  || wrap.offsetWidth  || 300;
    canvas.height = wrap.clientHeight || wrap.offsetHeight || 80;
    draw();
  }

  // Register hook — called by neo.js after each data refresh
  OW.hooks.neoTimeline = draw;

  // Register init for resize handling
  OW.initFns.push(init);
}());
