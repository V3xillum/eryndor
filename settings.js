/**
 * Instellingen — één plek voor timezone, debug en verjaardagen/memorials.
 *
 * Tip: dit is het enige bestand dat je meestal hoeft aan te passen.
 */
export const SETTINGS = Object.freeze({
  displayTimeZone: 'Europe/Amsterdam',
  /** Standaard aan/uit; runtime override via snelle tikken op .title-block (zie DEBUG_TITLE_TAP_TO_TOGGLE). */
  debugCalendar: false,
  debugScenario: null, // midwinter_stack, hammer1_stack
  birthdays: [
    { month: 'Mirtul',    day: 15, name: 'Nixy Fernlore' },
    { month: 'Mirtul',    day: 30, name: 'Brunn' },
    { name: 'Kezra', gregorian: { month: 5, day: 10 } }, /* 10 mei → zelfde DOY als Harptos in deze 1:1-mapping */
    { month: 'Marpenoth', day: 14, name: 'Orlin Ashleaf' },
    { month: 'Nightal',   day: 11, name: 'Barry' },
    { month: 'Flamerule', day: 29, name: 'Fireheart' },
  ],
  memorialDays: [
    { dayOfYear: 311, title: 'Eerste stap op Eryndor', subtitle: 'Feest' },
    { dayOfYear: 312, title: 'Stichting van The Pixie\'s «Promise»' },
    { dayOfYear: 348, title: 'Draxion', type: 'death', subtitle: '14 december 2025' },
  ],
});
