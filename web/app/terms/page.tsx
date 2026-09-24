import type { Metadata } from "next";
import { LegalShell, TODO } from "@/components/legal-shell";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "The terms you agree to when using the MagicalTracker app and website.",
};

export default function TermsPage() {
  return (
    <LegalShell
      title="Terms of Service"
      updated={<TODO>[EFFECTIVE DATE]</TODO>}
      intro="These terms cover the MagicalTracker iPhone app and magicaltracker.com. By using either, you agree to them."
    >
      <p>
        The service is operated by <TODO>[LEGAL ENTITY NAME]</TODO>,{" "}
        <TODO>[BUSINESS ADDRESS]</TODO> (&ldquo;we&rdquo;, &ldquo;us&rdquo;).
      </p>

      <h2>Using the app</h2>
      <p>
        You must be at least 13 years old to create an account. You are
        responsible for what happens under your account, and for keeping access
        to your email or Apple ID secure.
      </p>
      <p>Do not use MagicalTracker to:</p>
      <ul>
        <li>Break the law, or infringe anyone else&rsquo;s rights.</li>
        <li>
          Scrape, bulk-export, or resell our restaurant and resort data.
        </li>
        <li>
          Interfere with the service, attempt to access other users&rsquo; data,
          or probe our systems.
        </li>
        <li>
          Upload content that is unlawful, abusive, or that you do not have the
          rights to.
        </li>
      </ul>

      <h2>Your content</h2>
      <p>
        <strong>Your trip log is yours.</strong> You keep ownership of your
        visits, ratings, notes and photos. You grant us only the permission we
        need to operate the service — storing your content, showing it back to
        you, backing it up, and including your ratings in anonymous aggregate
        figures such as top-rated lists.
      </p>
      <p>
        We will not publish your notes, photos, or individually identifiable
        ratings without your explicit choice to share them.
      </p>

      <h2>Our content</h2>
      <p>
        The app, the website, and our compiled catalog of restaurants and
        resorts are ours. You may use them for your own personal trip tracking.
        You may not copy the catalog, redistribute it, or build a competing
        product from it.
      </p>

      <h2>Subscriptions</h2>
      <p>
        MagicalTracker is free to use. Some features require a paid
        subscription, purchased through Apple.
      </p>
      <ul>
        <li>
          Payment is charged to your Apple ID at confirmation of purchase.
        </li>
        <li>
          Subscriptions renew automatically unless cancelled at least 24 hours
          before the end of the current period.
        </li>
        <li>
          Manage or cancel your subscription in your Apple ID account settings.
          Deleting the app does not cancel a subscription.
        </li>
        <li>
          If a free trial is offered, any unused portion is forfeited when you
          purchase a subscription.
        </li>
        <li>
          Refunds are handled by Apple under their policies. We cannot issue
          them directly.
        </li>
      </ul>
      <p>
        We may change prices for future billing periods. We will give notice
        before a change affects you.
      </p>

      <h2>Accuracy of information</h2>
      <p>
        We work hard to keep restaurant and resort information correct, and we
        verify every entry against official sources. Even so, venues open,
        close, change hours, and change service models constantly.{" "}
        <strong>
          Always confirm details with Disney before making plans based on what
          you see here.
        </strong>{" "}
        We are not responsible for a wasted walk across a park.
      </p>

      <h2>Availability</h2>
      <p>
        We do not guarantee the service will be uninterrupted or error-free. We
        may change, suspend, or discontinue features. If we ever shut the service
        down, we will give reasonable notice and a way to export your data.
      </p>

      <h2>Ending your account</h2>
      <p>
        You can delete your account at any time from inside the app. We may
        suspend or terminate an account that breaks these terms.
      </p>

      <h2>Disclaimers and liability</h2>
      <p>
        The service is provided &ldquo;as is&rdquo;, without warranties of any
        kind to the fullest extent the law allows. To the extent permitted by
        law, our total liability for any claim relating to the service is
        limited to the amount you paid us in the twelve months before the claim.
      </p>

      <h2>Not affiliated with Disney</h2>
      <p>
        MagicalTracker is an independent app. It is not affiliated with,
        endorsed by, sponsored by, or officially connected to The Walt Disney
        Company or any of its subsidiaries. Park, resort and restaurant names are
        used factually to identify real places, and all trademarks belong to
        their respective owners.
      </p>

      <h2>Governing law</h2>
      <p>
        These terms are governed by the laws of{" "}
        <TODO>[STATE / JURISDICTION]</TODO>, without regard to conflict of law
        rules.
      </p>

      <h2>Changes</h2>
      <p>
        We may update these terms. If a change is material we will notify you in
        the app before it takes effect. Continuing to use the service after that
        means you accept the new terms.
      </p>

      <h2>Contact</h2>
      <p>
        <a href="mailto:support@magicaltracker.com">
          support@magicaltracker.com
        </a>
      </p>
    </LegalShell>
  );
}
