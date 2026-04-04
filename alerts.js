// ==========================================================================
// ORBITAL WATCH — Event Horizon Bar
// Surfaces the single most notable live event from owData.
// Priority: imminent launch → hazardous NEO in 24h → close NEO today → ISS
// ==========================================================================

(function () {
  const badge = document.getElementById('eh-badge');
  const text  = document.getElementById('eh-text');

  if (!badge || !text) return;

  function todayUTC() {
    const d = new Date();
    return d.getUTCFullYear() + '-' +
      pad(d.getUTCMonth() + 1) + '-' +
      pad(d.getUTCDate());
  }

  function evaluate() {
    const now = Date.now();
    const today = todayUTC();

    // ── Priority 1: Launch within 6 hours ──
    const launches = owData.launches;
    if (launches && launches.nextNet && launches.nextName) {
      const net = new Date(launches.nextNet).getTime();
      const delta = net - now;
      if (delta > 0 && delta <= 6 * 3600000) {
        const h = Math.floor(delta / 3600000);
        const m = Math.floor((delta % 3600000) / 60000);
        const s = Math.floor((delta % 60000) / 1000);
        badge.className = 'eh-badge launch';
        badge.textContent = 'LAUNCH';
        text.textContent = 'T\u2212' + pad(h) + ':' + pad(m) + ':' + pad(s) +
                           ' \u00b7 ' + launches.nextName;
        return;
      }
    }

    // ── Priority 2: Hazardous NEO with approach within next 24 hours ──
    const objects = (owData.neo && owData.neo.objects) ? owData.neo.objects : [];
    const cutoff24h = new Date(now + 24 * 3600000);
    const pha24 = objects.find(function (n) {
      return n.hazardous && new Date(n.approachTime) <= cutoff24h;
    });
    if (pha24) {
      badge.className = 'eh-badge hazardous';
      badge.textContent = 'HAZARDOUS';
      text.textContent = pha24.name + ' \u00b7 ' +
                         pha24.ld.toFixed(2) + ' LD \u2014 approach ' +
                         humanDateUTC(pha24.date);
      return;
    }

    // ── Priority 3: Any NEO today under 5 LD ──
    const closeToday = objects.find(function (n) {
      return n.date === today && n.ld < 5;
    });
    if (closeToday) {
      badge.className = 'eh-badge neo';
      badge.textContent = 'NEO';
      text.textContent = closeToday.name + ' \u00b7 ' +
                         closeToday.ld.toFixed(2) + ' LD flyby today';
      return;
    }

    // ── Priority 4: ISS fallback ──
    const iss = owData.iss;
    badge.className = 'eh-badge iss';
    badge.textContent = 'ISS';
    text.textContent = (iss && iss.lat !== undefined)
      ? getRegionLabel(iss.lat, iss.lon) + ' \u00b7 ' + iss.alt.toFixed(0) + ' km alt'
      : 'Acquiring position\u2026';
  }

  // Delay first evaluation to allow data modules to load,
  // then run on a single stable interval
  setTimeout(function () {
    evaluate();
    setInterval(evaluate, 10000);
  }, 2000);
}());
