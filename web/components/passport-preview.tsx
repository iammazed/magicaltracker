/**
 * An illustrative preview of the app's passport screen. The numbers are
 * representative of the product, not real user data.
 *
 * The brand ramp is used in park order, which is the one place its ordering
 * carries meaning. Gold marks an unlocked achievement and nothing else.
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
    <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6 shadow-[0_1px_2px_rgba(18,33,42,.05),0_24px_48px_-24px_rgba(18,33,42,.28)]">
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-faint">
          Dining passport
        </p>
        <p className="font-display text-3xl leading-none text-accent tabular-nums">
          {pct}%
        </p>
      </div>

      <div className="mt-6 flex flex-col gap-3.5">
        {PARKS.map((park) => (
          <div key={park.name}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[13px] font-medium text-ink">{park.name}</span>
              <span className="text-[11px] tabular-nums text-ink-faint">
                {park.eaten}/{park.total}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-alt">
              <div
                className={`h-full rounded-full ${park.color}`}
                style={{ width: `${(park.eaten / park.total) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 border-t border-line-soft pt-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-faint">
          Challenges
        </p>
        <ul className="mt-3 flex flex-col gap-2">
          {BADGES.map((badge) => (
            <li key={badge.label} className="flex items-center gap-2.5">
              <span
                className={[
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                  badge.earned
                    ? "bg-gold-surface text-gold ring-1 ring-gold/40"
                    : "bg-surface-alt text-ink-faint ring-1 ring-line",
                ].join(" ")}
                aria-hidden="true"
              >
                {badge.earned ? "✓" : ""}
              </span>
              <span
                className={`text-[13px] ${
                  badge.earned ? "text-ink" : "text-ink-faint"
                }`}
              >
                {badge.label}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
