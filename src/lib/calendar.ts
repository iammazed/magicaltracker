/**
 * Date maths for the date pickers.
 *
 * Everything here is pure and string-in, string-out on `YYYY-MM-DD`, which is
 * what the database stores and what the rest of the app passes around.
 *
 * **All grid arithmetic goes through `Date.UTC`.** `new Date('2027-04-03')`
 * parses as midnight UTC and then renders in local time, so west of Greenwich
 * every date in the calendar would render as the day before. Building with
 * `Date.UTC` and reading back with `getUTC*` keeps a date a date rather than an
 * instant, which is the only thing that makes this correct everywhere.
 *
 * The one exception is "today", which must be genuinely local — someone
 * planning a trip at 11pm in Florida means today, not tomorrow in UTC. That
 * lives in `todayISO()` in `local-db.ts` and is passed in.
 */

export type YearMonth = { year: number; month: number };

/** A single cell in the month grid. */
export type DayCell = {
  iso: string;
  day: number;
  /** False for the leading and trailing days that pad the grid to whole weeks. */
  inMonth: boolean;
};

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Sunday-first, which is the US convention and Walt Disney World is in Florida. */
export const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function toISO(year: number, month: number, day: number): string {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

export function parseISO(iso: string): { year: number; month: number; day: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]) - 1;
  const day = Number(m[3]);
  if (month < 0 || month > 11 || day < 1 || day > 31) return null;
  // Rejects 2027-02-30: the UTC constructor rolls it into March, so a date
  // that survives the round trip is a date that exists.
  const date = new Date(Date.UTC(year, month, day));
  if (date.getUTCMonth() !== month || date.getUTCDate() !== day) return null;
  return { year, month, day };
}

/** Zero-padded ISO dates also compare correctly with `<` directly, which is
 *  what the grid does inline — no helper needed for that. */
export function isValidISO(iso: string): boolean {
  return parseISO(iso) !== null;
}

export function daysInMonth(year: number, month: number): number {
  // Day 0 of the next month is the last day of this one, which handles leap
  // years without a special case.
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

export function addMonths({ year, month }: YearMonth, delta: number): YearMonth {
  const total = year * 12 + month + delta;
  return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
}

export function monthOf(iso: string): YearMonth | null {
  const parsed = parseISO(iso);
  return parsed ? { year: parsed.year, month: parsed.month } : null;
}

export function monthLabel({ year, month }: YearMonth): string {
  return `${MONTHS[month]} ${year}`;
}

/**
 * Six weeks of cells, padded with the neighbouring months.
 *
 * Always six rows, never five or four. A grid that changes height as you page
 * through months makes the calendar card resize under your thumb mid-tap.
 */
export function monthGrid({ year, month }: YearMonth): DayCell[][] {
  const firstWeekday = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const weeks: DayCell[][] = [];

  for (let week = 0; week < 6; week++) {
    const cells: DayCell[] = [];
    for (let weekday = 0; weekday < 7; weekday++) {
      // Offset from the 1st: negative values roll back into the previous
      // month, past the length rolls into the next, and Date.UTC normalises
      // both for us.
      const offset = week * 7 + weekday - firstWeekday;
      const date = new Date(Date.UTC(year, month, 1 + offset));
      cells.push({
        iso: toISO(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
        day: date.getUTCDate(),
        inMonth: date.getUTCMonth() === month && date.getUTCFullYear() === year,
      });
    }
    weeks.push(cells);
  }
  return weeks;
}

/** Nights, not days. Arriving Friday and leaving Sunday is two nights. */
export function nightsBetween(startISO: string, endISO: string): number {
  const a = parseISO(startISO);
  const b = parseISO(endISO);
  if (!a || !b) return 0;
  const ms =
    Date.UTC(b.year, b.month, b.day) - Date.UTC(a.year, a.month, a.day);
  return Math.round(ms / 86_400_000);
}

/** `2027-04-03` -> `Sat, Apr 3`. */
export function formatShort(iso: string): string {
  const parsed = parseISO(iso);
  if (!parsed) return '';
  const date = new Date(Date.UTC(parsed.year, parsed.month, parsed.day));
  return `${DAYS_SHORT[date.getUTCDay()]}, ${MONTHS[parsed.month].slice(0, 3)} ${parsed.day}`;
}
