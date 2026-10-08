import type { SQLiteDatabase } from 'expo-sqlite';

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
const SCHEMA_VERSION = 1;

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

  await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
}

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
