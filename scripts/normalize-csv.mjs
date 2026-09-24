#!/usr/bin/env node
/**
 * Repairs the things Google Sheets breaks on export. Run with
 * `npm run data:normalize` after every download, before `validate:data`.
 *
 * Sheets reformats anything it thinks is a date into the locale's display
 * format, so `2026-09-21` comes back as `9/21/2026` — every row, every export.
 * Rather than fighting the spreadsheet, normalize on the way in.
 *
 * Also strips the UTF-8 BOM that Excel adds, which otherwise corrupts the
 * first column name into "﻿id" and makes every row look like it is
 * missing an id.
 *
 * Idempotent: running it on already-clean files changes nothing.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseCsv } from './vocabulary.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FILES = ['venues.csv', 'resorts.csv'];
const DATE_COLUMNS = ['verified_on'];

/** M/D/YYYY or MM/DD/YYYY -> YYYY-MM-DD. Leaves anything else alone. */
function toIso(value) {
  const m = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return value;
  const [, month, day, year] = m;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

/** Re-quote a field only when CSV requires it. */
function quote(v) {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

let totalChanged = 0;

for (const file of FILES) {
  const path = join(ROOT, 'data', file);
  let raw;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    console.log(`  ${file.padEnd(14)} not found, skipped`);
    continue;
  }

  const hadBom = raw.charCodeAt(0) === 0xfeff;
  if (hadBom) raw = raw.slice(1);

  const rows = parseCsv(raw);
  if (!rows.length) {
    console.log(`  ${file.padEnd(14)} empty, skipped`);
    continue;
  }

  const header = rows[0].map((h) => h.trim());
  const dateIdx = DATE_COLUMNS.map((c) => header.indexOf(c)).filter((i) => i >= 0);

  let dates = 0;
  for (const row of rows.slice(1)) {
    for (const i of dateIdx) {
      if (row[i] == null) continue;
      const fixed = toIso(row[i].trim());
      if (fixed !== row[i]) {
        row[i] = fixed;
        dates++;
      }
    }
  }

  const out = rows.map((r) => r.map((c) => quote(c ?? '')).join(',')).join('\n') + '\n';
  const changed = dates > 0 || hadBom || out !== raw;
  if (changed) writeFileSync(path, out, 'utf8');
  totalChanged += dates;

  const notes = [];
  if (dates) notes.push(`${dates} date${dates === 1 ? '' : 's'} -> YYYY-MM-DD`);
  if (hadBom) notes.push('BOM stripped');
  if (!notes.length) notes.push('already clean');
  console.log(`  ${file.padEnd(14)} ${notes.join(', ')}`);
}

console.log('');
console.log(
  totalChanged
    ? `  Normalized ${totalChanged} value(s). Run \`npm run validate:data\` next.\n`
    : '  Nothing to fix.\n',
);
