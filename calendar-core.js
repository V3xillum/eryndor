/**
 * Pure Harptos-kalenderlogica (geen DOM).
 * Gebruikt door scripts/generate-api-json.mjs en houdt parity met app.js.
 */

export const MONTHS = [
  { name: 'Hammer', days: 30, start: 1 },
  { name: 'Alturiak', days: 30, start: 32 },
  { name: 'Ches', days: 30, start: 62 },
  { name: 'Tarsakh', days: 30, start: 92 },
  { name: 'Mirtul', days: 30, start: 123 },
  { name: 'Kythorn', days: 30, start: 153 },
  { name: 'Flamerule', days: 30, start: 183 },
  { name: 'Eleasis', days: 30, start: 214 },
  { name: 'Eleint', days: 30, start: 244 },
  { name: 'Marpenoth', days: 30, start: 275 },
  { name: 'Uktar', days: 30, start: 305 },
  { name: 'Nightal', days: 30, start: 336 },
];

export const SPECIALS = [
  { name: 'Midwinter', dayOfYear: 31, icon: '❄️', moon: 'New Moon', css: 'midwinter' },
  { name: 'Greengrass', dayOfYear: 122, icon: '🌿', moon: 'New Moon (Fading)', css: 'greengrass' },
  { name: 'Midsummer', dayOfYear: 213, icon: '🌞', moon: 'Waxing Crescent (Rising)', css: 'midsummer' },
  { name: 'Highharvestide', dayOfYear: 274, icon: '🌾', moon: 'Waxing Crescent', css: 'highharvestide' },
  { name: 'Feast of the Moon', dayOfYear: 335, icon: '🌕', moon: 'Waxing Crescent', css: 'feastofthemoon' },
];

/** 30-daagse maancyclus; (doy−1) mod 30. */
export const LUNAR_CYCLE_30 = [
  'New Moon', 'New Moon (Fading)', 'Waxing Crescent (Rising)', 'Waxing Crescent', 'Waxing Crescent',
  'Waxing Crescent (Fading)', 'First Quarter (Rising)', 'First Quarter', 'First Quarter (Fading)',
  'Waxing Gibbous (Rising)', 'Waxing Gibbous', 'Waxing Gibbous', 'Waxing Gibbous (Fading)',
  'Full Moon (Rising)', 'Full Moon', 'Full Moon (Fading)', 'Waning Gibbous (Rising)', 'Waning Gibbous',
  'Waning Gibbous', 'Waning Gibbous (Fading)', 'Last Quarter (Rising)', 'Last Quarter',
  'Last Quarter (Fading)', 'Waning Crescent (Rising)', 'Waning Crescent', 'Waning Crescent',
  'Waning Crescent (Fading)', 'Dark Moon (Rising)', 'Dark Moon', 'Dark Moon (Fading)',
];

export function getYMDInTimeZone(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  return {
    year: +parts.find((p) => p.type === 'year').value,
    month: +parts.find((p) => p.type === 'month').value,
    day: +parts.find((p) => p.type === 'day').value,
  };
}

export function getDayOfYearFromYMD(year, month, day) {
  const ml = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0) ml[1] = 29;
  let n = day;
  for (let i = 0; i < month - 1; i++) n += ml[i];
  return n;
}

export function getDayOfYearInTimeZone(date, timeZone) {
  const { year, month, day } = getYMDInTimeZone(date, timeZone);
  return getDayOfYearFromYMD(year, month, day);
}

export function parseGregorianBirthdayShape(g) {
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

export function gregorianMDToHarptosDoy(refYear, month, day) {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const t = Date.UTC(refYear, month - 1, day, 12, 0, 0);
  const d = new Date(t);
  if (d.getUTCFullYear() !== refYear || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  const doy = getDayOfYearFromYMD(refYear, month, day);
  return doy <= 365 ? doy : null;
}

export function harptosDoyForBirthday(b, refYear) {
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

export function harptosDoyForMemorial(mem, refYear) {
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

export function getDndDate(doy) {
  for (const s of SPECIALS) {
    if (s.dayOfYear === doy) return { special: s, month: null, day: null, moon: s.moon };
  }
  for (const m of MONTHS) {
    if (doy >= m.start && doy < m.start + m.days)
      return { special: null, month: m.name, day: doy - m.start + 1, moon: getMoonPhase(doy) };
  }
  return null;
}

export function getMoonPhase(doy) {
  if (doy < 1 || doy > 365) return LUNAR_CYCLE_30[0];
  return LUNAR_CYCLE_30[(doy - 1) % 30];
}

export function isExactFullMoonDoy(doy) {
  return (getMoonPhase(doy) || '').toLowerCase() === 'full moon';
}

export function moonEmoji(p) {
  p = (p || '').toLowerCase();
  if (p.includes('full moon')) return '🌕';
  if (p.includes('waxing gibbous')) return '🌔';
  if (p.includes('first quarter')) return '🌓';
  if (p.includes('waxing crescent')) return '🌒';
  if (p.includes('new moon')) return '🌑';
  if (p.includes('waning crescent')) return '🌘';
  if (p.includes('last quarter')) return '🌗';
  if (p.includes('waning gibbous')) return '🌖';
  return '🌑';
}

export function harptosLabelForDoy(doy) {
  const d = getDndDate(doy);
  if (!d || d.special) return d?.special?.name ?? '';
  return `${d.day} ${d.month}`;
}

export function wrapDoy1to365(doy) {
  const x = ((doy - 1) % 365 + 365) % 365;
  return x + 1;
}

export function describeInDays(d) {
  if (d === 0) return 'vandaag';
  if (d === 1) return 'morgen';
  return `over ${d} dagen`;
}

export function findNextExactMoonPhase(fromDoy, exactLower) {
  const start = wrapDoy1to365(fromDoy);
  for (let delta = 0; delta < 365; delta++) {
    const doy = wrapDoy1to365(start + delta);
    const phase = (getMoonPhase(doy) || '').toLowerCase();
    if (phase === exactLower) {
      return {
        dayOfYear: doy,
        daysUntil: delta,
        whenText: describeInDays(delta),
        label: harptosLabelForDoy(doy),
      };
    }
  }
  return null;
}

export function doyToRealDate(doy, year) {
  return new Date(Date.UTC(year, 0, doy, 12, 0, 0));
}

export function isGregorianLeapYear(y) {
  if (y % 400 === 0) return true;
  if (y % 100 === 0) return false;
  return y % 4 === 0;
}

export function getMemorialType(mem) {
  if (mem && mem.type === 'death') return 'death';
  if (mem && mem.type === 'festive') return 'festive';
  return 'memorial';
}

/**
 * Bouwt de API-payload voor één Harptos-dag.
 * @param {object} opts
 * @param {number} opts.doy 1–365
 * @param {number} opts.refYear Gregoriaans jaar (voor gregorian-mapped entries)
 * @param {string} opts.timezone
 * @param {Array} opts.birthdays
 * @param {Array} opts.memorialDays
 */
export function buildDayPayload({ doy, refYear, timezone, birthdays, memorialDays }) {
  const dnd = getDndDate(doy);
  const moon = dnd?.moon || getMoonPhase(doy);
  const real = doyToRealDate(doy, refYear);
  const iso = real.toISOString().slice(0, 10);

  const birthdaysToday = birthdays
    .filter((b) => harptosDoyForBirthday(b, refYear) === doy)
    .map((b) => ({ type: 'birthday', name: b.name }));

  const memorialsToday = memorialDays
    .filter((m) => harptosDoyForMemorial(m, refYear) === doy)
    .map((m) => ({
      type: 'memorial',
      title: m.title,
      memorialType: getMemorialType(m),
      subtitle: m.subtitle || null,
    }));

  const festival = dnd?.special
    ? {
        type: 'festival',
        name: dnd.special.name,
        icon: dnd.special.icon,
        css: dnd.special.css,
      }
    : null;

  return {
    dayOfYear: doy,
    refYear,
    timezone,
    leapYearNote: isGregorianLeapYear(refYear)
      ? 'Schrikkeljaar: Harptos gebruikt 365 dagen; 29 feb wordt niet meegenomen.'
      : null,
    harptos: dnd?.special
      ? {
          label: dnd.special.name,
          month: null,
          day: null,
          special: dnd.special.name,
        }
      : {
          label: `${dnd?.day ?? ''} ${dnd?.month ?? ''}`.trim(),
          month: dnd?.month ?? null,
          day: dnd?.day ?? null,
          special: null,
        },
    gregorian: {
      iso,
      year: refYear,
      month: real.getUTCMonth() + 1,
      day: real.getUTCDate(),
    },
    moon: {
      phase: moon,
      emoji: moonEmoji(moon),
      isExactFullMoon: isExactFullMoonDoy(doy),
    },
    events: [
      ...(festival ? [festival] : []),
      ...birthdaysToday,
      ...memorialsToday,
    ],
  };
}

/** Alle exacte Full Moon DOYs in de 365-dagen cyclus. */
export function listExactFullMoonDoys() {
  const out = [];
  for (let doy = 1; doy <= 365; doy++) {
    if (isExactFullMoonDoy(doy)) out.push(doy);
  }
  return out;
}
