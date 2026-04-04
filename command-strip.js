// ==========================================================================
// ORBITAL WATCH — Command Strip
// Populates the at-a-glance KPI bar from owData.
// Reads data written by iss.js, neo.js, launches.js, crew.js — no API calls.
// ==========================================================================

(function () {

  var elIss    = document.getElementById('cs-iss-val');
  var elCrew   = document.getElementById('cs-crew-val');
  var elNeo    = document.getElementById('cs-neo-val');
  var elThreat = document.getElementById('cs-threat-val');
  var elLaunch = document.getElementById('cs-launch-val');

  if (!elIss || !elCrew || !elNeo || !elThreat || !elLaunch) return;

  var launchTarget = null;

  function setVal(el, text) {
    if (el.textContent !== text) el.textContent = text;
  }

  // ── ISS region ──
  function updateISS() {
    var iss = owData && owData.iss;
    if (!iss || iss.lat === undefined) { setVal(elIss, 'Acquiring…'); return; }
    var region = getRegionLabel(iss.lat, iss.lon).replace('Over ', '');
    setVal(elIss, region);
  }

  // ── Crew count — read from the crew panel's meta element ──
  function updateCrew() {
    var countEl = document.getElementById('crew-count');
    if (!countEl) return;
    var raw = countEl.textContent || '';
    var match = raw.match(/(\d+)/);
    if (match) {
      setVal(elCrew, match[1] + ' aboard');
    } else if (!raw.toLowerCase().includes('load')) {
      setVal(elCrew, raw); // show whatever is there (e.g. "Unavailable")
    }
  }

  // ── NEO summary ──
  function updateNEO() {
    var neo = owData && owData.neo;
    if (!neo || !neo.totalCount) { setVal(elNeo, '—'); return; }
    var hazardous = neo.hazardousCount || 0;
    var text = neo.totalCount + ' total · ' + hazardous + ' hazardous';
    setVal(elNeo, text);
  }

  // ── Threat score ──
  function updateThreat() {
    var scoreEl  = document.getElementById('threat-score');
    var statusEl = document.getElementById('threat-status');
    if (!scoreEl) { setVal(elThreat, '—'); return; }
    var score  = scoreEl.textContent.trim();
    var status = statusEl ? statusEl.textContent.trim() : '';
    if (!score || score === '--') { setVal(elThreat, '—'); return; }
    setVal(elThreat, score + ' / 100 · ' + (status || '—'));
  }

  // ── Launch countdown — vehicle + mission label ──
  function updateLaunch() {
    // Sync launchTarget from owData whenever it is updated
    if (owData && owData.launches && owData.launches.nextNet) {
      var t = new Date(owData.launches.nextNet).getTime();
      if (!isNaN(t)) launchTarget = t;
    }

    if (!launchTarget) { setVal(elLaunch, '—'); return; }

    var delta = launchTarget - Date.now();
    if (delta <= 0) { setVal(elLaunch, 'LIFTOFF'); return; }

    var d = Math.floor(delta / 86400000); delta -= d * 86400000;
    var h = Math.floor(delta / 3600000);  delta -= h * 3600000;
    var m = Math.floor(delta / 60000);    delta -= m * 60000;
    var s = Math.floor(delta / 1000);

    var countdown = d > 0
      ? pad(d) + 'd ' + pad(h) + ':' + pad(m) + ':' + pad(s)
      : pad(h) + ':' + pad(m) + ':' + pad(s);

    // Prefer vehicle name; fall back to mission name; fall back to countdown only
    var launches = owData && owData.launches;
    var label = (launches && launches.nextVehicle)
      ? launches.nextVehicle
      : (launches && launches.nextName ? launches.nextName : null);

    var text = label ? countdown + ' · ' + label : countdown;
    setVal(elLaunch, text);
  }

  // ── Tick ──
  function tick() {
    try { updateISS();    } catch (e) { /* silent */ }
    try { updateCrew();   } catch (e) { /* silent */ }
    try { updateNEO();    } catch (e) { /* silent */ }
    try { updateThreat(); } catch (e) { /* silent */ }
    try { updateLaunch(); } catch (e) { /* silent */ }
  }

  // Wait for data modules to initialise, then tick every second
  // (1s granularity needed for the countdown display)
  setTimeout(function () {
    tick();
    setInterval(tick, 1000);
  }, 2500);

}());
