/**
 * The wordmark. Defined once and used everywhere it appears, so the header,
 * footer and any future artwork can never drift apart.
 *
 * Three parts, sized in `em` off the wrapper so the ratios stay explicit:
 *
 *   M       Berkshire Swash  1.60em   upright swashed initial
 *   agical  Pacifico         1.11em   x-height matched to Figtree
 *   Tracker Figtree semibold 1.00em
 *
 * The 1.11 is measured, not eyeballed. At the same font-size Pacifico's
 * lowercase a and c render 95 units tall against Figtree's 106 and 105, so
 * matching font-sizes leaves the script visibly short. Scaling by 1.11 lines
 * the bowls up; the l and the ascenders still overshoot, which is correct for
 * a script and is what stops it reading as a mismatched paste.
 *
 * If either face is ever swapped, re-measure rather than reusing this number.
 */

/** Wrapper font-size. Every part is an em multiple of this. */
const SIZES = {
  sm: "1.02rem",
  md: "1.22rem",
  lg: "2rem",
} as const;

const INITIAL_EM = 1.6;
const SCRIPT_EM = 1.111;

export function Wordmark({
  size = "sm",
  className = "",
  scriptClass = "text-gold-on-dark",
  restClass = "text-white",
}: {
  size?: keyof typeof SIZES;
  className?: string;
  /**
   * Defaults are gold + white, which require a dark ground. The header and
   * footer both sit on twilight for exactly this reason — on --ground the
   * white would be invisible and the gold would fail contrast.
   */
  scriptClass?: string;
  restClass?: string;
}) {
  return (
    <span
      className={`inline-flex items-baseline whitespace-nowrap leading-none ${className}`}
      style={{ fontSize: SIZES[size] }}
    >
      <span
        className={`font-initial ${scriptClass}`}
        style={{ fontSize: `${INITIAL_EM}em` }}
      >
        M
      </span>
      <span
        className={`font-script ${scriptClass}`}
        style={{
          fontSize: `${SCRIPT_EM}em`,
          marginLeft: "0.01em",
          marginRight: "0.11em",
        }}
      >
        agical
      </span>
      <span className={`font-semibold tracking-tight ${restClass}`}>
        Tracker
      </span>
    </span>
  );
}
