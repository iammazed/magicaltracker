# MagicalTracker

A Walt Disney World trip log for iOS. Track the restaurants you've eaten at and the resorts
you've stayed in, earn passport achievements, and count down to your next trip.

**Stack:** Expo (React Native) · TypeScript · Expo Router · Supabase (Postgres) · Drizzle ORM
· RevenueCat *(planned)*

Built on Windows — iOS builds go through EAS Build, so no Mac is required.

---

## Getting started

```bash
npm install
cp .env.example .env     # then fill in the four values
npx expo start
```

Install **Expo Go** on your iPhone, make sure it's on the same wifi as your PC, and scan the QR
code with the **Camera app** (not from inside Expo Go — that's the Android flow).

On a network that blocks device-to-device traffic (guest wifi, hotels), use `npx expo start --tunnel`.

### Requirements

- Node 20+ (22 LTS recommended)
- An iPhone with Expo Go — the iOS simulator is macOS-only
- A Supabase project — see [.env.example](.env.example) for exactly which values to grab and where

---

## Commands

### App

| Command | Does |
|---|---|
| `npx expo start` | Dev server + QR code |
| `npx expo start --tunnel` | Same, routed through Expo's servers for hostile networks |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run reset-project` | Blank out the template example screens |

### Data

| Command | Does |
|---|---|
| `npm run validate:data` | Check the CSVs — enums, coordinates, foreign keys, achievement completability |
| `npm run validate:data -- --strict` | Same, but unverified rows fail. The pre-ship gate. |
| `npm run db:import` | Validate, then upsert verified CSV rows into Supabase |
| `npm run db:import -- --dry-run` | Report what would change, write nothing |

### Database

| Command | Does |
|---|---|
| `npm run db:generate` | Schema changes → a SQL migration file |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:check` | Row counts + **RLS audit**. Fails if any table is unprotected. |
| `npm run db:studio` | Browser GUI for the database |

### Website

The marketing site is a separate Next.js app in `web/` with its own dependencies.

```bash
cd web && npm install && npm run dev
```

Deployed to **Cloudflare Workers** with static assets — path `/web`, build `npm run build`, output declared in `web/wrangler.jsonc`. Not Vercel — its free tier forbids commercial use. See [web/README.md](web/README.md).

---

## How data flows

```
data/catalog-entry.xlsx  ←── enter data here (dropdowns, validation)
     │  Save As → CSV UTF-8
     ▼
data/*.csv  ←── source of truth. Git-tracked, diffable, reviewable.
     │
     │  npm run db:import   (validates first; skips unverified rows)
     ▼
Supabase Postgres  ←── never edit catalog rows in the dashboard
     │
     │  (planned) export → versioned JSON → bundled in the app build
     ▼
expo-sqlite on device  ←── so the app works with no signal in the parks
```

Two rules keep this honest:

1. **The CSVs are the source of truth.** Editing catalog data in the Supabase dashboard forks
   your truth and git stops describing reality.
2. **`verified_on` is a gate, not metadata.** A row without it never reaches the database. See
   [data/README.md](data/README.md) for the per-row verification workflow.

## How schema changes work

```
src/db/schema.ts  →  npm run db:generate  →  drizzle/0000_*.sql  →  npm run db:migrate
```

Never write `CREATE TABLE` by hand and never change tables in the dashboard. Migration files are
committed, so the database structure lives in git next to the code.

Every table declares its RLS policies inline in `schema.ts`, so a table cannot be added without
deciding who can read it. `npm run db:check` fails the build if one slips through.

---

## Project layout

| Path | Holds |
|---|---|
| `src/app/` | Routes (Expo Router, file-based) |
| `src/app/(tabs)/` | Tab destinations |
| `src/components/` | Shared components (`.web.tsx` siblings override for web) |
| `src/constants/theme.ts` | **All** design tokens — colors, spacing, radii |
| `src/db/schema.ts` | Database schema and inferred types |
| `data/catalog-entry.xlsx` | Data-entry workbook with dropdowns — export to CSV |
| `data/` | Source-of-truth catalog CSVs + the data dictionary |
| `drizzle/` | Generated migrations (committed) |
| `scripts/` | Validation, import, and database tooling |
| `docs/` | Build plan and SQL snippets |
| `web/` | magicaltracker.com — static Next.js marketing site (own package.json) |

Conventions — design tokens, routing rules, database rules — live in [AGENTS.md](AGENTS.md).
Read it before contributing.

---

## Notes

`.env` is gitignored and holds real credentials. `.env.example` is committed and holds
placeholders only. Only `EXPO_PUBLIC_`-prefixed values are readable by the app, and that prefix
bakes them into the shipped binary — never use it for the database password or secret key.

Supabase Free Plan projects pause after ~7 days of inactivity. A scheduled GitHub Action
(`.github/workflows/keep-supabase-awake.yml`) pings the database every 3 days to prevent it.

---

MagicalTracker is an independent app and is not affiliated with, endorsed by, or sponsored by
The Walt Disney Company.
