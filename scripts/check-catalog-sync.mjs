#!/usr/bin/env node
/**
 * Is the DEPLOYED catalog the same as the CSVs?
 *
 *     node scripts/check-catalog-sync.mjs
 *
 * **Deliberately not an npm script.** The `scripts` block of `package.json` is
 * a fingerprint source (`packageJson:scripts`), so adding one line to it moves
 * the runtime version and orphans every binary already on a phone. A developer
 * convenience is not worth a new build.
 *
 * This exists because of a bug that reached a phone and had no symptom anyone
 * would connect to its cause. `data/venues.csv` grew a `monorail-bar-crawl`
 * tag on ten rows, `src/data/catalog.json` was regenerated from it, and
 * `npm run db:import` was never run — so Supabase still held those ten rows
 * untagged. On a device the sequence is:
 *
 *   1. install or update  → SQLite is seeded from the bundled catalog.json,
 *                           which HAS the tag. The challenge works.
 *   2. first refresh      → `writeCatalog(..., source: 'remote')` DELETEs every
 *                           row and rewrites it from Supabase, which does not
 *                           have the tag. The challenge now has zero steps.
 *
 * So the challenge screen opened to an empty checklist, and it was empty only
 * on devices that had been online — the opposite of how a missing-data bug is
 * expected to behave. `use-catalog`'s guard catches a refresh that returns
 * NOTHING, which is the loud failure; it cannot catch one that returns rows
 * that are merely old, and nothing else in the pipeline compares the two.
 *
 * The rule this encodes: **the remote catalog always wins on a device, so a
 * CSV edit that has not been imported does not exist.** Regenerating the
 * bundle makes a change look like it shipped, right up until the first
 * refresh takes it away again.
 *
 * Read-only. It uses the same publishable key and the same columns the app
 * reads, so it sees exactly what a phone sees, and it needs no DATABASE_URL —
 * which also means it can be run by anyone who can run the app.
 */

import 'dotenv/config';
import * as fs from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  MULTI_VALUE_COLUMNS,
  RESORT_COLUMNS,
  VENUE_COLUMNS,
  bool,
  num,
  pipes,
  nullable,
  readTable,
} from './vocabulary.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const URL_BASE = process.env.EXPO_PUBLIC_SUPABASE_URL;
const KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!URL_BASE || !KEY) {
  console.error(
    '\n  EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY are missing.' +
      '\n  Copy .env.example to .env and fill it in.\n',
  );
  process.exit(1);
}

/**
 * Coordinates are compared with a tolerance, everything else exactly.
 *
 * PostgREST serialises a double with 15 significant digits, so a latitude
 * stored exactly still comes back as 28.3713834246028 where the CSV says
 * 28.371383424602794. That is a rendering difference, not a data difference.
 * 1e-9 degrees is about a tenth of a millimetre — far below anything a map pin
 * could express, and far above serialisation noise.
 */
const COORD_EPSILON = 1e-9;

async function fetchAll(table) {
  const res = await fetch(`${URL_BASE.replace(/\/$/, '')}/rest/v1/${table}?select=*&limit=2000`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  });
  if (!res.ok) {
    throw new Error(`${table}: ${res.status} ${res.statusText} — ${await res.text()}`);
  }
  return res.json();
}

const PIPE = new Set(MULTI_VALUE_COLUMNS);
const NUMERIC = new Set(['lat', 'lng', 'price_tier']);
const BOOLEAN = new Set([
  'reservations_recommended',
  'is_character_dinner_dining',
  'is_character_breakfast_dining',
  'is_signature',
]);

/** The CSV cell, converted the way `import-catalog.mjs` converts it. */
function fromCsv(rec, column) {
  if (NUMERIC.has(column)) return num(rec[column]);
  if (BOOLEAN.has(column)) return bool(rec[column]);
  if (PIPE.has(column)) return pipes(rec[column]);
  return nullable(rec[column]);
}

function same(column, csv, server) {
  if (column === 'lat' || column === 'lng') {
    if (csv == null || server == null) return csv === server;
    return Math.abs(csv - server) <= COORD_EPSILON;
  }
  if (Array.isArray(csv)) {
    const a = [...csv].sort();
    const b = [...(server ?? [])].sort();
    return a.length === b.length && a.every((x, i) => x === b[i]);
  }
  // `status` and `ownership` default in the importer rather than in the CSV.
  if (csv == null && (server === '' || server == null)) return true;
  return String(csv) === String(server);
}

function compare(label, columns, csvRows, serverRows) {
  const byId = new Map(serverRows.map((r) => [r.id, r]));
  const missing = [];
  const drift = [];

  for (const rec of csvRows) {
    const server = byId.get(rec.id);
    if (!server) {
      missing.push(rec.id);
      continue;
    }
    for (const column of columns) {
      if (column === 'verified_on' || column === 'source_url') continue;
      if (!(column in server)) continue;
      const mine = fromCsv(rec, column);
      if (!same(column, mine, server[column])) {
        drift.push({ id: rec.id, column, csv: mine, server: server[column] });
      }
    }
  }

  const csvIds = new Set(csvRows.map((r) => r.id));
  const orphans = serverRows.filter((r) => !csvIds.has(r.id)).map((r) => r.id);

  console.log(
    `  ${label.padEnd(8)} ${String(csvRows.length).padStart(4)} verified in CSV` +
      `  ${String(serverRows.length).padStart(4)} on the server`,
  );
  return { missing, drift, orphans };
}

const fmt = (v) => (Array.isArray(v) ? `[${v.join('|')}]` : v === null ? '(null)' : String(v));

console.log('\n  Comparing data/*.csv against the deployed catalog...\n');

const [venuesServer, resortsServer] = await Promise.all([
  fetchAll('venues'),
  fetchAll('resorts'),
]);

const venueCsv = readTable(join(ROOT, 'data', 'venues.csv'), VENUE_COLUMNS, fs)
  .records.map((r) => r.rec)
  .filter((r) => r.verified_on);
const resortCsv = readTable(join(ROOT, 'data', 'resorts.csv'), RESORT_COLUMNS, fs)
  .records.map((r) => r.rec)
  .filter((r) => r.verified_on);

const results = [
  compare('venues', VENUE_COLUMNS, venueCsv, venuesServer),
  compare('resorts', RESORT_COLUMNS, resortCsv, resortsServer),
];

const missing = results.flatMap((r) => r.missing);
const drift = results.flatMap((r) => r.drift);
const orphans = results.flatMap((r) => r.orphans);

if (drift.length) {
  console.log(`\n  ${drift.length} field(s) differ — the CSV has been edited since the last import:\n`);
  for (const d of drift.slice(0, 40)) {
    console.log(`    ${d.id.slice(0, 44).padEnd(44)} ${d.column.padEnd(12)}`);
    console.log(`      csv    ${fmt(d.csv)}`);
    console.log(`      server ${fmt(d.server)}`);
  }
  if (drift.length > 40) console.log(`    ... and ${drift.length - 40} more`);
}

if (missing.length) {
  console.log(`\n  ${missing.length} verified row(s) have never been imported:\n`);
  for (const id of missing.slice(0, 40)) console.log(`    ${id}`);
  if (missing.length > 40) console.log(`    ... and ${missing.length - 40} more`);
}

// Not a failure. The importer never deletes, so a row removed from a CSV stays
// on the server until somebody removes it deliberately — which is the right
// default and is reported rather than acted on.
if (orphans.length) {
  console.log(`\n  ${orphans.length} row(s) on the server with no CSV row (orphans, not an error):\n`);
  for (const id of orphans.slice(0, 20)) console.log(`    ${id}`);
}

if (drift.length || missing.length) {
  console.error(
    '\n  OUT OF SYNC. Devices read the server, not the CSVs, so these edits are' +
      '\n  not live — and a refresh will undo them on any device that got them' +
      '\n  from the app bundle.\n\n  Run `npm run db:import` (or `-- --dry-run` first).\n',
  );
  process.exit(1);
}

console.log('\n  In sync. Every verified CSV row matches the deployed catalog.\n');
