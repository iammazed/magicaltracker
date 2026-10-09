import type { SQLiteDatabase } from 'expo-sqlite';

import { CATALOG_DDL, seedCatalogIfNeeded } from '@/lib/catalog-db';

/**
 * On-device store for the user's own data.
 *
 * Visits live here first and sync to Supabase later. That ordering is
 * deliberate rather than a shortcut:
 *
 *   - Guest mode. Forcing signup before anyone can log anything is the single
 *     biggest install-to-active killer, and Sign in with Apple needs a dev
 *     build we cannot make yet.
 *   - Offline. Cell service in the parks is bad exactly where people want to
 *     log a meal. A write that needs the network is a write that fails.
 *
 * Every row carries `synced_at`, null until it reaches the server, so the
 * eventual sync is "send everything with synced_at is null" rather than a
 * guess about what changed.
 */

export const DATABASE_NAME = 'magicaltracker.db';

/** Bump when the schema below changes, and add a matching step in migrate(). */
const SCHEMA_VERSION = 4;

export async function migrate(db: SQLiteDatabase) {
  // WAL keeps reads fast while a write is in flight, which matters when the
  // list re-renders as someone saves a visit.
  await db.execAsync('PRAGMA journal_mode = WAL;');

  const row = await db.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version',
  );
  let version = row?.user_version ?? 0;

  if (version < 1) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS visits (
        id            TEXT PRIMARY KEY NOT NULL,
        venue_id      TEXT NOT NULL,
        visited_on    TEXT NOT NULL,          -- YYYY-MM-DD
        rating        INTEGER,                -- 1-5, null if not rated
        would_return  INTEGER,                -- 0/1, null if not answered
        party_size    INTEGER,
        note          TEXT,
        created_at    TEXT NOT NULL,
        updated_at    TEXT NOT NULL,
        synced_at     TEXT                    -- null until pushed to Supabase
      );
      CREATE INDEX IF NOT EXISTS visits_venue_idx ON visits (venue_id);
      CREATE INDEX IF NOT EXISTS visits_date_idx  ON visits (visited_on DESC);
      CREATE INDEX IF NOT EXISTS visits_unsynced_idx ON visits (synced_at)
        WHERE synced_at IS NULL;
    `);
    version = 1;
  }

  if (version < 2) {
    // A stay has a range, not a date. Check-out is nullable so someone can
    // log a stay they are currently on.
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS stays (
        id         TEXT PRIMARY KEY NOT NULL,
        resort_id  TEXT NOT NULL,
        check_in   TEXT NOT NULL,          -- YYYY-MM-DD
        check_out  TEXT,                   -- null while mid-stay
        rating     INTEGER,
        room_type  TEXT,
        note       TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        synced_at  TEXT
      );
      CREATE INDEX IF NOT EXISTS stays_resort_idx ON stays (resort_id);
      CREATE INDEX IF NOT EXISTS stays_date_idx   ON stays (check_in DESC);
    `);
    version = 2;
  }

  if (version < 3) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS trips (
        id         TEXT PRIMARY KEY NOT NULL,
        name       TEXT NOT NULL,
        start_date TEXT NOT NULL,          -- YYYY-MM-DD
        end_date   TEXT NOT NULL,
        resort_id  TEXT,                   -- where you are staying, if decided
        note       TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        synced_at  TEXT
      );
      CREATE INDEX IF NOT EXISTS trips_start_idx ON trips (start_date);

      -- The planning list: places you WANT to go on a given trip, which is a
      -- different thing from a logged visit.
      CREATE TABLE IF NOT EXISTS trip_plans (
        id         TEXT PRIMARY KEY NOT NULL,
        trip_id    TEXT NOT NULL,
        venue_id   TEXT NOT NULL,
        booked     INTEGER NOT NULL DEFAULT 0,
        note       TEXT,
        created_at TEXT NOT NULL,
        synced_at  TEXT,
        UNIQUE (trip_id, venue_id)
      );
      CREATE INDEX IF NOT EXISTS trip_plans_trip_idx ON trip_plans (trip_id);
    `);
    version = 3;
  }

  if (version < 4) {
    // Read-only replicas of the catalog. They live in the same database as the
    // user's rows so there is one file, one connection and one migration
    // ladder — but they are `catalog_`-prefixed because re-seeding truncates
    // them, and nothing here may ever do that to a visit.
    await db.execAsync(CATALOG_DDL);
    version = 4;
  }

  await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);

  // After the DDL, never before: seeding inserts into tables version 4 creates.
  // This runs inside `onInit`, so it completes before the first render and
  // every catalog read can assume the tables are populated.
  await seedCatalogIfNeeded(db);
}

export type Trip = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  resort_id: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
  synced_at: string | null;
};

export type TripPlan = {
  id: string;
  trip_id: string;
  venue_id: string;
  booked: number;
  note: string | null;
  created_at: string;
  synced_at: string | null;
};

export type Stay = {
  id: string;
  resort_id: string;
  check_in: string;
  check_out: string | null;
  rating: number | null;
  room_type: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
  synced_at: string | null;
};

export type Visit = {
  id: string;
  venue_id: string;
  visited_on: string;
  rating: number | null;
  would_return: number | null;
  party_size: number | null;
  note: string | null;
  created_at: string;
  updated_at: string;
  synced_at: string | null;
};

/** Today in the device's own timezone — a guest logging dinner at 11pm in
 *  Florida means today, not tomorrow in UTC. */
export function todayISO(): string {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}
