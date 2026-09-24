#!/usr/bin/env node
/**
 * Reports what actually exists in the database: tables, whether RLS is on,
 * how many policies each has, and row counts. Run with `npm run db:check`.
 *
 * Exits non-zero if any public table has RLS disabled or has zero policies —
 * either of those means a table is wide open or unreachable, and both are bugs.
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

  console.log('');
  console.log('  table                rows   rls    policies');
  console.log('  ' + '─'.repeat(46));

  const problems = [];

  for (const t of tables) {
    const [{ count }] = await sql`select count(*)::int as count from ${sql(t.table_name)}`;
    const rls = t.rls_enabled ? 'on' : 'OFF';
    const policies = Number(t.policy_count);

    console.log(
      `  ${t.table_name.padEnd(20)} ${String(count).padStart(4)}   ${rls.padEnd(6)} ${policies}`,
    );

    // drizzle's own bookkeeping table lives in a separate schema, so anything
    // here is ours and must be locked down.
    if (!t.rls_enabled) problems.push(`${t.table_name}: RLS is DISABLED — table is readable by anyone with the publishable key`);
    else if (policies === 0) problems.push(`${t.table_name}: RLS on but no policies — table is unreachable from the app`);
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
    console.log('  Every table has RLS enabled with at least one policy.\n');
  }
} finally {
  await sql.end();
}
