import type { Metadata } from "next";
import Link from "next/link";
import { RampRule } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Support",
  description:
    "Get help with MagicalTracker, report a problem, or send a correction to our restaurant data.",
};

const TOPICS = [
  {
    q: "Something in the app is wrong — a closed restaurant, a bad link, the wrong park",
    a: "Please tell us. Every venue screen has a Report an Issue button, or email us directly. Disney changes things constantly and corrections from people actually in the parks are the fastest way we hear about it.",
    email: "data@magicaltracker.com",
  },
  {
    q: "How do I manage or cancel my subscription?",
    a: "Subscriptions are handled by Apple, not by us. On your iPhone open Settings, tap your name, then Subscriptions. Deleting the app does not cancel a subscription. Refund requests also go through Apple — we are not able to issue them.",
  },
  {
    q: "How do I delete my account?",
    a: "In the app, go to Settings and choose Delete Account. This permanently removes your account and everything in it — visits, ratings, trips, notes and photos. Export your data first if you want to keep a copy. You can also email us and we will do it for you.",
    email: "privacy@magicaltracker.com",
  },
  {
    q: "Does it connect to My Disney Experience?",
    a: "No, and it will not. Disney provides no public way for apps to read your plans, and the only alternatives would require handing over your Disney password. We are not willing to ask for that. Trips and dining are entered manually.",
  },
  {
    q: "I have a feature request",
    a: "Send it. The roadmap is genuinely shaped by what people ask for, and early requests carry the most weight.",
  },
];

export default function SupportPage() {
  return (
    <div className="mx-auto max-w-2xl px-5 pb-16 pt-16">
      <RampRule className="mb-8 max-w-[180px] rounded-full" />
      <h1 className="font-display text-5xl leading-none tracking-tight text-ink text-balance">
        Support
      </h1>
      <p className="mt-6 text-lg leading-relaxed text-ink-soft">
        MagicalTracker is made by one person. Email reaches a real human, and
        usually within a couple of days.
      </p>

      <a
        href="mailto:support@magicaltracker.com"
        className="mt-8 inline-flex items-center rounded-full bg-accent px-6 py-3 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-pressed"
      >
        support@magicaltracker.com
      </a>

      <p className="mt-5 text-sm leading-relaxed text-ink-soft">
        When reporting a problem it helps enormously to include your iPhone
        model, your iOS version, the app version from Settings, and what you
        were doing when it happened.
      </p>

      <div className="mt-14">
        <h2 className="font-display text-3xl leading-tight tracking-tight text-ink">
          Common questions
        </h2>

        <dl className="mt-8 flex flex-col gap-8">
          {TOPICS.map((topic) => (
            <div key={topic.q}>
              <dt className="text-[15px] font-semibold leading-snug text-ink">
                {topic.q}
              </dt>
              <dd className="mt-2 text-[15px] leading-relaxed text-ink-soft">
                {topic.a}
                {topic.email ? (
                  <>
                    {" "}
                    <a
                      href={`mailto:${topic.email}`}
                      className="text-accent underline underline-offset-2"
                    >
                      {topic.email}
                    </a>
                  </>
                ) : null}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="mt-14 rounded-2xl border border-line bg-surface p-7">
        <h2 className="text-[15px] font-semibold text-ink">
          Privacy and terms
        </h2>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
          Read what we collect and why in the{" "}
          <Link href="/privacy" className="text-accent underline underline-offset-2">
            Privacy Policy
          </Link>
          , and the rules of the road in the{" "}
          <Link href="/terms" className="text-accent underline underline-offset-2">
            Terms of Service
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
