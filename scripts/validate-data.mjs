#!/usr/bin/env node
/**
 * Validates data/venues.csv and data/resorts.csv against the schema in
 * data/README.md. Run with `npm run validate:data`.
 *
 * Errors fail the run. Unverified rows (no `verified_on`) are warnings during
 * data entry — pass --strict to promote them to errors before shipping.
 *
 * Vocabularies and CSV parsing live in scripts/vocabulary.mjs, shared with the
 * import script so the two can never disagree.
 */

import * as fs from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  AREAS, BOUNDS, DINING_STYLES, PARKS, RESORT_AREAS, RESORT_COLUMNS, RESORT_TIERS,
  SERVICE_TYPES, STATUS, SUB_AREAS, TAGS, TRANSPORT, VENUE_COLUMNS, VENUE_KINDS,
  WORLD_SHOWCASE, readTable,
} from './vocabulary.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const STRICT = process.argv.includes('--strict');

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const errors = [];
const warnings = [];

const err = (file, line, id, msg) =>
  errors.push(`${file}:${line}${id ? ` [${id}]` : ''} ${msg}`);
const warn = (file, line, id, msg) =>
  warnings.push(`${file}:${line}${id ? ` [${id}]` : ''} ${msg}`);

/* ── Field checks ─────────────────────────────────────────────────────── */

function checkRequired(file, line, id, rec, fields) {
  for (const f of fields) if (!rec[f]) err(file, line, id, `"${f}" is required but empty`);
}

function checkEnum(file, line, id, rec, field, allowed, { required = true } = {}) {
  const v = rec[field];
  if (!v) { if (required) err(file, line, id, `"${field}" is required but empty`); return; }
  if (!allowed.includes(v)) {
    err(file, line, id, `"${field}" is "${v}" — must be one of: ${allowed.join(' | ')}`);
  }
}

function checkBool(file, line, id, rec, field) {
  const v = rec[field];
  if (!v) { err(file, line, id, `"${field}" is required but empty`); return; }
  if (v !== 'TRUE' && v !== 'FALSE') {
    err(file, line, id, `"${field}" is "${v}" — must be exactly TRUE or FALSE`);
  }
}

function checkCoords(file, line, id, rec) {
  for (const [field, min, max] of [
    ['lat', BOUNDS.latMin, BOUNDS.latMax],
    ['lng', BOUNDS.lngMin, BOUNDS.lngMax],
  ]) {
    const raw = rec[field];
    if (!raw) { warn(file, line, id, `"${field}" is empty — drop a pin in Google Maps`); continue; }
    const n = Number(raw);
    if (!Number.isFinite(n)) err(file, line, id, `"${field}" is "${raw}" — not a number`);
    else if (n < min || n > max) {
      err(file, line, id,
        `"${field}" is ${n} — outside Walt Disney World (${min} to ${max}). ` +
        `Check for a swapped lat/lng or a missing minus sign.`);
    }
  }
}

function checkUrl(file, line, id, rec, field, { host = 'disneyworld.disney.go.com' } = {}) {
  const v = rec[field];
  if (!v) { warn(file, line, id, `"${field}" is empty`); return; }
  let u;
  try { u = new URL(v); } catch { err(file, line, id, `"${field}" is not a valid URL: "${v}"`); return; }
  if (u.protocol !== 'https:') err(file, line, id, `"${field}" must be https`);
  if (host && !u.hostname.endsWith(host)) {
    warn(file, line, id, `"${field}" points at ${u.hostname}, expected ${host}`);
  }
}

function checkVerified(file, line, id, rec) {
  const v = rec.verified_on;
  if (!v) {
    warn(file, line, id, 'not verified — confirm against disneyworld.com, then set verified_on');
    return;
  }
  if (!ISO_DATE.test(v)) { err(file, line, id, `"verified_on" is "${v}" — must be YYYY-MM-DD`); return; }
  const d = new Date(`${v}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) err(file, line, id, `"verified_on" is not a real date: ${v}`);
  else if (d.getTime() > Date.now()) err(file, line, id, `"verified_on" is in the future: ${v}`);
}

function checkPipeList(file, line, id, rec, field, allowed, { required = false } = {}) {
  const v = rec[field];
  if (!v) { if (required) err(file, line, id, `"${field}" is required but empty`); return; }
  const seen = new Set();
  for (const p of v.split('|').map((x) => x.trim())) {
    if (!p) { err(file, line, id, `"${field}" has an empty entry — check for "||" or a trailing "|"`); continue; }
    if (!allowed.includes(p)) {
      err(file, line, id, `"${field}" contains "${p}" — must be one of: ${allowed.join(' | ')}`);
    }
    if (seen.has(p)) err(file, line, id, `"${field}" repeats "${p}"`);
    seen.add(p);
  }
}

/* ── Run ──────────────────────────────────────────────────────────────── */

const resortTable = readTable(join(ROOT, 'data', 'resorts.csv'), RESORT_COLUMNS, fs);
const venueTable = readTable(join(ROOT, 'data', 'venues.csv'), VENUE_COLUMNS, fs);

for (const [name, t] of [['resorts.csv', resortTable], ['venues.csv', venueTable]]) {
  if (t.missing) { errors.push(`data/${name} not found`); continue; }
  for (const issue of t.headerIssues) errors.push(`${name} header — ${issue}`);
  for (const { line, cellCount } of t.records) {
    if (cellCount !== t.columnCount) {
      err(name, line, '', `has ${cellCount} fields, expected ${t.columnCount} — an unquoted comma in a name is the usual cause`);
    }
  }
}

const resortIds = new Set();
for (const { rec, line } of resortTable.records) {
  const f = 'resorts.csv';
  const id = rec.id;

  if (!id) err(f, line, '', '"id" is required');
  else if (!SLUG.test(id)) err(f, line, id, '"id" must be a lowercase kebab slug');
  else if (resortIds.has(id)) err(f, line, id, 'duplicate id');
  else resortIds.add(id);

  checkRequired(f, line, id, rec, ['name']);
  checkEnum(f, line, id, rec, 'destination_id', ['wdw']);
  checkEnum(f, line, id, rec, 'area_id', RESORT_AREAS);
  checkEnum(f, line, id, rec, 'tier', RESORT_TIERS);
  checkEnum(f, line, id, rec, 'status', STATUS);
  checkPipeList(f, line, id, rec, 'transport', TRANSPORT, { required: true });
  checkCoords(f, line, id, rec);
  checkUrl(f, line, id, rec, 'official_url');
  checkVerified(f, line, id, rec);
  if (!rec.description) warn(f, line, id, '"description" is empty — write one in your own words');
}

const venueIds = new Set();
const pavilionsWithBar = new Set();
for (const { rec, line } of venueTable.records) {
  const f = 'venues.csv';
  const id = rec.id;

  if (!id) err(f, line, '', '"id" is required');
  else if (!SLUG.test(id)) err(f, line, id, '"id" must be a lowercase kebab slug');
  else if (venueIds.has(id)) err(f, line, id, 'duplicate id');
  else venueIds.add(id);

  checkRequired(f, line, id, rec, ['name', 'cuisine']);
  checkEnum(f, line, id, rec, 'destination_id', ['wdw']);
  checkEnum(f, line, id, rec, 'area_id', AREAS);
  checkEnum(f, line, id, rec, 'venue_kind', VENUE_KINDS);
  checkEnum(f, line, id, rec, 'service_type', SERVICE_TYPES);
  checkEnum(f, line, id, rec, 'dining_style', DINING_STYLES, { required: false });
  checkEnum(f, line, id, rec, 'status', STATUS);
  checkEnum(f, line, id, rec, 'price_tier', ['1', '2', '3', '4']);
  checkBool(f, line, id, rec, 'accepts_reservations');
  checkBool(f, line, id, rec, 'is_character_dining');
  checkBool(f, line, id, rec, 'is_signature');
  checkCoords(f, line, id, rec);
  checkUrl(f, line, id, rec, 'menu_url');
  checkPipeList(f, line, id, rec, 'tags', TAGS);
  checkVerified(f, line, id, rec);
  if (!rec.description) warn(f, line, id, '"description" is empty — write one in your own words');

  if (rec.sub_area) {
    const allowed = SUB_AREAS[rec.area_id];
    if (!allowed) err(f, line, id, `"sub_area" is "${rec.sub_area}" but area "${rec.area_id}" has no sub-areas`);
    else if (!allowed.includes(rec.sub_area)) {
      err(f, line, id, `"sub_area" is "${rec.sub_area}", not valid within "${rec.area_id}"`);
    }
  }

  if (rec.resort_id) {
    if (!resortIds.has(rec.resort_id)) {
      err(f, line, id, `"resort_id" is "${rec.resort_id}" — no such id in resorts.csv`);
    }
    if (PARKS.includes(rec.area_id)) {
      err(f, line, id, `has a resort_id but sits in park "${rec.area_id}" — one or the other`);
    }
  }

  const tags = (rec.tags || '').split('|');
  if (rec.is_character_dining === 'TRUE' && !tags.includes('character-dining')) {
    warn(f, line, id, 'is_character_dining is TRUE but the "character-dining" tag is missing');
  }
  if (rec.is_signature === 'TRUE' && !tags.includes('signature')) {
    warn(f, line, id, 'is_signature is TRUE but the "signature" tag is missing');
  }
  if (rec.service_type === 'quick' && rec.accepts_reservations === 'TRUE') {
    warn(f, line, id, 'quick service that accepts reservations — unusual, worth re-checking');
  }

  if (tags.includes('world-showcase-bar')) {
    if (!WORLD_SHOWCASE.includes(rec.sub_area)) {
      err(f, line, id, `tagged "world-showcase-bar" but sub_area "${rec.sub_area}" is not a World Showcase pavilion`);
    } else pavilionsWithBar.add(rec.sub_area);
  }
}

if (venueTable.records.length > 0) {
  const missing = WORLD_SHOWCASE.filter((p) => !pavilionsWithBar.has(p));
  if (missing.length && missing.length < WORLD_SHOWCASE.length) {
    warn('venues.csv', 0, '',
      `Drinking Around the World is not yet completable — no "world-showcase-bar" venue in: ${missing.join(', ')}`);
  }
}

/* ── Output ───────────────────────────────────────────────────────────── */

const verifiedVenues = venueTable.records.filter((r) => r.rec.verified_on).length;
const verifiedResorts = resortTable.records.filter((r) => r.rec.verified_on).length;

console.log('');
console.log(`  venues   ${venueTable.records.length} rows, ${verifiedVenues} verified`);
console.log(`  resorts  ${resortTable.records.length} rows, ${verifiedResorts} verified`);
console.log('');

if (warnings.length) {
  console.log(`  ${warnings.length} warning${warnings.length === 1 ? '' : 's'}`);
  for (const w of warnings) console.log(`    · ${w}`);
  console.log('');
}

if (errors.length) {
  console.log(`  ${errors.length} error${errors.length === 1 ? '' : 's'}`);
  for (const e of errors) console.log(`    ✗ ${e}`);
  console.log('');
  process.exit(1);
}

if (STRICT && warnings.length) {
  console.log('  --strict: warnings are errors. Not ready to ship.\n');
  process.exit(1);
}

console.log(warnings.length === 0 ? '  All checks passed.\n' : '  No errors.\n');
