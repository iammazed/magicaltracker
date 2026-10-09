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

**`data/venues.csv` and `data/resorts.csv` are the only source of truth.** Everything else is
derived from them. `catalog-entry.xlsx` is a generated copy and is gitignored — regenerating it
overwrites anything typed there that has not been exported back to CSV.

The round trip, in order:

```
npm run data:workbook     # rebuild the xlsx FROM the current CSVs
                          # -> upload to Google Sheets: File > Import > Replace spreadsheet
                          # -> edit there
                          # -> File > Download > CSV, once per tab, into data/
npm run data:normalize    # repair the dates Sheets reformats on export
npm run validate:data     # catch typos, bad coordinates, broken references
npm run db:import         # push verified rows to Supabase
```

**Always start a new editing session with `npm run data:workbook`.** That is what guarantees the
spreadsheet reflects any change made since you last exported — a schema change, a fix applied
directly to the CSV, anything. Skip it and you will overwrite those changes on your next
download, silently.

`data:normalize` is not optional. Sheets reformats anything it reads as a date, so `2026-09-21`
comes back as `9/21/2026` on every row, every time. The normalizer converts it back and strips
the BOM Excel adds. It is idempotent.

The workbook generator needs Python with openpyxl (`pip install openpyxl`). Editing the CSVs
directly in VS Code is always valid too — the **Rainbow CSV** extension makes 22 columns
survivable — in which case skip steps 1 through 4 entirely.

On Windows, turn on **File name extensions** in Explorer's View menu before renaming downloads.
With extensions hidden, typing `resorts.csv` as the new name produces `resorts.csv.csv`.

## What belongs in the catalog

Two different questions, with two different answers.

### Venues — can a non-guest book a table?

**If anyone can reserve or walk up, it belongs in `venues.csv`.** Ownership of the building is
irrelevant. That includes restaurants at non-Disney hotels on Walt Disney World property — the
character breakfast at Four Seasons Resort Orlando qualifies, as do the restaurants at the Swan,
Dolphin and Swan Reserve.

**Excluded:** venues only registered guests can use — resort pool bars, club-level lounges, and
hotel restaurants that turn away non-guests. Nobody else can log them, so they would only inflate
coverage denominators.

A venue at a hotel that is not in `resorts.csv` is fine. Leave `resort_id` blank and set
`area_id` to the resort area it sits in; `resort_id` is optional precisely for this.

### Resorts — on Walt Disney World property?

`resorts.csv` is currently **Disney-owned resorts plus the Swan, Dolphin and Swan Reserve**,
which are Marriott-operated but sit on property, use Disney transportation, and are walkable to
two parks.

**Out of scope entirely:** the Good Neighbor programme. Those hotels are off property, have no
Disney transportation, and run to the hundreds. Nothing off property goes in this file.

**Deliberately not added yet:** Four Seasons Resort Orlando, Shades of Green, and the Disney
Springs Resort Area hotels. All are on property, so a future decision could bring them in — but
they are not needed just to host a venue, and they would distort the resort passport. See below.

### Why the resort line matters

The passport asks "stayed at what percentage of resorts". Anything in `resorts.csv` is in that
denominator, so adding a resort makes 100% harder for everyone.

**Shades of Green is the clearest case.** It is run by the US Department of Defense for service
members, retirees and some DoD-affiliated civilians — most people are not *eligible* to stay
there, not merely unwilling. A denominator containing it can never be completed.

If on-property non-Disney hotels are ever added, they need a flag (`is_disney_owned` or similar)
and coverage must count only Disney-owned rows. Until then, keeping them out keeps the maths
honest.

Note that the Swan, Dolphin and Swan Reserve are already in and already count. They carry
`tier: deluxe`, which is our classification — Disney does not assign them a tier at all.

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
| `sub_area` | no | single value; see sub-areas below; blank for resort venues |
| `resort_id` | no | must match an `id` in `resorts.csv`; blank for in-park venues |
| `venue_kind` | yes | `restaurant` · `lounge` · `snack` · `cart` · `kiosk` · `food-truck` · `event` |
| `service_type` | yes | **pipe-delimited**: `quick` · `table` · `lounge` · `snack` |
| `dining_style` | no | **pipe-delimited**: `a-la-carte` · `buffet` · `family-style` · `prix-fixe` · `snack` |
| `cuisine` | yes, except `event` | free text, but reuse existing values — this drives a filter |
| `price_tier` | yes | single `1`–`4`. For a range, use the lower value. |
| `reservations_recommended` | yes | `TRUE` / `FALSE` |
| `is_character_dinner_dining` | yes | `TRUE` / `FALSE` |
| `is_character_breakfast_dining` | yes | `TRUE` / `FALSE` |
| `is_signature` | yes | `TRUE` / `FALSE` |
| `status` | yes | `open` · `seasonal` · `temporarily-closed` · `permanently-closed` |
| `lat` / `lng` | yes | decimal degrees, inside 28.28–28.44 / −81.65–−81.45 |
| `dinner_menu_url` | — | official disneyworld.com URL |
| `lunch_menu_url` | — | " |
| `breakfast_menu_url` | — | " |
| `snack_menu_url` | — | " |
| `lounge_menu_url` | — | " |
| `description` | yes | 1–2 sentences, **your own words** |
| `tags` | no | **controlled**, pipe-delimited — see tags below |
| `keywords` | no | **free text**, pipe-delimited — search only |
| `verified_on` | yes | `YYYY-MM-DD` — the gate |
| `source_url` | no | the page you verified against |

Disney publishes a different menu per meal period, so there are five URL columns rather than
one. **At least one must be filled**; the validator warns when all five are empty.

### `tags` vs `keywords`

**`tags` is a controlled list and drives achievements.** Only the values below are allowed, and
a typo is an error, because a wrong tag makes a badge unearnable.

**`keywords` is free text and drives search only.** Cuisine words, `alcohol`, `bakery`,
`cocktails` — anything useful. Nothing reads it except search, so a typo here is cosmetic.

If you are unsure which column something belongs in: **would an achievement ever depend on it?**
If no, it is a keyword.

### `venue_kind: event`

Ticketed, scheduled experiences — dessert parties, Candlelight Processional, the California
Grill fireworks party. **Events are excluded from coverage percentages**, so a seasonal dessert
party can never make 100% of a park unreachable for someone who visits in June. They remain
fully loggable and rateable, and `cuisine` is not required for them.

## resorts.csv

| Column | Required | Type / allowed values |
|---|---|---|
| `id` | yes | lowercase kebab slug |
| `name` | yes | exact official name |
| `destination_id` | yes | `wdw` |
| `area_id` | yes | a resort area (below) |
| `tier` | yes | `value` · `moderate` · `deluxe` · `villa` · `campground` |
| `transport` | yes | pipe-delimited: `monorail` · `skyliner` · `bus` · `boat` · `walk` · `shuttle` |
| `ownership` | yes | `disney-owned` · `partner` |
| `transport_notes` | no | free text, e.g. "Walk or boat to EPCOT and Hollywood Studios" |
| `lat` / `lng` | yes | as above |
| `official_url` | yes | disneyworld.com resort page |
| `description` | yes | your own words |
| `status` | yes | as above |
| `verified_on` | yes | the gate |
| `source_url` | yes | page verified against |

`transport` drives the **Transportation Challenge** achievement, so it has to be right — an
incorrect value makes a badge unearnable or wrongly earnable.

`transport` answers **which modes serve this resort**, which is all the achievement needs — the
badge is earned from what a user logs riding, not from the catalog. It cannot answer *to where*:
the boat from Wilderness Lodge and the boat from Beach Club go to completely different places,
and the same is true of `walk` and `monorail`.

`transport_notes` carries that detail for the resort screen, and only where it is not obvious.
Fill it for the Crescent Lake walkers and the Magic Kingdom walkway; leave it blank for a value
resort whose only mode is `bus`. Roughly a dozen rows, not all 34.

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

**`outpost` is not one of the eleven.** Refreshment Outpost sits between Germany and China and is
a perfectly legal `sub_area`, but it is not a country pavilion, so never put a `world-showcase-*`
tag on it — the validator will reject it, and the app would ignore it anyway. The slug was in the
pavilion list once and the result was the validator calling Drinking Around the World
permanently uncompletable, because no bar would ever be tagged there.

Both achievements count **pavilions covered, not venues visited** — one tagged venue in each of
the eleven is enough. So tag *every* qualifying venue, not one per country: someone who drinks
at La Cava del Tequila and someone who drinks at Choza de Margarita have both done Mexico, and
both must count.

- `world-showcase-bar` — any World Showcase venue serving alcohol (47 rows)
- `world-showcase-snack` — any you can grab food from without a sit-down meal: kiosks, carts,
  snack stands, quick service (23 rows)

Events count toward these. The event exclusion applies only to coverage *percentages*, where a
seasonal party would make a park uncompletable; a tequila tasting in Mexico is unambiguously a
drink in Mexico.

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
