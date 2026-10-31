import type { SQLiteDatabase } from 'expo-sqlite';

import { getSetting, jsonList, setSetting } from '@/lib/local-db';
import { supabase } from '@/lib/supabase';

/**
 * Push on-device rows to the server, and pull back anything this device has
 * not seen.
 *
 * The contract that makes this safe is that **row ids are generated on the
 * device**. Both sides key on the same UUID, so every write is an upsert and
 * running the whole thing twice changes nothing. There is no id mapping to
 * get wrong and no "did my last request land?" question to answer — if a
 * response is lost, the next push sends the same rows to the same keys.
 *
 * `synced_at` is the only bookkeeping: null means "the server has not seen
 * this version", and it is cleared again on every local edit.
 *
 * **Photos do not sync.** They are local file URIs — `file:///var/mobile/...`
 * — which mean nothing on another device, and uploading them needs Supabase
 * Storage plus a quota conversation. Pushing the paths would produce a second
 * device showing broken images and claiming they were backed up, which is
 * worse than openly not having them.
 */

export type SyncResult = {
  pushed: number;
  pulled: number;
  /** Rows that existed before any account and were adopted by this one. */
  claimed: number;
  /** True when local rows belonging to a DIFFERENT account were cleared. */
  switchedUser: boolean;
  /** User-facing, already phrased. Null when it worked. */
  error: string | null;
};

const EMPTY: SyncResult = {
  pushed: 0,
  pulled: 0,
  claimed: 0,
  switchedUser: false,
  error: null,
};

/** Who the rows currently in SQLite belong to. Null means "nobody yet" —
 *  guest data, free to be adopted by whoever signs in first. */
const OWNER_KEY = 'sync_owner_id';

/** Child tables first: `trip_plans` and `trip_days` both reference `trips`. */
const USER_TABLES = ['trip_plans', 'trip_days', 'visits', 'stays', 'trips'] as const;

/* ── Row shapes ───────────────────────────────────────────────────────── */

type LocalVisit = {
  id: string;
  venue_id: string;
  visited_on: string;
  rating: number | null;
  would_return: number | null;
  party_size: number | null;
  note: string | null;
  dishes: string | null;
  date_exact: number;
  created_at: string;
  updated_at: string;
};

type LocalStay = {
  id: string;
  resort_id: string;
  check_in: string;
  check_out: string | null;
  rating: number | null;
  room_type: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
};

type LocalTrip = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  resort_id: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
};

type LocalPlan = {
  id: string;
  trip_id: string;
  venue_id: string;
  booked: number;
  note: string | null;
  created_at: string;
};

type LocalDay = {
  id: string;
  trip_id: string;
  day: string;
  area_id: string | null;
  kind: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
};

/* ── Push ─────────────────────────────────────────────────────────────── */

/**
 * Order matters. `trip_plans` references `trips`, so a plan pushed before its
 * trip is a foreign-key violation — and because each table is a separate
 * request, the only thing enforcing that order is this list.
 */
async function pushTable<T extends { id: string }>(
  db: SQLiteDatabase,
  table: string,
  rows: T[],
  toRemote: (row: T) => Record<string, unknown>,
  userId: string,
): Promise<number> {
  if (!rows.length) return 0;

  const { error } = await supabase
    .from(table)
    .upsert(rows.map((r) => ({ ...toRemote(r), user_id: userId })), {
      onConflict: 'id',
    });
  if (error) throw new Error(`${table}: ${error.message}`);

  // Marked only after the server confirms. A crash between the upsert and
  // this statement re-sends the same rows next time, which is a no-op.
  const now = new Date().toISOString();
  const ids = rows.map((r) => r.id);
  await db.runAsync(
    `UPDATE ${table} SET synced_at = ? WHERE id IN (${ids.map(() => '?').join(',')})`,
    now,
    ...ids,
  );
  return rows.length;
}

async function push(db: SQLiteDatabase, userId: string): Promise<number> {
  let total = 0;

  const trips = await db.getAllAsync<LocalTrip>(
    'SELECT * FROM trips WHERE synced_at IS NULL',
  );
  total += await pushTable(db, 'trips', trips, (t) => ({
    id: t.id,
    name: t.name,
    start_date: t.start_date,
    end_date: t.end_date,
    resort_id: t.resort_id,
    note: t.note,
    created_at: t.created_at,
    updated_at: t.updated_at,
  }), userId);

  // After `trips` and before anything else that could fail: `trip_days`
  // references `trips`, and the only thing enforcing that order is the order
  // of these calls.
  const days = await db.getAllAsync<LocalDay>(
    'SELECT * FROM trip_days WHERE synced_at IS NULL',
  );
  total += await pushTable(db, 'trip_days', days, (d) => ({
    id: d.id,
    trip_id: d.trip_id,
    day: d.day,
    area_id: d.area_id,
    kind: d.kind,
    note: d.note,
    created_at: d.created_at,
    updated_at: d.updated_at,
  }), userId);

  const plans = await db.getAllAsync<LocalPlan>(
    'SELECT * FROM trip_plans WHERE synced_at IS NULL',
  );
  total += await pushTable(db, 'trip_plans', plans, (p) => ({
    id: p.id,
    trip_id: p.trip_id,
    venue_id: p.venue_id,
    booked: !!p.booked,
    note: p.note,
    created_at: p.created_at,
  }), userId);

  const visits = await db.getAllAsync<LocalVisit>(
    'SELECT * FROM visits WHERE synced_at IS NULL',
  );
  total += await pushTable(db, 'visits', visits, (v) => ({
    id: v.id,
    venue_id: v.venue_id,
    visited_on: v.visited_on,
    date_exact: !!v.date_exact,
    rating: v.rating,
    would_return: v.would_return == null ? null : !!v.would_return,
    party_size: v.party_size,
    note: v.note,
    // SQLite stores these as a JSON string; Postgres wants a real text[].
    dishes: jsonList(v.dishes),
    created_at: v.created_at,
    updated_at: v.updated_at,
  }), userId);

  const stays = await db.getAllAsync<LocalStay>(
    'SELECT * FROM stays WHERE synced_at IS NULL',
  );
  total += await pushTable(db, 'stays', stays, (s) => ({
    id: s.id,
    resort_id: s.resort_id,
    check_in: s.check_in,
    check_out: s.check_out,
    rating: s.rating,
    room_type: s.room_type,
    note: s.note,
    created_at: s.created_at,
    updated_at: s.updated_at,
  }), userId);

  return total;
}

/* ── Pull ─────────────────────────────────────────────────────────────── */

/**
 * Brings down rows this device does not have.
 *
 * **Insert-only, never overwrite.** A row already present locally is left
 * exactly as it is, because the device is the only place an edit can
 * originate right now — there is no second writer. Taking the server's copy
 * instead would silently discard an edit made while offline, which is the
 * precise failure this whole feature exists to prevent. Real two-way
 * reconciliation needs per-field timestamps and a conflict rule, and that is
 * worth doing only once a second device can actually write.
 */
async function pull(db: SQLiteDatabase, userId: string): Promise<number> {
  let total = 0;

  const tables = [
    { name: 'trips', columns: 'id, name, start_date, end_date, resort_id, note, created_at, updated_at' },
    { name: 'trip_days', columns: 'id, trip_id, day, area_id, kind, note, created_at, updated_at' },
    { name: 'trip_plans', columns: 'id, trip_id, venue_id, booked, note, created_at' },
    { name: 'visits', columns: 'id, venue_id, visited_on, date_exact, rating, would_return, party_size, note, dishes, created_at, updated_at' },
    { name: 'stays', columns: 'id, resort_id, check_in, check_out, rating, room_type, note, created_at, updated_at' },
  ] as const;

  for (const { name, columns } of tables) {
    const { data, error } = await supabase
      .from(name)
      // `columns as string`, and it has to stay that way. supabase-js parses a
      // LITERAL select string into a result type, and `as const` above makes
      // this a union of every table's column list — five of them produced
      // "union type that is too complex to represent" and failed the build.
      // Nothing is lost: `data` is cast to Record<string, unknown>[] below, so
      // the parsed type was being discarded regardless. `name` keeps its
      // literal type, which is the one `.from()` actually needs.
      .select(columns as string)
      .eq('user_id', userId);
    if (error) throw new Error(`${name}: ${error.message}`);
    if (!data?.length) continue;

    const existing = await db.getAllAsync<{ id: string }>(`SELECT id FROM ${name}`);
    const have = new Set(existing.map((r) => r.id));
    const incoming = (data as unknown as Record<string, unknown>[]).filter(
      (r) => !have.has(String(r.id)),
    );
    if (!incoming.length) continue;

    await db.withTransactionAsync(async () => {
      for (const row of incoming) {
        await insertPulled(db, name, row);
      }
    });
    total += incoming.length;
  }

  return total;
}

/** Pulled rows arrive already synced, so `synced_at` is set on insert — they
 *  came FROM the server and must not be pushed straight back. */
async function insertPulled(
  db: SQLiteDatabase,
  table: string,
  r: Record<string, unknown>,
) {
  const now = new Date().toISOString();
  const bit = (v: unknown) => (v == null ? null : v ? 1 : 0);

  if (table === 'trips') {
    await db.runAsync(
      `INSERT OR IGNORE INTO trips
         (id, name, start_date, end_date, resort_id, note, created_at, updated_at, synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      String(r.id), String(r.name), String(r.start_date), String(r.end_date),
      (r.resort_id as string) ?? null, (r.note as string) ?? null,
      String(r.created_at), String(r.updated_at), now,
    );
  } else if (table === 'trip_days') {
    await db.runAsync(
      `INSERT OR IGNORE INTO trip_days
         (id, trip_id, day, area_id, kind, note, created_at, updated_at, synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      String(r.id), String(r.trip_id), String(r.day),
      (r.area_id as string) ?? null, (r.kind as string) ?? null, (r.note as string) ?? null,
      String(r.created_at), String(r.updated_at), now,
    );
  } else if (table === 'trip_plans') {
    await db.runAsync(
      `INSERT OR IGNORE INTO trip_plans
         (id, trip_id, venue_id, booked, note, created_at, synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      String(r.id), String(r.trip_id), String(r.venue_id),
      bit(r.booked) ?? 0, (r.note as string) ?? null, String(r.created_at), now,
    );
  } else if (table === 'visits') {
    await db.runAsync(
      `INSERT OR IGNORE INTO visits
         (id, venue_id, visited_on, rating, would_return, party_size, note,
          dishes, photos, date_exact, created_at, updated_at, synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?)`,
      String(r.id), String(r.venue_id), String(r.visited_on),
      (r.rating as number) ?? null, bit(r.would_return), (r.party_size as number) ?? null,
      (r.note as string) ?? null,
      Array.isArray(r.dishes) && r.dishes.length ? JSON.stringify(r.dishes) : null,
      bit(r.date_exact) ?? 1,
      String(r.created_at), String(r.updated_at), now,
    );
  } else if (table === 'stays') {
    await db.runAsync(
      `INSERT OR IGNORE INTO stays
         (id, resort_id, check_in, check_out, rating, room_type, note,
          created_at, updated_at, synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      String(r.id), String(r.resort_id), String(r.check_in),
      (r.check_out as string) ?? null, (r.rating as number) ?? null,
      (r.room_type as string) ?? null, (r.note as string) ?? null,
      String(r.created_at), String(r.updated_at), now,
    );
  }
}

/* ── Entry point ──────────────────────────────────────────────────────── */

/**
 * One full cycle: push, then pull.
 *
 * Push first, deliberately. Everything on this device predates the account —
 * pulling first on a fresh sign-in would be a round trip that returns nothing,
 * and if the push then failed the user would be looking at an account that
 * claims to be backed up and holds nothing.
 */
export async function syncNow(
  db: SQLiteDatabase,
  userId: string,
): Promise<SyncResult> {
  if (!userId) return EMPTY;
  try {
    const owner = (await getSetting(db, OWNER_KEY)) || null;

    /**
     * Rows that belong to somebody else.
     *
     * The question is how to tell a genuine guest device from one that
     * belonged to another account, and `synced_at` answers it:
     *
     *   nothing ever synced    nobody has owned this device — pure guest
     *                          data, and the account signing in adopts it
     *   something has synced   this device has been used with an account,
     *                          so if that is not the account signing in,
     *                          NONE of it is ours to show
     *
     * Keying on the stored owner id alone was not enough. A device that
     * synced before the id existed looked exactly like a fresh guest, so the
     * previous account's rows stayed in SQLite and appeared as the new
     * user's — which is precisely what happened in testing.
     *
     * The wipe takes unsynced rows too, and that is a deliberate trade. A row
     * logged by the previous user that never uploaded is lost rather than
     * silently handed to whoever signs in next: a privacy failure is worse
     * than a data loss the user was warned about, and `signOut` flushing
     * pending changes — warning if it cannot — is what keeps that warning
     * honest.
     */
    const [{ synced }] = await db.getAllAsync<{ synced: number }>(
      `SELECT (SELECT count(*) FROM visits     WHERE synced_at IS NOT NULL) +
              (SELECT count(*) FROM stays      WHERE synced_at IS NOT NULL) +
              (SELECT count(*) FROM trips      WHERE synced_at IS NOT NULL) +
              (SELECT count(*) FROM trip_plans WHERE synced_at IS NOT NULL) AS synced`,
    );
    const foreignDevice = owner !== userId && synced > 0;

    let switchedUser = false;
    if (foreignDevice) {
      await db.withTransactionAsync(async () => {
        for (const table of USER_TABLES) {
          await db.runAsync(`DELETE FROM ${table}`);
        }
      });
      switchedUser = true;
    }

    /**
     * Whatever is left unsynced gets adopted by this account. That is the
     * whole guest-to-account story: there is no separate claim step, because
     * an unsynced row has no owner and the push stamps it with this user's
     * id. Counted before the push, since the push is what clears the flag.
     */
    const claimed = owner !== userId ? await pendingCount(db) : 0;

    const pushed = await push(db, userId);
    const pulled = await pull(db, userId);

    // Only after a clean round trip. Recording it earlier would mean a failed
    // push left the device claiming to belong to an account it never reached.
    await setSetting(db, OWNER_KEY, userId);

    return { pushed, pulled, claimed, switchedUser, error: null };
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    return {
      ...EMPTY,
      error: /network|fetch/i.test(raw)
        ? 'Could not reach the server. Your data is safe on this device and will sync next time.'
        : raw,
    };
  }
}

/** Forgets which account owns the local rows. Only for a deleted account:
 *  the rows are now genuinely ownerless again. */
export async function clearOwner(db: SQLiteDatabase): Promise<void> {
  await setSetting(db, OWNER_KEY, '');
}

/** How much is waiting to go up. Drives the "N not backed up yet" line. */
export async function pendingCount(db: SQLiteDatabase): Promise<number> {
  const rows = await db.getAllAsync<{ n: number }>(
    `SELECT
       (SELECT count(*) FROM visits     WHERE synced_at IS NULL) +
       (SELECT count(*) FROM stays      WHERE synced_at IS NULL) +
       (SELECT count(*) FROM trips      WHERE synced_at IS NULL) +
       (SELECT count(*) FROM trip_plans WHERE synced_at IS NULL) AS n`,
  );
  return rows[0]?.n ?? 0;
}
