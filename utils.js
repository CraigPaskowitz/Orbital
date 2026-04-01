// ==========================================================================
// ORBITAL WATCH — Shared Utilities
// ==========================================================================

const NASA_API_KEY = 'O0cAaVkcI2sIaE3NFOBI7DWfmGOODKSe4W6b1z3k';
const LUNAR_DIST_KM = 384400;

// ── Formatting ──
function pad(n) { return String(n).padStart(2, '0'); }

function formatKm(km) {
  if (km == null) return '—';
  if (km >= 1e6) return (km / 1e6).toFixed(2) + ' M km';
  if (km >= 1e3) return (km / 1e3).toFixed(1) + 'K km';
  return km.toFixed(0) + ' km';
}

function fmtMillionKm(ld) {
  return (ld * LUNAR_DIST_KM / 1e6).toFixed(2) + ' M km';
}

function estimateMassKg(sizeM) {
  const r = sizeM / 2;
  return (4 / 3) * Math.PI * Math.pow(r, 3) * 2600;
}

function fmtMass(kg) {
  if (!isFinite(kg) || kg <= 0) return '—';
  if (kg >= 1e12) return (kg / 1e12).toFixed(2) + ' Tt';
  if (kg >= 1e9) return (kg / 1e9).toFixed(2) + ' Gt';
  if (kg >= 1e6) return (kg / 1e6).toFixed(2) + ' Mt';
  return Math.round(kg).toLocaleString() + ' kg';
}

const MONTH_ABBR = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
function monthAbbr(n) { return MONTH_ABBR[n] || '---'; }

function humanDateUTC(s) {
  const d = new Date(s);
  return monthAbbr(d.getUTCMonth()) + ' ' + d.getUTCDate();
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function dateISO(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// ── Safety ──
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, ch =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])
  );
}

// ── Country / agency ──
function countryFlag(code) {
  if (!code) return '🌍';
  return code.replace(/./g, c =>
    String.fromCodePoint(127397 + c.toUpperCase().charCodeAt(0))
  );
}

function initials(name) {
  return (name || '').split(/\s+/).map(p => (p[0] || '')).join('').slice(0, 2).toUpperCase();
}

function agencyMeta(craft) {
  const c = (craft || '').toLowerCase();
  if (c.includes('soyuz') || c.includes('roscosmos')) return { cls: 'ros', label: 'Roscosmos' };
  if (c.includes('shenzhou') || c.includes('tiangong') || c.includes('china')) return { cls: 'cnsa', label: 'CNSA' };
  if (c.includes('dragon') || c.includes('crew') || c.includes('iss')) return { cls: 'nasa', label: 'NASA' };
  if (c.includes('htv') || c.includes('jaxa')) return { cls: 'jaxa', label: 'JAXA' };
  if (c.includes('esa')) return { cls: 'esa', label: 'ESA' };
  return { cls: 'misc', label: craft || 'Orbital' };
}

function patchUrl(person) {
  return person.profile_image_thumbnail || person.profile_image || person.profile_image_url || null;
}

function providerUrl(agency) {
  if (!agency) return null;
  if (agency.info_url) return agency.info_url;
  if (agency.wiki_url) return agency.wiki_url;
  if (agency.url && !agency.url.includes('/2.2.0/') && !agency.url.includes('/2.3.0/')) return agency.url;
  return null;
}

// ── Color helpers (used by orrery + radar) ──
function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = n => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function lightenColor(hex, amt) {
  const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + amt);
  const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + amt);
  const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + amt);
  return `rgb(${r}, ${g}, ${b})`;
}

function darkenColor(hex, amt) {
  const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - amt);
  const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - amt);
  const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - amt);
  return `rgb(${r}, ${g}, ${b})`;
}

// ── ISS region lookup ──
const ISS_REGIONS = [
  { la0: -10, la1: 30, lo0: -100, lo1: -60, label: 'Over Caribbean Sea' },
  { la0: -5, la1: 10, lo0: -50, lo1: 10, label: 'Over South Atlantic' },
  { la0: 30, la1: 60, lo0: -20, lo1: 40, label: 'Over Europe' },
  { la0: 10, la1: 40, lo0: 40, lo1: 80, label: 'Over Middle East' },
  { la0: 0, la1: 40, lo0: 80, lo1: 130, label: 'Over South Asia' },
  { la0: 20, la1: 55, lo0: 120, lo1: 160, label: 'Over North Pacific' },
  { la0: -50, la1: -20, lo0: -180, lo1: -90, label: 'Over South Pacific' },
  { la0: 25, la1: 55, lo0: -130, lo1: -60, label: 'Over North America' },
  { la0: -35, la1: 15, lo0: -80, lo1: -34, label: 'Over South America' },
  { la0: -40, la1: 40, lo0: 10, lo1: 55, label: 'Over Africa' },
  { la0: -45, la1: -10, lo0: 110, lo1: 155, label: 'Over Australia' },
];

function getRegionLabel(lat, lon) {
  const r = ISS_REGIONS.find(r => lat >= r.la0 && lat <= r.la1 && lon >= r.lo0 && lon <= r.lo1);
  return r ? r.label : 'Over open ocean';
}
