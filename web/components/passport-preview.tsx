import { Burst } from "@/components/starfield";

/**
 * Illustrative preview of the app's passport screen, styled as an actual
 * passport page — stamp and all. Numbers are representative of the product,
 * not real user data.
 *
 * The brand ramp runs in park order, the one place its ordering means
 * something. Gold marks earned achievements and nothing else.
 */

const PARKS = [
  { name: "Magic Kingdom", eaten: 18, total: 24, color: "bg-brand-1" },
  { name: "EPCOT", eaten: 21, total: 34, color: "bg-brand-3" },
  { name: "Hollywood Studios", eaten: 9, total: 16, color: "bg-brand-5" },
  { name: "Animal Kingdom", eaten: 6, total: 13, color: "bg-brand-6" },
];

const BADGES = [
  { label: "Drinking Around the World", earned: true },
  { label: "Four Parks, One Day", earned: true },
  { label: "Transportation Challenge", earned: false },
];

export function PassportPreview() {
  const eaten = PARKS.reduce((n, p) => n + p.eaten, 0);
  const total = PARKS.reduce((n, p) => n + p.total, 0);
  const pct = Math.round((eaten / total) * 100);

  return (
    <div className="drift relative w-full max-w-sm">
      {/* The stub of the page behind, so it reads as a booklet. */}
      <div
        className="absolute -right-2.5 top-3 h-full w-full rounded-[28px] bg-brand-6/25"
        aria-hidden="true"
      />

      <div className="relative rounded-[28px] border border-line bg-surface p-7 shadow-[0_2px_4px_rgba(18,33,42,.06),0_32px_64px_-28px_rgba(35,19,58,.45)]">
        {/* Stamp */}
        <div
          className="absolute -right-3 -top-4 flex h-[74px] w-[74px] rotate-[14deg] flex-col items-center justify-center rounded-full border-[2.5px] border-dashed border-gold/60 bg-gold-surface text-center"
          aria-hidden="true"
        >
          <Burst className="absolute h-14 w-14 opacity-45" />
          <span className="relative font-display text-[19px] leading-none text-gold">
            2026
          </span>
          <span className="relative mt-0.5 text-[7px] font-bold uppercase tracking-[0.14em] text-gold">
            Visited
          </span>
        </div>

        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink-faint">
          Dining Passport
        </p>

        <div className="mt-2 flex items-end gap-2.5">
          <p className="font-display text-6xl leading-[0.85] text-accent">
            {pct}
            <span className="text-3xl">%</span>
          </p>
          <p className="mb-1.5 text-[13px] leading-tight text-ink-soft">
            of Walt Disney World
            <br />
            eaten through
          </p>
        </div>

        <div className="mt-7 flex flex-col gap-3.5">
          {PARKS.map((park) => (
            <div key={park.name}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[13px] font-semibold text-ink">
                  {park.name}
                </span>
                <span className="text-[11px] font-medium tabular-nums text-ink-faint">
                  {park.eaten}/{park.total}
                </span>
              </div>
              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-surface-alt">
                <div
                  className={`h-full rounded-full ${park.color}`}
                  style={{ width: `${(park.eaten / park.total) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-7 border-t border-dashed border-line pt-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink-faint">
            Challenges
          </p>
          <ul className="mt-3 flex flex-col gap-2.5">
            {BADGES.map((badge) => (
              <li key={badge.label} className="flex items-center gap-2.5">
                <span
                  className={[
                    "flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                    badge.earned
                      ? "bg-gold text-white shadow-[0_0_0_3px_var(--gold-surface)]"
                      : "border border-dashed border-line text-transparent",
                  ].join(" ")}
                  aria-hidden="true"
                >
                  {badge.earned ? "✓" : ""}
                </span>
                <span
                  className={`text-[13px] ${
                    badge.earned ? "font-semibold text-ink" : "text-ink-faint"
                  }`}
                >
                  {badge.label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
