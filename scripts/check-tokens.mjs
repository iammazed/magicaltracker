#!/usr/bin/env node
/**
 * Verifies that the design tokens in the app and on the website still agree.
 * Run with `npm run check:tokens`.
 *
 * `src/constants/theme.ts` is the source of truth; `web/app/globals.css`
 * mirrors it. They drifted once already — two surface colours diverged by a
 * few percent lightness, invisible in isolation and annoying to reconcile
 * later — so this makes the mirror checkable rather than a promise in a
 * comment.
 *
 * Exits non-zero on any mismatch, or if a mapped token is missing from either
 * side.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** CSS custom property  ->  key in the Colors object. */
const MAP = {
  ground: 'background',
  surface: 'backgroundElement',
  'surface-alt': 'backgroundSelected',
  ink: 'text',
  'ink-soft': 'textSecondary',
  'ink-faint': 'textFaint',
  line: 'border',
  'line-soft': 'borderSoft',
  accent: 'accent',
  'accent-pressed': 'accentPressed',
  'on-accent': 'onAccent',
  gold: 'gold',
  'gold-surface': 'goldSurface',
  'brand-1': 'brandTeal',
  'brand-2': 'brandTealDeep',
  'brand-3': 'brandBlue',
  'brand-4': 'brandNavy',
  'brand-5': 'brandIndigo',
  'brand-6': 'brandViolet',
};

/**
 * Pulls the light and dark custom properties out of globals.css.
 *
 * Scans line by line tracking brace depth rather than regexing whole blocks,
 * because the dark palette is nested inside a media query and a naive
 * "`:root {` to the next `}`" match stops at the wrong brace.
 */
function readCss(path) {
  const light = {};
  const dark = {};
  let depth = 0;
  let inDarkMedia = false;
  let darkMediaDepth = 0;
  let inTheme = false;

  for (const raw of readFileSync(path, 'utf8').split('\n')) {
    const line = raw.trim();

    if (line.startsWith('@media') && line.includes('prefers-color-scheme: dark')) {
      inDarkMedia = true;
      darkMediaDepth = depth;
    }
    // @theme maps tokens to utilities; its values are var() refs, not colours.
    if (line.startsWith('@theme')) inTheme = true;

    const decl = line.match(/^--([a-z0-9-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/);
    if (decl && !inTheme) {
      (inDarkMedia ? dark : light)[decl[1]] = decl[2].toLowerCase();
    }

    depth += (raw.match(/{/g) || []).length;
    depth -= (raw.match(/}/g) || []).length;

    if (inDarkMedia && depth <= darkMediaDepth) inDarkMedia = false;
    if (inTheme && depth === 0) inTheme = false;
  }
  return { light, dark };
}

/** Pulls the light and dark entries out of the Colors object in theme.ts. */
function readTs(path) {
  const src = readFileSync(path, 'utf8');
  const out = {};
  for (const scheme of ['light', 'dark']) {
    const start = src.indexOf(`${scheme}: {`);
    if (start === -1) throw new Error(`no "${scheme}" block in ${path}`);
    const end = src.indexOf('},', start);
    const block = src.slice(start, end);
    out[scheme] = {};
    for (const m of block.matchAll(/([A-Za-z0-9]+):\s*'(#[0-9a-fA-F]{3,8})'/g)) {
      out[scheme][m[1]] = m[2].toLowerCase();
    }
  }
  return out;
}

const css = readCss(join(ROOT, 'web', 'app', 'globals.css'));
const ts = readTs(join(ROOT, 'src', 'constants', 'theme.ts'));

const problems = [];
const rows = [];

for (const [cssName, tsName] of Object.entries(MAP)) {
  for (const scheme of ['light', 'dark']) {
    const a = css[scheme][cssName];
    const b = ts[scheme][tsName];

    if (!a) problems.push(`--${cssName} (${scheme}) missing from web/app/globals.css`);
    else if (!b) problems.push(`${tsName} (${scheme}) missing from src/constants/theme.ts`);
    else if (a !== b) {
      problems.push(
        `${scheme}: --${cssName} is ${a} on the web but ${tsName} is ${b} in the app`,
      );
    }
    if (scheme === 'dark') {
      rows.push([cssName, tsName, css.light[cssName] ?? '-', ts.light[tsName] ?? '-', a ?? '-', b ?? '-']);
    }
  }
}

console.log('');
console.log('  token / key                            light      dark');
console.log('  ' + '─'.repeat(62));
for (const [cn, tn, cl, tl, cd, td] of rows) {
  const ok = cl === tl && cd === td;
  const pair = `--${cn} / ${tn}`;
  console.log(
    `  ${pair.padEnd(38)}${(ok ? cl : `${cl}!=${tl}`).padEnd(11)}${ok ? cd : `${cd}!=${td}`}`,
  );
}
console.log('');

if (problems.length) {
  console.log(`  ${problems.length} mismatch${problems.length === 1 ? '' : 'es'}`);
  for (const p of problems) console.log(`    ✗ ${p}`);
  console.log('');
  console.log('  src/constants/theme.ts is the source of truth. Update the CSS to match.');
  console.log('');
  process.exit(1);
}

console.log(`  ${rows.length} tokens aligned across both themes.\n`);
