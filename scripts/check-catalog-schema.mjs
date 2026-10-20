#!/usr/bin/env node
/**
 * Proves the on-device catalog schema survives an UPGRADE.
 * Run with `npm run check:catalog`.
 *
 * This exists because the test it replaces did not. The seed test built a
 * fresh in-memory database, where `CREATE TABLE IF NOT EXISTS` always
 * produces the current schema — so adding `destination_id` passed every check
 * and then killed `onInit` on every device that already had the app:
 *
 *   SQLiteErrorException: table catalog_venues has no column named destination_id
 *
 * A fresh install and an upgrade are different code paths. Only one of them
 * is what your users actually run, and it is not the one that is easy to test.
 *
 * Everything here is read out of `src/lib/catalog-db.ts` rather than copied,
 * so the test cannot quietly drift from the statements that ship.
 */

import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(join(ROOT, 'src', 'lib', 'catalog-db.ts'), 'utf8');

/** Source is CRLF on Windows; that is not a difference in the SQL. */
const lf = (s) => s.replace(/\r\n/g, '\n');

function grab(name) {
  const decl = `const ${name} = ` + '`';
  const i = src.indexOf(decl);
  if (i < 0) throw new Error(`could not find ${name} in catalog-db.ts`);
  const start = i + decl.length;
  return src.slice(start, src.indexOf('`', start));
}

const DDL = grab('CATALOG_DDL');
const VENUE_INSERT = grab('VENUE_INSERT');
const CATALOG_META_DDL = grab('CATALOG_META_DDL');

let failed = 0;
const check = (label, ok, detail = '') => {
  if (!ok) failed += 1;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}${detail ? '  ' + detail : ''}`);
};

/* ── The shipped fingerprint, transcribed ────────────────────────────── */
function ddlFingerprint(ddl) {
  let h = 0x811c9dc5;
  for (let i = 0; i < ddl.length; i += 1) {
    h ^= ddl.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

const CATALOG_TABLES = [
  'catalog_venues', 'catalog_resorts', 'catalog_areas',
  'catalog_destinations', 'catalog_meta',
];

/** `syncCatalogSchema`, against node:sqlite's synchronous API. */
function syncCatalogSchema(db, ddl) {
  db.exec(CATALOG_META_DDL);
  const fp = ddlFingerprint(ddl);
  const row = db.prepare("SELECT value FROM catalog_meta WHERE key = 'ddl_fingerprint'").get();
  if (row?.value === fp) return false;
  db.exec(CATALOG_TABLES.map((t) => `DROP TABLE IF EXISTS ${t};`).join('\n'));
  db.exec(ddl);
  db.prepare('INSERT INTO catalog_meta (key, value) VALUES (?, ?)').run('ddl_fingerprint', fp);
  return true;
}

check(
  'CATALOG_META_DDL matches its block inside CATALOG_DDL',
  lf(DDL).includes(lf(CATALOG_META_DDL).trim()),
  'they must agree, or the bootstrap table differs from the real one',
);

/* ── Reconstruct a pre-destination_id device ─────────────────────────── */
const OLD_DDL = DDL
  .split('\n')
  .filter((l) => !/destination_id/.test(l))
  .join('\n')
  .replace(/CREATE TABLE IF NOT EXISTS catalog_destinations \([^;]*\);/s, '');

check('the simulated old schema really lacks destination_id', !/destination_id/.test(OLD_DDL));
check('the current schema has it', /destination_id/.test(DDL));

const db = new DatabaseSync(':memory:');
db.exec(OLD_DDL);
db.exec(`
  CREATE TABLE visits (
    id TEXT PRIMARY KEY NOT NULL, venue_id TEXT NOT NULL,
    visited_on TEXT NOT NULL, synced_at TEXT
  );
`);
db.prepare('INSERT INTO visits (id, venue_id, visited_on, synced_at) VALUES (?,?,?,?)')
  .run('v1', 'be-our-guest', '2026-04-03', '2026-04-04T00:00:00Z');
db.prepare('INSERT INTO catalog_meta (key, value) VALUES (?,?)')
  .run('bundle_version', 'df5cd15d954b');

/* ── 1. The reported crash reproduces ────────────────────────────────── */
let crashed = null;
try { db.prepare(VENUE_INSERT); } catch (e) { crashed = e.message; }
check(
  'an un-upgraded device reproduces the reported failure',
  crashed !== null && /destination_id/.test(crashed),
  crashed ? crashed.split('\n')[0].slice(0, 64) : 'NO ERROR — this test is no longer testing anything',
);

/* ── 2. Re-running the whole DDL is not a repair; it throws ──────────── */
let ddlErr = null;
try { db.exec(DDL); } catch (e) { ddlErr = e.message; }
check(
  're-running CATALOG_DDL on a stale database throws',
  ddlErr !== null && /no such column: destination_id/.test(ddlErr),
  'CREATE INDEX on a column the old table lacks — why only catalog_meta is run first',
);

/* ── 3. syncCatalogSchema repairs it ─────────────────────────────────── */
check('syncCatalogSchema reports a rebuild', syncCatalogSchema(db, DDL) === true);
check(
  'catalog_venues now has destination_id',
  db.prepare('PRAGMA table_info(catalog_venues)').all().map((r) => r.name).includes('destination_id'),
);
check(
  'catalog_destinations exists',
  db.prepare("SELECT count(*) n FROM sqlite_master WHERE type='table' AND name='catalog_destinations'").get().n === 1,
);
let prepared = true;
try { db.prepare(VENUE_INSERT); } catch { prepared = false; }
check('VENUE_INSERT prepares cleanly', prepared);

/* ── 4. The re-seed is triggered rather than silently skipped ────────── */
check(
  'bundle_version cleared, so seedCatalogIfNeeded will repopulate',
  db.prepare("SELECT value FROM catalog_meta WHERE key='bundle_version'").get() === undefined,
  'otherwise the app runs with empty catalog tables, which is worse than the crash',
);

/* ── 5. User data is untouched. The whole safety argument for dropping ─ */
const visit = db.prepare("SELECT * FROM visits WHERE id='v1'").get();
check('visits survive the rebuild', visit?.venue_id === 'be-our-guest');
check('synced_at preserved', visit?.synced_at === '2026-04-04T00:00:00Z');

/* ── 6. Idempotent — a normal launch must not drop anything ──────────── */
db.prepare('INSERT INTO catalog_meta (key, value) VALUES (?,?)')
  .run('bundle_version', '71cea2a4893a');
check('a second run is a no-op', syncCatalogSchema(db, DDL) === false);
check(
  'and it does not wipe the seeded catalog',
  db.prepare("SELECT value FROM catalog_meta WHERE key='bundle_version'").get()?.value === '71cea2a4893a',
);

/* ── 7. The NEXT schema change is caught too ─────────────────────────── */
const FUTURE_DDL = DDL.replace(
  'CREATE TABLE IF NOT EXISTS catalog_venues (',
  'CREATE TABLE IF NOT EXISTS catalog_venues (\n    future_col TEXT,',
);
check('a later column addition triggers another rebuild', syncCatalogSchema(db, FUTURE_DDL) === true);
check(
  'and the new column is really present',
  db.prepare('PRAGMA table_info(catalog_venues)').all().map((r) => r.name).includes('future_col'),
);

console.log(failed ? `\n${failed} FAILED` : '\nall checks passed');
process.exitCode = failed ? 1 : 0;
