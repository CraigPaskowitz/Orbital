// ==========================================================================
// ORBITAL WATCH — Upcoming Launches Module
// Ported from Mission Control — SpaceDevs Launch Library 2.2.0
// ==========================================================================

(function () {
  let countdownTarget = null;

  function runCountdown() {
    const el = document.getElementById('countdown');
    if (!el) return;
    if (!countdownTarget) { el.textContent = '--:--:--:--'; return; }

    let delta = countdownTarget.getTime() - Date.now();
    if (delta < 0) { el.textContent = 'LIFTOFF'; return; }

    const d = Math.floor(delta / 86400000); delta -= d * 86400000;
    const h = Math.floor(delta / 3600000); delta -= h * 3600000;
    const m = Math.floor(delta / 60000); delta -= m * 60000;
    const s = Math.floor(delta / 1000);
    el.textContent = `${pad(d)}d ${pad(h)}:${pad(m)}:${pad(s)}`;
  }

  setInterval(runCountdown, 1000);

  async function fetchLaunches() {
    const list = document.getElementById('launch-list');
    countdownTarget = null; // reset so a failed refresh doesn't show stale countdown
    try {
      const r = await fetch('https://ll.thespacedevs.com/2.3.0/launch/upcoming/?format=json&limit=4&include_suborbital=false');
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const data = await r.json();
      const results = Array.isArray(data.results) ? data.results : [];

      if (!results.length) throw new Error('No launches');

      const primary = results[0];
      countdownTarget = new Date(primary.net);
      runCountdown();

      // Last updated indicator
      const lUpd = document.getElementById('launches-updated');
      if (lUpd) {
        const lNow = new Date();
        lUpd.textContent = 'Updated ' + pad(lNow.getUTCHours()) + ':' + pad(lNow.getUTCMinutes()) + ' UTC';
      }

      list.innerHTML = results.map(l => {
        const d = new Date(l.net);
        const st = l.status?.abbrev || 'TBD';
        const go = /go/i.test(st);
        const vehicle = l.rocket?.configuration?.name || 'TBD';
        const padName = l.pad?.name || 'TBD';
        const orbit = l.mission?.orbit?.abbrev || 'TBD';

        const detailUrl = l.slug
          ? `https://spacelaunchnow.me/launch/${encodeURIComponent(l.slug)}`
          : null;
        const agencyUrl = providerUrl(l.launch_service_provider);

        return `<div class="launch-row">
          <div class="launch-date">
            <div class="mo">${monthAbbr(d.getUTCMonth())}</div>
            <div class="dy">${pad(d.getUTCDate())}</div>
          </div>
          <div class="launch-main">
            <div class="launch-line">
              <div class="launch-title">${esc(l.name)}</div>
              <span class="badge ${go ? 'go' : 'wait'}">${esc(st)}</span>
            </div>
            <div class="launch-specs">
              <span><span class="spec-label">Vehicle</span><span class="spec-val">${esc(vehicle)}</span></span>
              <span><span class="spec-label">Pad</span><span class="spec-val">${esc(padName)}</span></span>
              <span><span class="spec-label">Orbit</span><span class="spec-val">${esc(orbit)}</span></span>
            </div>
            <div class="launch-actions">
              ${detailUrl ? `<a class="linkout amber" href="${detailUrl}" target="_blank" rel="noopener noreferrer">Launch details ↗</a>` : ''}
              ${agencyUrl ? `<a class="linkout" href="${agencyUrl}" target="_blank" rel="noopener noreferrer">Provider ↗</a>` : ''}
            </div>
          </div>
        </div>`;
      }).join('');
    } catch (e) {
      list.innerHTML = '<div class="notice">Launch data temporarily unavailable.</div>';
    }
  }

  fetchLaunches();
  setInterval(fetchLaunches, 3600000); // refresh hourly
})();
