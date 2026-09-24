#!/usr/bin/env node
/**
 * Rebuilds data/catalog-entry.xlsx from data/*.csv.
 *
 * Exports the vocabularies from vocabulary.mjs to a temp JSON, then hands off
 * to the Python generator — openpyxl has no usable JavaScript equivalent for
 * data-validation dropdowns and cell comments.
 *
 * Keeping vocabulary.mjs as the only definition means the workbook's dropdowns
 * can never disagree with what `validate:data` enforces.
 */

import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  AREA_ROWS, DINING_STYLES, RESORT_COLUMNS, RESORT_TIERS, SERVICE_TYPES,
  STATUS, SUB_AREAS, TAGS, TRANSPORT, VENUE_COLUMNS, VENUE_KINDS,
} from './vocabulary.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

const payload = {
  areas: AREA_ROWS,
  subAreas: SUB_AREAS,
  tags: TAGS,
  transport: TRANSPORT,
  status: STATUS,
  tiers: RESORT_TIERS,
  kinds: VENUE_KINDS,
  service: SERVICE_TYPES,
  styles: DINING_STYLES,
  venueCols: VENUE_COLUMNS,
  resortCols: RESORT_COLUMNS,
};

const tmp = join(mkdtempSync(join(tmpdir(), 'mt-vocab-')), 'vocab.json');
writeFileSync(tmp, JSON.stringify(payload), 'utf8');

console.log('');
const py = spawnSync('python', [join(HERE, 'build-workbook.py'), tmp], {
  stdio: 'inherit',
});

if (py.error?.code === 'ENOENT') {
  console.error('  python not found on PATH.');
  console.error('  The workbook generator needs Python with openpyxl:');
  console.error('    pip install openpyxl\n');
  process.exit(1);
}

if (py.status !== 0) {
  console.error('\n  Workbook generation failed.');
  console.error('  If openpyxl is missing:  pip install openpyxl\n');
  process.exit(py.status ?? 1);
}

console.log('');
console.log('  Next: upload to Google Sheets with File > Import > Replace spreadsheet.');
console.log('  The CSVs stay the source of truth; this file is a copy.');
console.log('');
