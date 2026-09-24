import { RampRule } from "@/components/site-header";

/**
 * Visibly-unfinished marker. Anything wrapped in this MUST be replaced before
 * the site goes live — it renders in gold with a dotted underline so a
 * forgotten placeholder is impossible to miss on the page.
 */
export function TODO({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded bg-gold-surface px-1.5 py-0.5 font-semibold text-gold underline decoration-dotted decoration-2 underline-offset-2">
      {children}
    </span>
  );
}

export function LegalShell({
  title,
  updated,
  intro,
  children,
}: {
  title: string;
  updated: React.ReactNode;
  intro?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <article className="mx-auto max-w-2xl px-5 pb-16 pt-16">
      <RampRule className="mb-8 max-w-[180px] rounded-full" />
      <h1 className="font-display text-5xl leading-none tracking-tight text-ink text-balance">
        {title}
      </h1>
      <p className="mt-4 text-sm text-ink-faint">Last updated: {updated}</p>
      {intro ? (
        <p className="mt-6 text-lg leading-relaxed text-ink-soft">{intro}</p>
      ) : null}
      <div className="prose-legal mt-4">{children}</div>
    </article>
  );
}
