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
5. **`src/constants/theme.ts` is the source of truth; `web/app/globals.css` mirrors it.** Change
   a colour in both, then run `npm run check:tokens` — it fails on any mismatch. They have
   drifted once already, by a few percent lightness on two surfaces: invisible in isolation,
   annoying to reconcile later.

### What each group is for

| Group | Use for | Do not use for |
|---|---|---|
| `text` / `textSecondary` / `textFaint` | Copy hierarchy | Decoration |
| `background` / `backgroundElement` / `backgroundSelected` | Screen ground, cards, pressed rows | Text |
| `border` / `borderSoft` | Container edges / internal rules | Anything filled |
| `accent` / `accentPressed` / `onAccent` | Primary actions, links | Decoration, large fills |
| `gold` / `goldSurface` / `onGold` | **Achievement unlocks, premium, and the wordmark** | General emphasis |
| `success` / `warning` / `danger` | State and outcomes | Branding |
| `brandTeal` … `brandViolet` | Sequential/categorical things | Body text, semantic state |

**Text on a gold fill uses `onGold`, never `onAccent` and never a literal.**
Light-mode gold is dark (`#B07818`) and dark-mode gold is light (`#E5B45F`), so the ink has to
invert with the scheme. Three places had `#23133A` hardcoded, which was correct on dark-mode gold
and roughly 2.3:1 — unreadable — on light-mode gold. That is exactly the bug the no-literals rule
exists to prevent, and it shipped anyway because nobody opened those screens in light mode.

**`gold` is load-bearing.** It marks reward. If it starts appearing as a general highlight, an
unlocked achievement stops feeling like anything. Guard it.

The wordmark is the one sanctioned exception: `Magical` is gold everywhere it appears. That is a
brand use, not a reward use, and it is a fixed lockup rather than something applied case by case
— so it does not erode the signal the way an ad-hoc gold highlight would.

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
| `agical` | Pacifico | 1.111x |
| `Tracker` | Figtree semibold | base |

It is defined once in `web/components/wordmark.tsx` and used everywhere it
appears — never hand-roll it, or the header and footer drift apart.

The **1.111 is measured, not eyeballed**. At an equal font-size Pacifico's
lowercase `a` and `c` render 95 units tall against Figtree's 106 and 105, so
matching font-sizes leaves the script visibly short. Scaling by 1.111 lines the
bowls up to within a pixel. The `l` and the ascenders still overshoot, which is
correct for a script.

If either face is ever swapped, **re-measure** rather than reusing the number.
Sizes are written in `em` off the wrapper so the ratios stay readable.

The lockup exists twice — `web/components/wordmark.tsx` and
`src/components/wordmark.tsx` — because React Native has no `em` unit, so the
ratios are multiplied against a base size instead of inherited. **They are the
same mark: change a ratio in one and you must change it in the other.**

The app loads all three faces at runtime with `useFonts`, not through the
`expo-font` config plugin. The plugin needs a prebuild, so plugin-bundled fonts
are simply absent in Expo Go and the wordmark silently falls back to the system
face. **Figtree is bundled into the app for `Tracker` alone** — the 1.111 is
measured against Figtree's letterforms, so substituting SF Pro there breaks the
alignment the number exists to fix.

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

### Expo CLI reaches into web/

Running `npx expo install` or similar from the repo root can rewrite
`web/tsconfig.json` — it finds the file, assumes it belongs to an Expo project, adds
`"extends": "expo/tsconfig.base"`, and reformats the JSON.

**That change is always wrong.** `web/` is Next.js and must not inherit Expo's compiler
settings. It does not break the build, which is exactly why it is easy to commit by accident.

If `git status` shows `web/tsconfig.json` modified after an expo command you did not aim at the
website, just `git checkout -- web/tsconfig.json`.

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

`typedRoutes` is on, so hrefs are typechecked against `.expo/types/router.d.ts`.

**That file is generated by `expo start`, and the home route's canonical path has changed more
than once** — it was `/index` while `(tabs)` was the only group, and is `/` now that sibling
routes exist. Never guess it. When a valid-looking href fails to typecheck, read the union in
the generated file.

Deleting `.expo/types` makes `tsc` pass by removing enforcement entirely, so a green typecheck
right after a clean means nothing until the dev server has run once.

Prefer the object form for anything with params — `router.push({ pathname: '/venue/[id]',
params: { id } })` — which survives these regenerations and avoids hand-encoding query strings.

### The tab bar sizes itself unless told not to

`minimizeBehavior` defaults to `automatic`, which on iOS 26 shrinks the tab bar to a pill on
scroll-down and expands it on scroll-up. **Scroll position is per-tab**, so switching from a
scrolled list to an unscrolled screen lands you on a tab bar of a different height — which reads
as the tabs being inconsistently sized rather than as a scroll effect. `minimizeBehavior="never"`
pins it.

Give `labelStyle` an explicit `fontSize` and `fontWeight` for **both** `default` and `selected`,
differing only in colour. Leave them unset and the platform may pick a different face for the
selected item, so that label — and anything drawn around it — measures differently from its
neighbours.

Several NativeTabs props are silently inert on the platform you are probably testing:
`indicatorColor`, `rippleColor`, `disableIndicator` and `labelVisibilityMode` are **Android/web
only**, and on iOS `backgroundColor`, `blurEffect` and `shadowColor` apply to **iOS 18 and
earlier only** — iOS 26 draws liquid glass and ignores them. Check `@platform` in
`node_modules/expo-router/build/native-tabs/types.d.ts` before assuming a prop does anything.

Not every SF Symbol has a `.fill` twin. `fork.knife` and `rosette` do not, so a tab using one
cannot thicken on selection while its neighbours do. Prefer a glyph that fills — `medal` /
`medal.fill` over `rosette` — unless the non-filling one is clearly the better symbol.

---

## App data layer

**Every read of catalog data goes through a hook in `src/hooks/`.** No screen imports
`src/lib/supabase.ts` directly.

That indirection is the whole point: today `useVenues()` fetches from Supabase, and when the
offline layer lands it becomes a read from on-device SQLite with background sync. Park wifi is
bad enough that logging a meal must not depend on having bars. If screens query Supabase
directly, that swap means rewriting every screen instead of one hook.

`process.env.EXPO_PUBLIC_*` must be written as **static dot notation**. Metro substitutes these
at build time by matching the literal text, so `process.env['EXPO_PUBLIC_…']` or destructuring
silently yields `undefined`. Editing `.env` also needs a full app reload, not just a refresh.

**Visits live in on-device SQLite first** (`src/lib/local-db.ts`), and sync to Supabase once
accounts exist. Guest mode is not a shortcut: forcing signup before anyone can log anything is
the biggest install-to-active killer, and a write that needs the network fails in exactly the
dead zones where people want to log a meal. Every row carries `synced_at`, null until it reaches
the server, so sync is "send everything where synced_at is null" rather than a guess.

**`useVisits` is a provider, not a plain hook.** Each `useState` call creates its own state, so a
per-screen hook means the log-visit modal saves, refreshes its private copy, and every screen
behind it keeps showing stale data. One store, every screen subscribed.

**Never render a stored value directly.** The catalog stores lowercase, kebab-case,
pipe-separated values because filters and the achievement engine need them that way — `mexico`,
`american|seafood`, `galaxys-edge`. Everything display-facing goes through `src/lib/labels.ts`
(`titleCase`, `formatCuisine`, `formatList`, `formatSubArea`), so a fix lands once instead of in
every screen that happens to show the field. Pipes become commas; pipes are storage, not UI.

**Large challenges are tiered** — Bronze 25%, Silver 50%, Gold 75%, Platinum 100% — because "4
of 61" reads as hopeless where "16 more for Silver" reads as a next step. Pavilion challenges
stay all-or-nothing: eleven countries is a small complete set, and nobody claims a partial
Drinking Around the World. Tier medal colours are literal, not theme tokens — bronze is bronze
in both themes.

**Passport denominators have two exclusions, and both exist so 100% stays reachable.** Events are
out — a seasonal dessert party must not make a park uncompletable for someone who visits in June.
Permanently-closed venues are out — you cannot eat somewhere that no longer exists. Resort
coverage counts only `ownership = 'disney-owned'`: Shades of Green is restricted to US military
eligibility, and partner hotels are a different product.

**Pavilion challenges count pavilions covered, not venues visited.** A drink at either Mexico bar
completes Mexico. `require: all` over the tagged venues would demand all 47 bars.

Filtering and search happen **in memory**. The catalog is ~400 rows and already loaded, so a
round trip per keystroke would be slower and would break offline.

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
- **The CSVs are the only source of truth. `catalog-entry.xlsx` is generated and gitignored.**
  Rebuild it with `npm run data:workbook` at the *start* of every editing session — it reads the
  current CSVs, so it picks up anything changed since the last export. Editing a stale workbook
  and downloading it silently reverts those changes.
- **Controlled vocabularies live in `scripts/vocabulary.mjs`** — one copy, shared by the validator
  and the importer. `data/README.md` is the human-readable mirror; update both together.
- **Imports upsert, never delete.** A truncated CSV cannot wipe the catalog. Rows in the database
  with no CSV match are reported as orphans for you to remove deliberately.

**Catalog scope is decided — do not widen it without being asked.** A venue belongs in
`venues.csv` if a non-guest can book a table there, regardless of who owns the building;
guest-only pool bars and club lounges are out. `resorts.csv` is Disney-owned resorts plus the
Swan, Dolphin and Swan Reserve, and nothing off Walt Disney World property — the Good Neighbor
programme is explicitly out of scope. Adding a resort adds it to the passport denominator and
makes 100% harder for every user, which is why Shades of Green (US military eligibility only)
must never be added without an `is_disney_owned` flag to exclude it from coverage. Full reasoning
in `data/README.md`.

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
