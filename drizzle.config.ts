import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is missing. Copy .env.example to .env and fill it in.');
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL },

  // Supabase owns auth, storage, realtime etc. Without this, drizzle-kit sees
  // those schemas as drift and tries to drop them.
  schemaFilter: ['public'],

  // Tells drizzle-kit that `anon`, `authenticated`, and `service_role` are
  // managed by Supabase, so it references them in policies instead of
  // generating CREATE ROLE statements for them.
  entities: {
    roles: { provider: 'supabase' },
  },

  verbose: true,
  strict: true,
});
