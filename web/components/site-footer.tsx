import Link from "next/link";

const YEAR = new Date().getFullYear();

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-line bg-surface">
      <div className="mx-auto max-w-5xl px-5 py-12">
        <div className="flex flex-wrap items-start justify-between gap-8">
          <div className="max-w-xs">
            <p className="font-display text-lg leading-none text-ink">
              Magical<span className="text-accent">Tracker</span>
            </p>
            <p className="mt-2.5 text-sm leading-relaxed text-ink-soft">
              A trip log and achievement passport for Walt Disney World.
            </p>
          </div>

          <nav className="flex gap-12 text-sm">
            <div className="flex flex-col gap-2.5">
              <p className="text-xs font-semibold uppercase tracking-widest text-ink-faint">
                App
              </p>
              <Link href="/#features" className="text-ink-soft hover:text-ink">
                Features
              </Link>
              <Link href="/#pricing" className="text-ink-soft hover:text-ink">
                Pricing
              </Link>
            </div>
            <div className="flex flex-col gap-2.5">
              <p className="text-xs font-semibold uppercase tracking-widest text-ink-faint">
                Legal
              </p>
              <Link href="/privacy" className="text-ink-soft hover:text-ink">
                Privacy
              </Link>
              <Link href="/terms" className="text-ink-soft hover:text-ink">
                Terms
              </Link>
              <Link href="/support" className="text-ink-soft hover:text-ink">
                Support
              </Link>
            </div>
          </nav>
        </div>

        <div className="mt-10 border-t border-line-soft pt-6">
          {/*
            Required disclaimer. It appears here, in the App Store description,
            and on the app's About screen. Do not remove it.
          */}
          <p className="text-xs leading-relaxed text-ink-faint">
            MagicalTracker is an independent app and is not affiliated with,
            endorsed by, sponsored by, or in any way officially connected with
            The Walt Disney Company or any of its subsidiaries or affiliates.
            All product and company names are trademarks of their respective
            holders.
          </p>
          <p className="mt-3 text-xs text-ink-faint">
            &copy; {YEAR} MagicalTracker. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
