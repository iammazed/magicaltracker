import { datesBetween, formatRange, parseISO } from '@/lib/calendar';
import { byTimeThenName, formatTime } from '@/lib/clock';
import type { Trip, TripDay, TripPlan } from '@/lib/local-db';

/**
 * One shape, two outputs.
 *
 * The poster and the text share are built from the SAME `Itinerary`, and that
 * is the point of this file rather than a style choice. Two formatters
 * reading the trip tables directly would drift the first time a rule changed
 * — "a meal planned outside the trip's dates counts as unplaced" is the kind
 * of rule that would get fixed in one of them and not the other, and the two
 * shares are impossible to compare side by side because one of them is a
 * picture.
 *
 * Nothing here touches the database or React. It is a pure transform, which
 * is also what makes the text output readable at a glance in a test.
 */

export type ItineraryMeal = {
  name: string;
  booked: boolean;
  /** 'HH:MM' 24-hour, or null for "some time that day". */
  time: string | null;
};

export type ItineraryDay = {
  /** YYYY-MM-DD. */
  date: string;
  /** `SAT 14` — weekday and day of month, which is how people read a plan. */
  label: string;
  /**
   * The park, `Rest day`, `Resort day`, or null when nothing is decided.
   *
   * Null is a real state and is shown as such. A day with no park yet is
   * information — it is the day somebody still has to think about — and
   * dropping it from the list would make a seven-night trip look like five.
   */
  where: string | null;
  meals: ItineraryMeal[];
  /**
   * Set only on the day a split stay changes hotel, to the resort being
   * moved INTO. The move is a thing that happens on a day, so it belongs on
   * the day rather than being left for a reader to work out from two date
   * ranges in the header.
   */
  movingTo: string | null;
};

export type Itinerary = {
  name: string;
  /** `March 14 – 21, 2027`. */
  dates: string;
  /**
   * Where you sleep, in order, already formatted.
   *
   * Nought, one or two entries — a split stay is two hotels and the schema
   * holds exactly that. Each carries its own date range so a reader can tell
   * which nights are where, which is the whole reason the changeover date is
   * stored at all.
   */
  stays: { name: string; range: string }[];
  days: ItineraryDay[];
  /** Meals with no day, or a day outside the trip's own dates. */
  unplaced: ItineraryMeal[];
  mealCount: number;
  bookedCount: number;
};

/** `SAT`, `SUN`. Built on UTC so a date never slips a day on the way in. */
const WEEKDAY = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function dayLabel(iso: string): string {
  const p = parseISO(iso);
  if (!p) return iso;
  // `Date.UTC` rather than the local constructor: `new Date(2027, 2, 14)` is
  // midnight in the device's zone, and west of UTC that is the 13th once it
  // is read back as UTC. The weekday is the one thing here that can be
  // silently wrong, and only for some users.
  const weekday = WEEKDAY[new Date(Date.UTC(p.year, p.month, p.day)).getUTCDay()];
  return `${weekday} ${p.day}`;
}

export function buildItinerary({
  trip,
  days,
  plans,
  venueName,
  areaName,
  resortName,
}: {
  trip: Trip;
  /** Keyed by ISO date, as `daysFor` returns it. */
  days: Map<string, TripDay>;
  plans: TripPlan[];
  venueName: (id: string) => string | undefined;
  areaName: (id: string) => string | undefined;
  resortName: (id: string) => string | undefined;
}): Itinerary {
  const dates = datesBetween(trip.start_date, trip.end_date);
  const inRange = new Set(dates);

  // Grouped once rather than filtered per day, so a trip with a long dining
  // list does not walk the whole list once for every night of the stay.
  const byDate = new Map<string, ItineraryMeal[]>();
  const unplaced: ItineraryMeal[] = [];
  for (const p of plans) {
    const meal: ItineraryMeal = {
      name: venueName(p.venue_id) ?? 'Somewhere',
      booked: !!p.booked,
      time: p.reservation_time,
    };
    // Same rule as the trip screen: a `planned_on` outside the trip's own
    // dates is unplaced, which is what makes moving a trip's dates safe.
    if (p.planned_on && inRange.has(p.planned_on)) {
      const list = byDate.get(p.planned_on) ?? [];
      list.push(meal);
      byDate.set(p.planned_on, list);
    } else {
      unplaced.push(meal);
    }
  }

  // Timed meals in clock order, then the loose ones alphabetically — see
  // `byTimeThenName`. The pool has no day and therefore no schedule, so it
  // sorts the same way and the times are simply along for the ride.
  for (const list of byDate.values()) list.sort(byTimeThenName);
  unplaced.sort(byTimeThenName);

  /**
   * The stay, or the two halves of it.
   *
   * `resort_switch_on` is the day you check IN to the second resort, so it
   * is the end of the first range and the start of the second. A changeover
   * outside the trip's own dates is ignored rather than drawn, because a
   * trip whose dates were shortened after the split was set would otherwise
   * print a range that runs backwards.
   */
  const second = trip.resort_id_2 ? resortName(trip.resort_id_2) ?? null : null;
  const switchOn =
    second && trip.resort_switch_on && inRange.has(trip.resort_switch_on)
      ? trip.resort_switch_on
      : null;
  const first = trip.resort_id ? resortName(trip.resort_id) ?? null : null;

  const stays: { name: string; range: string }[] = [];
  if (first) {
    stays.push({
      name: first,
      range: formatRange(trip.start_date, switchOn ?? trip.end_date),
    });
  }
  if (second && switchOn) {
    stays.push({ name: second, range: formatRange(switchOn, trip.end_date) });
  }

  const itineraryDays: ItineraryDay[] = dates.map((date) => {
    const row = days.get(date);
    const where = row?.area_id
      ? areaName(row.area_id) ?? row.area_id
      : row?.kind === 'rest'
        ? 'Rest day'
        : row?.kind === 'resort'
          ? 'Resort day'
          : null;
    return {
      date,
      label: dayLabel(date),
      where,
      meals: byDate.get(date) ?? [],
      movingTo: switchOn === date ? second : null,
    };
  });

  return {
    name: trip.name,
    dates: formatRange(trip.start_date, trip.end_date),
    stays,
    days: itineraryDays,
    unplaced,
    mealCount: plans.length,
    bookedCount: plans.filter((p) => p.booked).length,
  };
}

/**
 * The itinerary as plain text, for a message or an email.
 *
 * ## Why plain text and not Markdown
 *
 * This lands in Messages, WhatsApp and Mail, none of which render Markdown.
 * `**Magic Kingdom**` would arrive with the asterisks in it. Two leading
 * spaces and a bullet survive everywhere and degrade to something readable
 * even in a plain-text email client that has collapsed the indentation.
 *
 * ## Why the legend is at the bottom
 *
 * A tick means booked and nothing else on the list says so. Without the line
 * at the end, a recipient reading `✓ Space 220` has to guess whether the tick
 * means booked, eaten, or wanted — and the three are very different when
 * somebody is about to try to make a reservation you already hold.
 */
export function itineraryText(it: Itinerary, { includeDining }: { includeDining: boolean }): string {
  const out: string[] = [it.name, it.dates];
  // One resort prints as a bare name; two print with their ranges, because
  // with two the dates are the only thing that says which is which.
  if (it.stays.length === 1) out.push(it.stays[0].name);
  else for (const st of it.stays) out.push(`${st.name} · ${st.range}`);
  out.push('');

  it.days.forEach((d, i) => {
    /**
     * Blank lines between days only when the meals are in.
     *
     * With the dining list on, each day is a little block and the gap is
     * what separates one block from the next. With it off, every day is a
     * single line and the same gap doubles the length of the message for
     * nothing — a five-night trip becomes eleven lines of which five are
     * empty. Same data, two different shapes, because the right spacing
     * depends on what is being spaced.
     */
    if (includeDining && i > 0) out.push('');
    // Worded exactly as the card words it. A recipient seeing "—" has to
    // guess whether it means a rest day or an oversight.
    out.push(`${d.label}  ${d.where ?? 'Nothing planned yet'}`);
    // Above the meals: you change hotel before dinner, and a reader scanning
    // the day wants the logistics before the plans.
    if (d.movingTo) out.push(`  → Moving to ${d.movingTo}`);
    if (includeDining) {
      for (const m of d.meals) {
        // The time leads the line. A column of times down the left is what
        // makes a day readable as a schedule rather than a list.
        const when = m.time ? `${formatTime(m.time)} ` : '';
        out.push(`  ${when}${m.booked ? '✓' : '·'} ${m.name}`);
      }
    }
  });

  if (includeDining && it.unplaced.length) {
    out.push('');
    out.push('NOT ON A DAY YET');
    for (const m of it.unplaced) {
      const when = m.time ? `${formatTime(m.time)} ` : '';
      out.push(`  ${when}${m.booked ? '✓' : '·'} ${m.name}`);
    }
  }

  out.push('');
  // The legend only earns its line when there is something ticked to explain.
  if (includeDining && it.bookedCount > 0) out.push('✓ booked');
  out.push('Planned with MagicalTracker');

  return out.join('\n');
}
