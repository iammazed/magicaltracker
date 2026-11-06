import type { SQLiteDatabase } from 'expo-sqlite';

import { seedCatalogIfNeeded, syncCatalogSchema } from '@/lib/catalog-db';

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
const SCHEMA_VERSION = 10;

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
    // Version 4 created the catalog tables here, which was the mistake. They
    // are read-only replicas of bundled data, so they do not belong on a
    // ladder at all: a ladder step runs once, and "once" is wrong for a
    // schema that changes whenever a column is added to the catalog. They are
    // now owned entirely by `syncCatalogSchema` below, which runs on every
    // launch and rebuilds them when the DDL changes. Nothing to do here.
    version = 4;
  }

  if (version < 5) {
    await db.execAsync(`
      -- Small key/value store for things that are settings rather than data:
      -- whether onboarding has run, the dev premium override. Deliberately
      -- not AsyncStorage, so there is one place a user's state lives.
      CREATE TABLE IF NOT EXISTS app_settings (
        key   TEXT PRIMARY KEY NOT NULL,
        value TEXT
      );

      -- Premium depth on a visit. Free users log the visit and the rating;
      -- these three are what they are paying for.
      ALTER TABLE visits ADD COLUMN dishes TEXT;        -- JSON array of strings
      ALTER TABLE visits ADD COLUMN photos TEXT;        -- JSON array of local URIs

      -- Onboarding asks "which of these have you eaten at?" and nobody
      -- remembers the date. Those rows get today's date with this flag at 0,
      -- and the UI says "date not set" rather than inventing a day the user
      -- would later see and not recognise.
      ALTER TABLE visits ADD COLUMN date_exact INTEGER NOT NULL DEFAULT 1;
    `);
    version = 5;
  }

  if (version < 6) {
    await db.execAsync(`
      -- One row per DAY of a trip, holding which park you plan to be in.
      --
      -- Rows are written lazily: a day with nothing decided has no row, so a
      -- seven-night trip starts as zero rows rather than seven empty ones.
      -- The UI generates the date list from the trip's own start and end and
      -- left-joins whatever is stored, which also means moving a trip's dates
      -- cannot orphan a day into a range it no longer covers.
      --
      -- \`area_id\` is deliberately NOT a foreign key here. The catalog tables
      -- are a disposable replica that \`syncCatalogSchema\` drops and rebuilds
      -- whenever the DDL changes, and a real FK from durable user data into
      -- them would make that rebuild fail. The server-side schema does
      -- constrain it, where the catalog is not disposable.
      CREATE TABLE IF NOT EXISTS trip_days (
        id         TEXT PRIMARY KEY NOT NULL,
        trip_id    TEXT NOT NULL,
        day        TEXT NOT NULL,          -- YYYY-MM-DD
        area_id    TEXT,                   -- null until a park is chosen
        note       TEXT,                   -- premium
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        synced_at  TEXT,
        UNIQUE (trip_id, day)
      );
      CREATE INDEX IF NOT EXISTS trip_days_trip_idx ON trip_days (trip_id);
    `);
    version = 6;
  }

  if (version < 7) {
    await db.execAsync(`
      -- Set only when the day is deliberately not a park day: 'rest' or
      -- 'resort'. Null means a park day (\`area_id\` says which) or nothing
      -- decided yet, so every row written before this column existed is
      -- already correct and there is nothing to backfill.
      --
      -- Not a sentinel row in \`catalog_areas\`: \`area_id\` names a real
      -- place, and a fake one would surface in every area filter and map.
      --
      -- The CHECK constraints live server-side only, for the same reason
      -- \`area_id\` has no FK here: this table is written exclusively by the
      -- app, whereas RLS lets an authenticated request POST at Postgres
      -- directly. SQLite also cannot add a constraint by ALTER, and
      -- rebuilding the table to gain one would risk real user rows to guard
      -- against a writer that does not exist.
      ALTER TABLE trip_days ADD COLUMN kind TEXT;
    `);
    version = 7;
  }

  if (version < 8) {
    await db.execAsync(`
      -- Which day of the trip a planned meal is on, if decided. Null is the
      -- pool: on the list, not yet placed.
      --
      -- A plain date, not a reference to \`trip_days\`. Day rows are written
      -- lazily, so the day a meal sits on may well have no row -- and making
      -- one just to hang a meal off it would undo the laziness that keeps a
      -- trip's dates editable. Nothing constrains it to the trip's range
      -- either, and the UI reads a date outside that range as unplaced, so
      -- moving the dates returns a stranded meal to the pool rather than
      -- hiding it somewhere unreachable.
      ALTER TABLE trip_plans ADD COLUMN planned_on TEXT;
      CREATE INDEX IF NOT EXISTS trip_plans_day_idx ON trip_plans (trip_id, planned_on);
    `);
    version = 8;
  }

  if (version < 9) {
    await db.execAsync(`
      -- Daily step totals, because iOS does not keep them.
      --
      -- CMPedometer stores only the past seven days: "Specifying a start
      -- date that is more than seven days in the past returns only the
      -- available data." So a trip's step count cannot be asked for after
      -- the fact — it has to be copied out of the sensor into somewhere
      -- durable while it is still answerable, which is what this table is.
      --
      -- One row per LOCAL day. A guest walking Magic Kingdom until midnight
      -- is walking on that day, not on tomorrow in UTC, which is the same
      -- reasoning that governs todayISO() below.
      --
      -- Deliberately local-only: no synced_at column and no server table.
      -- Step counts are health-adjacent data, so putting them on a server
      -- means a new RLS policy, a new line in the privacy policy and a new
      -- answer on the App Privacy questionnaire — none of which buys
      -- anything while the only reader is the phone that generated them.
      -- Adding sync later is an ALTER and a backfill, which is a smaller
      -- act than retracting a disclosure.
      CREATE TABLE IF NOT EXISTS step_days (
        day        TEXT PRIMARY KEY NOT NULL,   -- YYYY-MM-DD, local
        steps      INTEGER NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
    version = 9;
  }

  if (version < 10) {
    await db.execAsync(`
      -- Challenges the app cannot observe, ticked off by hand.
      --
      -- Everything else in the passport is DERIVED: a stamp is the shadow of
      -- a meal or a night someone logged, and there is nothing to store
      -- because the log already says it. The quests are not like that.
      --
      -- Four parks in one day is scored off MEALS, so a day spent riding
      -- rides in all four parks counts for nothing. The transportation
      -- challenge infers the monorail from a resort you ate or slept at, so
      -- the monorail between Magic Kingdom and EPCOT -- which needs no resort
      -- at all -- is invisible to it. The fireworks challenge counts reserved
      -- views because paid events are the rows the catalog holds, and
      -- standing on Main Street for free is not one of them.
      --
      -- So this table holds the one thing a log of meals and nights cannot
      -- imply: a person saying "I did that". One row per step ticked, and the
      -- absence of a row means nothing has been claimed -- NOT that it was
      -- denied.
      --
      -- **Additive only.** A mark can add a tick the log did not earn; it can
      -- never remove one the log did. Un-ticking deletes the row, which drops
      -- back to whatever the log says rather than overriding it, so a mark can
      -- never un-earn something already celebrated.
      --
      -- Unlike step_days this DOES sync. It is the same kind of thing as a
      -- visit -- a fact a person entered about their own trip -- and losing it
      -- to a reinstall would be the same loss.
      CREATE TABLE IF NOT EXISTS challenge_marks (
        id           TEXT PRIMARY KEY NOT NULL,
        challenge_id TEXT NOT NULL,
        step_id      TEXT NOT NULL,
        created_at   TEXT NOT NULL,
        updated_at   TEXT NOT NULL,
        synced_at    TEXT,
        -- One claim per step, which is what lets the push stay a plain upsert
        -- on the id and stops a second device minting a second row for a tick
        -- that already exists.
        UNIQUE (challenge_id, step_id)
      );

      CREATE INDEX IF NOT EXISTS challenge_marks_challenge_idx
        ON challenge_marks (challenge_id);
    `);
    version = 10;
  }

  await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);

  // The catalog tables are NOT governed by the ladder above, and must not be.
  // The ladder ran `CATALOG_DDL` once at `version < 4`, so a device already
  // past that never saw a later schema change — and `CREATE TABLE IF NOT
  // EXISTS` would have been a no-op anyway. That is how `destination_id`
  // reached new installs only, and killed `onInit` on every existing one.
  // `syncCatalogSchema` compares a fingerprint of the DDL instead, so it
  // cannot be forgotten the next time a column is added.
  await syncCatalogSchema(db);

  // After the DDL, never before: seeding inserts into the tables above. This
  // runs inside `onInit`, so it completes before the first render and every
  // catalog read can assume the tables are populated.
  await seedCatalogIfNeeded(db);
}

/**
 * The non-park day kinds.
 *
 * The authority is the `trip_days_kind_known` CHECK constraint in
 * `src/db/user-schema.ts`; this is the app-side copy, because nothing under
 * `src/` outside `src/db/` imports the Drizzle schema and that boundary is
 * worth more than saving three lines. Add a value in both places or the
 * server will reject a day the picker happily offered.
 */
export const DAY_KINDS = ['rest', 'resort'] as const;
export type DayKind = (typeof DAY_KINDS)[number];

export type TripDay = {
  id: string;
  trip_id: string;
  /** YYYY-MM-DD. */
  day: string;
  area_id: string | null;
  /** `'rest'` or `'resort'`; null for a park day or an undecided one. */
  kind: DayKind | null;
  note: string | null;
  created_at: string;
  updated_at: string;
  synced_at: string | null;
};

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
  /** YYYY-MM-DD, or null while the meal is still in the pool. */
  planned_on: string | null;
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

/** One local day's step total, copied out of CMPedometer before iOS drops it. */
export type StepDay = {
  day: string;
  steps: number;
};

/** A quest step someone ticked by hand. See the table comment for why these
 *  exist and why a missing row is not a denial. */
export type ChallengeMark = {
  id: string;
  challenge_id: string;
  step_id: string;
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
  /** JSON array. Premium. */
  dishes: string | null;
  /** JSON array of local file URIs. Premium. */
  photos: string | null;
  /** 0 when the date is a placeholder — an onboarding backfill. */
  date_exact: number;
  created_at: string;
  updated_at: string;
  synced_at: string | null;
};

/** A stored JSON array column that is somehow not valid JSON must not take the
 *  screen down with it. */
export function jsonList(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

/* ── Settings ─────────────────────────────────────────────────────────── */

export async function getSetting(
  db: SQLiteDatabase,
  key: string,
): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string | null }>(
    'SELECT value FROM app_settings WHERE key = ?',
    key,
  );
  return row?.value ?? null;
}

export async function setSetting(db: SQLiteDatabase, key: string, value: string) {
  await db.runAsync(
    `INSERT INTO app_settings (key, value) VALUES (?, ?)
     ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
    key,
    value,
  );
}

/** Today in the device's own timezone — a guest logging dinner at 11pm in
 *  Florida means today, not tomorrow in UTC. */
export function todayISO(): string {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}
