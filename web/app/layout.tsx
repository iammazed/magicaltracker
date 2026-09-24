import type { Metadata } from "next";
import { Instrument_Serif, Public_Sans } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

const display = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

const sans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
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
      <body className={`${display.variable} ${sans.variable} font-sans antialiased`}>
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
