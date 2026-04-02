// ==========================================================================
// ORBITAL WATCH — Crew in Orbit Module
// Reworked: profile photos, flags, nationality, agency badges, bio links
// Primary: SpaceDevs 2.2.0 astronaut API
// Fallback: corquaid ISS API
// ==========================================================================

(function () {
  // Map nationality strings to ISO 2-letter country codes for flags
  const NATION_TO_CC = {
    'american': 'US', 'canadian': 'CA', 'russian': 'RU',
    'chinese': 'CN', 'japanese': 'JP', 'indian': 'IN',
    'french': 'FR', 'german': 'DE', 'italian': 'IT',
    'british': 'GB', 'australian': 'AU', 'brazilian': 'BR',
    'korean': 'KR', 'israeli': 'IL', 'emirati': 'AE',
    'swedish': 'SE', 'danish': 'DK', 'spanish': 'ES',
    'polish': 'PL', 'czech': 'CZ', 'hungarian': 'HU',
    'belgian': 'BE', 'dutch': 'NL', 'austrian': 'AT',
    'norwegian': 'NO', 'finnish': 'FI', 'turkish': 'TR',
    'saudi': 'SA', 'mexican': 'MX', 'colombian': 'CO',
    'belarusian': 'BY', 'kazakh': 'KZ', 'ukrainian': 'UA',
    'earthling': '', // Starman filter
  };

  // Map agency abbreviations to styled badge classes
  const AGENCY_CLASS = {
    'NASA': 'nasa', 'SpX': 'nasa',
    'RFSA': 'ros', 'RSA': 'ros', 'Roscosmos': 'ros',
    'CNSA': 'cnsa', 'CAS': 'cnsa',
    'JAXA': 'jaxa',
    'ESA': 'esa', 'CNES': 'esa', 'DLR': 'esa', 'ASI': 'esa',
    'CSA': 'nasa', 'ISRO': 'misc', 'KARI': 'misc',
  };

  // Convert 3-letter country codes (from agency) to 2-letter for flags
  const CC3_TO_CC2 = {
    'USA': 'US', 'RUS': 'RU', 'CHN': 'CN', 'JPN': 'JP', 'FRA': 'FR',
    'DEU': 'DE', 'ITA': 'IT', 'GBR': 'GB', 'CAN': 'CA', 'AUS': 'AU',
    'BRA': 'BR', 'KOR': 'KR', 'ISR': 'IL', 'ARE': 'AE', 'IND': 'IN',
    'SAU': 'SA', 'MEX': 'MX', 'BLR': 'BY', 'KAZ': 'KZ', 'UKR': 'UA',
  };

  function getCountryCode(nationality, agencyCountry) {
    // First try nationality string
    if (nationality) {
      const key = nationality.toLowerCase().trim();
      if (NATION_TO_CC[key] !== undefined) return NATION_TO_CC[key];
    }
    // Fall back to agency country code (might be comma-separated for ESA)
    if (agencyCountry) {
      const first = agencyCountry.split(',')[0].trim();
      if (first.length === 2) return first;
      if (CC3_TO_CC2[first]) return CC3_TO_CC2[first];
    }
    return '';
  }

  async function fetchCrew() {
    const list = document.getElementById('crew-list');
    const titleEl = document.getElementById('crew-title');
    const countEl = document.getElementById('crew-count');

    try {
      let crew = [];

      // ── Primary source: SpaceDevs 2.2.0 ──
      try {
        const r = await fetch('https://ll.thespacedevs.com/2.2.0/astronaut/?in_space=true&limit=24&format=json', { cache: 'no-store' });
        if (!r.ok) throw new Error('SpaceDevs ' + r.status);
        const d = await r.json();
        crew = Array.isArray(d.results) ? d.results
          .filter(p => p.type?.name !== 'Non-Human') // Filter out Starman etc.
          .map(p => {
            const natStr = typeof p.nationality === 'string' ? p.nationality : '';
            const agencyCC = p.agency?.country_code || '';
            const cc = getCountryCode(natStr, agencyCC);
            const abbrev = p.agency?.abbrev || '';

            return {
              name: p.name || 'Unknown',
              nationality: natStr || 'Unknown',
              countryCode: cc,
              agencyAbbrev: abbrev,
              agencyName: p.agency?.name || '',
              agencyClass: AGENCY_CLASS[abbrev] || 'misc',
              photo: p.profile_image_thumbnail || p.profile_image || null,
              role: p.type?.name || 'Astronaut',
              wiki: p.wiki || null,
              bio: p.bio || '',
              flightsCount: p.flights_count || 0,
            };
          }) : [];
      } catch (e) {
        console.warn('SpaceDevs crew fetch failed, trying fallback:', e.message);
      }

      // ── Fallback: corquaid ──
      if (!crew.length) {
        try {
          const r2 = await fetch('https://corquaid.github.io/international-space-station-APIs/JSON/people-in-space.json', { cache: 'no-store' });
          const d2 = await r2.json();
          crew = Array.isArray(d2.people) ? d2.people.map(p => {
            const craft = p.craft || 'Orbital';
            let nationality = 'Unknown';
            let cc = '';
            let agencyClass = 'misc';
            let agencyAbbrev = craft;
            if (/soyuz|ros/i.test(craft)) { nationality = 'Russian'; cc = 'RU'; agencyClass = 'ros'; agencyAbbrev = 'RFSA'; }
            else if (/shenzhou|china|tiangong/i.test(craft)) { nationality = 'Chinese'; cc = 'CN'; agencyClass = 'cnsa'; agencyAbbrev = 'CNSA'; }
            else if (/iss|dragon|crew/i.test(craft)) { nationality = 'American'; cc = 'US'; agencyClass = 'nasa'; agencyAbbrev = 'NASA'; }

            return {
              name: p.name || 'Unknown',
              nationality,
              countryCode: cc,
              agencyAbbrev,
              agencyName: '',
              agencyClass,
              photo: null,
              role: 'Astronaut',
              wiki: null,
              bio: '',
              flightsCount: 0,
            };
          }) : [];
        } catch (e2) {
          console.warn('Fallback crew fetch also failed:', e2.message);
        }
      }

      if (!crew.length) throw new Error('No crew data from any source');

      // Update header
      titleEl.textContent = 'Crew in Orbit';
      countEl.textContent = `${crew.length} active`;

      // Last updated indicator
      var cUpd = document.getElementById('crew-updated');
      if (cUpd) {
        var cNow = new Date();
        cUpd.textContent = 'Updated ' + pad(cNow.getUTCHours()) + ':' + pad(cNow.getUTCMinutes()) + ' UTC';
      }

      // Build crew rows
      list.innerHTML = crew.slice(0, 8).map(p => {
        const flag = countryFlag(p.countryCode || '');
        const ini = initials(p.name);

        // Avatar: photo or initials
        const avatarContent = p.photo
          ? `<img src="${esc(p.photo)}" alt="${esc(p.name)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentElement.innerHTML='<span class=avatar-initials>${ini}</span>'">`
          : `<span class="avatar-initials">${ini}</span>`;

        // Agency badge label
        const agencyLabel = p.agencyAbbrev || p.agencyName || 'Orbital';

        // Role description — use nationality + role type
        const roleDesc = p.role !== 'Non-Human' ? p.role : 'Astronaut';

        return `<div class="crew-row">
          <div class="avatar">${avatarContent}</div>
          <div>
            <div class="crew-name">${esc(p.name)}</div>
            <div class="crew-role">${esc(p.nationality)} · ${esc(roleDesc)}</div>
            <div class="crew-meta">
              <span class="country-pill">${flag} ${esc(p.nationality)}</span>
              ${p.wiki ? `<a class="linkout" href="${esc(p.wiki)}" target="_blank" rel="noopener noreferrer">Bio ↗</a>` : ''}
            </div>
          </div>
          <span class="tag ${p.agencyClass}">${esc(agencyLabel)}</span>
        </div>`;
      }).join('');

      // Overflow indicator
      if (crew.length > 8) {
        list.insertAdjacentHTML('beforeend',
          `<div class="crew-row">
            <div class="avatar"><span class="avatar-initials">+${crew.length - 8}</span></div>
            <div>
              <div class="crew-name">Additional crew</div>
              <div class="crew-role">More orbital personnel tracked</div>
            </div>
            <span class="tag misc">Roster</span>
          </div>`
        );
      }
    } catch (e) {
      list.innerHTML = '<div class="notice">Crew roster temporarily unavailable.</div>';
      countEl.textContent = 'Unavailable';
    }
  }

  fetchCrew();
  setInterval(fetchCrew, 900000); // refresh every 15 min
})();
