/**
 * Wall-clock times, as stored on a planned meal.
 *
 * A reservation time is `'HH:MM'` in 24-hour park-local time and nothing
 * else — not a timestamp, not a zone, not a date. The date it belongs to is
 * already on the row as `planned_on`.
 *
 * Pure, and kept out of any `.tsx` file on purpose: `trip-share.ts` formats
 * itineraries outside React and must not drag React Native in to print a
 * time. Same lesson as `datesBetween`.
 */

/** Does this look like a time we wrote? Cheap guard for data off the wire. */
export function isValidTime(t: string | null | undefined): t is string {
  if (!t) return false;
  const m = /^(\d{2}):(\d{2})$/.exec(t);
  if (!m) return false;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h >= 0 && h <= 23 && min >= 0 && min <= 59;
}

/**
 * `'19:40'` → `'7:40pm'`.
 *
 * Lower-case `pm` with no space, because this sits in a dense list beside a
 * restaurant name and `7:40 PM` is two extra characters shouting. Midnight
 * and noon come out as `12:00am` and `12:00pm`, which is the convention
 * everyone reads correctly even though both are arguably ambiguous.
 *
 * An unparseable value is returned as-is rather than thrown over. This runs
 * while drawing a row, and a row that renders `19:40` is a cosmetic problem
 * where a thrown error is a blank screen.
 */
export function formatTime(t: string | null | undefined): string {
  if (!isValidTime(t)) return t ?? '';
  const [h, m] = t.split(':').map(Number);
  const suffix = h < 12 ? 'am' : 'pm';
  const twelve = h % 12 === 0 ? 12 : h % 12;
  return `${twelve}:${String(m).padStart(2, '0')}${suffix}`;
}

/**
 * Sorts meals within a day: timed ones first in clock order, then the rest
 * alphabetically.
 *
 * **Untimed last, not first.** A day's plan is read as a schedule, so the
 * rows that have a place in it come first and the loose ones gather at the
 * bottom where they read as "also, some time today" — which is exactly what
 * they are. Sorting them to the top would put the least settled thing at the
 * hour somebody is checking.
 *
 * Lexicographic comparison is correct for zero-padded 24-hour times, so
 * there is no parsing here and nothing to get wrong about noon.
 */
export function byTimeThenName<T extends { time: string | null; name: string }>(
  a: T,
  b: T,
): number {
  const at = isValidTime(a.time) ? a.time : null;
  const bt = isValidTime(b.time) ? b.time : null;
  if (at && bt && at !== bt) return at < bt ? -1 : 1;
  if (at && !bt) return -1;
  if (!at && bt) return 1;
  return a.name.localeCompare(b.name);
}
