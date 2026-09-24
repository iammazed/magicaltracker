import Link from "next/link";
import { Wordmark } from "@/components/wordmark";
import { RampRule } from "@/components/site-header";

const YEAR = new Date().getFullYear();

/**
 * Twilight in both themes, matching the header, so the wordmark sits on the
 * ground its gold-and-white treatment needs.
 *
 * The ramp rule on top is structural, not decorative: the closing CTA on the
 * home page is also `.sky`, and without a divider the two dark blocks merge
 * into one shapeless mass.
 */
export function SiteFooter() {
  return (
    <footer className="sky">
      <RampRule />
      <div className="mx-auto max-w-5xl px-5 py-14">
        <div className="flex flex-wrap items-start justify-between gap-10">
          <div className="max-w-xs">
            <Wordmark size="md" />
            <p className="mt-3 text-sm leading-relaxed text-white/75">
              A trip log and achievement passport for Walt Disney World.
            </p>
          </div>

          <nav className="flex gap-12 text-sm">
            <div className="flex flex-col gap-2.5">
              <p className="text-xs font-bold uppercase tracking-widest text-white/70">
                App
              </p>
              <Link href="/#features" className="text-white/70 hover:text-white">
                Features
              </Link>
              <Link href="/#pricing" className="text-white/70 hover:text-white">
                Pricing
              </Link>
            </div>
            <div className="flex flex-col gap-2.5">
              <p className="text-xs font-bold uppercase tracking-widest text-white/70">
                Legal
              </p>
              <Link href="/privacy" className="text-white/70 hover:text-white">
                Privacy
              </Link>
              <Link href="/terms" className="text-white/70 hover:text-white">
                Terms
              </Link>
              <Link href="/support" className="text-white/70 hover:text-white">
                Support
              </Link>
            </div>
          </nav>
        </div>

        <div className="mt-12 border-t border-white/15 pt-6">
          {/*
            Required disclaimer. It appears here, in the App Store description,
            and on the app's About screen. Do not remove it.
          */}
          <p className="text-xs leading-relaxed text-white/70">
            MagicalTracker is an independent app and is not affiliated with,
            endorsed by, sponsored by, or in any way officially connected with
            The Walt Disney Company or any of its subsidiaries or affiliates.
            All product and company names are trademarks of their respective
            holders.
          </p>
          <p className="mt-3 text-xs text-white/70">
            &copy; {YEAR} MagicalTracker. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
