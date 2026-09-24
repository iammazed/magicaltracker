/**
 * Single source of truth for the catalog's controlled vocabularies.
 *
 * Imported by both validate-data.mjs and import-catalog.mjs so the two can
 * never disagree. If you change something here, update data/README.md to match
 * — that file is the human-readable copy and it is the one you'll read at 11pm
 * while typing in restaurants.
 */

/** Areas, in the order they should appear in a filter list. */
export const AREA_ROWS = [
  // Parks
  { id: 'magic-kingdom', name: 'Magic Kingdom', kind: 'park' },
  { id: 'epcot', name: 'EPCOT', kind: 'park' },
  { id: 'hollywood-studios', name: "Disney's Hollywood Studios", kind: 'park' },
  { id: 'animal-kingdom', name: "Disney's Animal Kingdom", kind: 'park' },
  { id: 'typhoon-lagoon', name: 'Typhoon Lagoon', kind: 'park' },
  { id: 'blizzard-beach', name: 'Blizzard Beach', kind: 'park' },

  // Districts
  { id: 'disney-springs', name: 'Disney Springs', kind: 'district' },
  { id: 'boardwalk', name: "Disney's BoardWalk", kind: 'district' },
  { id: 'wide-world-of-sports', name: 'ESPN Wide World of Sports', kind: 'district' },

  // Resort areas
  { id: 'mk-resort-area', name: 'Magic Kingdom Resort Area', kind: 'resort_area' },
  { id: 'epcot-resort-area', name: 'EPCOT Resort Area', kind: 'resort_area' },
  { id: 'ak-resort-area', name: 'Animal Kingdom Resort Area', kind: 'resort_area' },
  { id: 'springs-resort-area', name: 'Disney Springs Resort Area', kind: 'resort_area' },
  { id: 'sports-resort-area', name: 'ESPN Wide World of Sports Resort Area', kind: 'resort_area' },
];

export const DESTINATION_ROWS = [{ id: 'wdw', name: 'Walt Disney World Resort' }];

export const AREAS = AREA_ROWS.map((a) => a.id);
export const PARKS = AREA_ROWS.filter((a) => a.kind === 'park').map((a) => a.id);
export const RESORT_AREAS = AREA_ROWS.filter((a) => a.kind === 'resort_area').map((a) => a.id);

/** Which sub_area values are legal within which area. */
export const SUB_AREAS = {
  'magic-kingdom': [
    'main-street', 'adventureland', 'frontierland',
    'liberty-square', 'fantasyland', 'tomorrowland',
  ],
  epcot: [
    'world-celebration', 'world-discovery', 'world-nature',
    'mexico', 'norway', 'china', 'germany', 'italy', 'american-adventure',
    'japan', 'morocco', 'france', 'united-kingdom', 'canada',
  ],
  'hollywood-studios': [
    'hollywood-blvd', 'echo-lake', 'commissary-lane', 'grand-avenue',
    'galaxys-edge', 'toy-story-land', 'sunset-blvd', 'animation-courtyard',
  ],
  'animal-kingdom': [
    'oasis', 'discovery-island', 'pandora', 'africa',
    'rafiki-planet-watch', 'asia', 'dinoland',
  ],
  'disney-springs': ['marketplace', 'the-landing', 'town-center', 'west-side'],
};

/** The eleven pavilions. Drinking/Snacking Around the World read these. */
export const WORLD_SHOWCASE = [
  'mexico', 'norway', 'china', 'germany', 'italy', 'american-adventure',
  'japan', 'morocco', 'france', 'united-kingdom', 'canada',
];

export const TAGS = [
  'world-showcase-bar', 'world-showcase-snack', 'character-dining', 'signature',
  'breakfast', 'lunch', 'dinner', 'mobile-order', 'outdoor-seating',
];

export const TRANSPORT = ['monorail', 'skyliner', 'bus', 'boat', 'walk'];
export const STATUS = ['open', 'seasonal', 'temporarily-closed', 'permanently-closed'];
export const RESORT_TIERS = ['value', 'moderate', 'deluxe', 'villa', 'campground'];
export const VENUE_KINDS = ['restaurant', 'lounge', 'snack', 'cart'];
export const SERVICE_TYPES = ['quick', 'table', 'lounge', 'snack'];
export const DINING_STYLES = ['a-la-carte', 'buffet', 'family-style', 'prix-fixe'];

/** Walt Disney World property, generously bounded. Mirrored as a CHECK
 *  constraint in src/db/schema.ts — keep the two in sync. */
export const BOUNDS = { latMin: 28.28, latMax: 28.44, lngMin: -81.65, lngMax: -81.45 };

export const VENUE_COLUMNS = [
  'id', 'name', 'destination_id', 'area_id', 'sub_area', 'resort_id', 'venue_kind',
  'service_type', 'dining_style', 'cuisine', 'price_tier', 'accepts_reservations',
  'is_character_dining', 'is_signature', 'status', 'lat', 'lng', 'menu_url',
  'description', 'tags', 'verified_on', 'source_url',
];

export const RESORT_COLUMNS = [
  'id', 'name', 'destination_id', 'area_id', 'tier', 'transport', 'lat', 'lng',
  'official_url', 'description', 'status', 'verified_on', 'source_url',
];

/* ── CSV parsing ──────────────────────────────────────────────────────── */

/** Handles quoted fields, embedded commas, and escaped quotes. */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  const src = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  if (inQuotes) throw new Error('Unterminated quoted field — check for a stray " character');
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

/** Reads a CSV into `{ rec, line }` records keyed by header name. */
export function readTable(path, expectedColumns, fs) {
  if (!fs.existsSync(path)) return { missing: true, records: [], headerIssues: [] };

  const rows = parseCsv(fs.readFileSync(path, 'utf8'));
  const header = rows[0].map((h) => h.trim());
  const headerIssues = [];

  const missing = expectedColumns.filter((c) => !header.includes(c));
  const extra = header.filter((c) => !expectedColumns.includes(c));
  if (missing.length) headerIssues.push(`missing column(s): ${missing.join(', ')}`);
  if (extra.length) headerIssues.push(`unexpected column(s): ${extra.join(', ')}`);

  const records = rows.slice(1).map((cells, idx) => {
    const rec = {};
    header.forEach((h, i) => { rec[h] = (cells[i] ?? '').trim(); });
    return { rec, line: idx + 2, cellCount: cells.length };
  });

  return { header, headerIssues, records, columnCount: header.length };
}
