#!/usr/bin/env node
/**
 * Proves that `npm run db:check` actually FAILS when a user-owned table has a
 * write policy with no `with_check`.
 *
 * This is a test OF A GUARD, which is why it exists at all. `db:check` reports
 * "RLS on, 1 policy" for a correct table and for a broken one alike, so the
 * with_check rule it now enforces is invisible in its own output — and a guard
 * nobody has watched fail is a guard nobody should trust. This project has
 * already paid for that lesson twice: the heartbeat workflow's `exit 0` turned
 * "misconfigured" into a column of green ticks, and the catalog seed test
 * passed throughout the release that broke every existing install.
 *
 * **It writes to the database**, which is why it is not part of `db:check` and
 * why it refuses to run without `--yes`. What it writes is one empty table
 * with no references, dropped in a `finally` so a crash cannot leave it
 * behind. Verify with the last line it prints.
 *
 *   node ./scripts/verify-db-check.mjs --yes
 */

import 'dotenv/config';
import { execFileSync } from 'node:child_process';
import postgres from 'postgres';

if (!process.argv.includes('--yes')) {
  console.error(
    '\n  This writes to the database it is pointed at: it creates an empty\n' +
      '  table, proves db:check rejects a bad policy on it, and drops it again.\n' +
      '  Re-run with --yes if that is what you want.\n',
  );
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is missing. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });
const PROBE = '__dbcheck_probe';

function runCheck() {
  try {
    execFileSync('npm', ['run', 'db:check'], {
      encoding: 'utf8',
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { code: 0, out: '' };
  } catch (e) {
    return { code: e.status ?? 1, out: (e.stdout ?? '') + (e.stderr ?? '') };
  }
}

/** Re-run with the output captured either way, so the pass case can be read too. */
function runCheckCapturing() {
  try {
    const out = execFileSync('npm', ['run', 'db:check'], {
      encoding: 'utf8',
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status ?? 1, out: (e.stdout ?? '') + (e.stderr ?? '') };
  }
}

let failures = 0;
const check = (label, ok) => {
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${label}`);
  if (!ok) failures += 1;
};

try {
  console.log('');

  await sql.unsafe(`
    create table public.${PROBE} (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null
    );
    alter table public.${PROBE} enable row level security;
    -- Deliberately broken: \`using\` only, no \`with_check\`. A user could
    -- insert rows stamped with somebody else's id.
    create policy "probe bad policy" on public.${PROBE}
      as permissive for all to authenticated
      using ((select auth.uid()) = user_id);
  `);

  const bad = runCheckCapturing();
  check('a write policy with no with_check makes db:check exit non-zero', bad.code !== 0);
  check('and it names with_check as the reason', bad.out.includes('with no with_check'));
  check(
    'and the table is marked UNCHECKED in the table listing',
    /__dbcheck_probe[^\n]*UNCHECKED/.test(bad.out),
  );

  await sql.unsafe(`
    drop policy "probe bad policy" on public.${PROBE};
    create policy "probe good policy" on public.${PROBE}
      as permissive for all to authenticated
      using ((select auth.uid()) = user_id)
      with check ((select auth.uid()) = user_id);
  `);

  const good = runCheck();
  check('adding with_check makes db:check pass again', good.code === 0);
} finally {
  await sql.unsafe(`drop table if exists public.${PROBE} cascade;`);
  const [{ n }] = await sql`
    select count(*)::int as n from information_schema.tables
    where table_schema = 'public' and table_name = ${PROBE}`;
  check('the probe table is gone', n === 0);
  await sql.end();
}

console.log('');
if (failures) {
  console.log(`  ${failures} check${failures === 1 ? '' : 's'} failed\n`);
  process.exitCode = 1;
} else {
  console.log('  db:check demonstrably rejects a missing with_check.\n');
}
