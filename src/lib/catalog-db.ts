import type { SQLiteDatabase } from 'expo-sqlite';

import bundle from '@/data/catalog.json';

/**
 * The catalog, on device.
 *
 * Three layers, in order:
 *
 *   1. `src/data/catalog.json` ships inside the JS bundle. A brand-new install
 *      has all 394 venues before it has ever touched the network.
 *   2. SQLite is seeded from that bundle in `onInit`, before the first render,
 *      so every screen reads from one place and there is no "bundle or
 *      database?" branch anywhere above this file.
 *   3. A background fetch from Supabase overwrites those rows, so a venue that
 *      closes between App Store releases can be corrected without shipping a
 *      new build — and the correction survives being offline next launch.
 *
 * The bundle version is the FLOOR. A new app release carries a new bundle, which
 * re-seeds and discards whatever the old remote fetch left behind. That is the
 * right way round: the bundle is generated from the same CSVs the database is
 * imported from, so a newer bundle is never older than the rows it replaces.
 *
 * These tables are read-only replicas of upstream data. They are deliberately
 * `catalog_`-prefixed to keep them visibly distinct from the user's own rows in
 * `local-db.ts`, which are the ones that would actually hurt to lose.
 */

export const BUNDLE_VERSION: string = bundle.version;

export type CatalogArea = { id: string; name: string; kind: string };

export type CatalogVenue = {
  id: string;
  name: string;
  area_id: string;
  sub_area: string | null;
  resort_id: string | null;
  venue_kind: string;
  service_type: string[];
  dining_style: string[];
  cuisine: string | null;
  price_tier: number;
  reservations_recommended: boolean;
  is_character_dinner_dining: boolean;
  is_character_breakfast_dining: boolean;
  is_signature: boolean;
  status: string;
  lat: number | null;
  lng: number | null;
  dinner_menu_url: string | null;
  lunch_menu_url: string | null;
  breakfast_menu_url: string | null;
  snack_menu_url: string | null;
  lounge_menu_url: string | null;
  description: string | null;
  tags: string[];
  keywords: string[];
};

export type CatalogResort = {
  id: string;
  name: string;
  area_id: string;
  tier: string;
  transport: string[];
  transport_notes: string | null;
  ownership: string;
  lat: number | null;
  lng: number | null;
  official_url: string | null;
  description: string | null;
  status: string;
};

export type Catalog = {
  areas: CatalogArea[];
  venues: CatalogVenue[];
  resorts: CatalogResort[];
  /** Which bundle these rows came from, and whether a refresh has landed. */
  version: string;
  source: 'bundle' | 'remote';
};

/* ── Schema ───────────────────────────────────────────────────────────── */

/**
 * Arrays are stored as JSON text rather than as join tables.
 *
 * Filtering happens in memory over ~400 rows, so there is no query that would
 * benefit from the normalisation, and a join table for `tags` would turn one
 * insert into five.
 */
export const CATALOG_DDL = `
  CREATE TABLE IF NOT EXISTS catalog_meta (
    key   TEXT PRIMARY KEY NOT NULL,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS catalog_areas (
    id   TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    kind TEXT NOT NULL,
    sort INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS catalog_resorts (
    id              TEXT PRIMARY KEY NOT NULL,
    name            TEXT NOT NULL,
    area_id         TEXT NOT NULL,
    tier            TEXT NOT NULL,
    transport       TEXT NOT NULL DEFAULT '[]',
    transport_notes TEXT,
    ownership       TEXT NOT NULL,
    lat             REAL,
    lng             REAL,
    official_url    TEXT,
    description     TEXT,
    status          TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS catalog_venues (
    id                            TEXT PRIMARY KEY NOT NULL,
    name                          TEXT NOT NULL,
    area_id                       TEXT NOT NULL,
    sub_area                      TEXT,
    resort_id                     TEXT,
    venue_kind                    TEXT NOT NULL,
    service_type                  TEXT NOT NULL DEFAULT '[]',
    dining_style                  TEXT NOT NULL DEFAULT '[]',
    cuisine                       TEXT,
    price_tier                    INTEGER NOT NULL,
    reservations_recommended      INTEGER NOT NULL DEFAULT 0,
    is_character_dinner_dining    INTEGER NOT NULL DEFAULT 0,
    is_character_breakfast_dining INTEGER NOT NULL DEFAULT 0,
    is_signature                  INTEGER NOT NULL DEFAULT 0,
    status                        TEXT NOT NULL,
    lat                           REAL,
    lng                           REAL,
    dinner_menu_url               TEXT,
    lunch_menu_url                TEXT,
    breakfast_menu_url            TEXT,
    snack_menu_url                TEXT,
    lounge_menu_url               TEXT,
    description                   TEXT,
    tags                          TEXT NOT NULL DEFAULT '[]',
    keywords                      TEXT NOT NULL DEFAULT '[]'
  );

  CREATE INDEX IF NOT EXISTS catalog_venues_area_idx   ON catalog_venues (area_id);
  CREATE INDEX IF NOT EXISTS catalog_venues_resort_idx ON catalog_venues (resort_id);
  CREATE INDEX IF NOT EXISTS catalog_venues_kind_idx   ON catalog_venues (venue_kind);
`;

/* ── Seeding ──────────────────────────────────────────────────────────── */

const VENUE_INSERT = `
  INSERT INTO catalog_venues (
    id, name, area_id, sub_area, resort_id, venue_kind, service_type,
    dining_style, cuisine, price_tier, reservations_recommended,
    is_character_dinner_dining, is_character_breakfast_dining, is_signature,
    status, lat, lng, dinner_menu_url, lunch_menu_url, breakfast_menu_url,
    snack_menu_url, lounge_menu_url, description, tags, keywords
  ) VALUES (
    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
  )
`;

const RESORT_INSERT = `
  INSERT INTO catalog_resorts (
    id, name, area_id, tier, transport, transport_notes, ownership,
    lat, lng, official_url, description, status
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

const venueParams = (v: CatalogVenue) => [
  v.id, v.name, v.area_id, v.sub_area, v.resort_id, v.venue_kind,
  JSON.stringify(v.service_type), JSON.stringify(v.dining_style),
  v.cuisine, v.price_tier,
  v.reservations_recommended ? 1 : 0,
  v.is_character_dinner_dining ? 1 : 0,
  v.is_character_breakfast_dining ? 1 : 0,
  v.is_signature ? 1 : 0,
  v.status, v.lat, v.lng,
  v.dinner_menu_url, v.lunch_menu_url, v.breakfast_menu_url,
  v.snack_menu_url, v.lounge_menu_url,
  v.description, JSON.stringify(v.tags), JSON.stringify(v.keywords),
];

const resortParams = (r: CatalogResort) => [
  r.id, r.name, r.area_id, r.tier, JSON.stringify(r.transport),
  r.transport_notes, r.ownership, r.lat, r.lng, r.official_url,
  r.description, r.status,
];

async function meta(db: SQLiteDatabase, key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string | null }>(
    'SELECT value FROM catalog_meta WHERE key = ?',
    key,
  );
  return row?.value ?? null;
}

async function setMeta(db: SQLiteDatabase, key: string, value: string) {
  await db.runAsync(
    `INSERT INTO catalog_meta (key, value) VALUES (?, ?)
     ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
    key,
    value,
  );
}

/**
 * Writes a full catalog into SQLite, replacing whatever was there.
 *
 * One transaction, so a crash halfway through cannot leave a half-seeded
 * catalog — either the old rows are still there or the new ones all are.
 * Prepared statements, because 394 separate `runAsync` calls re-parse the same
 * SQL 394 times and take roughly an order of magnitude longer.
 */
export async function writeCatalog(
  db: SQLiteDatabase,
  data: { areas: CatalogArea[]; venues: CatalogVenue[]; resorts: CatalogResort[] },
  { version, source }: { version: string; source: 'bundle' | 'remote' },
) {
  const venueStmt = await db.prepareAsync(VENUE_INSERT);
  const resortStmt = await db.prepareAsync(RESORT_INSERT);
  const areaStmt = await db.prepareAsync(
    'INSERT INTO catalog_areas (id, name, kind, sort) VALUES (?, ?, ?, ?)',
  );

  try {
    await db.withTransactionAsync(async () => {
      await db.execAsync(
        'DELETE FROM catalog_venues; DELETE FROM catalog_resorts; DELETE FROM catalog_areas;',
      );
      // `sort` preserves AREA_ROWS order — parks, then districts, then resort
      // areas — which is the order a filter list should offer them in and is
      // not recoverable from the names.
      for (const [i, a] of data.areas.entries()) {
        await areaStmt.executeAsync([a.id, a.name, a.kind, i]);
      }
      for (const r of data.resorts) await resortStmt.executeAsync(resortParams(r));
      for (const v of data.venues) await venueStmt.executeAsync(venueParams(v));
    });

    await setMeta(db, 'bundle_version', version);
    await setMeta(db, 'source', source);
    await setMeta(db, 'written_at', new Date().toISOString());
  } finally {
    await venueStmt.finalizeAsync();
    await resortStmt.finalizeAsync();
    await areaStmt.finalizeAsync();
  }
}

/**
 * Seeds from the bundled JSON when the installed app carries a bundle SQLite
 * has not seen. Called from `onInit`, so it finishes before the first render
 * and every read below it can assume the tables are populated.
 */
export async function seedCatalogIfNeeded(db: SQLiteDatabase): Promise<boolean> {
  const stored = await meta(db, 'bundle_version');
  if (stored === BUNDLE_VERSION) return false;

  await writeCatalog(db, bundle as unknown as Catalog, {
    version: BUNDLE_VERSION,
    source: 'bundle',
  });
  return true;
}

/* ── Reading ──────────────────────────────────────────────────────────── */

type VenueRow = Omit<
  CatalogVenue,
  | 'service_type' | 'dining_style' | 'tags' | 'keywords'
  | 'reservations_recommended' | 'is_character_dinner_dining'
  | 'is_character_breakfast_dining' | 'is_signature'
> & {
  service_type: string;
  dining_style: string;
  tags: string;
  keywords: string;
  reservations_recommended: number;
  is_character_dinner_dining: number;
  is_character_breakfast_dining: number;
  is_signature: number;
};

/** A stored array column that somehow is not valid JSON must not take the
 *  whole catalog down with it. */
function arr(json: string): string[] {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function readCatalog(db: SQLiteDatabase): Promise<Catalog> {
  const [areas, resortRows, venueRows, version, source] = await Promise.all([
    db.getAllAsync<CatalogArea>(
      'SELECT id, name, kind FROM catalog_areas ORDER BY sort',
    ),
    db.getAllAsync<Omit<CatalogResort, 'transport'> & { transport: string }>(
      'SELECT * FROM catalog_resorts ORDER BY name',
    ),
    db.getAllAsync<VenueRow>('SELECT * FROM catalog_venues ORDER BY name'),
    meta(db, 'bundle_version'),
    meta(db, 'source'),
  ]);

  return {
    areas,
    resorts: resortRows.map((r) => ({ ...r, transport: arr(r.transport) })),
    venues: venueRows.map((v) => ({
      ...v,
      service_type: arr(v.service_type),
      dining_style: arr(v.dining_style),
      tags: arr(v.tags),
      keywords: arr(v.keywords),
      reservations_recommended: !!v.reservations_recommended,
      is_character_dinner_dining: !!v.is_character_dinner_dining,
      is_character_breakfast_dining: !!v.is_character_breakfast_dining,
      is_signature: !!v.is_signature,
    })),
    version: version ?? BUNDLE_VERSION,
    source: source === 'remote' ? 'remote' : 'bundle',
  };
}
