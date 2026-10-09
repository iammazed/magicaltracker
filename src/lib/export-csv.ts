import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import type { CatalogResort, CatalogVenue } from '@/lib/catalog-db';
import { jsonList, type Stay, type Visit } from '@/lib/local-db';

/**
 * Export, as two CSVs the user actually owns.
 *
 * Premium, and nearly free to build — which is exactly why it is worth having:
 * the same person who wants 100% of the passport filled is the person who
 * wants the spreadsheet.
 *
 * Deliberately CSV rather than JSON. The audience is someone who opens it in
 * Numbers or Excel, not someone who parses it.
 */

/**
 * RFC 4180 quoting.
 *
 * Every text field goes through this, not just the ones that look risky. A
 * venue description with a comma in it is the normal case here, not the edge
 * case — and a leading `=`, `+`, `-` or `@` is prefixed with an apostrophe,
 * because a spreadsheet will otherwise treat a restaurant note as a formula.
 */
function cell(value: unknown): string {
  if (value == null) return '';
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

const row = (cells: unknown[]) => cells.map(cell).join(',');

const VISIT_HEADER = [
  'venue_id', 'venue_name', 'area', 'sub_area', 'resort', 'venue_kind',
  'cuisine', 'price_tier', 'visited_on', 'date_is_exact', 'rating',
  'would_return', 'party_size', 'dishes', 'photo_count', 'note', 'logged_at',
];

const STAY_HEADER = [
  'resort_id', 'resort_name', 'area', 'tier', 'ownership',
  'check_in', 'check_out', 'nights', 'rating', 'room_type', 'note', 'logged_at',
];

function nights(checkIn: string, checkOut: string | null): string {
  if (!checkOut) return '';
  const ms = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '';
  return String(Math.round(ms / 86_400_000));
}

export function visitsCsv(
  visits: Visit[],
  venues: CatalogVenue[],
  areaName: (id: string) => string,
  resortName: (id: string) => string,
): string {
  const byId = new Map(venues.map((v) => [v.id, v]));
  const lines = [row(VISIT_HEADER)];

  // Oldest first: a record of what happened reads forwards, even though every
  // screen in the app shows newest first.
  for (const visit of [...visits].sort((a, b) => a.visited_on.localeCompare(b.visited_on))) {
    const v = byId.get(visit.venue_id);
    lines.push(
      row([
        visit.venue_id,
        v?.name,
        v ? areaName(v.area_id) : '',
        v?.sub_area,
        v?.resort_id ? resortName(v.resort_id) : '',
        v?.venue_kind,
        v?.cuisine,
        v?.price_tier,
        visit.visited_on,
        visit.date_exact ? 'yes' : 'no',
        visit.rating,
        visit.would_return == null ? '' : visit.would_return ? 'yes' : 'no',
        visit.party_size,
        jsonList(visit.dishes).join('; '),
        jsonList(visit.photos).length,
        visit.note,
        visit.created_at,
      ]),
    );
  }
  return `${lines.join('\n')}\n`;
}

export function staysCsv(
  stays: Stay[],
  resorts: CatalogResort[],
  areaName: (id: string) => string,
): string {
  const byId = new Map(resorts.map((r) => [r.id, r]));
  const lines = [row(STAY_HEADER)];

  for (const stay of [...stays].sort((a, b) => a.check_in.localeCompare(b.check_in))) {
    const r = byId.get(stay.resort_id);
    lines.push(
      row([
        stay.resort_id,
        r?.name,
        r ? areaName(r.area_id) : '',
        r?.tier,
        r?.ownership,
        stay.check_in,
        stay.check_out,
        nights(stay.check_in, stay.check_out),
        stay.rating,
        stay.room_type,
        stay.note,
        stay.created_at,
      ]),
    );
  }
  return `${lines.join('\n')}\n`;
}

/**
 * Writes a CSV to the cache directory and opens the share sheet.
 *
 * Cache rather than documents: the file exists to be handed to another app, and
 * once it has been there is no reason to keep a copy the user cannot see or
 * delete. iOS reclaims the cache on its own.
 */
export async function shareCsv(filename: string, contents: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device.');
  }
  const file = new File(Paths.cache, filename);
  // `overwrite` because exporting twice on the same day reuses the filename,
  // and `create` throws on an existing path without it.
  file.create({ overwrite: true });
  file.write(contents);
  await Sharing.shareAsync(file.uri, {
    mimeType: 'text/csv',
    UTI: 'public.comma-separated-values-text',
    dialogTitle: filename,
  });
}

/** `magicaltracker-visits-2026-10-09.csv` */
export function exportFilename(kind: 'visits' | 'stays'): string {
  return `magicaltracker-${kind}-${new Date().toISOString().slice(0, 10)}.csv`;
}
