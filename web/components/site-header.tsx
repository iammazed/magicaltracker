import Link from "next/link";
import { Wordmark } from "@/components/wordmark";

/** The brand ramp as a hairline. Its order is the brand's one motif. */
export function RampRule({ className = "" }: { className?: string }) {
  return (
    <div className={`flex h-[3px] w-full overflow-hidden ${className}`} aria-hidden="true">
      <div className="flex-1 bg-brand-1" />
      <div className="flex-1 bg-brand-2" />
      <div className="flex-1 bg-brand-3" />
      <div className="flex-1 bg-brand-4" />
      <div className="flex-1 bg-brand-5" />
      <div className="flex-1 bg-brand-6" />
    </div>
  );
}

/**
 * Twilight in both themes, like `.sky`. The wordmark is gold on white, which
 * needs a dark ground to be legible at all — putting the bar on twilight is
 * what lets that treatment be the standard rather than a hero-only variant.
 */
export function SiteHeader() {
  return (
    <header className="sky-bar sticky top-0 z-40">
      <RampRule />
      <nav className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-3">
        <Link href="/" aria-label="MagicalTracker home" className="py-1">
          <Wordmark size="sm" />
        </Link>
        <div className="flex items-center gap-5 text-sm">
          <Link
            href="/#features"
            className="text-white/70 transition-colors hover:text-white"
          >
            Features
          </Link>
          <Link
            href="/support"
            className="text-white/70 transition-colors hover:text-white"
          >
            Support
          </Link>
        </div>
      </nav>
    </header>
  );
}
