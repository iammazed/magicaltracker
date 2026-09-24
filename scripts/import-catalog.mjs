#!/usr/bin/env node
/**
 * Imports data/*.csv into Supabase. Run with `npm run db:import`.
 *
 * Rules this enforces, in order:
 *   1. Validation must pass. A failing `validate:data` aborts the import.
 *   2. Only rows with `verified_on` are imported. Unverified rows are counted
 *      and skipped — so you can import incrementally as you verify, and an
 *      unverified row can never reach the app.
 *   3. Upsert only. Rows are inserted or updated by id; nothing is ever
 *      deleted. A truncated CSV cannot wipe your catalog. Rows in the database
 *      with no matching CSV row are reported as orphans for you to deal with.
 *
 * Connects via DATABASE_URL (the postgres superuser), which bypasses RLS — that
 * is intentional and why this is a local script, never app code.
 *
 * Flags:
 *   --dry-run   report what would change, write nothing
 */

import 'dotenv/config';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

import {
  AREA_ROWS, DESTINATION_ROWS, RESORT_COLUMNS, VENUE_COLUMNS, readTable,
} from './vocabulary.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DRY_RUN = process.argv.includes('--dry-run');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is missing. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

/* ── 1. Validation gate ───────────────────────────────────────────────── */

console.log('\n  Validating CSVs...');
try {
  execFileSync(process.execPath, [join(ROOT, 'scripts', 'validate-data.mjs')], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
} catch {
  console.error('\n  Validation failed. Fix the errors above before importing.');
  console.error('  Run `npm run validate:data` to see them.\n');
  process.exit(1);
}
console.log('  Validation passed.');

/* ── 2. Read and filter ───────────────────────────────────────────────── */

const resortTable = readTable(join(ROOT, 'data', 'resorts.csv'), RESORT_COLUMNS, fs);
const venueTable = readTable(join(ROOT, 'data', 'venues.csv'), VENUE_COLUMNS, fs);

const num = (v) => (v === '' || v == null ? null : Number(v));
const bool = (v) => v === 'TRUE';
const nullable = (v) => (v === '' ? null : v);
const pipes = (v) => (v === '' || v == null ? [] : v.split('|').map((s) => s.trim()).filter(Boolean));

const allResorts = resortTable.records.map((r) => r.rec);
const allVenues = venueTable.records.map((r) => r.rec);

const resortRows = allResorts.filter((r) => r.verified_on);
const venueRows = allVenues.filter((r) => r.verified_on);

const skippedResorts = allResorts.length - resortRows.length;
const skippedVenues = allVenues.length - venueRows.length;

/* ── 3. Import ────────────────────────────────────────────────────────── */

const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });

const counts = {};

try {
  await sql.begin(async (tx) => {
    // destinations — structural, always present
    await tx`
      insert into destinations ${tx(DESTINATION_ROWS, 'id', 'name')}
      on conflict (id) do update set name = excluded.name, updated_at = now()`;
    counts.destinations = DESTINATION_ROWS.length;

    // areas — the controlled vocabulary itself, from scripts/vocabulary.mjs
    const areaRows = AREA_ROWS.map((a) => ({ ...a, destination_id: 'wdw' }));
    await tx`
      insert into areas ${tx(areaRows, 'id', 'destination_id', 'name', 'kind')}
      on conflict (id) do update set
        destination_id = excluded.destination_id,
        name           = excluded.name,
        kind           = excluded.kind,
        updated_at     = now()`;
    counts.areas = areaRows.length;

    // resorts — before venues, because venues.resort_id references them
    if (resortRows.length) {
      const rows = resortRows.map((r) => ({
        id: r.id,
        destination_id: r.destination_id,
        area_id: r.area_id,
        name: r.name,
        tier: r.tier,
        transport: pipes(r.transport),
        transport_notes: nullable(r.transport_notes),
        lat: num(r.lat),
        lng: num(r.lng),
        official_url: nullable(r.official_url),
        description: nullable(r.description),
        status: r.status || 'open',
        verified_on: nullable(r.verified_on),
        source_url: nullable(r.source_url),
      }));
      await tx`
        insert into resorts ${tx(rows, 'id', 'destination_id', 'area_id', 'name', 'tier',
          'transport', 'transport_notes', 'lat', 'lng', 'official_url', 'description',
          'status', 'verified_on', 'source_url')}
        on conflict (id) do update set
          destination_id = excluded.destination_id,
          area_id        = excluded.area_id,
          name           = excluded.name,
          tier           = excluded.tier,
          transport      = excluded.transport,
          transport_notes = excluded.transport_notes,
          lat            = excluded.lat,
          lng            = excluded.lng,
          official_url   = excluded.official_url,
          description    = excluded.description,
          status         = excluded.status,
          verified_on    = excluded.verified_on,
          source_url     = excluded.source_url,
          updated_at     = now()`;
    }
    counts.resorts = resortRows.length;

    if (venueRows.length) {
      const rows = venueRows.map((v) => ({
        id: v.id,
        destination_id: v.destination_id,
        area_id: v.area_id,
        sub_area: nullable(v.sub_area),
        resort_id: nullable(v.resort_id),
        name: v.name,
        venue_kind: v.venue_kind,
        service_type: v.service_type,
        dining_style: nullable(v.dining_style),
        cuisine: v.cuisine,
        price_tier: num(v.price_tier),
        accepts_reservations: bool(v.accepts_reservations),
        is_character_dining: bool(v.is_character_dining),
        is_signature: bool(v.is_signature),
        status: v.status || 'open',
        lat: num(v.lat),
        lng: num(v.lng),
        menu_url: nullable(v.menu_url),
        description: nullable(v.description),
        tags: pipes(v.tags),
        verified_on: nullable(v.verified_on),
        source_url: nullable(v.source_url),
      }));
      await tx`
        insert into venues ${tx(rows, 'id', 'destination_id', 'area_id', 'sub_area',
          'resort_id', 'name', 'venue_kind', 'service_type', 'dining_style', 'cuisine',
          'price_tier', 'accepts_reservations', 'is_character_dining', 'is_signature',
          'status', 'lat', 'lng', 'menu_url', 'description', 'tags', 'verified_on',
          'source_url')}
        on conflict (id) do update set
          destination_id       = excluded.destination_id,
          area_id              = excluded.area_id,
          sub_area             = excluded.sub_area,
          resort_id            = excluded.resort_id,
          name                 = excluded.name,
          venue_kind           = excluded.venue_kind,
          service_type         = excluded.service_type,
          dining_style         = excluded.dining_style,
          cuisine              = excluded.cuisine,
          price_tier           = excluded.price_tier,
          accepts_reservations = excluded.accepts_reservations,
          is_character_dining  = excluded.is_character_dining,
          is_signature         = excluded.is_signature,
          status               = excluded.status,
          lat                  = excluded.lat,
          lng                  = excluded.lng,
          menu_url             = excluded.menu_url,
          description          = excluded.description,
          tags                 = excluded.tags,
          verified_on          = excluded.verified_on,
          source_url           = excluded.source_url,
          updated_at           = now()`;
    }
    counts.venues = venueRows.length;

    if (DRY_RUN) throw new Error('__DRY_RUN__');
  });
} catch (e) {
  if (e.message !== '__DRY_RUN__') {
    await sql.end();
    console.error('\n  Import failed — nothing was written (the whole import is one transaction).');
    console.error(`  ${e.message}\n`);
    process.exit(1);
  }
}

/* ── 4. Report ────────────────────────────────────────────────────────── */

console.log('');
console.log(`  destinations  ${String(counts.destinations).padStart(4)}`);
console.log(`  areas         ${String(counts.areas).padStart(4)}`);
console.log(`  resorts       ${String(counts.resorts).padStart(4)}${skippedResorts ? `   (${skippedResorts} unverified, skipped)` : ''}`);
console.log(`  venues        ${String(counts.venues).padStart(4)}${skippedVenues ? `   (${skippedVenues} unverified, skipped)` : ''}`);

// Orphans: in the database but no longer in the CSV. Never auto-deleted —
// a row could be missing because the CSV was truncated by accident.
if (!DRY_RUN) {
  const csvVenueIds = venueRows.map((v) => v.id);
  const csvResortIds = resortRows.map((r) => r.id);

  const orphanVenues = csvVenueIds.length
    ? await sql`select id, name from venues where id != all(${csvVenueIds}) order by id`
    : await sql`select id, name from venues order by id`;
  const orphanResorts = csvResortIds.length
    ? await sql`select id, name from resorts where id != all(${csvResortIds}) order by id`
    : await sql`select id, name from resorts order by id`;

  const orphans = [
    ...orphanResorts.map((r) => `resorts: ${r.id} (${r.name})`),
    ...orphanVenues.map((v) => `venues: ${v.id} (${v.name})`),
  ];

  if (orphans.length) {
    console.log('');
    console.log(`  ${orphans.length} row(s) in the database with no matching CSV row.`);
    console.log('  Not deleted. Remove them by hand if they are genuinely gone:');
    for (const o of orphans) console.log(`    · ${o}`);
  }
}

await sql.end();

console.log('');
console.log(DRY_RUN ? '  Dry run — nothing written.\n' : '  Import complete.\n');
