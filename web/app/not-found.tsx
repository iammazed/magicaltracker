import Link from "next/link";
import { RampRule } from "@/components/site-header";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl px-5 pb-24 pt-24 text-center">
      <RampRule className="mx-auto mb-8 max-w-[140px] rounded-full" />
      <h1 className="font-display text-5xl leading-none tracking-tight text-ink">
        This page is not on the map
      </h1>
      <p className="mx-auto mt-5 max-w-md text-lg leading-relaxed text-ink-soft">
        The link may be old, or we may have moved something. Either way, it is
        not here.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex items-center rounded-full bg-accent px-6 py-3 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-pressed"
      >
        Back to the start
      </Link>
    </div>
  );
}
