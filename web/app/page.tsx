import Link from "next/link";
import { PassportPreview } from "@/components/passport-preview";

const FEATURES = [
  {
    title: "Every restaurant, logged",
    body: "Check off table service, quick service, lounges and snack stands across all four parks, Disney Springs and every resort. Rate each visit, and log the same place as many times as you go.",
  },
  {
    title: "Every resort, remembered",
    body: "Track where you stayed and when, from value to deluxe villas. Years later you will still know which room you loved and which one you would skip.",
  },
  {
    title: "A passport worth filling",
    body: "Coverage badges per park and overall, plus real challenges — Drinking Around the World, Four Parks in One Day, the Transportation Challenge, festivals and after-hours parties.",
  },
  {
    title: "Works with no signal",
    body: "The whole catalog lives on your phone. Park wifi is terrible and cell service is worse, so logging a meal never depends on having bars.",
  },
  {
    title: "Countdown to the next one",
    body: "The trip countdown sits on your home screen, because the eleven months between visits are part of the fun too.",
  },
  {
    title: "Find what is near you",
    body: "Map view with your visits marked, filtered by quick service, table service, and who takes walk-ups versus reservations.",
  },
];

const FREE = [
  "Unlimited restaurant and resort check-offs",
  "Ratings on every visit",
  "Full catalog, search and filters",
  "List and map views",
  "One active trip with countdown",
  "Coverage badges, per park and overall",
];

const PREMIUM = [
  "Notes, dishes ordered and photos",
  "Unlimited trips and trip planning",
  "The complete challenge set",
  "Live near-me map with walk-up filters",
  "Community rankings and trending",
  "Home screen countdown widget",
  "Export your passport",
];

export default function Home() {
  return (
    <>
      {/* ── Hero ──────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-5 pb-20 pt-16 sm:pt-24">
        <div className="grid items-center gap-14 md:grid-cols-[1.15fr_1fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-faint">
              For Walt Disney World
            </p>
            <h1 className="mt-5 font-display text-5xl leading-[1.02] tracking-tight text-ink text-balance sm:text-6xl">
              A passport for{" "}
              <em className="not-italic text-accent">every trip</em> you take
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-ink-soft">
              Log the restaurants you have eaten at and the resorts you have
              stayed in. Earn challenges worth chasing. Keep the record of every
              trip in one place instead of scattered across camera rolls and
              memory.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-4">
              <span className="inline-flex items-center gap-2.5 rounded-full border border-line bg-surface px-4 py-2.5 text-sm font-medium text-ink">
                <span className="h-2 w-2 shrink-0 rounded-full bg-accent" />
                Coming to the App Store
              </span>
              <Link
                href="#features"
                className="text-sm font-medium text-accent underline-offset-4 hover:underline"
              >
                See what it does
              </Link>
            </div>
          </div>

          <div className="flex justify-center md:justify-end">
            <PassportPreview />
          </div>
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────────────── */}
      <section
        id="features"
        className="scroll-mt-20 border-y border-line bg-surface"
      >
        <div className="mx-auto max-w-5xl px-5 py-20">
          <h2 className="font-display text-4xl leading-tight tracking-tight text-ink text-balance">
            Built for people who keep track
          </h2>
          <p className="mt-4 max-w-2xl text-ink-soft">
            Not a checklist you abandon after one trip. A record that gets more
            valuable the longer you keep it.
          </p>

          <div className="mt-12 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature, i) => (
              <div key={feature.title}>
                <div
                  className="h-0.5 w-9 rounded-full"
                  style={{ background: `var(--brand-${(i % 6) + 1})` }}
                  aria-hidden="true"
                />
                <h3 className="mt-4 text-[15px] font-semibold text-ink">
                  {feature.title}
                </h3>
                <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
                  {feature.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ───────────────────────────────────────────────── */}
      <section id="pricing" className="scroll-mt-20">
        <div className="mx-auto max-w-5xl px-5 py-20">
          <h2 className="font-display text-4xl leading-tight tracking-tight text-ink text-balance">
            Free to use, properly
          </h2>
          <p className="mt-4 max-w-2xl text-ink-soft">
            Logging is never locked behind a paywall. Premium adds depth,
            convenience, and everything the community data makes possible.
          </p>

          <div className="mt-12 grid gap-5 md:grid-cols-2">
            <div className="rounded-2xl border border-line bg-surface p-7">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-faint">
                Free
              </p>
              <p className="mt-3 font-display text-4xl leading-none text-ink">
                $0
              </p>
              <ul className="mt-7 flex flex-col gap-3">
                {FREE.map((item) => (
                  <li key={item} className="flex gap-3 text-[15px] text-ink-soft">
                    <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-gold/35 bg-gold-surface p-7">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold">
                Premium
              </p>
              <p className="mt-3 font-display text-4xl leading-none text-ink">
                $24.99
                <span className="ml-2 align-middle text-base text-ink-soft">
                  / year
                </span>
              </p>
              <p className="mt-1.5 text-[13px] text-ink-soft">
                Monthly and lifetime options at launch.
              </p>
              <ul className="mt-6 flex flex-col gap-3">
                {PREMIUM.map((item) => (
                  <li key={item} className="flex gap-3 text-[15px] text-ink-soft">
                    <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <p className="mt-6 text-[13px] text-ink-faint">
            Pricing shown is planned and may change before launch.
          </p>
        </div>
      </section>

      {/* ── Close ─────────────────────────────────────────────────── */}
      <section className="border-t border-line bg-surface">
        <div className="mx-auto max-w-5xl px-5 py-20 text-center">
          <h2 className="mx-auto max-w-2xl font-display text-4xl leading-tight tracking-tight text-ink text-balance">
            The next trip is already worth counting down to
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-ink-soft">
            MagicalTracker is in development for iPhone. Questions, feature
            requests, or corrections to our restaurant data are all welcome.
          </p>
          <Link
            href="/support"
            className="mt-8 inline-flex items-center rounded-full bg-accent px-6 py-3 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-pressed"
          >
            Get in touch
          </Link>
        </div>
      </section>
    </>
  );
}
