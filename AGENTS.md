# MagicalTracker — working agreements

## Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

SDK 57 / React Native 0.86 / React 19.2. Do not write Expo API code from memory — check the
versioned page for the specific module first.

---

## Design tokens

All color lives in `src/constants/theme.ts`. Nothing else defines a color.

**Read colors through `useTheme()`. Never write a color literal in a component.**

```tsx
// Yes
const theme = useTheme();
<View style={{ backgroundColor: theme.backgroundElement }} />
<ThemedText themeColor="textSecondary">…</ThemedText>

// No — invisible in one scheme, and invisible to the token screen
<View style={{ backgroundColor: '#FFFFFF' }} />
```

A literal that looks fine in light mode is the classic unreadable-in-dark-mode bug. It is also
invisible to `/theme`, so nobody catches it until a user does.

### Rules

1. **`Colors.light` and `Colors.dark` must have identical keys.** `ThemeColor` is the
   intersection of both — a key present in only one silently vanishes from the type and from
   autocomplete, with no error.
2. **Every new token gets added to `GROUPS` in `src/app/theme.tsx`.** Ungrouped tokens render in
   a warning block on that screen, so this is enforced visually rather than by convention alone.
3. **Never add a token without both values.** Dark is not an afterthought and not an inversion —
   pick a value that actually works on a dark ground.
4. **Check both schemes before calling UI done.** Open `/theme` (dev link on the home screen) and
   flip the phone via Control Center.

### What each group is for

| Group | Use for | Do not use for |
|---|---|---|
| `text` / `textSecondary` / `textFaint` | Copy hierarchy | Decoration |
| `background` / `backgroundElement` / `backgroundSelected` | Screen ground, cards, pressed rows | Text |
| `border` / `borderSoft` | Container edges / internal rules | Anything filled |
| `accent` / `accentPressed` / `onAccent` | Primary actions, links | Decoration, large fills |
| `gold` / `goldSurface` | **Achievement unlocks and premium only** | General emphasis |
| `success` / `warning` / `danger` | State and outcomes | Branding |
| `brandTeal` … `brandViolet` | Sequential/categorical things | Body text, semantic state |

**`gold` is load-bearing.** It marks reward. If it starts appearing as a general highlight, an
unlocked achievement stops feeling like anything. Guard it.

**The brand ramp is ordered.** `BrandRamp` is exported as an ordered array — index into it for
anything sequential (park chips, achievement tiers, trip phases). Don't pick ramp colors ad hoc;
the order carries meaning.

**Semantic colors are deliberately outside the ramp.** A destructive confirm must never read as
the same violet as a premium badge.

**White text only on the ramp.** Black fails WCAG AA contrast on all six. `#00807E` is the
lightest at ~4.8:1 — passes, but with no margin, so darken for hover/pressed states, never lighten.

---

## Brand

The wordmark is a three-part lockup:

| Part | Face | Size |
|---|---|---|
| `M` | Berkshire Swash | 1.6x |
| `agical` | Pacifico | base |
| `Tracker` | Figtree semibold | base |

It is defined once in `web/components/wordmark.tsx` and used everywhere it
appears — never hand-roll it, or the header and footer drift apart.

`agical` and `Tracker` share a font-size on purpose. They will not look
identically tall, because Figtree's cap height per em exceeds Pacifico's
x-height, and that mismatch is what keeps the script from reading as an error.

The **app icon, favicon and splash are the Berkshire Swash `M` alone**, in gold
on the twilight gradient — the same initial that opens the wordmark, so the
browser tab, the home screen and the logo are visibly one mark. Regenerate them
with `scripts/` tooling rather than editing the PNGs by hand.

Pacifico and Berkshire Swash are for the wordmark only. Neither is a UI font,
and neither may appear in body copy, headings, or buttons.

**Never use a face that reads as the Disney script.** Waltograph and its
lookalikes are off the table entirely, and so is anything spiky, angular and
signature-like with a looping capital. Pacifico was chosen partly because its
roundness is the clearest possible signal of distance from that mark. The same
rule covers artwork: no Mickey silhouettes, no castle shapes, no character art,
no Disney logos — in the app, on the site, or in App Store screenshots.

The non-affiliation disclaimer appears in the app's About screen, the App Store
description, and the site footer. It is not optional.

---

## Spacing and radius

Use the `Spacing` and `Radius` scales from `src/constants/theme.ts`. No magic numbers.

Sibling groups get laid out with flex `gap`, not per-element margins.

---

## Project layout

| Path | Holds |
|---|---|
| `src/app/` | Routes (Expo Router, file-based). `typedRoutes` is on — hrefs are typechecked. |
| `src/components/` | Shared components. `.web.tsx` siblings override for web. |
| `src/constants/` | Design tokens and app-wide constants |
| `src/hooks/` | Shared hooks |
| `data/` | Source-of-truth CSVs for the venue/resort catalog |
| `docs/` | Planning docs |

### Routing

```
src/app/
├── _layout.tsx        root Stack — declare anything that opens OVER the tabs here
├── (tabs)/
│   ├── _layout.tsx    renders <AppTabs />
│   ├── index.tsx      → /index
│   └── explore.tsx    → /explore
└── theme.tsx          → /theme  (modal, dev tool)
```

**`NativeTabs` cannot push screens.** It is a tab bar, not a stack. A route that is not a
declared `NativeTabs.Trigger` and not on the root Stack is unreachable — `<Link>` to it silently
does nothing, with no error. This cost an afternoon once already.

So: **tab destinations** go in `(tabs)/` with a matching trigger in
`src/components/app-tabs.tsx`. **Everything else** — venue detail, log-visit sheet, paywall,
`/theme` — is a sibling in `src/app/` AND a `<Stack.Screen>` in the root `_layout.tsx`. Both,
not either.

`typedRoutes` is on, so hrefs are typechecked against `.expo/types/router.d.ts`. Note that the
home route's canonical path is **`/index`**, not `/` — moving it into the `(tabs)` group changed
that. When a valid-looking href fails to typecheck, read the generated union rather than guessing.

---

## Database

Schema lives in `src/db/schema.ts`. Migrations are generated, never hand-written.

```
edit schema.ts → npm run db:generate → READ the generated SQL → npm run db:migrate
```

**Never change tables in the Supabase dashboard.** The dashboard has no migration history, so a
dashboard change makes the repo lie about the database and the next `db:generate` will try to
undo it.

### RLS is mandatory, and Drizzle enforces it

Every table declares its policies inline, in the same definition as its columns:

```ts
export const venues = pgTable('venues', { /* columns */ }, (t) => [
  index('venues_area_idx').on(t.areaId),
  pgPolicy('anyone can read venues', {
    for: 'select',
    to: [anonRole, authenticatedRole],
    using: sql`true`,
  }),
]);
```

A table with **RLS off** is readable by anyone holding the publishable key — which ships inside
the app binary. A table with **RLS on and no policy** is unreachable. `npm run db:check` fails on
either, so run it after every migration.

For user-owned tables (`visits`, `trips`, `stays`), the policy needs **both** clauses:

```ts
pgPolicy('own visits only', {
  for: 'all',
  to: authenticatedRole,
  using: sql`auth.uid() = ${t.userId}`,        // governs reads
  withCheck: sql`auth.uid() = ${t.userId}`,    // governs writes
})
```

Omitting `withCheck` lets a user write rows assigned to someone else's id. It is not optional.

### Debugging RLS

**RLS returns empty results, not errors.** When a query unexpectedly returns `[]`, check policies
before checking your code. And never test policies in the SQL Editor — it runs as superuser and
bypasses RLS entirely, so everything looks fine there. Test as an authenticated user.

### Connection

Supabase's transaction pooler (port 6543) does not support prepared statements. Any
`postgres()` client must pass `prepare: false` or you get errors unrelated to the real cause.

---

## Catalog data

`data/venues.csv` and `data/resorts.csv` are the **source of truth**. They are git-tracked,
diffable, and reviewable; the database is downstream of them.

- **Never populate rows from memory or from an LLM.** Models invent restaurants that closed years
  ago and coordinates that are plausible but wrong. Open disneyworld.com, read it, type the row.
- **`verified_on` is a gate.** `db:import` skips any row without it. Unverified data cannot reach
  the app.
- **Controlled vocabularies live in `scripts/vocabulary.mjs`** — one copy, shared by the validator
  and the importer. `data/README.md` is the human-readable mirror; update both together.
- **Imports upsert, never delete.** A truncated CSV cannot wipe the catalog. Rows in the database
  with no CSV match are reported as orphans for you to remove deliberately.

Some fields are functionally load-bearing rather than descriptive: the eleven World Showcase
pavilion slugs drive Drinking/Snacking Around the World, and `transport` on resorts drives the
Transportation Challenge. Wrong value, unearnable badge.

---

## Before saying something works

- `npm run typecheck` passes.
- `npm run db:check` passes, if the schema changed.
- `npm run validate:data` passes, if the CSVs changed.
- Checked on a real device in **both** light and dark.
- No color literals added outside `theme.ts`.
- No credentials in any committed file — real values go in `.env`, which is gitignored.
