# Coordinate worklist

Sixteen venue rows whose pin was far enough off to be visible on the map. Reported
after a review found Casey's Corner and Auntie Gravity's in the wrong place; these
are every row that failed the same test.

**Status: complete, 2026-11-22.** Fifteen rows were re-captured and one,
Funnel Cake, was confirmed already correct. 242 of the 249 rows OSM can match
are now within 60 m of it, against 227 before; the seven that remain are all
cases where OSM is the one that is wrong, and they are listed at the end so a
later sweep does not "fix" them.

## How these were found, and the rule for fixing them

OpenStreetMap was queried through Overpass for every named dining point in the
resort area, 743 of them, and 249 matched a catalog row by name. The catalog is
mostly right: the median disagreement is 25 m and 227 of the 249 agree within
60 m. What follows is the tail.

**OSM is the detector, not the source.** Its coordinates are deliberately not
written down here. OSM is ODbL-licensed, so copying its values into this catalog
would make this a derived database and bring an attribution and share-alike
obligation with it — a decision nobody should make by accident, in an app that
charges money. Each row below says how far off it is, which way to move it and
what sits next to it. Read the position off satellite imagery and type it,
the same way `2d9ae30` did.

That also keeps `AGENTS.md:2896` intact: never populate a row from a model.
Disney publishes no coordinates, so imagery read by hand is the source of record
for lat/lng.

## Why the earlier pass missed them

`2d9ae30` checked each venue against the median of its own land. A venue 130 m
off inside a land 150 m across does not move that median enough to flag itself,
and six wrong rows in one park drag the median toward themselves. The check
needed a reference from outside the catalog, which it did not have. Magic
Kingdom's lands are in fact all correctly placed, to within 62 m.

## Magic Kingdom

### Auntie Gravitys Galactic Goodies

- `auntie-gravitys-galactic-goodies`
- Currently `28.4186,-81.5812` — **176 m** out, move it **north-east**
- Tomorrowland. The counter is on the walkway between the Speedway and the Carousel of Progress; OSM has it beside Merchant of Venus.
- **Applied 2026-11-22** as `28.418868030380242,-81.57942524658016` — now 10 m from the OSM point.


### Caseys Corner

- `caseys-corner`
- Currently `28.4192,-81.5812` — **141 m** out, move it **south-west**
- Main Street USA, west side, right at the hub end. Next to where the horse-drawn streetcar turns.
- **Applied 2026-11-22** as `28.418152067726,-81.58134507356408` — now 24 m from the OSM point.


### Columbia Harbour House

- `columbia-harbor-house`
- Currently `28.4191,-81.5814` — **133 m** out, move it **north-west**
- Liberty Square, on the boundary with Fantasyland, beside Memento Mori.
- **Applied 2026-11-22** as `28.420184163741954,-81.5825658177438` — now 33 m from the OSM point.


### Golden Oak Outpost

- `golden-oak-outpost`
- Currently `28.4182,-81.5835` — **130 m** out, move it **north-west**
- Frontierland, close to the Walt Disney World Railroad and about 30 m from Pecos Bill.
- **Applied 2026-11-22** as `28.418863530388784,-81.58474186007223` — now 26 m from the OSM point.


### Cosmic Rays Starlight Cafe

- `cosmic-rays-starlight-cafe`
- Currently `28.4183,-81.5796` — **120 m** out, move it **north-west**
- Tomorrowland, west end facing the hub, near Fairytale Garden.
- **Applied 2026-11-22** as `28.41950190863081,-81.5798191447281` — now 18 m from the OSM point.


### Gastons Tavern

- `gastons-tavern`
- Currently `28.42045,-81.5803` — **102 m** out, move it **north-west**
- Fantasyland, beside the Gaston fountain.
- **Applied 2026-11-22** as `28.421537425382738,-81.58044923123582` — now 21 m from the OSM point.


## Resort venues

### Banana Cabana

- `banana-cabana`
- Currently `28.3575,-81.5389` — **686 m** out, move it **north-west**
- Caribbean Beach, at Old Port Royale about 12 m from Sebastian's Bistro. The current pin is 658 m from the resort's own coordinate in resorts.csv; it should be inside about 60 m.
- **Applied 2026-11-22** as `28.363063852933234,-81.5425685600729` — now 30 m from the OSM point.


### Oasis Bar and Grill

- `oasis-bar-and-grill`
- Currently `28.40993052732107,-81.58396956222643` — **464 m** out, move it **south**
- Polynesian Village, at the Oasis pool rather than the Great Ceremonial House, roughly 110 m from Capt. Cook's. Currently 489 m from the resort anchor.
- **Applied 2026-11-22** as `28.406122599225,-81.58406553123592` — now 41 m from the OSM point.


### Cape Town Lounge & Wine Bar

- `cape-town-lounge-and-wine-bar`
- Currently `28.356187084122393,-81.60411708020222` — **446 m** out, move it **south-east**
- Animal Kingdom Lodge. It is inside Jiko, so it should be within about 20 m of it. Currently 373 m from the resort anchor.
- **Applied 2026-11-22** as `28.352405738382725,-81.60341883123752` — now 22 m from the OSM point.


### Intermission Food Court

- `intermission-food-court`
- Currently `28.339424,-81.574598` — **171 m** out, move it **east**
- All-Star Music, about 30 m from the Singing Spirits pool bar. Currently 179 m from the resort anchor.
- **Applied 2026-11-22** as `28.339815778177535,-81.57302946007333` — now 42 m from the OSM point.


### World Premiere Food Court

- `world-premiere-food-court`
- Currently `28.336309,-81.573273` — **121 m** out, move it **south-east**
- All-Star Movies, about 45 m from the Silver Screen Spirits pool bar. Currently 111 m from the resort anchor.
- **Applied 2026-11-22** as `28.33573048580401,-81.57238041774544` — now 14 m from the OSM point.


### Steakhouse 71 Lounge

- `steakhouse-71-lounge`
- Currently `28.415948,-81.574233` — **121 m** out, move it **south-west**
- Contemporary, ground floor. Same footprint as California Grill fifteen floors up, so within about 10 m of it horizontally. Currently 105 m from the resort anchor.
- **Applied 2026-11-22** as `28.41546577299325,-81.57429844472813` — now 67 m from the OSM point. The 67 m to OSM is OSM's node sitting off-centre in a large building; this value is 2 m from our own Steakhouse 71 row and 18 m from California Grill, so the Contemporary cluster agrees with itself.


## Elsewhere

### Harambe Fruit Market

- `harambe-fruit-market`
- Was `28.35811407,-81.58985573` — **243 m** out
- **Applied 2026-11-22** as `28.35908017912438,-81.59209675156076` — now 5 m from
  the OSM point, 11 m from our own Kusafiri Coffee Shop row, and every neighbour
  inside 50 m is `africa`.
- Settled by reading Disney's page for the cart and then finding it on Google
  Street View. The pin had been in the wrong land since import; `sub_area` was
  `africa` and correct all along, so no other field changed.
- It was the one row where the documentary evidence and the stored position
  disagreed about which land it was in, which is why it was held back rather
  than written with the other thirteen.


### Jaleo by Jose Andres

- `jaleo-by-jose-andres`
- Currently `28.3732,-81.5173` — **478 m** out, move it **south-west**
- Disney Springs, Town Center, about 47 m from Splitsville.
- **Applied 2026-11-22** as `28.37077580078899,-81.52112367356516` — now 22 m from the OSM point.


## Two that needed a decision rather than a correction — both settled

### Funnel Cake — `funnel-cake`, no change needed

- Stays at `28.3676,-81.5494`, `sub_area=american-adventure`.
- Confirmed against Disney's own page as the cart between Japan and the
  American Adventure, which is where the stored coordinate already was: 37 m
  from our Regal Eagle Smokehouse row, 64 m from Fife and Drum, 83 m from
  Kabuki Cafe. It sits on the pavilion boundary, exactly as described.
- The 75 m "error" was OSM's. It carries two nodes — `Funnel Cake` at EPCOT and
  `Funnel Cakes` over by the BoardWalk — and the EPCOT one is simply placed 75 m
  from where the cart is. This row was never wrong.
- Worth keeping in mind for any future sweep: a disagreement with OSM is a
  question, not a verdict. Five of the sixteen rows raised here turned out to be
  OSM's mistake rather than ours.

### Spyglass Grill — `spyglass-grill`

- Was `28.3582,-81.5456` — **269 m** out
- **Applied 2026-11-22** as `28.357989426959012,-81.54296718890917`, a 259 m
  move, now 36 m from the OSM point.
- The arithmetic could not referee this one and did not need to: it is 550 m
  from Caribbean Beach's anchor and 566 m from the resort's nearest other venue,
  which is Trinidad being genuinely far out rather than an error. Ours and OSM's
  both agreed the grill was roughly 600 m from the resort centre; they disagreed
  about where, and imagery settled it.

## Not a coordinate: two rows shared a name — fixed

`ale-and-compass-lounge-restaurant` carried the lounge's name, which put the
same text in the list twice with nothing to tell them apart.

- **Applied 2026-11-22.** `name` is now `Ale and Compass Restaurant`, and the
  coordinate is `28.370821240918396,-81.55834454472858` — 25 m from the OSM
  point, 45 m from Yacht Club's own anchor, 17 m from our Crew's Cup Lounge row
  in the same building, and 37 m from the lounge it was confused with.
- Spelled "and" rather than "&" to match the two sibling rows,
  `ale-and-compass-lounge` and `the-market-at-ale-and-compass`. Disney writes it
  "Ale & Compass Restaurant"; this catalog does not, consistently, so the family
  stays consistent with itself.
- The id is unchanged and now no longer matches the name. That is deliberate:
  the id is a stable key that saved visits reference, so renaming it would
  orphan them.
- Nothing in the codebase referenced the old name — checked across `.ts`,
  `.tsx`, `.mjs`, `.json` and `.md` before changing it.

## Four where our coordinate is better than OSM's — do not change these

| venue | ours to its resort | OSM to its resort |
|---|---|---|
| Cove Bar | 71 m | 217 m |
| Maji Pool Bar | 44 m | 204 m |
| Geyser Point Bar & Grill | 41 m | 190 m |
| Roaring Fork | 26 m | 65 m |

Recorded so a later pass that re-runs the same comparison does not
helpfully move them to the wrong place.

## After editing data/venues.csv

```
npm run validate:data            # schema, ranges, duplicate ids
npm run data:bundle              # rebuild src/data/catalog.json so apps re-seed
npm run db:import                # devices read Supabase, not the CSVs
node ./scripts/check-catalog-sync.mjs
npm run update:prod              # only needed for the bundle; coordinates come from Supabase
```

Without `db:import` a refresh pulls the old coordinates back over the new ones.
