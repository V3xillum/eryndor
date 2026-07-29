## Commit commandline ##
git add .
git commit -m "Update calendar"
git push

## Statische JSON voor Discord (geen live API) ##

GitHub Pages kan JSON **niet** dynamisch bij een request maken. Genereer daarom vooraf:

```bash
node scripts/generate-api-json.mjs
# optioneel vast jaar (Gregoriaanse entries / schrikkeljaar):
node scripts/generate-api-json.mjs --year=2026
```

Output onder `data/`:

- `data/days/001.json` … `365.json` — Harptos-dag, maan, events, `nextFullMoon`
- `data/full-moons.json` — alle exacte Full Moons + `nextByFromDoy`
- `data/meta.json` — metadata / gebruiksinfo

**Discord-bot:** bereken de Gregoriaanse jaardag in `Europe/Amsterdam` (max 365), haal dan `data/days/210.json` (padded) op. Na wijzigingen in `settings.js` opnieuw genereren en committen.
