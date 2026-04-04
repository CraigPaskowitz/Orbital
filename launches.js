// ==========================================================================
// ORBITAL WATCH — Upcoming Launches Module
// Ported from Mission Control — SpaceDevs Launch Library 2.3.0
// ==========================================================================

(function () {
  const CACHE_KEY = 'ow_launches_cache';
  const CACHE_MAX_AGE_MS = 12 * 60 * 60 * 1000; // 12 hours

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

  function saveCache(results) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ fetchedAt: Date.now(), results: results }));
    } catch (e) {
      // localStorage unavailable (private browsing quota, etc.) — fail silently
    }
  }

  function loadCache() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.results) || !parsed.fetchedAt) return null;
      if (Date.now() - parsed.fetchedAt > CACHE_MAX_AGE_MS) return null;
      return parsed;
    } catch (e) {
      return null;
    }
  }

  function renderResults(results, list) {
    countdownTarget = new Date(results[0].net);
    runCountdown();

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
  }

  async function fetchLaunches() {
    const list = document.getElementById('launch-list');
    countdownTarget = null; // reset so a failed refresh doesn't show stale countdown
    try {
      const r = await fetch('https://ll.thespacedevs.com/2.3.0/launches/upcoming/?format=json&limit=4&include_suborbital=false');
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const data = await r.json();
      const results = Array.isArray(data.results) ? data.results : [];

      if (!results.length) throw new Error('No launches');

      // Successful fetch — save to cache, expose to owData, and render
      saveCache(results);
      owData.launches = {
        nextName:    results[0].name || null,
        nextNet:     results[0].net  || null,
        nextVehicle: results[0].rocket?.configuration?.name || null,
      };
      renderResults(results, list);

      // ── Launches panel insight line ──
      const insightEl = document.getElementById('launches-insight');
      if (insightEl && results[0] && results[0].net) {
        const delta = new Date(results[0].net).getTime() - Date.now();
        let insightText;
        if (delta <= 0) {
          insightText = 'Launch window now open';
        } else {
          const totalH = Math.floor(delta / 3600000);
          if (totalH < 1) {
            insightText = 'Next launch in less than an hour';
          } else if (totalH < 24) {
            insightText = 'Next launch in ' + totalH + ' hour' + (totalH > 1 ? 's' : '');
          } else {
            const days = Math.floor(totalH / 24);
            insightText = 'Next launch in ' + days + ' day' + (days > 1 ? 's' : '');
          }
        }
        insightEl.textContent = insightText;
      }

      // Last updated indicator
      const lUpd = document.getElementById('launches-updated');
      if (lUpd) {
        const lNow = new Date();
        lUpd.textContent = 'Updated ' + pad(lNow.getUTCHours()) + ':' + pad(lNow.getUTCMinutes()) + ' UTC';
      }

    } catch (e) {
      console.error('[Launches] fetch error:', e.message, e);

      const cached = loadCache();
      if (cached) {
        // Render stale data with a throttle notice above the rows
        renderResults(cached.results, list);
        const staleBanner = document.createElement('div');
        staleBanner.className = 'launch-stale-notice';
        staleBanner.textContent = 'Live data throttled — showing cached data';
        list.insertBefore(staleBanner, list.firstChild);

        // Update timestamp to reflect cache age
        const lUpd = document.getElementById('launches-updated');
        if (lUpd) {
          const cachedAt = new Date(cached.fetchedAt);
          lUpd.textContent = 'Cached ' + pad(cachedAt.getUTCHours()) + ':' + pad(cachedAt.getUTCMinutes()) + ' UTC';
        }
      } else {
        list.innerHTML = '<div class="notice">Launch data temporarily throttled — check back shortly.</div>';
      }
    }
  }

  fetchLaunches();
  setInterval(fetchLaunches, 3600000); // refresh hourly
})();
