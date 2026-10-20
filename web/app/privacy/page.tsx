import type { Metadata } from "next";
import { LegalShell } from "@/components/legal-shell";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "What MagicalTracker collects, why, who it is shared with, and how to delete it.",
};

export default function PrivacyPage() {
  return (
    <LegalShell
      title="Privacy Policy"
      updated="20 October 2026"
      intro="MagicalTracker keeps a record of your Walt Disney World trips. This policy explains exactly what that means for your data — what is collected, why, who else can see it, and how to get rid of it."
    >
      <p>
        This policy applies to the MagicalTracker iPhone app and to
        magicaltracker.com. The service is operated by{" "}
        Grey Fox Creations LLC, 114 Saint Francis Lane, Wenonah, NJ 08090.
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
        If you use Sign in with Apple and choose to share your name, Apple sends
        it to us once, the first time you authorise the app, and we store it so
        we can address you by it. Apple never sends it again. If you would
        rather we did not have it, choose to hide it at that first screen.
      </p>
      <p>
        <strong>You can use the entire app without an account.</strong> Every
        feature works signed out, and nothing you log is sent anywhere until you
        choose to create one. An account buys exactly one thing: your record
        surviving a reinstall or reaching a second device. Anything you logged
        beforehand stays on your device and is uploaded when you first sign in.
      </p>

      <h3>Content you create</h3>
      <p>
        This is the substance of the app and it belongs to you. It includes the
        restaurants and resorts you mark as visited, your ratings, visit dates,
        party size, trips and trip dates, and the achievements you earn. On a
        premium subscription it also includes your notes and the dishes you
        record.
      </p>
      <p>
        <strong>Photos are different, and you should know how.</strong> A photo
        you attach to a visit never leaves your phone. We do not upload it, we
        cannot see it, and it is not part of the backup that signing in gives
        you — which also means a photo is lost if you delete the app or move to
        a new phone. Everything else you log is covered; photos are not.
      </p>

      <h3>Location</h3>
      <p>
        <strong>Only if you turn it on.</strong> The map can show what is near
        you, which requires your device location while the app is open.
      </p>
      <p>
        Your location is read on your phone, used there to sort the list by
        distance, and discarded. <strong>It is never sent to us or to anyone
        else</strong>, so there is no location history to store, delete or hand
        over. The app also never asks for background location, which is a
        separate permission we have no reason to request.
      </p>

      <h3>Crash reports</h3>
      <p>
        When the app crashes or hits an error, it sends a report so we can fix
        it. A report contains the technical details of the failure — the error
        itself, where in our code it happened, which screen of the app you were
        on, your device model and your iOS version.
      </p>
      <p>
        It does not contain your name, your email, your IP address, or anything
        you have logged. We have deliberately turned off the setting that would
        attach your IP address, because a stack trace is what fixes a crash and
        knowing who was holding the phone is not.
      </p>
      <p>
        <strong>We do not collect usage analytics.</strong> There is no
        analytics SDK in this app. We do not record which screens you visit,
        which features you use, or how long you spend in the app. A crash
        report is the only diagnostic information we ever receive.
      </p>

      <h3>Purchases</h3>
      <p>
        If you subscribe, the purchase is processed by Apple. We never see your
        payment card, billing address, or any financial information — only
        whether a subscription is active.
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
          <strong>Supabase</strong> — database and authentication. Your account
          and the content you log are stored here.
        </li>
        <li>
          <strong>Apple</strong> — sign-in, and payment processing if you
          subscribe.
        </li>
        <li>
          <strong>Sentry</strong> — crash reports, as described above.
        </li>
        <li>
          <strong>Cloudflare</strong> — hosting for magicaltracker.com.
        </li>
      </ul>
      <p>
        That is the complete list. If we ever add another, this page is updated
        before the change ships.
      </p>
      <p>
        We may also disclose information if we are legally required to, or to
        protect the safety or rights of our users.
      </p>

      <h2>Other users</h2>
      <p>
        No part of what you log is visible to anyone else. There are no profiles,
        no feeds, no follower lists and no sharing. Your ratings and notes are
        yours alone, enforced at the database level rather than by our
        application code — every row is readable only by the account that wrote
        it.
      </p>
      <p>
        We may later add features that summarise ratings across everyone, such
        as a top-rated list. Those would be aggregate figures only, and we will
        update this page before shipping anything of the kind.
      </p>

      <h2>How long we keep it</h2>
      <p>
        Your content is kept as long as your account exists, because the point of
        the app is a record that survives across years and trips. Crash reports
        are deleted automatically by Sentry and are never kept longer than{" "}
        90 days.
      </p>

      <h2>Deleting your data</h2>
      <p>
        You can delete your account from inside the app at any time, under
        Settings. Deleting your account permanently removes your account
        information and all of your content — visits, ratings, trips and notes —
        from our servers. This cannot be undone, so export first if you want to
        keep a copy.
      </p>
      <p>
        Deleting your account does <strong>not</strong> wipe the copy on your
        phone, and that is deliberate: &ldquo;close my account&rdquo; and
        &ldquo;erase the record I have spent years building&rdquo; are different
        requests, and we will not assume the second from the first. To remove
        the local copy as well, delete the app from your device.
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
        30 days.
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
