/**
 * @typedef {Object} BirthdayEntry
 * @property {string} name
 * @property {string} [month] — Harptos-maand (samen met `day`).
 * @property {number} [day] — Dag 1–30 in die Harptos-maand.
 * @property {number} [dayOfYear] — 1–365, o.a. jarige op een feestdag.
 * @property {{month:number, day:number}|string} [gregorian] — Echte kalender: `{ month: 1–12, day: 1–31 }`, of `YYYY-MM-DD` / `M-D` (jaar bij ISO alleen ter documentatie; matching gebruikt maand+dag elk jaar).
 */

import { SETTINGS } from './settings.js';

/** Aantal opeenvolgende snelle clicks op `.title-block` om debug aan/uit te zetten (zelfde gebaar voor toggle). */
const DEBUG_TITLE_TAP_TO_TOGGLE = 5;
/** Reset de click-teller als er langer dan dit geen click volgt (ms). */
const DEBUG_TITLE_TAP_RESET_MS = 2000;

/** Runtime: start gelijk aan SETTINGS.debugCalendar; wijzigen zonder pagina-herlaad via title-block taps. */
let debugCalendarActive = SETTINGS.debugCalendar;

/* Maand-start en feestdagen: Harptos “day of year” 1–365 (1 = 1 Hammer), gelijk aan gangbare FR-tabellen. */
const MONTHS = [
  { name:"Hammer",    days:30, start:1   },
  { name:"Alturiak",  days:30, start:32  },
  { name:"Ches",      days:30, start:62  },
  { name:"Tarsakh",   days:30, start:92  },
  { name:"Mirtul",    days:30, start:123 },
  { name:"Kythorn",   days:30, start:153 },
  { name:"Flamerule", days:30, start:183 },
  { name:"Eleasis",   days:30, start:214 },
  { name:"Eleint",    days:30, start:244 },
  { name:"Marpenoth", days:30, start:275 },
  { name:"Uktar",     days:30, start:305 },
  { name:"Nightal",   days:30, start:336 },
];

const SPECIALS = [
  { name:"Midwinter",         dayOfYear:31,  icon:"❄️",  moon:"New Moon",                  css:"midwinter"       },
  { name:"Greengrass",        dayOfYear:122, icon:"🌿",  moon:"New Moon (Fading)",          css:"greengrass"      },
  { name:"Midsummer",         dayOfYear:213, icon:"🌞",  moon:"Waxing Crescent (Rising)",   css:"midsummer"       },
  { name:"Highharvestide",    dayOfYear:274, icon:"🌾",  moon:"Waxing Crescent",            css:"highharvestide"  },
  { name:"Feast of the Moon", dayOfYear:335, icon:"🌕",  moon:"Waxing Crescent",            css:"feastofthemoon"  },
];

let debugSimulatedDoy = null;

function getEffectiveBirthdays() {
  const base = [...SETTINGS.birthdays];
  if (!debugCalendarActive || !SETTINGS.debugScenario) return base;
  if (SETTINGS.debugScenario === 'midwinter_stack') {
    return base.concat([{ dayOfYear: 31, name: 'Debug jarige Midwinter' }]);
  }
  if (SETTINGS.debugScenario === 'hammer1_stack') {
    return base.concat([{ dayOfYear: 1, name: 'Debug jarige 1 Hammer' }]);
  }
  return base;
}

function getEffectiveMemorialDays() {
  const base = [...SETTINGS.memorialDays];
  if (!debugCalendarActive || !SETTINGS.debugScenario) return base;
  if (SETTINGS.debugScenario === 'midwinter_stack') {
    return base.concat([
      { dayOfYear: 31, title: 'Debug mijlpaal Midwinter', subtitle: 'scenario' },
      { dayOfYear: 31, title: 'Debug herdacht Midwinter', type: 'death', subtitle: 'scenario' },
    ]);
  }
  if (SETTINGS.debugScenario === 'hammer1_stack') {
    return base.concat([
      { dayOfYear: 1, title: 'Debug mijlpaal 1 Hammer', subtitle: 'scenario' },
      { dayOfYear: 1, title: 'Debug herdacht 1 Hammer', type: 'death', subtitle: 'scenario' },
    ]);
  }
  return base;
}

function harptosDoyForMemorial(mem, refYear) {
  if (!mem) return null;
  if (mem.dayOfYear != null) {
    const x = mem.dayOfYear;
    return x >= 1 && x <= 365 ? x : null;
  }
  const g = parseGregorianBirthdayShape(mem.gregorian);
  if (g) return gregorianMDToHarptosDoy(refYear, g.month, g.day);
  if (mem.month != null && mem.day != null) {
    const m = MONTHS.find((x) => x.name === mem.month);
    if (!m) return null;
    if (mem.day < 1 || mem.day > m.days) return null;
    return m.start + mem.day - 1;
  }
  return null;
}

function getMemorialsForDoy(doy, refYear) {
  const y = refYear != null ? refYear : getBirthdayRefYear();
  return getEffectiveMemorialDays().filter((e) => harptosDoyForMemorial(e, y) === doy);
}

function memorialsHasDeath(arr) {
  return arr.some((m) => isMemorialDeath(m));
}

function memorialsHasCelebration(arr) {
  return arr.some((m) => !isMemorialDeath(m));
}

function isMemorialDeath(mem) {
  return !!(mem && mem.type === 'death');
}

/** Harptos weergave "7 Uktar" voor jaardag 1–365. */
function harptosLabelForDoy(doy) {
  const d = getDndDate(doy);
  if (!d || d.special) return d?.special?.name ?? '';
  return `${d.day} ${d.month}`;
}

/** 30-daagse maancyclus; (doy−1) mod 30 komt overeen met de officiële Harptos-rij per dag. */
const LUNAR_CYCLE_30 = [
  "New Moon","New Moon (Fading)","Waxing Crescent (Rising)","Waxing Crescent","Waxing Crescent",
  "Waxing Crescent (Fading)","First Quarter (Rising)","First Quarter","First Quarter (Fading)",
  "Waxing Gibbous (Rising)","Waxing Gibbous","Waxing Gibbous","Waxing Gibbous (Fading)",
  "Full Moon (Rising)","Full Moon","Full Moon (Fading)","Waning Gibbous (Rising)","Waning Gibbous",
  "Waning Gibbous","Waning Gibbous (Fading)","Last Quarter (Rising)","Last Quarter",
  "Last Quarter (Fading)","Waning Crescent (Rising)","Waning Crescent","Waning Crescent",
  "Waning Crescent (Fading)","Dark Moon (Rising)","Dark Moon","Dark Moon (Fading)",
];

function getMoonPhase(doy) {
  if (doy < 1 || doy > 365) return LUNAR_CYCLE_30[0];
  return LUNAR_CYCLE_30[(doy - 1) % 30];
}

function moonEmoji(p) {
  p = (p||'').toLowerCase();
  if (p.includes("full moon"))       return "🌕";
  if (p.includes("waxing gibbous"))  return "🌔";
  if (p.includes("first quarter"))   return "🌓";
  if (p.includes("waxing crescent")) return "🌒";
  if (p.includes("new moon"))        return "🌑";
  if (p.includes("waning crescent")) return "🌘";
  if (p.includes("last quarter"))    return "🌗";
  if (p.includes("waning gibbous"))  return "🌖";
  return "🌑";
}

/** Basis-maanstijl + optioneel moon-transition: dagen met "(Rising)" / "(Fading)" subtieler. */
function getDayClass(phase) {
  const p = (phase||'').toLowerCase();
  let base = '';
  if (p.startsWith("full moon")) base = "full-moon";
  else if (p.startsWith("new moon")) base = "new-moon";
  else if (p.startsWith("dark moon")) base = "dark-moon";
  else return "";
  const transition = /\([^)]+\)/.test(phase) ? " moon-transition" : "";
  return base + transition;
}

/** Kalenderdatum (Y, maand 1–12, dag) van `date` in de gegeven IANA-timezone. */
function getYMDInTimeZone(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const y = +parts.find((p) => p.type === 'year').value;
  const mo = +parts.find((p) => p.type === 'month').value;
  const d = +parts.find((p) => p.type === 'day').value;
  return { year: y, month: mo, day: d };
}

/** Gregoriaanse jaardag 1–366 voor jaar `year`, maand 1–12, dag 1–31. */
function getDayOfYearFromYMD(year, month, day) {
  const ml = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0) ml[1] = 29;
  let n = day;
  for (let i = 0; i < month - 1; i++) n += ml[i];
  return n;
}

function getDayOfYearInTimeZone(date, timeZone) {
  const { year, month, day } = getYMDInTimeZone(date, timeZone);
  return getDayOfYearFromYMD(year, month, day);
}

/** Jaar waarin Gregoriaanse verjaardagen naar Harptos-DOY worden omgezet (zelfde als `refYear` in de renderer). */
function getBirthdayRefYear() {
  return getYMDInTimeZone(new Date(), SETTINGS.displayTimeZone).year;
}

/**
 * @param {{ month:number, day:number }|string|null|undefined} g
 * @returns {{ month:number, day:number }|null}
 */
function parseGregorianBirthdayShape(g) {
  if (g == null) return null;
  if (typeof g === 'string') {
    const iso = g.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) return { month: +iso[2], day: +iso[3] };
    const md = g.trim().match(/^(\d{1,2})\s*-\s*(\d{1,2})$/);
    if (md) return { month: +md[1], day: +md[2] };
    return null;
  }
  if (typeof g === 'object' && g.month != null && g.day != null)
    return { month: +g.month, day: +g.day };
  return null;
}

/** Harptos-DOY 1–365 voor een geldige Gregoriaanse datum in `refYear`, of null. */
function gregorianMDToHarptosDoy(refYear, month, day) {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const t = Date.UTC(refYear, month - 1, day, 12, 0, 0);
  const d = new Date(t);
  if (d.getUTCFullYear() !== refYear || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  const doy = getDayOfYearFromYMD(refYear, month, day);
  return doy <= 365 ? doy : null;
}

function harptosDoyForBirthday(b, refYear) {
  if (b.dayOfYear != null) {
    const x = b.dayOfYear;
    return x >= 1 && x <= 365 ? x : null;
  }
  const g = parseGregorianBirthdayShape(b.gregorian);
  if (g) return gregorianMDToHarptosDoy(refYear, g.month, g.day);
  if (b.month != null && b.day != null) {
    const m = MONTHS.find((x) => x.name === b.month);
    if (!m) return null;
    if (b.day < 1 || b.day > m.days) return null;
    return m.start + b.day - 1;
  }
  return null;
}

/** Gregoriaanse datum voor Harptos-DOY in `year`; UTC-middag zodat `Intl` met timeZone stabiel blijft. */
function doyToRealDate(doy, year) {
  return new Date(Date.UTC(year, 0, doy, 12, 0, 0));
}

function isGregorianLeapYear(y) {
  if (y % 400 === 0) return true;
  if (y % 100 === 0) return false;
  return y % 4 === 0;
}

/** Chronologische volgorde: normale maanden afgewisseld met 1-dags feesten (Harptos DOY). */
function buildYearTimeline() {
  const sorted = [...SPECIALS].sort((a, b) => a.dayOfYear - b.dayOfYear);
  const segments = [];
  let i = 0;
  for (const m of MONTHS) {
    while (i < sorted.length && sorted[i].dayOfYear < m.start) {
      segments.push({ type: 'festival', special: sorted[i] });
      i++;
    }
    segments.push({ type: 'month', month: m });
  }
  while (i < sorted.length) {
    segments.push({ type: 'festival', special: sorted[i] });
    i++;
  }
  return segments;
}

function getDndDate(doy) {
  for (const s of SPECIALS) if (s.dayOfYear === doy) return { special:s, month:null, day:null, moon:s.moon };
  for (const m of MONTHS) if (doy >= m.start && doy < m.start + m.days)
    return { special:null, month:m.name, day:doy - m.start + 1, moon:getMoonPhase(doy) };
  return null;
}

function getActiveDoy() {
  if (debugCalendarActive && debugSimulatedDoy != null)
    return Math.min(Math.max(1, debugSimulatedDoy), 365);
  return Math.min(getDayOfYearInTimeZone(new Date(), SETTINGS.displayTimeZone), 365);
}

function getActiveGregorianDate() {
  const tz = SETTINGS.displayTimeZone;
  const { year, month, day } = getYMDInTimeZone(new Date(), tz);
  if (debugCalendarActive && debugSimulatedDoy != null)
    return doyToRealDate(debugSimulatedDoy, year);
  const doy = getDayOfYearFromYMD(year, month, day);
  return doyToRealDate(doy, year);
}

/** Gregoriaanse datumtekst in nl-NL, altijd in SETTINGS.displayTimeZone. */
function formatGregorianInDisplayTz(date, intlOptions) {
  return new Intl.DateTimeFormat('nl-NL', { timeZone: SETTINGS.displayTimeZone, ...intlOptions }).format(date);
}

/**
 * @param {number} doy
 * @param {number} [refYear] — default: zichtjaar (Amsterdam) voor Gregoriaanse entries
 */
function getBirthdayForDoy(doy, refYear) {
  const y = refYear != null ? refYear : getBirthdayRefYear();
  for (const b of getEffectiveBirthdays()) {
    if (harptosDoyForBirthday(b, y) === doy) return b;
  }
  return null;
}

function birthdayListDateLabel(b, doy) {
  if (b.gregorian) return harptosLabelForDoy(doy);
  if (b.dayOfYear != null) {
    const dnd = getDndDate(doy);
    return dnd && dnd.special ? dnd.special.name : harptosLabelForDoy(doy);
  }
  return `${b.day} ${b.month}`;
}

function wrapDoy1to365(doy) {
  const x = ((doy - 1) % 365 + 365) % 365;
  return x + 1;
}

function daysUntil(fromDoy, targetDoy) {
  const a = wrapDoy1to365(fromDoy);
  const b = wrapDoy1to365(targetDoy);
  const d = b - a;
  return d >= 0 ? d : (365 + d);
}

function describeInDays(d) {
  if (d === 0) return 'vandaag';
  if (d === 1) return 'morgen';
  return `over ${d} dagen`;
}

function findNextBirthdayOrMemorial(fromDoy, refYear) {
  const start = wrapDoy1to365(fromDoy);
  for (let delta = 0; delta < 365; delta++) {
    const doy = wrapDoy1to365(start + delta);
    const bd = getBirthdayForDoy(doy, refYear);
    const mems = getMemorialsForDoy(doy, refYear);
    if (!bd && (!mems || mems.length === 0)) continue;

    const labelParts = [];
    if (bd) labelParts.push(`🎂 ${bd.name}`);
    if (mems && mems.length) {
      const memLabel = mems
        .map((m) => (isMemorialDeath(m) ? `🕯 ${m.title}` : `✦ ${m.title}`))
        .join(' · ');
      labelParts.push(memLabel);
    }

    return {
      doy,
      deltaDays: delta,
      whenText: describeInDays(delta),
      harptosLabel: harptosLabelForDoy(doy),
      label: labelParts.join(' · '),
    };
  }
  return null;
}

function findNextMoonPhase(fromDoy, phasePrefixLower) {
  const start = wrapDoy1to365(fromDoy);
  for (let delta = 0; delta < 365; delta++) {
    const doy = wrapDoy1to365(start + delta);
    const phase = getMoonPhase(doy);
    if ((phase || '').toLowerCase().startsWith(phasePrefixLower)) {
      return {
        doy,
        deltaDays: delta,
        whenText: describeInDays(delta),
        phase,
      };
    }
  }
  return null;
}

function renderNextUpUI({ harptosDoy, refYear }) {
  const el = document.getElementById('next-up');
  if (!el) return;

  const nextEvent = findNextBirthdayOrMemorial(harptosDoy, refYear);
  const nextFull = findNextMoonPhase(harptosDoy, 'full moon');

  const fullExact = nextFull ? findNextExactMoonPhase(harptosDoy, 'full moon') : null;

  const left = nextEvent
    ? `<span class="next-up-item"><span class="next-up-label">Eerstvolgende</span> <span class="next-up-value">${nextEvent.label}</span> <span class="next-up-when">${nextEvent.harptosLabel} · ${nextEvent.whenText}</span></span>`
    : '';

  const right = fullExact
    ? `<span class="next-up-item"><span class="next-up-label">Volgende Full Moon</span> <span class="next-up-value">🌕</span> <span class="next-up-when">${harptosLabelForDoy(fullExact.doy)} · ${fullExact.whenText}</span></span>`
    : '';

  if (!left && !right) {
    el.innerHTML = '';
    return;
  }

  el.innerHTML = `
    <div class="next-up-inline" role="note" aria-label="Volgende Full Moon en eerstvolgende events">
      ${right}
      ${left && right ? `<span class="next-up-sep" aria-hidden="true">•</span>` : ''}
      ${left}
    </div>
  `;
}

function findNextExactMoonPhase(fromDoy, exactLower) {
  const start = wrapDoy1to365(fromDoy);
  for (let delta = 0; delta < 365; delta++) {
    const doy = wrapDoy1to365(start + delta);
    const phase = (getMoonPhase(doy) || '').toLowerCase();
    if (phase === exactLower) {
      return {
        doy,
        deltaDays: delta,
        whenText: describeInDays(delta),
      };
    }
  }
  return null;
}

function updateDebugBar(harptosDoy) {
  const wrap = document.getElementById('calendar-debug-bar-wrap');
  if (!wrap) return;
  if (!debugCalendarActive) {
    wrap.innerHTML = '';
    return;
  }
  const sim = debugSimulatedDoy != null;
  const scen = SETTINGS.debugScenario
    ? ` · scenario: <strong>${SETTINGS.debugScenario}</strong> (extra jarige + memorials)`
    : '';
  wrap.innerHTML = `
    <div class="calendar-debug-bar">
      <span>Debugmodus: klik een feestkaart in de jaarlijst of een verjaardag om die als actieve dag te tonen.${scen}</span>
      <div class="debug-actions">
        ${sim ? `<button type="button" id="debug-calendar-reset">Terug naar echte datum</button>` : ''}
        <span style="opacity:0.85;">Actief: dag ${harptosDoy}${sim ? ' (simulatie)' : ''}</span>
      </div>
    </div>`;
  const btn = document.getElementById('debug-calendar-reset');
  if (btn) btn.addEventListener('click', () => { debugSimulatedDoy = null; renderCalendar(); });
}

let festFxRafId = null;
let festFxResizeBound = false;
let festFxCurrentSlug = null;

const FEST_FX_SLUGS = [
  'midwinter',
  'greengrass',
  'midsummer',
  'highharvestide',
  'feastofthemoon',
  'memorial-celebration',
  'memorial-mourning',
];

function stopFestFx() {
  festFxCurrentSlug = null;
  if (festFxRafId != null) {
    cancelAnimationFrame(festFxRafId);
    festFxRafId = null;
  }
  const fc = document.getElementById('fest-fx-canvas');
  if (fc) {
    const x = fc.getContext('2d');
    if (x) x.clearRect(0, 0, fc.width, fc.height);
  }
}

function startFestFx(slug) {
  if (!slug || !FEST_FX_SLUGS.includes(slug)) {
    stopFestFx();
    return;
  }
  stopFestFx();

  const canvas = document.getElementById('fest-fx-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  festFxCurrentSlug = slug;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const W = canvas.width;
  const H = canvas.height;
  let frame = 0;
  let particles;

  function rnd(a, b) { return a + Math.random() * (b - a); }

  if (slug === 'midwinter') {
    particles = Array.from({ length: 36 }, () => ({
      x: rnd(0, W), y: rnd(-H, H), r: rnd(1.8, 3.2),
      vy: rnd(0.35, 0.85), vx: rnd(-0.15, 0.15),
      rot: rnd(0, Math.PI * 2), rotSp: rnd(-0.018, 0.018),
      phase: rnd(0, Math.PI * 2),
    }));
  } else if (slug === 'greengrass') {
    const greens = ['#4caf50', '#66bb6a', '#81c784', '#2e7d32', '#43a047'];
    particles = Array.from({ length: 32 }, () => ({
      x: rnd(0, W), y: rnd(0, H),
      sc: rnd(0.7, 1.2), rot: rnd(0, Math.PI * 2),
      vr: rnd(-0.025, 0.025),
      vx: rnd(-0.6, 0.6), vy: rnd(0.2, 0.9),
      phase: rnd(0, Math.PI * 2),
      col: greens[Math.floor(Math.random() * greens.length)],
    }));
  } else if (slug === 'midsummer') {
    /* Los van de felle body-zon: source-over + hogere alpha; stofdeeltjes voor zicht op donkere randen */
    particles = {
      glows: Array.from({ length: 14 }, () => ({
        x: rnd(-120, W + 80), y: rnd(-40, H * 0.92),
        r: rnd(50, 115),
        vx: rnd(0.18, 0.5), vy: rnd(0.06, 0.24),
        pulse: rnd(0, Math.PI * 2), pulseSp: rnd(0.009, 0.018),
        a: rnd(0.16, 0.32),
      })),
      motes: Array.from({ length: 48 }, () => ({
        x: rnd(0, W), y: rnd(0, H),
        r: rnd(0.7, 3.2),
        vx: rnd(-0.45, 0.45), vy: rnd(-0.2, 0.5),
        tw: rnd(0, Math.PI * 2),
      })),
    };
  } else if (slug === 'highharvestide') {
    particles = Array.from({ length: 30 }, () => {
      const t = Math.random();
      let kind = 'foam';
      if (t < 0.33) kind = 'bread';
      else if (t < 0.66) kind = 'hop';
      return {
        x: rnd(0, W), y: rnd(-H * 0.3, H),
        kind,
        vx: rnd(-0.4, 0.4), vy: rnd(0.3, 0.75), rot: rnd(0, Math.PI * 2), vr: rnd(-0.04, 0.04),
        s: rnd(0.6, 1.1),
        phase: rnd(0, Math.PI * 2),
      };
    });
  } else if (slug === 'memorial-celebration') {
    const sparks = [];
    function spawnMemorialFireworkBurst(cx, cy) {
      const n = 56 + Math.floor(Math.random() * 48);
      for (let i = 0; i < n; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 1.6 + Math.random() * 5.2;
        const t = Math.random();
        let rgb;
        if (t < 0.28) rgb = [255, 224, 130];
        else if (t < 0.48) rgb = [255, 140, 70];
        else if (t < 0.62) rgb = [255, 95, 130];
        else if (t < 0.76) rgb = [255, 250, 235];
        else if (t < 0.88) rgb = [190, 205, 255];
        else rgb = [110, 215, 255];
        sparks.push({
          x: cx,
          y: cy,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd - rnd(0.4, 1.4),
          life: 1,
          decay: 0.0055 + Math.random() * 0.011,
          r: 2.2 + Math.random() * 4,
          rgb,
        });
      }
    }
    for (let k = 0; k < 7; k++) {
      spawnMemorialFireworkBurst(rnd(W * 0.1, W * 0.9), rnd(H * 0.05, H * 0.52));
    }
    particles = {
      sparks,
      burstTimer: 32 + Math.floor(Math.random() * 28),
      spawnBurst: spawnMemorialFireworkBurst,
    };
  } else if (slug === 'memorial-mourning') {
    particles = Array.from({ length: 24 }, () => ({
      x: rnd(0, W), y: rnd(-H * 0.5, H * 0.85),
      r: rnd(0.75, 2.1),
      vy: rnd(0.22, 0.58), vx: rnd(-0.22, 0.22),
      a: rnd(0.1, 0.26),
      tw: rnd(0, Math.PI * 2),
    }));
  } else {
    particles = {
      glows: Array.from({ length: 3 }, () => ({
        x: rnd(W * 0.2, W * 0.85), y: rnd(H * 0.1, H * 0.45),
        r: rnd(120, 220), phase: rnd(0, Math.PI * 2), phSp: rnd(0.008, 0.015),
        dx: rnd(-0.15, 0.15), dy: rnd(-0.1, 0.1),
      })),
      sparks: Array.from({ length: 28 }, () => ({
        x: rnd(0, W), y: rnd(0, H),
        vy: rnd(-0.15, 0.35), vx: rnd(-0.25, 0.25),
        tw: rnd(0, Math.PI * 2), size: rnd(0.8, 1.8),
      })),
    };
  }

  function drawSnowflake(px, py, pr, prot) {
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(prot);
    ctx.strokeStyle = 'rgba(232, 248, 255, 0.78)';
    ctx.lineWidth = 0.85;
    const s = pr * 2.8;
    for (let i = 0; i < 6; i++) {
      ctx.rotate(Math.PI / 3);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -s);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.45);
      ctx.lineTo(-s * 0.22, -s * 0.65);
      ctx.moveTo(0, -s * 0.45);
      ctx.lineTo(s * 0.22, -s * 0.65);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawLeaf(px, py, sc, rot, col) {
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(rot);
    ctx.scale(sc, sc);
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.bezierCurveTo(11, -2, 11, 6, 0, 10);
    ctx.bezierCurveTo(-11, 6, -11, -2, 0, -9);
    ctx.fill();
    ctx.strokeStyle = 'rgba(20,60,20,0.35)';
    ctx.lineWidth = 0.6;
    ctx.stroke();
    ctx.restore();
  }

  function draw() {
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    frame++;

    if (slug === 'midwinter') {
      particles.forEach((p) => {
        drawSnowflake(p.x, p.y, p.r, p.rot);
        p.y += p.vy;
        p.x += p.vx + Math.sin(frame * 0.018 + p.phase) * 0.5;
        p.rot += p.rotSp;
        if (p.y > h + 15) {
          p.y = -12;
          p.x = Math.random() * w;
        }
      });
    } else if (slug === 'greengrass') {
      particles.forEach((p) => {
        drawLeaf(p.x, p.y, p.sc, p.rot, p.col);
        p.rot += p.vr;
        p.x += p.vx * 0.08 + Math.sin(frame * 0.03 + p.phase) * 0.35;
        p.y += p.vy * 0.06;
        if (p.x < -30) p.x = w + 20;
        if (p.x > w + 30) p.x = -20;
        if (p.y > h + 20) p.y = -20;
        if (p.y < -30) p.y = h + 10;
      });
    } else if (slug === 'midsummer') {
      const { glows, motes } = particles;
      glows.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.pulse += p.pulseSp;
        const alpha = p.a * (0.78 + 0.22 * Math.sin(p.pulse));
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        g.addColorStop(0, `rgba(255, 252, 230, ${Math.min(0.55, alpha * 0.95)})`);
        g.addColorStop(0.38, `rgba(255, 215, 110, ${alpha * 0.5})`);
        g.addColorStop(0.72, `rgba(255, 150, 40, ${alpha * 0.22})`);
        g.addColorStop(1, 'rgba(160, 70, 10, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        if (p.x > w + p.r) p.x = -p.r * 0.8;
        if (p.y > h + p.r) p.y = -p.r * 0.8;
      });
      motes.forEach((m) => {
        const tw = 0.45 + 0.55 * Math.sin(frame * 0.055 + m.tw);
        ctx.fillStyle = `rgba(255, 250, 220, ${0.28 + 0.52 * tw})`;
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
        ctx.fill();
        m.x += m.vx;
        m.y += m.vy;
        if (m.x < -5) m.x = w + 5;
        if (m.x > w + 5) m.x = -5;
        if (m.y < -5) m.y = h + 5;
        if (m.y > h + 5) m.y = -5;
      });
    } else if (slug === 'highharvestide') {
      particles.forEach((p) => {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = 0.72;
        if (p.kind === 'bread') {
          ctx.fillStyle = '#8d6e63';
          ctx.fillRect(-5 * p.s, -2 * p.s, 10 * p.s, 5 * p.s);
        } else if (p.kind === 'hop') {
          ctx.fillStyle = '#7cb342';
          ctx.beginPath();
          ctx.arc(0, 0, 3.5 * p.s, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = '#ffb74d';
          ctx.beginPath();
          ctx.arc(0, 0, 4 * p.s, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.35)';
          ctx.beginPath();
          ctx.arc(-1 * p.s, -1 * p.s, 1.5 * p.s, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
        p.y += p.vy;
        p.x += p.vx + Math.sin(frame * 0.025 + p.phase) * 0.4;
        p.rot += p.vr;
        if (p.y > h + 20) {
          p.y = -15;
          p.x = Math.random() * w;
        }
      });
    } else if (slug === 'memorial-celebration') {
      const fw = particles;
      const { sparks, spawnBurst } = fw;
      fw.burstTimer -= 1;
      if (fw.burstTimer <= 0 && sparks.length < 320) {
        fw.burstTimer = 36 + Math.floor(Math.random() * 52);
        spawnBurst(rnd(w * 0.08, w * 0.92), rnd(h * 0.04, h * 0.5));
      }
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.x += s.vx;
        s.y += s.vy;
        s.vy += 0.085;
        s.vx *= 0.991;
        s.life -= s.decay;
        if (s.life <= 0) {
          sparks.splice(i, 1);
          continue;
        }
        const [r0, g0, b0] = s.rgb;
        const core = s.life * s.life;
        const a = Math.min(1, s.life * 0.92);
        const rad = Math.max(0.6, s.r * (0.35 + 0.65 * s.life));
        const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, rad * 2.2);
        g.addColorStop(0, `rgba(255,255,255,${a * 0.55 * core})`);
        g.addColorStop(0.35, `rgba(${r0},${g0},${b0},${a * 0.9})`);
        g.addColorStop(0.75, `rgba(${r0},${g0},${b0},${a * 0.35})`);
        g.addColorStop(1, `rgba(${r0},${g0},${b0},0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(s.x, s.y, rad * 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    } else if (slug === 'memorial-mourning') {
      particles.forEach((p) => {
        const pulse = 0.72 + 0.28 * Math.sin(frame * 0.028 + p.tw);
        ctx.fillStyle = `rgba(42, 42, 50, ${p.a * pulse})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        p.y += p.vy;
        p.x += p.vx + Math.sin(frame * 0.014 + p.tw) * 0.28;
        if (p.y > h + 10) {
          p.y = -8;
          p.x = Math.random() * w;
        }
      });
    } else {
      const { glows, sparks } = particles;
      ctx.save();
      glows.forEach((g) => {
        g.phase += g.phSp;
        g.x += g.dx;
        g.y += g.dy;
        const pulse = 0.55 + 0.2 * Math.sin(g.phase);
        const radGr = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, g.r);
        radGr.addColorStop(0, `rgba(230, 225, 255, ${0.14 * pulse})`);
        radGr.addColorStop(0.4, `rgba(180, 170, 230, ${0.06 * pulse})`);
        radGr.addColorStop(1, 'rgba(100, 80, 160, 0)');
        ctx.fillStyle = radGr;
        ctx.beginPath();
        ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2);
        ctx.fill();
        if (g.x < -g.r) g.x = w + g.r * 0.5;
        if (g.x > w + g.r) g.x = -g.r * 0.5;
        if (g.y < -g.r) g.y = h * 0.3;
        if (g.y > h) g.y = -g.r * 0.3;
      });
      ctx.restore();
      sparks.forEach((s) => {
        const tw = 0.35 + 0.65 * Math.sin(frame * 0.04 + s.tw);
        ctx.fillStyle = `rgba(245, 242, 255, ${0.25 + 0.5 * tw})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
        s.y += s.vy;
        s.x += s.vx + Math.sin(frame * 0.02 + s.tw) * 0.2;
        if (s.y > h + 5) s.y = -5;
        if (s.y < -5) s.y = h + 5;
        if (s.x < 0) s.x = w;
        if (s.x > w) s.x = 0;
      });
    }

    festFxRafId = requestAnimationFrame(draw);
  }

  draw();

  if (!festFxResizeBound) {
    festFxResizeBound = true;
    window.addEventListener('resize', () => {
      if (festFxCurrentSlug) startFestFx(festFxCurrentSlug);
    });
  }
}

let confettiRafId = null;
let confettiResizeBound = false;

function stopConfetti() {
  if (confettiRafId != null) {
    cancelAnimationFrame(confettiRafId);
    confettiRafId = null;
  }
  const canvas = document.getElementById('confetti-canvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

function startConfetti() {
  stopConfetti();
  const canvas = document.getElementById('confetti-canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const colors = ['#f5e27a','#daa520','#8b1a1a','#c0392b','#f4e8c1','#b8860b','#fff'];
  const pieces = Array.from({ length: 120 }, () => ({
    x: Math.random() * canvas.width, y: Math.random() * -canvas.height,
    r: Math.random() * 6 + 3, d: Math.random() * 80 + 20,
    color: colors[Math.floor(Math.random() * colors.length)],
    tiltAngle: 0, tiltSpeed: Math.random() * 0.1 + 0.05,
    speed: Math.random() * 2 + 1, shape: Math.random() > 0.5 ? 'rect' : 'circle',
  }));
  let frame = 0;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pieces.forEach(p => {
      ctx.beginPath();
      ctx.fillStyle = p.color;
      if (p.shape === 'rect') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.tiltAngle);
        ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r);
        ctx.restore();
      } else {
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      p.tiltAngle += p.tiltSpeed;
      p.y += p.speed;
      p.x += Math.sin(frame / 20 + p.d) * 1.5;
      if (p.y > canvas.height) { p.y = -10; p.x = Math.random() * canvas.width; }
    });
    frame++;
    confettiRafId = requestAnimationFrame(draw);
  }
  draw();
  if (!confettiResizeBound) {
    confettiResizeBound = true;
    window.addEventListener('resize', () => {
      const c = document.getElementById('confetti-canvas');
      if (c) { c.width = window.innerWidth; c.height = window.innerHeight; }
    });
  }
}

const FEST_BODY_CLASSES = ['fest-theme-midwinter', 'fest-theme-greengrass', 'fest-theme-midsummer', 'fest-theme-highharvestide', 'fest-theme-feastofthemoon'];

/** Midden-ornamenten op boven/onder/zijkanten van de garland-SVG */
const GARLAND_ORNAMENT_BY_FEST = {
  '': '❋',
  midwinter: '❄',
  greengrass: '❀',
  midsummer: '☀',
  highharvestide: '✦',
  feastofthemoon: '☽',
};
/** Hoeken van het kader */
const GARLAND_CORNER_BY_FEST = {
  '': '⚜',
  midwinter: '❄',
  greengrass: '⚜',
  midsummer: '✶',
  highharvestide: '⚜',
  feastofthemoon: '☽',
};

function applyBodyFestivalTheme(todayDnd, todayBd, todayMemorials) {
  FEST_BODY_CLASSES.forEach((c) => document.body.classList.remove(c));
  document.body.classList.remove('birthday-theme');
  document.body.classList.remove('memorial-theme');
  document.body.classList.remove('memorial-mourning-theme');

  const festSlug = (todayDnd && todayDnd.special && todayDnd.special.css) ? todayDnd.special.css : '';
  const svg = document.querySelector('.garland-svg');

  if (festSlug) {
    document.body.classList.add('fest-theme-' + festSlug);
    if (svg) {
      svg.setAttribute('data-garland', festSlug);
      const o = GARLAND_ORNAMENT_BY_FEST[festSlug] ?? GARLAND_ORNAMENT_BY_FEST[''];
      const c = GARLAND_CORNER_BY_FEST[festSlug] ?? GARLAND_CORNER_BY_FEST[''];
      svg.querySelectorAll('.gar-ornament').forEach((el) => { el.textContent = o; });
      svg.querySelectorAll('.gar-corner').forEach((el) => { el.textContent = c; });
    }
  } else if (todayBd) {
    document.body.classList.add('birthday-theme');
    if (svg) {
      svg.setAttribute('data-garland', 'birthday');
      svg.querySelectorAll('.gar-ornament').forEach((el) => { el.textContent = '🎂'; });
      svg.querySelectorAll('.gar-corner').forEach((el) => { el.textContent = '🎈'; });
    }
  } else if (memorialsHasCelebration(todayMemorials)) {
    document.body.classList.add('memorial-theme');
    if (svg) {
      svg.setAttribute('data-garland', 'memorial');
      svg.querySelectorAll('.gar-ornament').forEach((el) => { el.textContent = '✦'; });
      svg.querySelectorAll('.gar-corner').forEach((el) => { el.textContent = '✦'; });
    }
  } else if (memorialsHasDeath(todayMemorials)) {
    document.body.classList.add('memorial-mourning-theme');
    if (svg) {
      svg.setAttribute('data-garland', 'memorial-mourning');
      svg.querySelectorAll('.gar-ornament').forEach((el) => { el.textContent = '🕯'; });
      svg.querySelectorAll('.gar-corner').forEach((el) => { el.textContent = '🕯'; });
    }
  } else if (svg) {
    svg.setAttribute('data-garland', '');
    const o = GARLAND_ORNAMENT_BY_FEST[''];
    const c = GARLAND_CORNER_BY_FEST[''];
    svg.querySelectorAll('.gar-ornament').forEach((el) => { el.textContent = o; });
    svg.querySelectorAll('.gar-corner').forEach((el) => { el.textContent = c; });
  }
}

function getMoonAccentVars(moonPhase) {
  const p = (moonPhase || '').toLowerCase();

  // Defaults: warm parchment-gold
  let accent = 'rgba(184, 134, 11, 0.55)';
  let halo = 'rgba(240, 208, 96, 0.16)';

  if (p.startsWith('full moon')) {
    accent = 'rgba(240, 208, 96, 0.62)';
    halo = 'rgba(240, 208, 96, 0.22)';
  } else if (p.startsWith('new moon') || p.startsWith('dark moon')) {
    accent = 'rgba(130, 160, 210, 0.55)';
    halo = 'rgba(140, 180, 255, 0.14)';
  } else if (p.includes('quarter')) {
    accent = 'rgba(212, 112, 10, 0.52)';
    halo = 'rgba(255, 170, 60, 0.12)';
  } else if (p.includes('waxing') || p.includes('waning')) {
    accent = 'rgba(196, 162, 56, 0.52)';
    halo = 'rgba(240, 208, 96, 0.12)';
  }

  return { accent, halo };
}

function getSeasonKeyFromDndMonth(monthName) {
  // Subtle / lore-friendly seasons: coarse mapping.
  const m = (monthName || '').toLowerCase();
  if (['hammer', 'alturiak', 'nightal'].includes(m)) return 'winter';
  if (['ches', 'tarsakh', 'mirtul'].includes(m)) return 'spring';
  if (['kythorn', 'flamerule', 'eleasis'].includes(m)) return 'summer';
  if (['eleint', 'marpenoth', 'uktar'].includes(m)) return 'autumn';
  return 'neutral';
}

function getSeasonKeyForDoy(doy) {
  const d = getDndDate(doy);
  if (d && !d.special) return getSeasonKeyFromDndMonth(d.month);
  // For specials: pick the season of the most recent month segment.
  const x = wrapDoy1to365(doy);
  let last = MONTHS[0];
  for (const m of MONTHS) {
    if (m.start <= x) last = m;
  }
  return getSeasonKeyFromDndMonth(last.name);
}

function getSeasonWashVars(seasonKey) {
  switch (seasonKey) {
    case 'winter':
      return {
        washA: 'rgba(120, 210, 255, 0.07)', washB: 'rgba(20, 40, 80, 0.03)',
        palette: ['rgba(120, 210, 255, 0.55)', 'rgba(170, 230, 255, 0.52)', 'rgba(90, 150, 230, 0.5)'],
      };
    case 'spring':
      return {
        washA: 'rgba(80, 220, 120, 0.07)', washB: 'rgba(20, 60, 30, 0.03)',
        palette: ['rgba(80, 220, 120, 0.55)', 'rgba(160, 245, 175, 0.5)', 'rgba(50, 180, 90, 0.52)'],
      };
    case 'summer':
      return {
        washA: 'rgba(255, 200, 80, 0.08)', washB: 'rgba(80, 30, 0, 0.03)',
        palette: ['rgba(255, 200, 80, 0.6)', 'rgba(240, 208, 96, 0.55)', 'rgba(212, 112, 10, 0.5)'],
      };
    case 'autumn':
      return {
        washA: 'rgba(212, 112, 10, 0.08)', washB: 'rgba(60, 20, 0, 0.03)',
        palette: ['rgba(212, 112, 10, 0.6)', 'rgba(255, 160, 50, 0.52)', 'rgba(160, 70, 10, 0.5)'],
      };
    default:
      return {
        washA: 'rgba(184, 134, 11, 0.06)', washB: 'rgba(26, 10, 0, 0.02)',
        palette: ['rgba(184, 134, 11, 0.55)', 'rgba(240, 208, 96, 0.5)', 'rgba(196, 162, 56, 0.5)'],
      };
  }
}

const TENDAY_RUNES = ['ᚠ','ᚢ','ᚦ','ᚨ','ᚱ','ᚲ','ᛉ','ᚹ','ᚺ','ᛃ'];

function getSpecialAccentVars(slug) {
  switch (slug) {
    case 'midwinter':
      return {
        washA: 'rgba(120, 210, 255, 0.10)', washB: 'rgba(20, 40, 80, 0.04)',
        palette: ['rgba(120, 210, 255, 0.62)', 'rgba(210, 250, 255, 0.55)', 'rgba(90, 150, 230, 0.52)'],
      };
    case 'greengrass':
      return {
        washA: 'rgba(80, 220, 120, 0.10)', washB: 'rgba(20, 60, 30, 0.04)',
        palette: ['rgba(80, 220, 120, 0.62)', 'rgba(210, 255, 220, 0.52)', 'rgba(50, 180, 90, 0.55)'],
      };
    case 'midsummer':
      return {
        washA: 'rgba(255, 200, 80, 0.11)', washB: 'rgba(80, 30, 0, 0.04)',
        palette: ['rgba(255, 200, 80, 0.66)', 'rgba(255, 245, 200, 0.52)', 'rgba(212, 112, 10, 0.55)'],
      };
    case 'highharvestide':
      return {
        washA: 'rgba(212, 112, 10, 0.11)', washB: 'rgba(60, 20, 0, 0.04)',
        palette: ['rgba(212, 112, 10, 0.66)', 'rgba(255, 190, 120, 0.5)', 'rgba(160, 70, 10, 0.55)'],
      };
    case 'feastofthemoon':
      return {
        washA: 'rgba(200, 190, 255, 0.10)', washB: 'rgba(50, 30, 110, 0.04)',
        palette: ['rgba(200, 190, 255, 0.66)', 'rgba(255, 255, 255, 0.5)', 'rgba(136, 112, 208, 0.55)'],
      };
    default:
      return null;
  }
}

function tendayIndexFromDoy(doy) {
  return ((wrapDoy1to365(doy) - 1) % 10 + 10) % 10;
}

function svgDataUrlForRune(runeChar, rgbaColor, { size = 220 } = {}) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">
      <defs>
        <filter id="blur" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="0.6"/>
        </filter>
      </defs>
      <rect width="${size}" height="${size}" fill="transparent"/>
      <text x="50%" y="53%" text-anchor="middle" dominant-baseline="middle"
            font-family="Cinzel Decorative, Cinzel, serif"
            font-size="${Math.round(size * 0.62)}"
            fill="${rgbaColor}"
            opacity="1"
            filter="url(#blur)">${runeChar}</text>
    </svg>
  `.trim();
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

function applyTodayBlockAccents({ todayBlock, harptosDoy, todayDnd, moon }) {
  if (!todayBlock) return;

  const festSlug = (todayDnd && todayDnd.special && todayDnd.special.css) ? todayDnd.special.css : '';
  const special = festSlug ? getSpecialAccentVars(festSlug) : null;
  const seasonKey = getSeasonKeyForDoy(harptosDoy);
  const season = getSeasonWashVars(seasonKey);
  const washA = special?.washA ?? season.washA;
  const washB = special?.washB ?? season.washB;
  const palette = special?.palette ?? season.palette;

  const ui = (SETTINGS && SETTINGS.ui) ? SETTINGS.ui : {};
  const showSeasonAccent = ui.showSeasonAccent !== false;
  const showTendaySigil = ui.showTendaySigil !== false;
  const showWaxSeal = ui.showWaxSeal !== false;

  const { accent: moonAccent, halo: moonHalo } = getMoonAccentVars(moon);
  const accent = showSeasonAccent ? (palette && palette[0] ? palette[0] : moonAccent) : moonAccent;
  const halo = showSeasonAccent ? (palette && palette[1] ? palette[1] : moonHalo) : moonHalo;

  todayBlock.style.setProperty('--today-accent', accent);
  todayBlock.style.setProperty('--today-halo', halo);
  todayBlock.style.setProperty('--today-wash-a', showSeasonAccent ? washA : 'rgba(0,0,0,0)');
  todayBlock.style.setProperty('--today-wash-b', showSeasonAccent ? washB : 'rgba(0,0,0,0)');
  todayBlock.style.setProperty('--today-sigil-opacity', festSlug ? '0.22' : '0.16');

  // Tenday sigil + wax seal visuals (watermark & stamp)
  const idx = tendayIndexFromDoy(getActiveDoy());
  const rune = TENDAY_RUNES[idx] || '✦';
  const sigilColor = palette && palette.length ? palette[idx % palette.length] : accent;
  const sealColor = palette && palette.length ? palette[(idx + 1) % palette.length] : accent;

  todayBlock.style.setProperty('--today-rune', `"${rune}"`);
  todayBlock.style.setProperty('--today-sigil-image', showTendaySigil ? svgDataUrlForRune(rune, sigilColor) : 'none');
  todayBlock.style.setProperty('--today-seal-color', showWaxSeal ? sealColor : 'transparent');
  todayBlock.style.setProperty('--today-seal-visible', showWaxSeal ? '1' : '0');

  const sealRuneEl = todayBlock.querySelector('.today-seal-rune');
  if (sealRuneEl) sealRuneEl.textContent = rune;
}

function buildTodaySummaryText() {
  const harptosDoy = getActiveDoy();
  const todayDnd = getDndDate(harptosDoy);
  const today = getActiveGregorianDate();
  const refYear = today.getUTCFullYear();

  const dateStr = todayDnd?.special ? todayDnd.special.name : `${todayDnd?.day ?? ''} ${todayDnd?.month ?? ''}`.trim();
  const moon = todayDnd?.moon || getMoonPhase(harptosDoy);
  const realStr = formatGregorianInDisplayTz(today, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const nextEvent = findNextBirthdayOrMemorial(harptosDoy, refYear);
  const fullExact = findNextExactMoonPhase(harptosDoy, 'full moon');

  const lines = [];
  lines.push(`Vandaag: ${dateStr} (${realStr})`);
  lines.push(`Maan: ${moonEmoji(moon)} ${moon}`);
  if (fullExact) lines.push(`Volgende Full Moon: ${harptosLabelForDoy(fullExact.doy)} (${fullExact.whenText})`);
  if (nextEvent) lines.push(`Eerstvolgende: ${nextEvent.label} — ${nextEvent.harptosLabel} (${nextEvent.whenText})`);
  return lines.join('\n');
}

async function copyTextToClipboard(text) {
  if (!text) return false;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (_) {
    // fall through
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch (_) {
    return false;
  }
}

function setupTodayBlockCopyOnce() {
  if (window.__eryndorTodayCopySetupDone) return;
  const el = document.getElementById('today-block');
  if (!el) return;
  window.__eryndorTodayCopySetupDone = true;

  el.classList.add('is-clickable');
  el.tabIndex = 0;
  el.setAttribute('role', 'button');
  el.setAttribute('aria-label', 'Kopieer vandaag-overzicht');

  const doCopy = async () => {
    const text = buildTodaySummaryText();
    const ok = await copyTextToClipboard(text);
    const toast = el.querySelector('.today-copy-toast');
    if (toast) {
      toast.textContent = ok ? 'Copied' : 'Copy failed';
      toast.classList.add('is-visible');
      window.setTimeout(() => toast.classList.remove('is-visible'), 900);
    }
  };

  el.addEventListener('click', () => { void doCopy(); });
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      void doCopy();
    }
  });
}

let debugTitleTapSetupDone = false;
let titleDebugTapCount = 0;
let titleDebugTapTimer = null;

/** 5× snel klikken op de titel toggelt debugCalendar (aan ↔ uit); uit = simulatie gewist. */
function setupDebugTitleTapToggle() {
  if (debugTitleTapSetupDone) return;
  const el = document.querySelector('.title-block');
  if (!el) return;
  debugTitleTapSetupDone = true;
  el.addEventListener('click', () => {
    titleDebugTapCount++;
    if (titleDebugTapTimer) clearTimeout(titleDebugTapTimer);
    if (titleDebugTapCount >= DEBUG_TITLE_TAP_TO_TOGGLE) {
      titleDebugTapCount = 0;
      debugCalendarActive = !debugCalendarActive;
      if (!debugCalendarActive) debugSimulatedDoy = null;
      renderCalendar();
      return;
    }
    titleDebugTapTimer = setTimeout(() => {
      titleDebugTapCount = 0;
      titleDebugTapTimer = null;
    }, DEBUG_TITLE_TAP_RESET_MS);
  });
}

function renderCalendar() {
  const today = getActiveGregorianDate();
  const refYear = today.getUTCFullYear();
  const todayDoyGreg = getActiveDoy();
  const harptosDoy = todayDoyGreg;
  const todayDnd = getDndDate(harptosDoy);
  const todayBd = getBirthdayForDoy(harptosDoy, refYear);
  const todayMemorials = getMemorialsForDoy(harptosDoy, refYear);
  const ui = (SETTINGS && SETTINGS.ui) ? SETTINGS.ui : {};
  const showSeasonAccent = ui.showSeasonAccent !== false;

  // Global CSS animation toggle (banners/special cards/today pulse)
  document.body.classList.toggle('ui-animations-off', ui.enableCssAnimations === false);
  document.body.classList.toggle('ui-haze-off', ui.enableBackgroundHaze === false);
  if (ui.enableBackgroundHaze === false) {
    delete document.body.dataset.season;
  } else {
    document.body.dataset.season = getSeasonKeyForDoy(harptosDoy);
  }

  updateDebugBar(harptosDoy);
  renderNextUpUI({ harptosDoy, refYear });

  const leapWrap = document.getElementById('leap-year-notice-wrap');
  if (leapWrap) {
    const gy = today.getUTCFullYear();
    leapWrap.innerHTML = isGregorianLeapYear(gy)
      ? `<div class="leap-year-notice">Let op: ${gy} is een schrikkeljaar. Deze kalender gebruikt voorlopig steeds <strong>365</strong> Harptos-dagen; <strong>29 februari</strong> wordt hier nog niet meegenomen.</div>`
      : '';
  }

  const bannerEl = document.getElementById('birthday-banner-container');
  bannerEl.innerHTML = '';
  if (todayBd) {
    bannerEl.innerHTML +=
      `<div class="birthday-banner"><div class="birthday-banner-text">🎂 Gelukkige Naamdag, ${todayBd.name}! 🎂</div></div>`;
    if (ui.enableConfetti !== false) startConfetti();
    else stopConfetti();
  } else {
    stopConfetti();
  }
  for (const mem of todayMemorials) {
    const sub = mem.subtitle
      ? `<div class="memorial-banner-sub">${mem.subtitle}</div>`
      : '';
    const deathMem = isMemorialDeath(mem);
    const bcls = deathMem ? 'memorial-banner memorial-banner--mourning' : 'memorial-banner';
    const deco = deathMem ? '🕯' : '✦';
    bannerEl.innerHTML +=
      `<div class="${bcls}"><div class="memorial-banner-text">${deco} ${mem.title} ${deco}</div>${sub}</div>`;
  }

  const todayBlock = document.getElementById('today-block');
  if (todayDnd) {
    const moon = todayDnd.moon || getMoonPhase(harptosDoy);
    const emoji = moonEmoji(moon);
    const realStr = formatGregorianInDisplayTz(today, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const dateStr = todayDnd.special ? todayDnd.special.name : `${todayDnd.day} ${todayDnd.month}`;
    const debugTag = debugCalendarActive && debugSimulatedDoy != null ? ' <span style="opacity:0.65;font-size:10px;">(simulatie)</span>' : '';
    todayBlock.innerHTML = `
    <div class="today-label">Vandaag${debugTag}</div>
    <span class="moon-symbol">${emoji}</span>
    <div class="today-dnd-date">${dateStr}</div>
    <div class="today-moon">${moon}</div>
    <div class="today-real-date">${realStr}</div>
    <div class="today-sigil today-sigil--primary" aria-hidden="true"></div>
    <div class="today-sigil today-sigil--secondary" aria-hidden="true"></div>
    <div class="today-seal" aria-hidden="true"><span class="today-seal-rune" aria-hidden="true"></span></div>
    <div class="today-copy-toast" aria-hidden="true">Copied</div>`;

    applyTodayBlockAccents({ todayBlock, harptosDoy, todayDnd, moon });
    setupTodayBlockCopyOnce();
  } else {
    todayBlock.innerHTML = '';
  }

  const monthsGrid = document.getElementById('months-grid');
  monthsGrid.innerHTML = '';
  let currentMonthCard = null;
  for (const seg of buildYearTimeline()) {
    if (seg.type === 'month') {
      const m = seg.month;
      const isCurrent = todayDnd && !todayDnd.special && todayDnd.month === m.name;
      const card = document.createElement('div');
      card.className = 'month-card' + (isCurrent ? ' is-current' : '');
      if (isCurrent) {
        card.id = 'current-month';
        currentMonthCard = card;
      }
      if (showSeasonAccent) card.setAttribute('data-season', getSeasonKeyFromDndMonth(m.name));
      let cells = '';
      for (let d = 1; d <= m.days; d++) {
        const doy = m.start + d - 1;
        const phase = getMoonPhase(doy);
        const cls = getDayClass(phase);
        const isToday = isCurrent && todayDnd.day === d;
        const birthday = getBirthdayForDoy(doy, refYear);
        const memorials = getMemorialsForDoy(doy, refYear);
        const hasDeath = memorialsHasDeath(memorials);
        const hasCel = memorialsHasCelebration(memorials);
        const realStr = formatGregorianInDisplayTz(doyToRealDate(doy, refYear), { day: 'numeric', month: 'long' });
        const bdTitle = birthday ? ` · 🎂 ${birthday.name} is jarig!` : '';
        let memTitle = '';
        for (const mem of memorials) {
          memTitle += isMemorialDeath(mem) ? ` · 🕯 ${mem.title}` : ` · ✦ ${mem.title}`;
        }
        let baseCls;
        if (isToday) {
          if (birthday) baseCls = 'birthday-today';
          else if (hasCel) baseCls = 'memorial-today';
          else if (hasDeath) baseCls = 'memorial-death-today';
          else baseCls = 'today-cell';
        } else {
          baseCls = cls;
        }
        let markers = '';
        if (birthday) markers += ' birthday-day';
        if (hasCel) markers += ' memorial-day';
        if (hasDeath) markers += ' memorial-day--death';
        let pips = '';
        if (birthday) pips += '<span class="cake-pip">🎂</span>';
        if (hasDeath) pips += '<span class="memorial-pip memorial-pip--death">🕯</span>';
        if (hasCel) pips += '<span class="memorial-pip memorial-pip--celebration">✦</span>';
        const tooltipText = `${phase} · ${realStr}${bdTitle}${memTitle}`;
        if (birthday || memorials.length) {
          cells += `<div class="day-cell ${baseCls}${markers}" data-doy="${doy}" data-tooltip="${tooltipText}" tabindex="0" role="button" aria-label="${tooltipText}">${d}${pips}</div>`;
        } else {
          cells += `<div class="day-cell ${baseCls}" data-doy="${doy}" data-tooltip="${tooltipText}" tabindex="0" role="button" aria-label="${tooltipText}">${d}</div>`;
        }
      }
      const g0 = doyToRealDate(m.start, refYear);
      const g1 = doyToRealDate(m.start + m.days - 1, refYear);
      const fmtG = (d) => formatGregorianInDisplayTz(d, { day: 'numeric', month: 'short' });
      const gregRange = `${fmtG(g0)} tot ${fmtG(g1)} ${refYear}`;
      card.innerHTML = `
    <div class="month-name">${m.name}</div>
    <div class="month-days">${gregRange}</div>
    <div class="day-grid">${cells}</div>`;
      monthsGrid.appendChild(card);
    } else {
      const s = seg.special;
      const isCurrent = todayDnd && todayDnd.special && todayDnd.special.name === s.name;
      const card = document.createElement('div');
      const realDateStr = formatGregorianInDisplayTz(doyToRealDate(s.dayOfYear, refYear), { day: 'numeric', month: 'long', year: 'numeric' });
      const sdoy = s.dayOfYear;
      const sBd = getBirthdayForDoy(sdoy, refYear);
      const sMems = getMemorialsForDoy(sdoy, refYear);
      const sHasDeath = memorialsHasDeath(sMems);
      const sHasCel = memorialsHasCelebration(sMems);
      let scMarkers = '';
      if (sBd) scMarkers += '<span class="sc-marker-cake" aria-hidden="true">🎂</span>';
      if (sHasDeath) scMarkers += '<span class="sc-marker-death" aria-hidden="true">🕯</span>';
      if (sHasCel) scMarkers += '<span class="sc-marker-celebration" aria-hidden="true">✦</span>';
      const markerWrap = scMarkers ? `<div class="special-card-markers">${scMarkers}</div>` : '';
      card.innerHTML = `<span class="s-icon">${s.icon}</span><div class="s-name">${s.name}</div><div class="s-real-date">${realDateStr}</div><div class="s-moon">${s.moon}</div>${markerWrap}`;
      let cls = `special-card special-${s.css}`;
      if (isCurrent) cls += ' is-current';
      if (debugCalendarActive) cls += ' debug-clickable';
      card.className = cls;
      if (showSeasonAccent) card.setAttribute('data-season', getSeasonKeyForDoy(s.dayOfYear));
      if (debugCalendarActive) {
        card.tabIndex = 0;
        card.setAttribute('role', 'button');
        card.setAttribute('aria-label', `Simuleer ${s.name}`);
        card.addEventListener('click', () => { debugSimulatedDoy = s.dayOfYear; renderCalendar(); });
        card.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); debugSimulatedDoy = s.dayOfYear; renderCalendar(); }
        });
      }
      monthsGrid.appendChild(card);
    }
  }

  const jumpBtn = document.getElementById('jump-to-current-month');
  if (jumpBtn) {
    const visible = !!currentMonthCard;
    jumpBtn.style.display = visible ? 'inline-flex' : 'none';
    if (!jumpBtn.__eryndorBound) {
      jumpBtn.__eryndorBound = true;
      jumpBtn.addEventListener('click', () => {
        const target = document.getElementById('current-month') || document.querySelector('.month-card.is-current');
        if (!target) return;
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }

  const bdList = document.getElementById('birthday-list');
  bdList.innerHTML = '';
  const birthdaysSorted = getEffectiveBirthdays()
    .map((b) => ({ b, doy: harptosDoyForBirthday(b, refYear) }))
    .filter((x) => x.doy != null)
    .sort((a, z) => a.doy - z.doy);
  for (const { b, doy } of birthdaysSorted) {
    const dateLabel = birthdayListDateLabel(b, doy);
    const isToday = doy === harptosDoy;
    const item = document.createElement('div');
    item.innerHTML = `
    <span class="birthday-icon">${isToday ? '🎂' : '🎈'}</span>
    <div>
      <div class="birthday-name">${b.name}</div>
      <div class="birthday-date">${dateLabel}</div>
    </div>`;
    let icls = 'birthday-item' + (isToday ? ' is-today' : '');
    if (debugCalendarActive) icls += ' debug-clickable';
    item.className = icls;
    if (debugCalendarActive) {
      item.tabIndex = 0;
      item.setAttribute('role', 'button');
      item.setAttribute('aria-label', `Simuleer verjaardag ${b.name}`);
      item.addEventListener('click', () => { debugSimulatedDoy = doy; renderCalendar(); });
      item.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); debugSimulatedDoy = doy; renderCalendar(); }
      });
    }
    bdList.appendChild(item);
  }

  const memorialListEl = document.getElementById('memorial-list');
  memorialListEl.innerHTML = '';
  const memorialSorted = [...getEffectiveMemorialDays()]
    .map((mem) => ({ mem, doy: harptosDoyForMemorial(mem, refYear) }))
    .filter((x) => x.doy != null)
    .sort((a, b) => {
      if (a.doy !== b.doy) return a.doy - b.doy;
      return (isMemorialDeath(a.mem) ? 1 : 0) - (isMemorialDeath(b.mem) ? 1 : 0);
    });
  for (const { mem, doy: doyM } of memorialSorted) {
    const isTodayM = doyM === harptosDoy;
    const row = document.createElement('div');
    const hLabel = harptosLabelForDoy(doyM);
    const subLine = mem.subtitle
      ? `<div class="memorial-date">${hLabel} · ${mem.subtitle}</div>`
      : `<div class="memorial-date">${hLabel}</div>`;
    const deathRow = isMemorialDeath(mem);
    const rowIcon = deathRow ? '🕯' : (isTodayM ? '✦' : '·');
    row.innerHTML = `
    <span class="memorial-icon">${rowIcon}</span>
    <div>
      <div class="memorial-title">${mem.title}</div>
      ${subLine}
    </div>`;
    let mcls = 'memorial-item' + (deathRow ? ' memorial-item--death' : '') + (isTodayM ? ' is-today' : '');
    if (debugCalendarActive) mcls += ' debug-clickable';
    row.className = mcls;
    if (debugCalendarActive) {
      row.tabIndex = 0;
      row.setAttribute('role', 'button');
      row.setAttribute('aria-label', `Simuleer mijlpaal ${mem.title}`);
      row.addEventListener('click', () => { debugSimulatedDoy = doyM; renderCalendar(); });
      row.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); debugSimulatedDoy = doyM; renderCalendar(); }
      });
    }
    memorialListEl.appendChild(row);
  }

  applyBodyFestivalTheme(todayDnd, todayBd, todayMemorials);

  if (ui.enableFestFx === false) {
    stopFestFx();
  } else {
    if (todayDnd && todayDnd.special && todayDnd.special.css)
      startFestFx(todayDnd.special.css);
    else if (memorialsHasCelebration(todayMemorials))
      startFestFx('memorial-celebration');
    else if (memorialsHasDeath(todayMemorials))
      startFestFx('memorial-mourning');
    else
      stopFestFx();
  }
}

setupDebugTitleTapToggle();
setupDebugDayPickerOnce();
setupMobileGarlandAspectOnce();
renderCalendar();

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopFestFx();
    stopConfetti();
    hideTooltip();
    return;
  }
  renderCalendar();
});

function setupDebugDayPickerOnce() {
  if (window.__eryndorDebugDayPickerSetupDone) return;
  window.__eryndorDebugDayPickerSetupDone = true;

  const grid = document.getElementById('months-grid');
  if (!grid) return;

  const activate = (target) => {
    if (!debugCalendarActive) return;
    const el = target && target.closest ? target.closest('.day-cell[data-doy]') : null;
    if (!el) return;
    const doy = Number(el.getAttribute('data-doy'));
    if (!Number.isFinite(doy) || doy < 1 || doy > 365) return;
    debugSimulatedDoy = doy;
    hideTooltip();
    renderCalendar();
  };

  grid.addEventListener('click', (e) => {
    if (!debugCalendarActive) return;
    const el = e.target && e.target.closest ? e.target.closest('.day-cell[data-doy]') : null;
    if (!el) return;
    e.preventDefault();
    e.stopPropagation(); // avoid pinning tooltip on debug-click
    activate(e.target);
  });

  grid.addEventListener('keydown', (e) => {
    if (!debugCalendarActive) return;
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const el = e.target && e.target.closest ? e.target.closest('.day-cell[data-doy]') : null;
    if (!el) return;
    e.preventDefault();
    e.stopPropagation();
    activate(e.target);
  });
}

function setupMobileGarlandAspectOnce() {
  if (window.__eryndorMobileGarlandSetupDone) return;
  window.__eryndorMobileGarlandSetupDone = true;

  const garland = document.querySelector('.garland-svg');
  const buntings = Array.from(document.querySelectorAll('.birthday-bunting'));
  if (!garland && buntings.length === 0) return;

  const mq = window.matchMedia('(max-width: 600px)');
  const apply = () => {
    // Desktop keeps the original full-frame stretch; mobile prefers less distortion.
    if (garland) garland.setAttribute('preserveAspectRatio', mq.matches ? 'xMidYMid slice' : 'none');
    // Birthday bunting: same idea; avoids weird skinny scaling on mobile.
    for (const b of buntings) b.setAttribute('preserveAspectRatio', mq.matches ? 'xMidYMid slice' : 'none');
  };

  apply();
  mq.addEventListener?.('change', apply);
}

let tooltipPinned = false;
let tooltipPinnedTarget = null;
let tooltipLastAnchorRect = null;

function getTooltipEls() {
  const layer = document.getElementById('tooltip-layer');
  const tip = document.getElementById('tooltip');
  return { layer, tip };
}

function hideTooltip() {
  const { layer, tip } = getTooltipEls();
  if (!layer || !tip) return;
  tooltipPinned = false;
  tooltipPinnedTarget = null;
  tooltipLastAnchorRect = null;
  layer.setAttribute('aria-hidden', 'true');
  layer.style.display = 'none';
  tip.textContent = '';
}

function showTooltipForTarget(targetEl, { pinned }) {
  const { layer, tip } = getTooltipEls();
  if (!layer || !tip || !targetEl) return;

  const text = targetEl.getAttribute('data-tooltip') || '';
  if (!text) return;

  tooltipPinned = !!pinned;
  tooltipPinnedTarget = tooltipPinned ? targetEl : null;
  tooltipLastAnchorRect = targetEl.getBoundingClientRect();

  tip.textContent = text;
  layer.style.display = 'block';
  layer.setAttribute('aria-hidden', 'false');
  positionTooltip(tooltipLastAnchorRect);
}

function positionTooltip(anchorRect) {
  const { layer, tip } = getTooltipEls();
  if (!layer || !tip || !anchorRect) return;

  // Ensure measurable
  const pad = 10;
  const gap = 8;

  const tipRect = tip.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let left = anchorRect.left + anchorRect.width / 2 - tipRect.width / 2;
  left = Math.max(pad, Math.min(vw - pad - tipRect.width, left));

  // Prefer above; if not enough space, place below.
  let top = anchorRect.top - gap - tipRect.height;
  if (top < pad) top = anchorRect.bottom + gap;
  top = Math.max(pad, Math.min(vh - pad - tipRect.height, top));

  layer.style.left = `${left}px`;
  layer.style.top = `${top}px`;
}

function closestTooltipTarget(el) {
  if (!el) return null;
  if (el instanceof Element) {
    const t = el.closest('[data-tooltip]');
    return t;
  }
  return null;
}

function setupTooltipInteractionsOnce() {
  if (window.__eryndorTooltipSetupDone) return;
  window.__eryndorTooltipSetupDone = true;

  document.addEventListener('pointerover', (e) => {
    if (tooltipPinned) return;
    const t = closestTooltipTarget(e.target);
    if (!t) return;
    showTooltipForTarget(t, { pinned: false });
  });

  document.addEventListener('pointerout', (e) => {
    if (tooltipPinned) return;
    const from = closestTooltipTarget(e.target);
    const to = closestTooltipTarget(e.relatedTarget);
    if (from && from !== to) hideTooltip();
  });

  document.addEventListener('focusin', (e) => {
    if (tooltipPinned) return;
    const t = closestTooltipTarget(e.target);
    if (!t) return;
    showTooltipForTarget(t, { pinned: false });
  });

  document.addEventListener('focusout', (e) => {
    if (tooltipPinned) return;
    const from = closestTooltipTarget(e.target);
    const to = closestTooltipTarget(e.relatedTarget);
    if (from && from !== to) hideTooltip();
  });

  document.addEventListener('click', (e) => {
    const { tip } = getTooltipEls();
    const t = closestTooltipTarget(e.target);

    // Font-size toggle: never pin tooltips on click (avoid sticky tooltip)
    if (t && t.closest && t.closest('.font-face-toggle')) {
      return;
    }

    // Close if pinned and click outside tooltip + outside pinned target
    if (tooltipPinned) {
      const clickedInsideTooltip = !!(tip && tip.contains(e.target));
      const clickedPinnedTarget = !!(tooltipPinnedTarget && tooltipPinnedTarget.contains(e.target));
      if (!clickedInsideTooltip && !clickedPinnedTarget) {
        hideTooltip();
      }
      return;
    }

    // Pin on click
    if (t) {
      showTooltipForTarget(t, { pinned: true });
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideTooltip();
  });

  window.addEventListener('resize', () => {
    if (!tooltipLastAnchorRect) return;
    positionTooltip(tooltipLastAnchorRect);
  });

  window.addEventListener('scroll', () => {
    if (!tooltipLastAnchorRect || !tooltipPinnedTarget) return;
    tooltipLastAnchorRect = tooltipPinnedTarget.getBoundingClientRect();
    positionTooltip(tooltipLastAnchorRect);
  }, true);
}

setupTooltipInteractionsOnce();

const FONT_SCALE_STORAGE_KEY = 'eryndor_font_scale_v1';

function emojiForFontScale(slug) {
  // Normal/default should feel friendly.
  if (slug === 'normal') return '🙂';
  if (slug === 'young') return '😐';
  if (slug === 'reader') return '🤓';
  if (slug === 'grand') return '👴';
  return '🙂';
}

function applyFontScaleClass(scaleSlug) {
  const valid = ['young', 'normal', 'reader', 'grand'];
  const fallback = 'normal';
  const slug = valid.includes(scaleSlug) ? scaleSlug : fallback;

  document.body.classList.remove(
    'font-scale-young',
    'font-scale-normal',
    'font-scale-reader',
    'font-scale-grand',
  );

  let cls = 'font-scale-young';
  if (slug === 'normal') cls = 'font-scale-normal';
  else if (slug === 'reader') cls = 'font-scale-reader';
  else if (slug === 'grand') cls = 'font-scale-grand';

  document.body.classList.add(cls);

  try {
    window.localStorage.setItem(FONT_SCALE_STORAGE_KEY, slug);
  } catch (_) {
    // ignore storage errors (private mode, etc.)
  }

  const menuItems = document.querySelectorAll('.font-face-toggle__item[data-font-scale]');
  menuItems.forEach((btn) => {
    const v = btn.getAttribute('data-font-scale');
    if (v === slug) btn.classList.add('is-active');
    else btn.classList.remove('is-active');
  });

  const triggerEmoji = document.querySelector('.font-face-toggle__trigger-emoji');
  if (triggerEmoji) triggerEmoji.textContent = emojiForFontScale(slug);
}

function setupFontScaleToggleOnce() {
  if (window.__eryndorFontScaleSetupDone) return;
  window.__eryndorFontScaleSetupDone = true;

  const container = document.querySelector('.font-face-toggle');
  if (!container) return;

  const trigger = container.querySelector('.font-face-toggle__trigger');
  const menu = container.querySelector('.font-face-toggle__menu');

  let initialSlug = 'normal';
  try {
    const stored = window.localStorage.getItem(FONT_SCALE_STORAGE_KEY);
    if (stored) initialSlug = stored;
  } catch (_) {
    // ignore storage errors
  }

  applyFontScaleClass(initialSlug);

  const closeMenu = () => {
    container.classList.remove('is-open');
    trigger?.setAttribute('aria-expanded', 'false');
  };

  const openMenu = () => {
    container.classList.add('is-open');
    trigger?.setAttribute('aria-expanded', 'true');
  };

  trigger?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (container.classList.contains('is-open')) closeMenu();
    else openMenu();
  });

  menu?.addEventListener('click', (e) => {
    const btn = e.target.closest?.('.font-face-toggle__item[data-font-scale]');
    if (!btn) return;
    const slug = btn.getAttribute('data-font-scale');
    if (!slug) return;
    applyFontScaleClass(slug);
    closeMenu();
  });

  document.addEventListener('click', (e) => {
    if (!container.classList.contains('is-open')) return;
    if (container.contains(e.target)) return;
    closeMenu();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMenu();
  });
}

setupFontScaleToggleOnce();
