#!/usr/bin/env node
/**
 * Reports what actually exists in the database: tables, whether RLS is on,
 * how many policies each has, and row counts. Run with `npm run db:check`.
 *
 * Exits non-zero if any public table has RLS disabled or has zero policies —
 * either of those means a table is wide open or unreachable, and both are bugs.
 *
 * It ALSO fails when a user-owned table has a write policy with no
 * `with_check`, which is the failure the first two versions of this script
 * could not see. `using` governs reads and `with_check` governs writes, so a
 * policy with only `using` lets a user insert rows stamped with somebody
 * else's id — and the table still reports "RLS on, 1 policy" and passes. A
 * guard that cannot see the thing the docs call non-optional is the kind that
 * costs attention and returns nothing.
 *
 * "User-owned" is derived from the presence of a `user_id` column rather than
 * a hardcoded list, so a new table is covered the day it is added instead of
 * the day somebody remembers to add it here.
 */

import 'dotenv/config';
import postgres from 'postgres';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is missing. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

// The Supabase transaction pooler does not support prepared statements.
const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });

try {
  const tables = await sql`
    select c.relname                as table_name,
           c.relrowsecurity         as rls_enabled,
           (select count(*) from pg_policies p
             where p.schemaname = 'public' and p.tablename = c.relname) as policy_count
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
    order by c.relname`;

  if (tables.length === 0) {
    console.error('\n  No tables found. Has the migration been applied? `npm run db:migrate`\n');
    process.exit(1);
  }

  /** Tables that carry a `user_id`, so their writes must be constrained. */
  const owned = new Set(
    (
      await sql`
        select table_name
        from information_schema.columns
        where table_schema = 'public' and column_name = 'user_id'`
    ).map((r) => r.table_name),
  );

  /** Write-capable policies lacking `with_check`, by table. */
  const unchecked = new Map();
  for (const r of await sql`
    select tablename, policyname, cmd
    from pg_policies
    where schemaname = 'public'
      and cmd in ('ALL', 'INSERT', 'UPDATE')
      and with_check is null`) {
    if (!unchecked.has(r.tablename)) unchecked.set(r.tablename, []);
    unchecked.get(r.tablename).push(r.policyname);
  }

  console.log('');
  console.log('  table                rows   rls    policies  writes');
  console.log('  ' + '─'.repeat(56));

  const problems = [];

  for (const t of tables) {
    const [{ count }] = await sql`select count(*)::int as count from ${sql(t.table_name)}`;
    const rls = t.rls_enabled ? 'on' : 'OFF';
    const policies = Number(t.policy_count);

    // Blank rather than "n/a" for a catalog table: it has no user_id, so
    // constraining writes is not a question that applies to it.
    const writes = owned.has(t.table_name)
      ? unchecked.has(t.table_name)
        ? 'UNCHECKED'
        : 'checked'
      : '';

    console.log(
      `  ${t.table_name.padEnd(20)} ${String(count).padStart(4)}   ${rls.padEnd(6)} ${String(
        policies,
      ).padEnd(9)} ${writes}`,
    );

    // drizzle's own bookkeeping table lives in a separate schema, so anything
    // here is ours and must be locked down.
    if (!t.rls_enabled) problems.push(`${t.table_name}: RLS is DISABLED — table is readable by anyone with the publishable key`);
    else if (policies === 0) problems.push(`${t.table_name}: RLS on but no policies — table is unreachable from the app`);

    if (owned.has(t.table_name) && unchecked.has(t.table_name)) {
      problems.push(
        `${t.table_name}: policy ${unchecked
          .get(t.table_name)
          .map((n) => `"${n}"`)
          .join(', ')} can write with no with_check — a user could insert rows owned by someone else`,
      );
    }
  }

  const enums = await sql`
    select t.typname, count(e.enumlabel)::int as n
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
    group by t.typname order by t.typname`;

  if (enums.length) {
    console.log('');
    console.log('  enums: ' + enums.map((e) => `${e.typname}(${e.n})`).join('  '));
  }

  console.log('');

  if (problems.length) {
    console.log(`  ${problems.length} problem${problems.length === 1 ? '' : 's'}`);
    for (const p of problems) console.log(`    ✗ ${p}`);
    console.log('');
    process.exitCode = 1;
  } else {
    console.log(
      '  Every table has RLS enabled with at least one policy, and every\n' +
        '  user-owned table constrains writes with with_check.\n',
    );
  }
} finally {
  await sql.end();
}
