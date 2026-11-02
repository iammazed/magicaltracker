#!/usr/bin/env node
/**
 * Publish the current JS to the builds that an `eas.json` edit orphaned.
 *
 * ## Why this exists
 *
 * `runtimeVersion.policy` is `fingerprint`, and `eas.json` is one of the 130
 * fingerprint sources. Adding `submit.production.ios.ascAppId` — pure
 * submission metadata that the binary cannot observe — moved the iOS runtime
 * version from `ed8385a7…` to `d41cd429…`. Every update published afterwards
 * was offered only to build 5. Builds 3 and 4, already on testers' phones,
 * were cut off permanently: they ask for an update, the server filters by
 * runtime version before replying, and they are told there is nothing.
 *
 * The orthodox fix is for testers to install the newer build from TestFlight.
 * When that is blocked — Beta App Review, an incomplete App Privacy
 * questionnaire, a build not yet assigned to the group — their phones sit on
 * stale JS reporting bugs in code that was fixed days ago. That happened
 * three times here, and it is what this script is for.
 *
 * ## Why this is safe, and the one condition that makes it so
 *
 * The fingerprint moved for a reason the *binary* cannot detect. Nothing
 * native changed between build 4 and now: no dependency added or removed, no
 * `app.json` change, only that one line of `eas.json`. So build 4's binary
 * can run today's JS, and the fingerprint difference is bookkeeping rather
 * than an incompatibility.
 *
 * **That is a claim with an expiry date.** The moment a real native change
 * lands — a new Expo module, a plugin, an SDK bump — this stops being safe,
 * and publishing anyway ships the `expo-image-manipulator` crash this project
 * already shipped once: JS calling a native module the binary does not
 * contain, which fails at launch rather than politely. So the script refuses
 * to run unless it can verify the only difference is `ascAppId`.
 *
 * ## Usage
 *
 *     node scripts/update-legacy.mjs "what changed"
 *
 * It temporarily removes `ascAppId`, publishes, and restores the file in a
 * `finally` — including on Ctrl-C. Run the ordinary `npm run update:prod`
 * as well; this one reaches the old builds, that one reaches build 5.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const EAS = 'eas.json';
/** The commit the oldest still-installed build was made from. */
const LEGACY_BUILD_COMMIT = '31101f2854a43d923835961b7291851bc775b279';
/** Files that, if changed since that commit, mean the binary differs for real. */
const NATIVE = ['package.json', 'package-lock.json', 'app.json', 'babel.config.js', 'metro.config.js'];

const message = process.argv[2];
if (!message) {
  console.error('Usage: node scripts/update-legacy.mjs "what changed"');
  process.exit(1);
}

const run = (cmd, args) =>
  execFileSync(cmd, args, { encoding: 'utf8', shell: process.platform === 'win32' });

// ── Refuse if anything native moved ──────────────────────────────────────
// This is the whole safety argument, so it is checked rather than assumed.
const changed = run('git', ['diff', '--name-only', LEGACY_BUILD_COMMIT, 'HEAD', '--', ...NATIVE])
  .split('\n')
  .filter(Boolean);

if (changed.length) {
  console.error('Refusing to publish: these affect the native binary and have changed');
  console.error('since the old build was made, so its binary cannot be trusted to run');
  console.error('this JS. The testers on it need a new build from TestFlight.\n');
  for (const f of changed) console.error('  ' + f);
  process.exit(1);
}

// A dirty eas.json would be destroyed by the restore below.
if (run('git', ['status', '--porcelain', EAS]).trim()) {
  console.error(`Refusing to publish: ${EAS} has uncommitted changes.`);
  process.exit(1);
}

const original = readFileSync(EAS, 'utf8');
const restore = () => {
  writeFileSync(EAS, original);
  console.log(`\n${EAS} restored.`);
};
// Ctrl-C must not leave the repo holding a half-edited submit profile.
process.on('SIGINT', () => {
  restore();
  process.exit(130);
});

try {
  const config = JSON.parse(original);
  const removed = config.submit?.production?.ios?.ascAppId;
  if (!removed) {
    console.error(`No ascAppId in ${EAS} — nothing to roll back, so the runtime`);
    console.error('version is already the old one. Use npm run update:prod instead.');
    process.exit(1);
  }
  delete config.submit.production.ios.ascAppId;
  writeFileSync(EAS, JSON.stringify(config, null, 2) + '\n');

  const { hash } = JSON.parse(
    run('npx', ['expo-updates', 'fingerprint:generate', '--platform', 'ios']),
  );
  console.log(`Publishing to iOS runtime ${hash.slice(0, 12)}… (the old builds)\n`);

  run('npx', [
    'eas', 'update',
    '--channel', 'production',
    '--environment', 'production',
    '--message', message,
    '--non-interactive',
  ]);
  console.log('\nPublished. Now run the normal one for build 5:');
  console.log(`  npm run update:prod -- --message ${JSON.stringify(message)}`);
} finally {
  restore();
}
