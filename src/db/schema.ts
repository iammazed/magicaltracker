/**
 * Catalog schema — the read-mostly half of the database.
 *
 * These tables mirror `data/README.md` exactly. The CSVs in `data/` are the
 * source of truth; these tables are where they land. Never edit catalog rows in
 * the Supabase dashboard — edit the CSV and re-import, or the repo stops
 * describing reality.
 *
 * EVERY table declares RLS policies inline. A table without a policy is
 * unreachable rather than wide open, which is the failure direction you want.
 *
 * Catalog data is world-readable and never written by users. Writes happen only
 * from the import script using the secret key, which bypasses RLS entirely — so
 * there are deliberately no insert/update/delete policies here.
 */

import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  doublePrecision,
  index,
  pgEnum,
  pgPolicy,
  pgTable,
  smallint,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { anonRole, authenticatedRole } from 'drizzle-orm/supabase';

/* ── Enums ────────────────────────────────────────────────────────────── */

export const areaKind = pgEnum('area_kind', ['park', 'resort_area', 'district']);

export const resortTier = pgEnum('resort_tier', [
  'value',
  'moderate',
  'deluxe',
  'villa',
  'campground',
]);

export const transportMode = pgEnum('transport_mode', [
  'monorail',
  'skyliner',
  'bus',
  'boat',
  'walk',
]);

export const venueKind = pgEnum('venue_kind', ['restaurant', 'lounge', 'snack', 'cart']);

export const serviceType = pgEnum('service_type', ['quick', 'table', 'lounge', 'snack']);

export const diningStyle = pgEnum('dining_style', [
  'a-la-carte',
  'buffet',
  'family-style',
  'prix-fixe',
]);

export const catalogStatus = pgEnum('catalog_status', [
  'open',
  'seasonal',
  'temporarily-closed',
  'permanently-closed',
]);

/* ── Shared column builders ───────────────────────────────────────────── */

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};

/** Provenance — mirrors the `verified_on` gate in data/README.md. */
const provenance = {
  verifiedOn: date('verified_on'),
  sourceUrl: text('source_url'),
};

/** Read-only-to-everyone policy. Catalog tables all share this shape. */
const publicRead = (table: string) =>
  pgPolicy(`anyone can read ${table}`, {
    for: 'select',
    to: [anonRole, authenticatedRole],
    using: sql`true`,
  });

/* ── destinations ─────────────────────────────────────────────────────── */

/**
 * One row for now (`wdw`). It exists so Disneyland, Disney Cruise Line, and
 * Aulani can be added later without a migration touching every other table.
 */
export const destinations = pgTable(
  'destinations',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    ...timestamps,
  },
  () => [publicRead('destinations')],
);

/* ── areas ────────────────────────────────────────────────────────────── */

/** Parks, resort areas, and districts — the top-level filter dimension. */
export const areas = pgTable(
  'areas',
  {
    id: text('id').primaryKey(),
    destinationId: text('destination_id')
      .notNull()
      .references(() => destinations.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    kind: areaKind('kind').notNull(),
    ...timestamps,
  },
  (t) => [index('areas_destination_idx').on(t.destinationId), publicRead('areas')],
);

/* ── resorts ──────────────────────────────────────────────────────────── */

export const resorts = pgTable(
  'resorts',
  {
    id: text('id').primaryKey(),
    destinationId: text('destination_id')
      .notNull()
      .references(() => destinations.id, { onDelete: 'restrict' }),
    areaId: text('area_id')
      .notNull()
      .references(() => areas.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    tier: resortTier('tier').notNull(),

    /** Drives the Transportation Challenge achievement — must be accurate. */
    transport: transportMode('transport').array().notNull(),

    lat: doublePrecision('lat'),
    lng: doublePrecision('lng'),
    officialUrl: text('official_url'),
    description: text('description'),
    status: catalogStatus('status').notNull().default('open'),
    ...provenance,
    ...timestamps,
  },
  (t) => [
    index('resorts_area_idx').on(t.areaId),
    index('resorts_status_idx').on(t.status),
    // Same bounding box the CSV validator enforces — catches a swapped
    // lat/lng or a missing minus sign that slipped past import.
    check(
      'resorts_coords_within_wdw',
      sql`(${t.lat} is null or (${t.lat} between 28.28 and 28.44))
          and (${t.lng} is null or (${t.lng} between -81.65 and -81.45))`,
    ),
    publicRead('resorts'),
  ],
);

/* ── venues ───────────────────────────────────────────────────────────── */

export const venues = pgTable(
  'venues',
  {
    id: text('id').primaryKey(),
    destinationId: text('destination_id')
      .notNull()
      .references(() => destinations.id, { onDelete: 'restrict' }),
    areaId: text('area_id')
      .notNull()
      .references(() => areas.id, { onDelete: 'restrict' }),

    /** Land or pavilion within a park. The eleven World Showcase pavilion
     *  slugs are load-bearing: Drinking/Snacking Around the World read them. */
    subArea: text('sub_area'),

    /** Set for resort venues, null for in-park ones. Never both. */
    resortId: text('resort_id').references(() => resorts.id, { onDelete: 'restrict' }),

    name: text('name').notNull(),
    venueKind: venueKind('venue_kind').notNull(),
    serviceType: serviceType('service_type').notNull(),
    diningStyle: diningStyle('dining_style'),
    cuisine: text('cuisine').notNull(),
    priceTier: smallint('price_tier').notNull(),

    acceptsReservations: boolean('accepts_reservations').notNull().default(false),
    isCharacterDining: boolean('is_character_dining').notNull().default(false),
    isSignature: boolean('is_signature').notNull().default(false),

    status: catalogStatus('status').notNull().default('open'),

    lat: doublePrecision('lat'),
    lng: doublePrecision('lng'),
    menuUrl: text('menu_url'),
    description: text('description'),

    /** Achievement tags: world-showcase-bar, character-dining, signature, … */
    tags: text('tags').array().notNull().default(sql`'{}'::text[]`),

    ...provenance,
    ...timestamps,
  },
  (t) => [
    // Index the filter dimensions the catalog screen actually uses.
    index('venues_area_idx').on(t.areaId),
    index('venues_resort_idx').on(t.resortId),
    index('venues_service_type_idx').on(t.serviceType),
    index('venues_status_idx').on(t.status),
    index('venues_tags_idx').using('gin', t.tags),

    check('venues_price_tier_range', sql`${t.priceTier} between 1 and 4`),
    check(
      'venues_coords_within_wdw',
      sql`(${t.lat} is null or (${t.lat} between 28.28 and 28.44))
          and (${t.lng} is null or (${t.lng} between -81.65 and -81.45))`,
    ),

    publicRead('venues'),
  ],
);

/* ── Inferred types ───────────────────────────────────────────────────── */

export type Destination = typeof destinations.$inferSelect;
export type Area = typeof areas.$inferSelect;
export type Resort = typeof resorts.$inferSelect;
export type NewResort = typeof resorts.$inferInsert;
export type Venue = typeof venues.$inferSelect;
export type NewVenue = typeof venues.$inferInsert;
