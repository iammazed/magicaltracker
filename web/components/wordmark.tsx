/**
 * The wordmark. Defined once and used everywhere it appears, so the header,
 * footer and any future artwork can never drift apart.
 *
 * Construction: "Magical" in Pacifico, "Tracker" in Figtree semibold. The
 * two-weight split is what keeps it legible at header size — a full script
 * wordmark turns to mush below about 20px.
 *
 * Pacifico sits on a taller body than Figtree, so the sizes below are not a
 * single ratio applied blindly; each step is tuned so the x-heights read as
 * level.
 */

const SIZES = {
  sm: { script: "text-[1.45rem]", rest: "text-[1.02rem]", nudge: "-0.06em" },
  md: { script: "text-[1.75rem]", rest: "text-[1.22rem]", nudge: "-0.06em" },
  lg: { script: "text-[2.9rem]", rest: "text-[2rem]", nudge: "-0.05em" },
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
    <span className={`inline-flex items-baseline whitespace-nowrap ${className}`}>
      <span
        className={`font-script leading-none ${s.script} ${scriptClass}`}
        style={{ marginRight: s.nudge }}
      >
        Magical
      </span>
      <span className={`font-semibold leading-none tracking-tight ${s.rest} ${restClass}`}>
        Tracker
      </span>
    </span>
  );
}
