import type { Metadata } from "next";
import { LegalShell, TODO } from "@/components/legal-shell";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "What MagicalTracker collects, why, who it is shared with, and how to delete it.",
};

export default function PrivacyPage() {
  return (
    <LegalShell
      title="Privacy Policy"
      updated={<TODO>[EFFECTIVE DATE]</TODO>}
      intro="MagicalTracker keeps a record of your Walt Disney World trips. This policy explains exactly what that means for your data — what is collected, why, who else can see it, and how to get rid of it."
    >
      <p>
        This policy applies to the MagicalTracker iPhone app and to
        magicaltracker.com. The service is operated by{" "}
        <TODO>[LEGAL ENTITY NAME]</TODO>, <TODO>[BUSINESS ADDRESS]</TODO>.
      </p>

      <h2>What we collect</h2>

      <h3>Account information</h3>
      <p>
        When you create an account we store an email address and a unique
        account identifier. If you use Sign in with Apple and choose to hide
        your email, we receive and store only Apple&rsquo;s private relay
        address — we never see your real one. We do not store passwords; sign-in
        uses either Apple or a one-time email link.
      </p>
      <p>
        You can use parts of the app without an account. Data logged before you
        sign up stays on your device until you create one.
      </p>

      <h3>Content you create</h3>
      <p>
        This is the substance of the app and it belongs to you. It includes the
        restaurants and resorts you mark as visited, your ratings, visit dates,
        party size, trips and trip dates, and the achievements you earn. On a
        premium subscription it also includes your notes, the dishes you record,
        and any photos you attach to a visit.
      </p>

      <h3>Location</h3>
      <p>
        <strong>Only if you turn it on.</strong> The map can show what is near
        you, which requires your device location while the app is open. Location
        is used on your device to sort and filter what is nearby. We do not store
        your location history, and the app does not track your location in the
        background.
      </p>

      <h3>Diagnostics and usage</h3>
      <p>
        We collect crash reports and basic usage analytics — which screens are
        opened, which features are used, device model and operating system
        version — so we can fix what breaks and understand what is worth
        building. This data is tied to a random identifier, not to your name or
        email. We do not use it for advertising, and we do not sell it.
      </p>

      <h3>Purchases</h3>
      <p>
        Subscriptions are processed by Apple. We never see your payment card,
        billing address, or any financial information. We receive only a
        confirmation of whether your subscription is active.
      </p>

      <h2>What we do not do</h2>
      <ul>
        <li>We do not sell your personal information.</li>
        <li>We do not share your data with advertisers or data brokers.</li>
        <li>We do not use third-party advertising or tracking SDKs.</li>
        <li>We do not track you across other apps or websites.</li>
        <li>We do not access your Disney account or your reservations.</li>
      </ul>

      <h2>Who your data is shared with</h2>
      <p>
        We use a small number of service providers to run the app. Each of them
        processes data only to provide their service to us.
      </p>
      <ul>
        <li>
          <strong>Supabase</strong> — database, authentication and file storage.
          Your account and content are stored here.
        </li>
        <li>
          <strong>Apple</strong> — sign-in and subscription processing.
        </li>
        <li>
          <strong>RevenueCat</strong> — manages subscription status on our
          behalf.
        </li>
        <li>
          <strong>Sentry</strong> — crash reporting.
        </li>
        <li>
          <strong>PostHog</strong> — product analytics.
        </li>
        <li>
          <strong>Cloudflare</strong> — hosting for magicaltracker.com.
        </li>
      </ul>
      <p>
        We may also disclose information if we are legally required to, or to
        protect the safety or rights of our users.
      </p>

      <h2>Other users</h2>
      <p>
        Some premium features summarise ratings across everyone who uses the
        app, such as top-rated lists and trending restaurants. These are
        aggregate figures. Your individual ratings, notes and photos are never
        shown to other users with your name attached unless you explicitly
        choose to share them.
      </p>

      <h2>How long we keep it</h2>
      <p>
        Your content is kept as long as your account exists, because the point of
        the app is a record that survives across years and trips. Diagnostic and
        analytics data is retained for{" "}
        <TODO>[RETENTION PERIOD, e.g. 12 months]</TODO>.
      </p>

      <h2>Deleting your data</h2>
      <p>
        You can delete your account from inside the app at any time, under
        Settings. Deleting your account permanently removes your account
        information and all of your content — visits, ratings, trips, notes and
        photos — from our systems. This cannot be undone, so export first if you
        want to keep a copy.
      </p>
      <p>
        You can also email us at{" "}
        <a href="mailto:privacy@magicaltracker.com">privacy@magicaltracker.com</a>{" "}
        to request deletion.
      </p>

      <h2>Your rights</h2>
      <p>
        Depending on where you live, you may have the right to access a copy of
        your data, correct it, delete it, or object to certain processing. You
        can do most of this directly in the app; for anything else, contact us
        and we will respond within{" "}
        <TODO>[RESPONSE WINDOW, e.g. 30 days]</TODO>.
      </p>
      <p>
        Data is stored on servers in the United States. If you use the app from
        outside the US, you are consenting to that transfer.
      </p>

      <h2>Children</h2>
      <p>
        MagicalTracker is not directed at children under 13, and we do not
        knowingly collect personal information from them. If you believe a child
        has created an account, contact us and we will delete it. Families are
        welcome to use the app together — but the account should belong to an
        adult.
      </p>

      <h2>Changes to this policy</h2>
      <p>
        If we change this policy in a way that materially affects your data, we
        will update the date at the top and notify you in the app before the
        change takes effect.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about privacy:{" "}
        <a href="mailto:privacy@magicaltracker.com">privacy@magicaltracker.com</a>
      </p>

      <h2>A note on Disney</h2>
      <p>
        MagicalTracker is independent and is not affiliated with, endorsed by, or
        sponsored by The Walt Disney Company. We have no access to your My Disney
        Experience account, your reservations, or any Disney systems. Restaurant
        and resort information in the app is factual reference data compiled by
        us, and menu links open Disney&rsquo;s own website.
      </p>
    </LegalShell>
  );
}
