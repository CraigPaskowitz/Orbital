// ==========================================================================
// ORBITAL WATCH — NEO Watchlist + Threat Score Module
// 7-day NASA NeoWs feed, compact watchlist, threat scoring
// Feeds data to orrery trajectories and radar blips
// ==========================================================================

(function () {
  function computeThreatScore(total, phaCt, closestLd) {
    let score = phaCt * 8;
    if (closestLd < 1) score += 30;
    else if (closestLd < 2) score += 18;
    else if (closestLd < 5) score += 8;
    score += Math.min(Math.floor(total / 2), 20);
    return Math.min(Math.max(score, 1), 99);
  }

  function sevClass(ld, pha) {
    if (pha && ld < 2) return 'hi';
    if (pha || ld < 5) return 'med';
    return '';
  }

  async function fetchNEO() {
    try {
      const now = new Date();
      const end = new Date(now.getTime() + 7 * 86400000);
      const url = `https://api.nasa.gov/neo/rest/v1/feed?start_date=${dateISO(now)}&end_date=${dateISO(end)}&api_key=${NASA_API_KEY}`;

      const r = await fetch(url);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const data = await r.json();

      const all = [];
      Object.keys(data.near_earth_objects || {}).sort().forEach(day => {
        (data.near_earth_objects[day] || []).forEach(n => {
          const ca = n.close_approach_data && n.close_approach_data[0];
          if (!ca) return;

          const missKm = parseFloat(ca.miss_distance?.kilometers || 0);
          const ld = parseFloat(ca.miss_distance?.lunar || 0);
          const sizeMin = parseFloat(n.estimated_diameter?.meters?.estimated_diameter_min || 0);
          const sizeMax = parseFloat(n.estimated_diameter?.meters?.estimated_diameter_max || 0);
          const size = (sizeMin + sizeMax) / 2;
          const velKms = parseFloat(ca.relative_velocity?.kilometers_per_second || 0);

          all.push({
            name: (n.name || '').replace(/[()]/g, '').trim(),
            date: day,
            ld,
            missKm,
            size,
            velocity: velKms,
            hazardous: !!n.is_potentially_hazardous_asteroid,
            nasaUrl: n.nasa_jpl_url || null,
            approachTime: ca.close_approach_date_full || ca.close_approach_date || day,
          });
        });
      });

      all.sort((a, b) => a.ld - b.ld);
      const phaCt = all.filter(n => n.hazardous).length;
      const closest = all[0];

      // ── Update shared data store ──
      owData.neo = {
        objects: all,
        totalCount: all.length,
        hazardousCount: phaCt,
        minMissKm: closest ? closest.missKm : null,
        lastUpdated: new Date(),
      };

      // ── Threat score card ──
      const score = computeThreatScore(all.length, phaCt, closest ? closest.ld : 99);
      const scoreEl = document.getElementById('threat-score');
      const statusEl = document.getElementById('threat-status');
      const descEl = document.getElementById('threat-desc');
      const tsEl = document.getElementById('threat-ts');
      const gaugeEl = document.getElementById('gauge-fill');

      if (scoreEl) scoreEl.textContent = score;
      if (statusEl) {
        statusEl.textContent = score < 20 ? 'Nominal' : score < 40 ? 'Elevated' : score < 65 ? 'Heightened' : 'Critical';
      }
      if (descEl) {
        descEl.textContent = `${all.length} near-Earth objects in the 7-day window, ${phaCt} flagged as potentially hazardous. No confirmed impact events.`;
      }
      if (tsEl) {
        tsEl.innerHTML = `Updated<br>${pad(new Date().getUTCHours())}:${pad(new Date().getUTCMinutes())} UTC`;
      }
      if (gaugeEl) gaugeEl.style.width = `${score}%`;

      // ── NEO compact watchlist ──
      const phaCountEl = document.getElementById('neo-pha-count');
      if (phaCountEl) phaCountEl.textContent = `${phaCt} PHA active`;

      const rowsEl = document.getElementById('neo-rows');
      if (rowsEl) {
        rowsEl.innerHTML = all.slice(0, 6).map(n => {
          const sev = sevClass(n.ld, n.hazardous);
          const sizeStr = n.size > 1000
            ? `${(n.size / 1000).toFixed(1)} km`
            : `${Math.round(n.size)} m`;
          const mass = fmtMass(estimateMassKg(n.size));
          const sbdbUrl = `https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=${encodeURIComponent(n.name)}`;

          return `<div class="neo-row ${sev}">
            <div>
              <div class="neo-name">${esc(n.name)}</div>
              <div class="neo-sub">${n.hazardous ? 'PHA' : 'Nominal'} · ${mass}</div>
              <div class="neo-actions">
                <a class="linkout" href="${sbdbUrl}" target="_blank" rel="noopener noreferrer">JPL ↗</a>
              </div>
            </div>
            <div class="neo-cell">${humanDateUTC(n.date)}</div>
            <div class="neo-cell">${fmtMillionKm(n.ld)}</div>
            <div class="neo-cell">${sizeStr}</div>
          </div>`;
        }).join('');
      }

      // ── Regenerate orrery trajectories with fresh NEO data ──
      if (OW.hooks.neoRefresh) {
        OW.hooks.neoRefresh();
      }

    } catch (e) {
      console.error('NEO fetch error:', e);
      const statusEl = document.getElementById('threat-status');
      if (statusEl) statusEl.textContent = 'Data unavailable';
      const descEl = document.getElementById('threat-desc');
      if (descEl) descEl.textContent = 'NEO feed temporarily unavailable.';
      const rowsEl = document.getElementById('neo-rows');
      if (rowsEl) rowsEl.innerHTML = '<div class="notice">NEO data could not be loaded.</div>';
    }
  }

  fetchNEO();
  setInterval(fetchNEO, 600000); // refresh every 10 min
})();
