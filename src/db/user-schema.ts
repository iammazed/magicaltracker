/**
 * User data — the write-heavy half of the database.
 *
 * Mirrors the on-device SQLite tables in `src/lib/local-db.ts`, because sync is
 * "send every row where `synced_at` is null" and that is only simple if both
 * sides agree on shape.
 *
 * **Primary keys are generated on the device, not here.** `local-db` already
 * mints a UUID per row, and reusing it server-side is what makes the push
 * idempotent: an upsert on `id` that runs twice is a no-op the second time.
 * A server-generated key would mean the client had to remember a mapping, and
 * a retry after a dropped response would duplicate the row.
 *
 * EVERY table is scoped to `auth.uid()` with BOTH `using` and `withCheck`.
 * `using` governs what you can read, `withCheck` what you can write — omit the
 * second and a user can insert rows assigned to someone else's id.
 */

import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  integer,
  pgPolicy,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { authenticatedRole, authUid, authUsers } from 'drizzle-orm/supabase';

import { areas, destinations, resorts, venues } from './schema';

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};

/**
 * The owner column, identical on every table here.
 *
 * `onDelete: 'cascade'` is what makes in-app account deletion — mandatory
 * since 2022 for any app with accounts — a single delete of the auth user
 * rather than a transaction that has to remember every table.
 */
const owner = {
  userId: uuid('user_id')
    .notNull()
    .references(() => authUsers.id, { onDelete: 'cascade' }),
};

/** Scopes a table to its owner. Both clauses, always. */
const ownRowsOnly = (table: string) =>
  pgPolicy(`own ${table} only`, {
    for: 'all',
    to: authenticatedRole,
    using: sql`${authUid} = user_id`,
    withCheck: sql`${authUid} = user_id`,
  });

/* ── visits ───────────────────────────────────────────────────────────── */

export const visits = pgTable(
  'visits',
  {
    id: uuid('id').primaryKey(),
    ...owner,

    /**
     * `restrict`, so a catalog cleanup cannot silently erase someone's
     * history. The importer never deletes — it reports orphans for a human to
     * remove deliberately — and "you may not delete a restaurant someone has
     * eaten at" is the right thing for that human to be told.
     */
    venueId: text('venue_id')
      .notNull()
      .references(() => venues.id, { onDelete: 'restrict' }),

    visitedOn: date('visited_on').notNull(),

    /**
     * False for an onboarding backfill, where the date is a placeholder for
     * sorting and the UI says "date not set" rather than inventing a day.
     */
    dateExact: boolean('date_exact').notNull().default(true),

    rating: smallint('rating'),
    wouldReturn: boolean('would_return'),
    partySize: smallint('party_size'),

    /* Premium depth. */
    note: text('note'),
    dishes: text('dishes').array().notNull().default(sql`'{}'::text[]`),

    ...timestamps,
  },
  (t) => [
    index('visits_user_idx').on(t.userId),
    index('visits_user_venue_idx').on(t.userId, t.venueId),
    ownRowsOnly('visits'),
  ],
);

/* ── stays ────────────────────────────────────────────────────────────── */

export const stays = pgTable(
  'stays',
  {
    id: uuid('id').primaryKey(),
    ...owner,
    resortId: text('resort_id')
      .notNull()
      .references(() => resorts.id, { onDelete: 'restrict' }),

    checkIn: date('check_in').notNull(),
    /** Null while the stay is still happening. */
    checkOut: date('check_out'),

    rating: smallint('rating'),
    roomType: text('room_type'),
    note: text('note'),

    ...timestamps,
  },
  (t) => [
    index('stays_user_idx').on(t.userId),
    index('stays_user_resort_idx').on(t.userId, t.resortId),
    ownRowsOnly('stays'),
  ],
);

/* ── trips ────────────────────────────────────────────────────────────── */

export const trips = pgTable(
  'trips',
  {
    id: uuid('id').primaryKey(),
    ...owner,

    /**
     * A trip is to a destination, so this is the one piece of user data that
     * carries `destination_id` directly rather than inheriting it through a
     * venue. Disneyland lands inside this app, not beside it.
     */
    destinationId: text('destination_id')
      .notNull()
      .default('wdw')
      .references(() => destinations.id, { onDelete: 'restrict' }),

    name: text('name').notNull(),
    startDate: date('start_date').notNull(),
    endDate: date('end_date').notNull(),

    /** Where you are staying, if decided. */
    resortId: text('resort_id').references(() => resorts.id, { onDelete: 'restrict' }),
    note: text('note'),

    ...timestamps,
  },
  (t) => [
    index('trips_user_idx').on(t.userId),
    index('trips_user_start_idx').on(t.userId, t.startDate),
    ownRowsOnly('trips'),
  ],
);

/* ── trip_plans ───────────────────────────────────────────────────────── */

/** Places you WANT to go on a trip, which is a different thing from a logged
 *  visit. */
export const tripPlans = pgTable(
  'trip_plans',
  {
    id: uuid('id').primaryKey(),
    ...owner,

    /** Cascade: deleting a trip takes its planning list with it, which is what
     *  the local database already does and what the UI promises. */
    tripId: uuid('trip_id')
      .notNull()
      .references(() => trips.id, { onDelete: 'cascade' }),
    venueId: text('venue_id')
      .notNull()
      .references(() => venues.id, { onDelete: 'restrict' }),

    booked: boolean('booked').notNull().default(false),
    note: text('note'),

    /**
     * Which day of the trip this meal is on, if decided. Null is the pool:
     * on the list, not yet placed.
     *
     * A plain date rather than a reference to `trip_days`, because days are
     * derived from the trip's own dates and a row exists only once something
     * has been decided about one. Pointing at a row that may not exist is not
     * a foreign key, and creating an empty day row just to hang a meal off
     * would undo the laziness that stops a trip's dates being un-editable.
     *
     * Nothing constrains it to the trip's range — it cannot, from one row —
     * and the UI treats a date outside the range as unplaced. So moving a
     * trip's dates degrades a stranded meal back to the pool instead of
     * hiding it somewhere unreachable.
     */
    plannedOn: date('planned_on'),

    createdAt: timestamps.createdAt,
  },
  (t) => [
    index('trip_plans_user_idx').on(t.userId),
    /** Mirrors the local `UNIQUE (trip_id, venue_id)` — a venue is on a trip
     *  once, and the upsert on push relies on that being true both sides. */
    uniqueIndex('trip_plans_trip_venue_key').on(t.tripId, t.venueId),
    ownRowsOnly('trip_plans'),
  ],
);

/* -- trip_days -- */

/**
 * What you plan to be doing on a given day of a trip.
 *
 * Structured rather than a free-text itinerary, and that is the whole point:
 * a park-per-day can be read back. "You are at EPCOT tomorrow, here are
 * twelve places you have not eaten at" is only possible if the day carries a
 * park id. A notes blob cannot be queried, cannot drive a notification, and
 * cannot feed the passport.
 *
 * Rows are written lazily, so a day with nothing decided simply has no row.
 */
export const tripDays = pgTable(
  'trip_days',
  {
    id: uuid('id').primaryKey(),
    ...owner,

    /** Cascade, like `trip_plans`: deleting a trip takes its days with it. */
    tripId: uuid('trip_id')
      .notNull()
      .references(() => trips.id, { onDelete: 'cascade' }),

    day: date('day').notNull(),

    /**
     * Restrict, like every other reference into the catalog: retiring an area
     * must not silently erase somebody's plan. Nullable, because "this day is
     * part of the trip but we have not decided" is a real state, and the row
     * may exist only to hold a note.
     */
    areaId: text('area_id').references(() => areas.id, { onDelete: 'restrict' }),

    /**
     * Set only when the day is deliberately NOT a park day: `rest` or
     * `resort`. Null means the day is a park day (`area_id` says which) or
     * nothing has been decided yet.
     *
     * A separate column rather than sentinel rows in `areas`, because
     * `area_id` is a real foreign key into the catalog and "resting" is not a
     * place. Faking it would put non-places in every area filter, every map
     * and every venue count in the app.
     *
     * Nullable-plus-two-values rather than a four-value enum including
     * `park`: every row that existed before this column was added is already
     * correct, so there is no backfill and no window where a day means one
     * thing on one device and another on the next.
     *
     * `resort` deliberately does not name WHICH resort. The trip's stays
     * already cover the dates, so a reader can derive it; storing it here
     * would be a second copy to keep in step with a changed booking.
     */
    kind: text('kind'),

    /** Premium, the same as a visit note. */
    note: text('note'),

    ...timestamps,
  },
  (t) => [
    index('trip_days_user_idx').on(t.userId),
    /** Mirrors the local `UNIQUE (trip_id, day)`. One row per day, which is
     *  what makes the push a plain upsert. */
    uniqueIndex('trip_days_trip_day_key').on(t.tripId, t.day),
    /** The device is the only writer today, but RLS lets an authenticated
     *  user POST straight at the table. A column whose legal values live
     *  only in TypeScript is a column the database will happily fill with
     *  anything. */
    check('trip_days_kind_known', sql`${t.kind} is null or ${t.kind} in ('rest', 'resort')`),
    /** A rest day is not in a park, so the two cannot both be set. Without
     *  this, a row could claim EPCOT and a rest day at once and every reader
     *  would have to pick a winner. */
    check('trip_days_kind_xor_area', sql`${t.kind} is null or ${t.areaId} is null`),
    ownRowsOnly('trip_days'),
  ],
);

/* ── sync bookkeeping ─────────────────────────────────────────────────── */

/**
 * One row per user, recording the last successful pull.
 *
 * Without it, signing in on a second device means fetching everything every
 * time. With it, the pull is "rows changed since `pulled_through`".
 *
 * Deliberately NOT a column on the auth user: that table belongs to Supabase
 * and adding to it is how a future Supabase upgrade breaks.
 */
export const syncState = pgTable(
  'sync_state',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    pulledThrough: timestamp('pulled_through', { withTimezone: true }),
    /** Bumped when a device claims guest rows, so a second claim can be
     *  recognised as a repeat rather than run again. */
    claimCount: integer('claim_count').notNull().default(0),
    ...timestamps,
  },
  () => [ownRowsOnly('sync_state')],
);

export type Visit = typeof visits.$inferSelect;
export type Stay = typeof stays.$inferSelect;
export type Trip = typeof trips.$inferSelect;
export type TripPlan = typeof tripPlans.$inferSelect;
export type TripDay = typeof tripDays.$inferSelect;
export type SyncState = typeof syncState.$inferSelect;
