import Link from "next/link";
import { PassportPreview } from "@/components/passport-preview";
import { Starfield, Burst } from "@/components/starfield";

const FEATURES = [
  {
    title: "Every bite, remembered",
    body: "Check off table service, quick service, lounges and snack carts across all four parks, Disney Springs and every resort. Rate each visit. Log the same place as many times as you go back.",
    ring: "from-brand-1 to-brand-2",
  },
  {
    title: "Every resort you have called home",
    body: "Value, moderate, deluxe, villas, even the campground. Years from now you will still know which room you loved and which one you would quietly skip.",
    ring: "from-brand-2 to-brand-3",
  },
  {
    title: "A passport worth filling",
    body: "Drinking Around the World. Four Parks in One Day. The Transportation Challenge. Festivals, after-hours parties, and coverage badges for every park.",
    ring: "from-brand-3 to-brand-4",
  },
  {
    title: "Works when your signal does not",
    body: "The whole catalog lives on your phone. Park wifi is rough and cell service is rougher, so logging lunch never depends on having bars.",
    ring: "from-brand-4 to-brand-5",
  },
  {
    title: "Something to count down to",
    body: "The trip countdown sits right on your home screen, because the eleven months in between are part of the fun too.",
    ring: "from-brand-5 to-brand-6",
  },
  {
    title: "Find what is close",
    body: "A map with your visits marked, filtered by quick service, table service, and who takes walk-ups versus who needs a reservation sixty days out.",
    ring: "from-brand-6 to-brand-1",
  },
];

const FREE = [
  "Unlimited restaurant and resort check-offs",
  "Rate every single visit",
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
  "Export your whole passport",
];

export default function Home() {
  return (
    <>
      {/* ── Hero ──────────────────────────────────────────────────── */}
      <section className="sky relative overflow-hidden">
        <Starfield />
        <Burst
          className="pointer-events-none absolute -left-10 top-16 h-56 w-56 opacity-25"
          color="#2FB5AF"
        />
        <Burst
          className="pointer-events-none absolute right-[18%] top-4 h-36 w-36 opacity-20"
          color="#E5B45F"
        />

        <div className="relative mx-auto max-w-5xl px-5 pb-24 pt-20 sm:pt-28">
          <div className="grid items-center gap-16 md:grid-cols-[1.1fr_1fr]">
            <div>
              <p
                className="rise inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-white/80 ring-1 ring-white/15 backdrop-blur-sm"
                style={{ "--delay": "0ms" } as React.CSSProperties}
              >
                For Walt Disney World
              </p>

              <h1
                className="rise mt-6 font-display text-[3.4rem] font-semibold leading-[0.98] text-white text-balance sm:text-7xl"
                style={{ "--delay": "80ms" } as React.CSSProperties}
              >
                Collect the
                <br />
                whole{" "}
                <em className="italic text-gold">trip</em>
              </h1>

              <p
                className="rise mt-7 max-w-lg text-[1.08rem] leading-relaxed text-white/75"
                style={{ "--delay": "160ms" } as React.CSSProperties}
              >
                Every restaurant you have eaten at. Every resort you have stayed
                in. Every challenge you have chased down. One passport that
                keeps getting fuller, trip after trip after trip.
              </p>

              <div
                className="rise mt-10 flex flex-wrap items-center gap-5"
                style={{ "--delay": "240ms" } as React.CSSProperties}
              >
                <span className="inline-flex items-center gap-2.5 rounded-full bg-gold px-5 py-3 text-sm font-bold text-[#23133a]">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-[#23133a]/60" />
                  Coming to the App Store
                </span>
                <Link
                  href="#features"
                  className="text-sm font-semibold text-white/80 underline-offset-4 transition-colors hover:text-white hover:underline"
                >
                  See what it does
                </Link>
              </div>
            </div>

            <div
              className="rise flex justify-center md:justify-end"
              style={{ "--delay": "300ms" } as React.CSSProperties}
            >
              <PassportPreview />
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────────────── */}
      <section id="features" className="scroll-mt-20 bg-ground">
        <div className="mx-auto max-w-5xl px-5 py-24">
          <h2 className="max-w-2xl font-display text-[2.6rem] font-semibold leading-[1.08] text-ink text-balance sm:text-5xl">
            For the kind of person who keeps the receipts
          </h2>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-soft">
            Not a checklist you abandon after one trip. A record that gets
            better the longer you keep it.
          </p>

          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="rounded-3xl border border-line bg-surface p-7 transition-transform duration-300 hover:-translate-y-1"
              >
                <div
                  className={`h-10 w-10 rounded-2xl bg-gradient-to-br ${feature.ring}`}
                  aria-hidden="true"
                />
                <h3 className="mt-5 font-display text-xl font-semibold leading-snug text-ink">
                  {feature.title}
                </h3>
                <p className="mt-2.5 text-[15px] leading-relaxed text-ink-soft">
                  {feature.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ───────────────────────────────────────────────── */}
      <section id="pricing" className="scroll-mt-20 border-t border-line bg-surface">
        <div className="mx-auto max-w-5xl px-5 py-24">
          <h2 className="font-display text-[2.6rem] font-semibold leading-[1.08] text-ink text-balance sm:text-5xl">
            Free, and actually free
          </h2>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-soft">
            Logging is never locked behind a paywall. Premium adds the depth,
            the convenience, and everything the community makes possible.
          </p>

          <div className="mt-14 grid gap-6 md:grid-cols-2">
            <div className="rounded-3xl border border-line bg-ground p-8">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-ink-faint">
                Free
              </p>
              <p className="mt-3 font-display text-5xl font-semibold leading-none text-ink">
                $0
              </p>
              <ul className="mt-8 flex flex-col gap-3.5">
                {FREE.map((item) => (
                  <li key={item} className="flex gap-3 text-[15px] text-ink-soft">
                    <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="relative overflow-hidden rounded-3xl border-2 border-gold/45 bg-gold-surface p-8">
              <Burst
                className="pointer-events-none absolute -right-8 -top-8 h-36 w-36 opacity-25"
                color="var(--gold)"
              />
              <p className="relative text-[11px] font-bold uppercase tracking-[0.18em] text-gold">
                Premium
              </p>
              <p className="relative mt-3 font-display text-5xl font-semibold leading-none text-ink">
                $24.99
                <span className="ml-2 align-middle text-base font-normal text-ink-soft">
                  / year
                </span>
              </p>
              <p className="relative mt-2 text-[13px] text-ink-soft">
                Monthly and lifetime options at launch.
              </p>
              <ul className="relative mt-7 flex flex-col gap-3.5">
                {PREMIUM.map((item) => (
                  <li key={item} className="flex gap-3 text-[15px] text-ink-soft">
                    <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
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
      <section className="sky relative overflow-hidden">
        <Starfield />
        <div className="relative mx-auto max-w-5xl px-5 py-24 text-center">
          <h2 className="mx-auto max-w-2xl font-display text-[2.6rem] font-semibold leading-[1.08] text-white text-balance sm:text-5xl">
            The next trip is already worth counting down to
          </h2>
          <p className="mx-auto mt-5 max-w-lg text-lg leading-relaxed text-white/75">
            MagicalTracker is in development for iPhone. Questions, feature
            requests, and corrections to our restaurant data are all genuinely
            welcome.
          </p>
          <Link
            href="/support"
            className="mt-9 inline-flex items-center rounded-full bg-gold px-7 py-3.5 text-sm font-bold text-[#23133a] transition-transform duration-200 hover:scale-[1.03]"
          >
            Say hello
          </Link>
        </div>
      </section>
    </>
  );
}
