/**
 * Genereert statische JSON voor Discord/andere clients (GitHub Pages heeft geen live API).
 *
 * Gebruik:
 *   node scripts/generate-api-json.mjs
 *   node scripts/generate-api-json.mjs --year=2026
 *
 * Output:
 *   data/days/001.json … 365.json  — dag + maan + events (geen nextFullMoon)
 *   data/full-moons.json            — alle exacte Full Moon DOYs + lookup per fromDoy
 *   data/meta.json                  — refYear, timezone, hoe te gebruiken
 *
 * Discord-bot (vandaag):
 *   1. Bepaal Gregoriaanse jaardag in Europe/Amsterdam (cap op 365)
 *   2. GET …/data/days/{doy padded 3}.json
 *
 * Discord-bot (volgende volle maan):
 *   GET …/data/full-moons.json  → nextByFromDoy[String(doy)]
 */

import { mkdir, writeFile, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SETTINGS } from '../settings.js';
import {
  buildDayPayload,
  findNextExactMoonPhase,
  getDayOfYearInTimeZone,
  getYMDInTimeZone,
  harptosLabelForDoy,
  listExactFullMoonDoys,
} from '../calendar-core.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA_DIR = join(ROOT, 'data');
const DAYS_DIR = join(DATA_DIR, 'days');

function parseYearArg(argv) {
  const flag = argv.find((a) => a.startsWith('--year='));
  if (flag) return Number(flag.slice('--year='.length));
  const idx = argv.indexOf('--year');
  if (idx >= 0 && argv[idx + 1]) return Number(argv[idx + 1]);
  return null;
}

async function main() {
  const timezone = SETTINGS.displayTimeZone || 'Europe/Amsterdam';
  const now = new Date();
  const { year: currentYear } = getYMDInTimeZone(now, timezone);
  const refYear = parseYearArg(process.argv) || currentYear;

  if (!Number.isInteger(refYear) || refYear < 1) {
    console.error('Ongeldig --year');
    process.exit(1);
  }

  await rm(DAYS_DIR, { recursive: true, force: true });
  await mkdir(DAYS_DIR, { recursive: true });

  const birthdays = [...SETTINGS.birthdays];
  const memorialDays = [...SETTINGS.memorialDays];

  for (let doy = 1; doy <= 365; doy++) {
    const payload = buildDayPayload({
      doy,
      refYear,
      timezone,
      birthdays,
      memorialDays,
    });
    const name = String(doy).padStart(3, '0') + '.json';
    await writeFile(join(DAYS_DIR, name), JSON.stringify(payload, null, 2) + '\n', 'utf8');
  }

  const fullMoonDoys = listExactFullMoonDoys();
  const nextByFromDoy = {};
  for (let doy = 1; doy <= 365; doy++) {
    const next = findNextExactMoonPhase(doy, 'full moon');
    nextByFromDoy[String(doy)] = next;
  }

  const fullMoons = {
    refYear,
    timezone,
    exactFullMoonDayOfYear: fullMoonDoys,
    exactFullMoons: fullMoonDoys.map((doy) => ({
      dayOfYear: doy,
      label: harptosLabelForDoy(doy),
    })),
    /** Lookup: from Harptos DOY → volgende exacte Full Moon */
    nextByFromDoy,
  };
  await writeFile(join(DATA_DIR, 'full-moons.json'), JSON.stringify(fullMoons, null, 2) + '\n', 'utf8');

  const todayDoy = Math.min(getDayOfYearInTimeZone(now, timezone), 365);
  const meta = {
    generatedAt: now.toISOString(),
    refYear,
    timezone,
    note:
      'Statische JSON: niet live bij request. Na wijzigingen in settings.js opnieuw genereren. Gregoriaanse entries hangen af van refYear (schrikkeljaren).',
    usage: {
      today: {
        step1: `Bepaal day-of-year in ${timezone} (max 365)`,
        step2: 'GET data/days/{doy als 001–365}.json',
        exampleTodayDoyAtGenerate: todayDoy,
        examplePath: `data/days/${String(todayDoy).padStart(3, '0')}.json`,
      },
      nextFullMoon: {
        step1: `Bepaal day-of-year in ${timezone} (max 365)`,
        step2: 'GET data/full-moons.json → nextByFromDoy[String(doy)]',
      },
    },
  };
  await writeFile(join(DATA_DIR, 'meta.json'), JSON.stringify(meta, null, 2) + '\n', 'utf8');

  console.log(`Generated data/days/001–365.json + full-moons.json + meta.json (refYear=${refYear})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
