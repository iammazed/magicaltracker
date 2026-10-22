#!/usr/bin/env node
/**
 * Checks the product identifiers in the paywall against the ones RevenueCat
 * actually serves. Run with `npm run check:iap`.
 *
 * This exists because the first run of it, done by hand, found that the code
 * said `premium_annual` while RevenueCat said `premium_yearly`. Nothing would
 * have reported that: `fetchPackages` returns what it returns, the paywall
 * falls back to the hardcoded price when it cannot find a match, and the plan
 * simply says "Not available here" when tapped. The hero product would have
 * been quietly unbuyable, and the only symptom is revenue that never arrives.
 *
 * It calls the same public endpoint the SDK does, so it needs no secret and
 * no device — just the key from .env.
 */

import fs from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function envValue(name) {
  const path = join(ROOT, '.env');
  if (!fs.existsSync(path)) return null;
  const m = fs.readFileSync(path, 'utf8').match(new RegExp(`^${name}=(.*)$`, 'm'));
  if (!m) return null;
  return m[1].trim().replace(/^["']|["']$/g, '') || null;
}

/**
 * Which store to check. The two keys return DIFFERENT product identifiers for
 * the same offering — the Test Store ones under `test_`, the App Store ones
 * under `appl_` — so "it passed" is meaningless without saying which was used.
 *
 *   npm run check:iap            prefers the test key (everyday use)
 *   npm run check:iap -- --apple forces the real App Store products
 */
const forced = process.argv.includes('--apple')
  ? 'apple'
  : process.argv.includes('--test')
    ? 'test'
    : null;

const TEST = envValue('EXPO_PUBLIC_REVENUECAT_KEY_TEST');
const APPLE = envValue('EXPO_PUBLIC_REVENUECAT_KEY_APPLE');

const key = forced === 'apple' ? APPLE : forced === 'test' ? TEST : (TEST ?? APPLE);
const using = key && key === APPLE ? 'App Store (appl_)' : 'Test Store (test_)';

if (!key) {
  // Deliberately a failure, not a skip. A check that reports success when it
  // did not run is the `exit 0` mistake the heartbeat workflow already made.
  console.error(
    forced
      ? `✗ No ${forced === 'apple' ? 'EXPO_PUBLIC_REVENUECAT_KEY_APPLE' : 'EXPO_PUBLIC_REVENUECAT_KEY_TEST'} in .env.\n` +
          '  This check cannot run, which is not the same as passing.'
      : '✗ No RevenueCat key in .env (EXPO_PUBLIC_REVENUECAT_KEY_TEST or _APPLE).\n' +
          '  This check cannot run, which is not the same as passing.',
  );
  process.exit(1);
}

console.log(`Checking against: ${using}\n`);

/* ── What the app expects, read from the real file ───────────────────── */
const paywall = fs.readFileSync(join(ROOT, 'src', 'app', 'paywall.tsx'), 'utf8');
const expected = [...paywall.matchAll(/productId:\s*'([^']+)'/g)].map((m) => m[1]);

if (expected.length === 0) {
  console.error('✗ Found no productId entries in paywall.tsx — has PLANS been restructured?');
  process.exit(1);
}

/* ── What RevenueCat serves ──────────────────────────────────────────── */
const res = await fetch(
  'https://api.revenuecat.com/v1/subscribers/magicaltracker-preflight/offerings',
  { headers: { Authorization: `Bearer ${key}`, 'X-Platform': 'ios' } },
);

if (!res.ok) {
  console.error(`✗ RevenueCat returned HTTP ${res.status}. Is the key valid?`);
  process.exit(1);
}

const body = await res.json();
const current = body.offerings?.find((o) => o.identifier === body.current_offering_id);

let failed = 0;
const check = (label, ok, detail = '') => {
  if (!ok) failed += 1;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}${detail ? '  ' + detail : ''}`);
};

check(
  'an offering is marked Default',
  Boolean(body.current_offering_id),
  body.current_offering_id ? `current = "${body.current_offering_id}"` : 'none — the SDK gets nothing',
);
check('that offering exists in the response', Boolean(current));

const served = (current?.packages ?? []).map((p) => p.platform_product_identifier);

for (const id of expected) {
  check(
    `paywall product "${id}" is served`,
    served.includes(id),
    served.includes(id) ? '' : `RevenueCat has: ${served.join(', ') || '(none)'}`,
  );
}

for (const id of served) {
  check(
    `RevenueCat product "${id}" is used by the paywall`,
    expected.includes(id),
    expected.includes(id) ? '' : 'configured but unreachable — nothing can buy it',
  );
}

console.log(
  failed
    ? `\n${failed} FAILED — a mismatched identifier means that plan silently cannot be bought.`
    : `\nall checks passed (${served.length} products)`,
);
process.exitCode = failed ? 1 : 0;
