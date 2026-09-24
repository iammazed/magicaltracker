import Link from "next/link";

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

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-ground/85 backdrop-blur-md">
      <RampRule />
      <nav className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-3.5">
        <Link
          href="/"
          className="font-display text-xl leading-none tracking-tight text-ink"
        >
          Magical<span className="text-accent">Tracker</span>
        </Link>
        <div className="flex items-center gap-5 text-sm">
          <Link href="/#features" className="text-ink-soft transition-colors hover:text-ink">
            Features
          </Link>
          <Link href="/support" className="text-ink-soft transition-colors hover:text-ink">
            Support
          </Link>
        </div>
      </nav>
    </header>
  );
}
