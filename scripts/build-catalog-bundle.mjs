#!/usr/bin/env node
/**
 * Builds the offline catalog bundle: CSVs -> src/data/catalog.json.
 * Run with `npm run data:bundle`.
 *
 * The app ships with this file inside the JS bundle and seeds SQLite from it
 * on first launch, so a brand-new install has the whole catalog before it has
 * ever reached the network. Park wifi is bad exactly where people want to look
 * up a restaurant, and an empty list in a dead zone is the failure mode that
 * gets written up in reviews.
 *
 * Generated FROM THE CSVs rather than from Supabase, for two reasons:
 *
 *   - The CSVs are the source of truth and the database is downstream of them,
 *     so generating from the database would mean generating from a copy.
 *   - It needs no credentials and no network, which means it can run in CI and
 *     cannot produce a different answer on a bad connection.
 *
 * It applies the SAME `verified_on` gate as `db:import`, so the bundle and the
 * database always hold the same set of rows. Skipping that would let an
 * unverified row reach users through the bundle after being deliberately kept
 * out of the database.
 *
 * `version` is a content hash. A changed CSV changes the hash, the app sees a
 * version it has not seen, and it re-seeds. Nothing to remember to bump.
 */

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  AREA_ROWS,
  MENU_COLUMNS,
  RESORT_COLUMNS,
  VENUE_COLUMNS,
  readTable,
} from './vocabulary.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'src', 'data', 'catalog.json');

const list = (v) => (v ? v.split('|').map((s) => s.trim()).filter(Boolean) : []);
const bool = (v) => String(v).toUpperCase() === 'TRUE';
const num = (v) => (v === '' || v == null ? null : Number(v));

function readVerified(file, columns, label) {
  const { missing, headerIssues, records } = readTable(
    join(ROOT, 'data', file),
    columns,
    fs,
  );
  if (missing) {
    console.error(`✗ data/${file} is missing.`);
    process.exit(1);
  }
  if (headerIssues.length) {
    console.error(`✗ data/${file}: ${headerIssues.join('; ')}`);
    process.exit(1);
  }

  const rows = records.map((r) => r.rec);
  const verified = rows.filter((r) => r.verified_on);
  const skipped = rows.length - verified.length;
  if (skipped > 0) {
    console.warn(
      `  ! ${skipped} ${label} row(s) have no verified_on and were left out, ` +
        'matching what db:import does.',
    );
  }
  return verified;
}

const venues = readVerified('venues.csv', VENUE_COLUMNS, 'venue').map((r) => ({
  id: r.id,
  name: r.name,
  area_id: r.area_id,
  sub_area: r.sub_area || null,
  resort_id: r.resort_id || null,
  venue_kind: r.venue_kind,
  service_type: list(r.service_type),
  dining_style: list(r.dining_style),
  cuisine: r.cuisine || null,
  price_tier: num(r.price_tier),
  reservations_recommended: bool(r.reservations_recommended),
  is_character_dinner_dining: bool(r.is_character_dinner_dining),
  is_character_breakfast_dining: bool(r.is_character_breakfast_dining),
  is_signature: bool(r.is_signature),
  status: r.status,
  lat: num(r.lat),
  lng: num(r.lng),
  description: r.description || null,
  tags: list(r.tags),
  keywords: list(r.keywords),
  // One URL per meal period — Disney publishes a different menu for each.
  ...Object.fromEntries(MENU_COLUMNS.map((c) => [c, r[c] || null])),
}));

const resorts = readVerified('resorts.csv', RESORT_COLUMNS, 'resort').map((r) => ({
  id: r.id,
  name: r.name,
  area_id: r.area_id,
  tier: r.tier,
  transport: list(r.transport),
  transport_notes: r.transport_notes || null,
  ownership: r.ownership,
  lat: num(r.lat),
  lng: num(r.lng),
  official_url: r.official_url || null,
  description: r.description || null,
  status: r.status,
}));

// Sorted so the hash depends on the data and not on CSV row order.
venues.sort((a, b) => a.id.localeCompare(b.id));
resorts.sort((a, b) => a.id.localeCompare(b.id));

const payload = { areas: AREA_ROWS, resorts, venues };
const version = createHash('sha256')
  .update(JSON.stringify(payload))
  .digest('hex')
  .slice(0, 12);

// `generated_at` is deliberately OUTSIDE the hashed payload. Including it would
// change the version on every run and force every installed app to re-seed a
// catalog that had not actually changed.
const bundle = { version, generated_at: new Date().toISOString(), ...payload };

const previous = fs.existsSync(OUT)
  ? JSON.parse(fs.readFileSync(OUT, 'utf8')).version
  : null;

fs.mkdirSync(dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `${JSON.stringify(bundle, null, 2)}\n`);

const kb = (fs.statSync(OUT).size / 1024).toFixed(0);
console.log(`\n  src/data/catalog.json  ${kb} KB`);
console.log(`  ${venues.length} venues · ${resorts.length} resorts · ${AREA_ROWS.length} areas`);
console.log(
  previous === version
    ? `  version ${version} (unchanged — installed apps will not re-seed)`
    : `  version ${version}${previous ? ` (was ${previous} — apps will re-seed)` : ''}`,
);
