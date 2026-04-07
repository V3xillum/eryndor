/**
 * Instellingen — één plek voor timezone, debug en verjaardagen/memorials.
 *
 * Tip: dit is het enige bestand dat je meestal hoeft aan te passen.
 */
export const SETTINGS = Object.freeze({
  displayTimeZone: 'Europe/Amsterdam',
  /** Standaard aan/uit; runtime override via snelle tikken op .title-block (zie DEBUG_TITLE_TAP_TO_TOGGLE). */
  debugCalendar: false,
  debugScenario: 'hammer1_stack', // midwinter_stack, hammer1_stack
  ui: {
    showTendaySigil: true,
    showSeasonAccent: true,
    showWaxSeal: true,
    enableCssAnimations: true, // banners + special cards + today pulse
    enableFestFx: true,        // seasonal/memorial canvas FX
    enableConfetti: true,      // birthday confetti canvas
    enableBackgroundHaze: true, // subtle non-festival background depth
  },
  /**
   * Verjaardagen.
   *
   * Je mag per entry 1 van deze vormen gebruiken:
   * - Harptos datum: `{ month: 'Mirtul', day: 30, name: 'Brunn' }`
   * - Harptos dayOfYear: `{ dayOfYear: 31, name: '...' }` (handig voor feestdagen)
   * - Gregoriaans: `{ gregorian: { month: 5, day: 10 }, name: '...' }`
   *   Ook als string: `"YYYY-MM-DD"` of `"M-D"` (jaar wordt genegeerd; maand+dag telt).
   */
  birthdays: [
    { month: 'Mirtul',    day: 15, name: 'Nixy Fernlore' },
    { month: 'Mirtul',    day: 30, name: 'Brunn' },
    { name: 'Kezra', gregorian: { month: 5, day: 10 } }, /* 10 mei → zelfde DOY als Harptos in deze 1:1-mapping */
    { month: 'Marpenoth', day: 14, name: 'Orlin Ashleaf' },
    { month: 'Nightal',   day: 11, name: 'Barry' },
    { month: 'Flamerule', day: 29, name: 'Fireheart' },
  ],
  /**
   * Mijlpalen / herdenkingen.
   *
   * Zelfde datum-opties als bij birthdays:
   *
   * Extra velden:
   * - `subtitle`: extra tekst onder de titel (bv. “4 april 2026”)
   * - `type: 'death'`: toont de 🕯 styling (gevallen personage / rouw)
   */
  memorialDays: [
    { dayOfYear: 311, title: 'Eerste stap op Eryndor',},
    { dayOfYear: 312, title: 'Stichting van The Pixie\'s Promise' },
    { dayOfYear: 348, title: 'Draxion', type: 'death', subtitle: '14 december 2025' },
    { gregorian: "4-4", title: "Velkan", type: "death", subtitle: "4 april 2026" },

  ],
});
