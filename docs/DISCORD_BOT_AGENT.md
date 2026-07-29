# Eryndor Calendar — Discord Bot Agent Brief

Instructions for an AI agent implementing a Discord bot that consumes the **static JSON API** of the Calendar of Eryndor.

## Goal

Expose two Discord commands (slash or prefix — prefer slash):

1. **Today** — current Harptos day, moon phase, and events (birthdays, memorials, festivals).
2. **Next full moon** — next *exact* Full Moon (not Rising/Fading).

These are **separate endpoints**. Day JSON does **not** include next full moon.

User-facing replies should be in **Dutch**.

## Critical constraints

- The calendar site is **static GitHub Pages**. There is **no live API** that computes “today” on request.
- JSON files are **pre-generated**. After `settings.js` changes on the calendar repo, someone must run `npm run generate-api-json` and push `data/`.
- The bot must compute the current Harptos day-of-year (DOY) itself, then fetch the matching file(s).
- Cap Gregorian day-of-year at **365** (Harptos has no leap day; 29 Feb is ignored).

## Base URLs

Prefer Pages (same origin as the calendar UI):

```
https://v3xillum.github.io/eryndor
```

Calendar UI: https://v3xillum.github.io/eryndor/

Fallback if Pages is not updated yet:

```
https://raw.githubusercontent.com/V3xillum/eryndor/main
```

Paths are the same under both bases (`/data/...`).

## Endpoints

### 1. Today — day + events

```
GET {BASE}/data/days/{doy}.json
```

- `{doy}` = `001` … `365` (always **3 digits**, zero-padded).
- Contains: Harptos date, moon phase, events only.
- Example: https://v3xillum.github.io/eryndor/data/days/210.json

### 2. Next full moon

```
GET {BASE}/data/full-moons.json
```

- Use `nextByFromDoy[String(doy)]` for the next exact Full Moon from a given DOY.
- Example: https://v3xillum.github.io/eryndor/data/full-moons.json

### 3. Meta (optional)

```
GET {BASE}/data/meta.json
```

## How to compute “today” DOY

Timezone: **`Europe/Amsterdam`** (must match calendar).

```js
function harptosDoyNow(date = new Date(), timeZone = 'Europe/Amsterdam') {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const y = +parts.find((p) => p.type === 'year').value;
  const m = +parts.find((p) => p.type === 'month').value;
  const d = +parts.find((p) => p.type === 'day').value;
  const ml = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if ((y % 4 === 0 && y % 100 !== 0) || y % 400 === 0) ml[1] = 29;
  let n = d;
  for (let i = 0; i < m - 1; i++) n += ml[i];
  return Math.min(n, 365);
}

function dayUrl(base, doy) {
  return `${base}/data/days/${String(doy).padStart(3, '0')}.json`;
}
```

## Day JSON schema (`/vandaag`)

```json
{
  "dayOfYear": 210,
  "refYear": 2026,
  "timezone": "Europe/Amsterdam",
  "leapYearNote": null,
  "harptos": {
    "label": "28 Flamerule",
    "month": "Flamerule",
    "day": 28,
    "special": null
  },
  "gregorian": {
    "iso": "2026-07-29",
    "year": 2026,
    "month": 7,
    "day": 29
  },
  "moon": {
    "phase": "Dark Moon (Fading)",
    "emoji": "🌑",
    "isExactFullMoon": false
  },
  "events": []
}
```

### Field notes

| Field | Meaning |
|--------|---------|
| `harptos.label` | Display date, or festival name (e.g. `Midwinter`) |
| `harptos.special` | Festival name or `null` |
| `moon.isExactFullMoon` | `true` only on exact `"Full Moon"` (not Rising/Fading) |
| `events[]` | Zero or more events for that day |
| `leapYearNote` | Non-null string in Gregorian leap years |

### Event object types

**Festival**

```json
{ "type": "festival", "name": "Midwinter", "icon": "❄️", "css": "midwinter" }
```

**Birthday**

```json
{ "type": "birthday", "name": "Nixy Fernlore" }
```

**Memorial**

```json
{
  "type": "memorial",
  "title": "Eerste stap op Eryndor",
  "memorialType": "festive",
  "subtitle": null
}
```

`memorialType`: `"festive"` | `"death"` | `"memorial"` (subdued / default).

## Full moons JSON (`/vollemaan`)

```js
const doy = harptosDoyNow();
const moons = await (await fetch(`${BASE}/data/full-moons.json`)).json();
const next = moons.nextByFromDoy[String(doy)];
// next: { dayOfYear, daysUntil, whenText, label }
```

`nextByFromDoy` values use **exact** Full Moon only (not Rising/Fading).

## Suggested Discord commands

### `/vandaag` (or `/today`)

1. Fetch **only** day JSON for current DOY.
2. Reply with an embed (or plain text), Dutch, e.g.:

- **Titel:** Vandaag — `{harptos.label}`
- Gregoriaans: `{gregorian.iso}` (or formatted)
- Maan: `{moon.emoji} {moon.phase}`
- Events: list or “Geen events vandaag”

Event line ideas:

- birthday → `🎂 {name}`
- festival → `{icon} {name}`
- memorial festive → `✨ {title}`
- memorial death → `🕯 {title}` (+ subtitle if present)
- memorial default → `✦ {title}`

### `/vollemaan` (or `/fullmoon`)

1. Compute DOY.
2. Fetch **`/data/full-moons.json`** (not the day file).
3. Read `nextByFromDoy[String(doy)]`.

Reply e.g.:

- **Volgende Full Moon:** 🌕 `{label}`
- `{whenText}` (`vandaag` / `morgen` / `over N dagen`)
- DOY / Harptos label as needed

## Error handling

- Non-2xx or invalid JSON → tell the user the calendar data could not be loaded; suggest retry later.
- Prefer Pages URL; on persistent 404, fall back to `raw.githubusercontent.com`.
- Server-side `fetch` in the bot (CORS is irrelevant for a Discord bot process).

## Do not

- Do not scrape the HTML calendar page for data.
- Do not invent Harptos dates or moon phases; trust the JSON.
- Do not expect `nextFullMoon` on day JSON — use `full-moons.json` only.
- Do not treat `"Full Moon (Rising)"` / `"Full Moon (Fading)"` as exact full moon (`nextByFromDoy` already uses exact only).
- Do not assume `events` is non-empty.

## Source of truth (calendar repo)

| Path | Role |
|------|------|
| `settings.js` | Birthdays & memorials (edit here) |
| `calendar-core.js` | Shared Harptos / moon logic |
| `scripts/generate-api-json.mjs` | Regenerates `data/` |
| `data/days/*.json` | Per-day API (today only) |
| `data/full-moons.json` | Full moon index / next lookup |
| `data/meta.json` | Generation metadata |

Regenerate after settings changes:

```bash
npm run generate-api-json
# optional: npm run generate-api-json -- --year=2026
```

Then commit and push `data/`.

## Quick test checklist

- [ ] `GET …/data/days/210.json` returns JSON without `nextFullMoon`
- [ ] `GET …/data/full-moons.json` has `nextByFromDoy`
- [ ] `harptosDoyNow()` in Amsterdam matches calendar “vandaag”
- [ ] `/vandaag` shows label + moon + events only
- [ ] `/vollemaan` uses `full-moons.json` only
- [ ] Empty `events` still produces a valid reply
