import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export — plain HTML/CSS/JS, deployed to Cloudflare Pages with no
  // adapter or edge runtime. Everything this site does is static.
  output: "export",

  // next/image optimization needs a server; the export has none.
  images: { unoptimized: true },

  // This app is nested inside the Expo repo, so two lockfiles exist and
  // Turbopack guesses the wrong workspace root without this.
  turbopack: { root: path.resolve(__dirname) },
};

export default nextConfig;
