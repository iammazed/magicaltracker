# Catalog data

`venues.csv` and `resorts.csv` are the **source of truth** for the catalog. They get imported to
Supabase, exported to JSON, bundled into the app, and seeded into on-device SQLite. Everything
downstream inherits any error here, so the rules below are strict.

## The one rule

**Every row must be verified against disneyworld.com before `verified_on` is filled in.**

A row with an empty `verified_on` is unverified and must not ship. That column is not metadata —
it is the gate.

Do not populate rows from memory, from an LLM, or from a fan site. Fan wikis carry closed venues
for years. LLMs confidently invent restaurants that closed in 2019, and invent coordinates that
are plausible but wrong. Open the official page, read it, then type the row.

## How to enter data

Use **`catalog-entry.xlsx`** in this folder. It is the same columns as the CSVs, with dropdowns
wired to the vocabularies below, so an invalid enum cannot be typed. `sub_area` filters itself
based on the `area_id` you picked in that row, and rows still missing `verified_on` tint red so
your progress is visible at a glance.

When a batch is done, export each tab and drop it in this folder as `venues.csv` /
`resorts.csv`, then:

```
npm run data:normalize    # repair what the spreadsheet broke
npm run validate:data     # catch typos and bad references
npm run db:import         # push verified rows to Supabase
```

**`data:normalize` is not optional after a Google Sheets export.** Sheets reformats anything it
reads as a date, so `2026-09-21` comes back as `9/21/2026` on every row, every time. The
normalizer converts it back and strips the BOM Excel adds. It is idempotent, so running it on
clean files does nothing.

On Windows, turn on **File name extensions** in Explorer's View menu before renaming downloads.
With extensions hidden, typing `resorts.csv` as the new name produces `resorts.csv.csv`.

Plain CSV export is not good enough — it mangles the apostrophe in `'Ohana` and every accented
character. It must be the UTF-8 variant.

Editing the CSVs directly is fine too; the workbook is a convenience, not a requirement. If you
do, the **Rainbow CSV** extension for VS Code makes 22 columns survivable.

## Workflow per row

1. Find the venue on disneyworld.com/dining.
2. Copy the **exact official name**, including punctuation (`'Ohana` has a leading apostrophe;
   `Chef Art Smith's Homecomin'` has a trailing one).
3. Fill the classification columns from the page.
4. Copy the menu page URL into `menu_url`.
5. Drop a pin in Google Maps at the actual building. Right-click → copy coordinates → `lat`/`lng`.
   Do not use a geocoding API; in-park addresses resolve to the park entrance, not the venue.
6. Write `description` **in your own words**. Do not paste Disney's marketing copy — that is a
   copyright issue separate from trademark, and it is the easy one to avoid.
7. Set `verified_on` to today (`YYYY-MM-DD`) and `source_url` to the page you read.

## venues.csv

| Column | Required | Type / allowed values |
|---|---|---|
| `id` | yes | lowercase kebab slug, globally unique, stable forever |
| `name` | yes | exact official name |
| `destination_id` | yes | `wdw` |
| `area_id` | yes | see areas below |
| `sub_area` | no | see sub-areas below; blank for resort venues |
| `resort_id` | no | must match an `id` in `resorts.csv`; blank for in-park venues |
| `venue_kind` | yes | `restaurant` · `lounge` · `snack` · `cart` |
| `service_type` | yes | `quick` · `table` · `lounge` · `snack` |
| `dining_style` | no | `a-la-carte` · `buffet` · `family-style` · `prix-fixe` |
| `cuisine` | yes | free text, but reuse existing values — this drives a filter |
| `price_tier` | yes | `1`–`4` (matches Disney's $ – $$$$) |
| `accepts_reservations` | yes | `TRUE` / `FALSE` |
| `is_character_dining` | yes | `TRUE` / `FALSE` |
| `is_signature` | yes | `TRUE` / `FALSE` |
| `status` | yes | `open` · `seasonal` · `temporarily-closed` · `permanently-closed` |
| `lat` | yes | decimal degrees, 6 dp, ~`28.3` – `28.4` |
| `lng` | yes | decimal degrees, 6 dp, ~`-81.6` – `-81.5` |
| `menu_url` | yes | official disneyworld.com URL |
| `description` | yes | 1–2 sentences, **your own words** |
| `tags` | no | pipe-delimited, see tags below |
| `verified_on` | yes | `YYYY-MM-DD` — the gate |
| `source_url` | yes | the page you verified against |

## resorts.csv

| Column | Required | Type / allowed values |
|---|---|---|
| `id` | yes | lowercase kebab slug |
| `name` | yes | exact official name |
| `destination_id` | yes | `wdw` |
| `area_id` | yes | a resort area (below) |
| `tier` | yes | `value` · `moderate` · `deluxe` · `villa` · `campground` |
| `transport` | yes | pipe-delimited: `monorail` · `skyliner` · `bus` · `boat` · `walk` |
| `lat` / `lng` | yes | as above |
| `official_url` | yes | disneyworld.com resort page |
| `description` | yes | your own words |
| `status` | yes | as above |
| `verified_on` | yes | the gate |
| `source_url` | yes | page verified against |

`transport` drives the **Transportation Challenge** achievement, so it has to be right — an
incorrect value makes a badge unearnable or wrongly earnable.

## Controlled vocabularies

Anything not on these lists is a typo. Filters break silently on typos — a misspelled `area_id`
makes a venue invisible rather than throwing an error.

### `area_id`

Parks: `magic-kingdom` · `epcot` · `hollywood-studios` · `animal-kingdom`

Other: `disney-springs` · `boardwalk` · `typhoon-lagoon` · `blizzard-beach` ·
`wide-world-of-sports`

Resort areas: `mk-resort-area` · `epcot-resort-area` · `ak-resort-area` ·
`springs-resort-area` · `sports-resort-area`

### `sub_area`

In-park only. **Verify these land names against the current park map** — Disney renames lands,
and the Epcot neighborhoods are relatively recent.

- **Magic Kingdom** — `main-street` · `adventureland` · `frontierland` · `liberty-square` ·
  `fantasyland` · `tomorrowland`
- **Epcot neighborhoods** — `world-celebration` · `world-discovery` · `world-nature`
- **Epcot World Showcase** — `mexico` · `norway` · `china` · `germany` · `italy` ·
  `american-adventure` · `japan` · `morocco` · `france` · `united-kingdom` · `canada`
- **Hollywood Studios** — `hollywood-blvd` · `echo-lake` · `commissary-lane` · `grand-avenue` ·
  `galaxys-edge` · `toy-story-land` · `sunset-blvd` · `animation-courtyard`
- **Animal Kingdom** — `oasis` · `discovery-island` · `pandora` · `africa` ·
  `rafiki-planet-watch` · `asia` · `dinoland`
- **Disney Springs** — `marketplace` · `the-landing` · `town-center` · `west-side`

The eleven World Showcase pavilions are load-bearing: **Drinking Around the World** and
**Snacking Around the World** are computed from them. If a pavilion slug is wrong, the
achievement cannot be completed.

### `tags`

Pipe-delimited. These drive achievements, so they are functional, not descriptive:

`world-showcase-bar` · `world-showcase-snack` · `character-dining` · `signature` ·
`breakfast` · `lunch` · `dinner` · `mobile-order` · `outdoor-seating`

Tag as you go. Retrofitting tags across 200 rows later costs a full day.

## Starter rows

The rows currently in both files are **structural examples, not verified data.** They show the
column shape for an in-park venue, a resort venue, and a lounge. Their `verified_on` is
deliberately blank and their `lat`/`lng`/`menu_url`/`description` are deliberately empty —
those are exactly the fields that cannot be filled without opening the official page.

Verify them like any other row before shipping, or delete them.

## Editing

Any spreadsheet works. If you use Excel, **save as CSV UTF-8** — the default CSV export mangles
the apostrophe in `'Ohana` and any accented character.

Names containing commas must be quoted: `"Jiko - The Cooking Place, Animal Kingdom Lodge"`.
