import type { Metadata } from "next";
import { Fraunces, Figtree, Pacifico, Berkshire_Swash } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

// Fraunces carries the warmth. Its SOFT and WONK axes round the terminals and
// tilt the italics off-axis, which is what keeps it from reading as corporate.
const display = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["SOFT", "WONK", "opsz"],
  display: "swap",
});

const sans = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
  display: "swap",
});

// Wordmark only. Round and thick enough to survive a favicon, and its
// roundness is the clearest signal that it is not imitating the Disney script.
const script = Pacifico({
  variable: "--font-pacifico",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

// The swashed initial. Upright rather than slanted, which is what lets it sit
// at 1.6x without fighting the script that follows it.
const initial = Berkshire_Swash({
  variable: "--font-berkshire",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://magicaltracker.com"),
  title: {
    default: "MagicalTracker — A passport for every Disney World trip",
    template: "%s · MagicalTracker",
  },
  description:
    "Log every restaurant you eat at and every resort you stay in at Walt Disney World. Earn passport achievements, count down to your next trip, and keep the whole record in one place.",
  openGraph: {
    type: "website",
    siteName: "MagicalTracker",
    url: "https://magicaltracker.com",
    title: "MagicalTracker — A passport for every Disney World trip",
    description:
      "Log every restaurant and resort at Walt Disney World, earn passport achievements, and count down to your next trip.",
  },
  twitter: {
    card: "summary_large_image",
    title: "MagicalTracker",
    description:
      "A trip log and achievement passport for Walt Disney World.",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body
        className={`${display.variable} ${sans.variable} ${script.variable} ${initial.variable} font-sans antialiased`}
      >
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-accent focus:px-4 focus:py-2 focus:text-on-accent"
        >
          Skip to content
        </a>
        <SiteHeader />
        <main id="main">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
