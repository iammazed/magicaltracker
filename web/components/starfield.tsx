/**
 * Decorative star field for the hero.
 *
 * Positions come from a seeded PRNG rather than Math.random so the server and
 * the client generate identical markup — random values here would hydrate as a
 * mismatch and React would blow the whole subtree away.
 */

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20260924);

const STARS = Array.from({ length: 70 }, () => ({
  top: rand() * 100,
  left: rand() * 100,
  size: 1 + rand() * 2.2,
  dur: 2.8 + rand() * 4.5,
  delay: rand() * 5,
}));

export function Starfield() {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
      {STARS.map((s, i) => (
        <span
          key={i}
          className="star"
          style={
            {
              top: `${s.top}%`,
              left: `${s.left}%`,
              width: `${s.size}px`,
              height: `${s.size}px`,
              "--dur": `${s.dur}s`,
              "--delay": `${s.delay}s`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

/** Abstract burst — fireworks are not anyone's intellectual property. */
export function Burst({
  className = "",
  color = "#E5B45F",
}: {
  className?: string;
  color?: string;
}) {
  const rays = Array.from({ length: 12 }, (_, i) => (i * 360) / 12);
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      aria-hidden="true"
      fill="none"
    >
      {rays.map((deg) => (
        <line
          key={deg}
          x1="50"
          y1="50"
          x2="50"
          y2="12"
          stroke={color}
          strokeWidth="1.6"
          strokeLinecap="round"
          opacity="0.55"
          transform={`rotate(${deg} 50 50)`}
        />
      ))}
      {rays.map((deg) => (
        <circle
          key={`d${deg}`}
          cx="50"
          cy="10"
          r="1.9"
          fill={color}
          transform={`rotate(${deg} 50 50)`}
        />
      ))}
    </svg>
  );
}
