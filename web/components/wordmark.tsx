/**
 * The wordmark. Defined once and used everywhere it appears, so the header,
 * footer and any future artwork can never drift apart.
 *
 * Three parts:
 *   M       Berkshire Swash, 1.6x — an upright swashed initial
 *   agical  Pacifico, base size
 *   Tracker Figtree semibold, base size
 *
 * "agical" and "Tracker" share a font-size by design. They will not look
 * identically tall — Figtree's cap height per em exceeds Pacifico's x-height —
 * and that difference is what keeps the script from reading as a mistake.
 *
 * Everything is baseline-aligned via `items-baseline`; the small horizontal
 * nudges below close the gaps the three faces leave in their side bearings.
 */

const SIZES = {
  sm: { base: "text-[1.02rem]", initial: "text-[1.63rem]" },
  md: { base: "text-[1.22rem]", initial: "text-[1.95rem]" },
  lg: { base: "text-[2rem]", initial: "text-[3.2rem]" },
} as const;

export function Wordmark({
  size = "sm",
  className = "",
  scriptClass = "text-accent",
  restClass = "text-ink",
}: {
  size?: keyof typeof SIZES;
  className?: string;
  /** Override for dark grounds — e.g. "text-gold". */
  scriptClass?: string;
  restClass?: string;
}) {
  const s = SIZES[size];
  return (
    <span
      className={`inline-flex items-baseline whitespace-nowrap leading-none ${className}`}
    >
      <span className={`font-initial ${s.initial} ${scriptClass}`}>M</span>
      <span
        className={`font-script ${s.base} ${scriptClass}`}
        style={{ marginLeft: "0.01em", marginRight: "0.12em" }}
      >
        agical
      </span>
      <span className={`font-semibold tracking-tight ${s.base} ${restClass}`}>
        Tracker
      </span>
    </span>
  );
}
