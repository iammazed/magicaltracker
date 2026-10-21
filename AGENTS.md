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

**Text on a ramp fill uses `onAccent`, and the reason is measured.** The rule here used to say
"white only on the ramp", which is true of the LIGHT ramp and backwards for the dark one — the
dark values are lightened ~18%, so white on them lands at 2.5–3.9:1 and fails everywhere:

| | on white | on `#052322` |
|---|---|---|
| Light ramp | **4.8 – 13.3** | 1.2 – 3.5 |
| Dark ramp | 2.5 – 3.9 | **4.2 – 6.6** |

`onAccent` is white in light mode and `#052322` in dark, which is exactly the column that passes
in each — so use it for any text sitting on a ramp colour, never a white literal. `brandIndigo`
in dark mode is the thinnest at 4.21:1, so avoid long body copy on a ramp fill in either scheme.

On the SkyCard gradient the opposite holds: it is dark in *both* schemes, so white and gold
literals are correct there and `onAccent` would invert and vanish.

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

### Pushing to a tab route mounts a SECOND copy of the tab navigator

`router.push({ pathname: '/dining', params: { addToTrip } })` from a screen stacked over the
tabs does not switch the existing tab. Traced through `getNavigationAction.js`:
`findDivergentState` compares the target against the root stack's *focused* route, which is the
pushed screen, so divergence is detected at the root; `navigationState.type === 'stack'` leaves
the action as `PUSH`; and `singular` comes from `options.dangerouslySingular`, which `push` never
sets. So the root stack becomes `[(tabs), trip/[id], (tabs)]` — a whole second tab navigator,
with all four screens remounted.

It is contained rather than harmful: the original tab keeps its own params and `back()` destroys
the copy. But a route param outlives a tab change, so inside that copy you can leave Dining, come
back, and still be in add-to-trip mode with no explanation and no back button — tab screens run
under `headerShown: false`.

**A mode held in a route param must be abandoned in REACT STATE, never by clearing the param.**
`router.setParams` mutates the navigation state, mutating navigation state emits a `state`
event, and the handler for that event was the thing calling `setParams` — an infinite loop that
surfaced as "Maximum update depth exceeded" pointing at `app-tabs.tsx`, which is only where the
re-render storm landed. Recording it in component state cannot emit a navigation event, so the
handler cannot re-enter itself, and once the flag is set the effect tears its own listener down.

The listener still has to watch the TAB NAVIGATOR's focused route, not the screen's own focus. Pushing the filter
sheet blurs the screen without changing which tab is selected, so a focus-based check would drop
you out of the task every time you opened filters. Compare against `useRoute().name` rather than a
hardcoded route name, and do not capture it at mount — a tab navigator can mount a screen while a
different tab is focused.

The real fix is for a task not to live in a tab at all. See the note in the add-to-trip flow.

### The back button needs `headerBackButtonDisplayMode: 'minimal'`

iOS labels the back button with the PREVIOUS screen's title. The previous screen is always the
tab group, which has no title, so navigation fell back to the route name and every detail screen
showed **"‹ (tabs)"**. Giving `(tabs)` a title does not fix it either: one title has to serve
four tabs, so opening a restaurant from Dining would read "‹ Home". A bare chevron is correct and
is what Apple itself falls back to when a label will not fit. It is set once in the root Stack's
`screenOptions`.

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

**Bottom spacing comes from `useBottomInset()`, never a constant.** A hardcoded
`BottomTabInset = 50` lived in `theme.ts` and was wrong: on iOS the tab bar occupies its own
~49pt PLUS the bottom safe area, which is 34pt on a notched iPhone, 0 on an SE, and different
again on Android. Scroll padding survived the error by accident because it added `Spacing.five`
on top and landed near the right number; the fixed "Done" footer on the add-to-trip screen had no
such slack and sat **two thirds behind the tab bar**, where it could not be scrolled into view
because a fixed footer does not scroll. Anything positioned against the bottom of a tab screen —
a footer, an absolutely-positioned card, scroll padding — reads the hook.

**A screen in a temporary mode needs two ways out.** The tab screens run under
`headerShown: false`, so there is no navigation bar and no back button; when the add-to-trip
footer was unreachable, there was no other exit at all. `SkyHeader` takes an optional top-right
`action` for exactly this.

**`disableAutomaticContentInsets` belongs on every Trigger.** iOS applies its automatic inset and
its scroll-edge appearance to the FIRST scroll view in each screen — and on Dining and Resorts
that is the horizontal filter-chip strip, not the list under it. So the bar tracked a strip that
never scrolls vertically on two tabs and the real content on the other two, which is why it moved
differently depending on which tab you landed on. Every screen pads its own bottom by
`useBottomInset()` already, so taking the automatic behaviour away costs nothing. It is a
per-Trigger prop; setting it on `NativeTabs` does not typecheck.

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

**Every read of catalog data goes through a hook in `src/hooks/`.** `src/lib/supabase.ts` has
exactly one importer — `use-catalog.tsx` — and nothing else may import it.

That indirection paid for itself: `useVenues()` fetched from Supabase, and swapping it to a read
from on-device SQLite touched one file instead of every screen.

**The catalog is local-first, in three layers.** `src/data/catalog.json` ships inside the JS
bundle, `onInit` seeds SQLite from it before the first render, and a background fetch from
Supabase overwrites those rows at most once a day. So a cold install in a dead zone has all 394
venues, and a venue that closes between App Store releases can still be corrected without
shipping a build.

The bundle version is a **content hash of the CSVs**, which is the floor. A new app release
carries a new bundle, re-seeds, and discards whatever the last remote fetch left — correct,
because the bundle is generated from the same CSVs the database is imported from. Regenerate it
with `npm run data:bundle`; `prestart` and `eas-build-post-install` both run it, so a CSV edit
cannot reach a build unseen.

**Every catalog read is scoped to `ACTIVE_DESTINATION`.** `destination_id` has been on these
rows since the first migration precisely so Disneyland can land inside this app, and the
on-device catalog dropped it for a while — meaning both coasts would have shown in one list and
the passport would have demanded you eat at Blue Bayou to finish Walt Disney World. It now runs
the whole path: CSV, bundle, SQLite, the remote refresh columns, and the filters in `useVenues`,
`useResorts` and `useAreas`. Adding a destination is a data import plus a picker, not a change
to every screen.

**The catalog tables are NOT on the migration ladder, and putting them there is what broke
them.** Adding `destination_id` shipped green — typecheck, the seed test, `expo export`, all
fine — and then killed `onInit` on every device that already had the app:

```
SQLiteErrorException: table catalog_venues has no column named destination_id
```

Two mistakes compounded. `CATALOG_DDL` ran in a single `version < 4` ladder step, so a device
already at 5 never looked at it again; and `CREATE TABLE IF NOT EXISTS` is **a no-op on a table
that already exists**, including one whose DDL has since grown a column — so even re-running it
would have changed nothing. A fresh install got the new column, everybody else got a black screen
before the first render.

`syncCatalogSchema` owns them instead. It compares a **fingerprint of the DDL text**, and when it
differs it drops all five `catalog_` tables and rebuilds them. Dropping is safe here and nowhere
else: they are a disposable replica of data that ships in the app bundle, and losing them costs
one re-seed, which fires automatically because `bundle_version` lives in the dropped
`catalog_meta`. Visits, stays and trips are different tables and are never touched.

A fingerprint rather than a version number precisely because the bug *was* somebody changing the
schema and not bumping anything. A number you must remember to bump is a number you will forget.

**Only `catalog_meta` is created before the fingerprint is read — never the full DDL.** Running
`CATALOG_DDL` against a stale database throws, because `CREATE INDEX … ON catalog_venues
(destination_id)` is not a no-op when the table lacks that column. The one statement that looks
like a safe way to ensure the tables exist is the one that fails first, on exactly the devices
being repaired. That was a real bug in the first version of the fix, caught by the test below
rather than by a device.

**`npm run check:catalog` is the guard, and it tests the UPGRADE path.** The seed test built a
fresh in-memory database, where `IF NOT EXISTS` always yields the current schema — which is why
it passed throughout. A fresh install and an upgrade are different code paths, and the one your
users run is not the one that is easy to test. The check starts from the old schema, asserts the
reported crash reproduces, upgrades, and then asserts the user's visits survived.

**A failed background refresh is not a load error.** In a local-first app those are different
conditions, and conflating them is what put a full-page "Could not load resorts" over 35 resorts
the app was already holding — and, through `useResort`, over every resort detail screen too. The
hooks now surface `refreshError` only when `data.length === 0`, so a screen that forgets the
check cannot reintroduce it: there is no error to hand it. Screens report "nothing to show";
`useCatalog()` reports staleness, and Settings is where that belongs.

**A successful refresh that returns zero rows is treated as an error, not as an instruction.**
An empty result means something broke upstream — an RLS policy, a bad filter — and wiping every
restaurant off someone's device in response to it would turn a server mistake into a dead app.

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

## Auth

**Guest mode is the default and stays first-class.** Everything works with no account. Signing in
buys exactly one thing — the record surviving a reinstall or reaching a second device — and the
screen says so rather than overselling it. `session === null` is a normal state, never a gate.

**Signing out does not touch local SQLite.** It is not "delete my trips": the rows stay on the
device exactly as a guest's would, and sync picks them up on the next sign-in.

**Apple hands over the user's name on the FIRST authorization only.** Every later sign-in returns
null for it, and there is no way to ask again short of the user revoking the app in their Apple
ID settings. It is persisted to user metadata inside `signInWithApple` or it is gone forever.

**The redirect allow list is glob-matched, and a bare scheme does not match a path.**
`magicaltracker://` does NOT match `magicaltracker://auth`, which is what the app actually sends
— separators are `.` and `/`, so the entry needs a wildcard: **`magicaltracker://**`**. An
unlisted `redirectTo` silently falls back to the Site URL, so the symptom is a magic link that
opens the website instead of the app and hands the session tokens to a page that cannot use
them. It looks like a deep-link bug and is a dashboard typo.

**"Confirm email" must be off on the Email provider.** With it on, a new address gets the
*Confirm signup* template rather than *Magic Link* — the giveaway is an email headed "Confirm
email address". A magic link is inherently confirming; requiring both means two round trips to
sign in once.

**A deep link's path is a ROUTE, so one has to exist for it.** `magicaltracker://auth` was
matched against the route tree, found nothing, and rendered "Unmatched Route" — on top of a
session that `use-auth` had already set successfully. The session worked; the user was stranded.
`src/app/auth.tsx` is that route: it handles no tokens itself, it waits for the provider's result
and redirects. It also needs its `<Stack.Screen>` in the root layout like any other non-tab
screen.

**The magic link's tokens arrive in the URL fragment, after `#`.** `Linking.parse` only reads the
query string, so the fragment is split by hand — reading `queryParams` returns nothing and looks
exactly like a broken link. Both entry points matter: `getInitialURL` for a link that launched
the app cold, and the `url` listener for one that arrived while it was open. Handling only the
second is the bug where tapping the email from a closed app does nothing.

A *failed* link comes back as a fragment too, carrying `error_description` instead of tokens.
Without a branch for it the app does nothing at all, which from the user's side is
indistinguishable from the link being broken — so expired and already-used links are surfaced.

**Sessions persist through AsyncStorage, not `expo-secure-store`.** SecureStore caps a value at
2048 bytes and a Supabase session routinely exceeds that, so using it means a chunking adapter
whose failure mode is a silent logout. The cost is the refresh token living in the app sandbox
rather than the Keychain — acceptable for a trip log, worth revisiting if this ever holds
anything more sensitive.

**Auto-refresh is tied to `AppState`.** Supabase's timer otherwise keeps running while
backgrounded, firing refreshes against a dead network as iOS suspends the process.

**Native Sign in with Apple needs no Services ID or secret key** — only the bundle ID in
Supabase's Apple provider Client IDs, plus `ios.usesAppleSignIn`. The OAuth settings are for web
flows this app does not use.

---

## Account deletion

**Required by App Store review since 2022** for any app that creates accounts, and a guaranteed
rejection without it. It lives on the account screen behind two confirmations.

`public.delete_own_account()` is SECURITY DEFINER because removing a row from `auth.users` needs
privileges `authenticated` does not have. Four things make that safe, and all four matter:

- `set search_path = ''`, so a caller who can create objects cannot shadow an unqualified name
  and have it run as `postgres`. Every relation in the body is schema-qualified.
- The ownership check is **in the body**, not in a policy — a definer function bypasses RLS, so
  `auth.uid()` is the only id it can ever delete, and a null caller raises instead.
- `revoke` from `public` and `anon`, `grant` to `authenticated` only.
- Every user table cascades from `auth.users`, so one statement takes all of it.

Verified over the wire: an anonymous call gets `401 permission denied for function`, refused at
the privilege layer before the body runs.

**Deleting the account does not touch local SQLite.** "Delete my account" and "erase this phone"
are different requests, and silently doing the second would destroy the only copy of a log
someone may have spent years building. The confirmation says so explicitly.

---

## Sync

**On**, as of the end-to-end run on a real device — guest adoption, reinstall recovery, and two
accounts on one phone staying separate in both directions. The `__DEV__` toggle in Settings
remains for turning it back off while debugging. It is the one feature whose bug destroys data rather than
displaying something wrong, which is why it shipped behind a flag and stayed there until a real
device had exercised every account transition.

**Device-generated ids are what make it safe.** Both sides key on the same UUID, so every write
is an upsert and the whole cycle is idempotent. There is no id mapping to get wrong and no "did
my last request land?" to answer — a lost response just means the next push re-sends the same
rows to the same keys.

**Push order is a foreign key constraint in disguise.** `trip_plans` references `trips`, each
table is its own request, and nothing but the order of calls in `push()` enforces that.

**`synced_at` is marked only after the server confirms.** A crash between the upsert and the
UPDATE re-sends those rows next time, which is a no-op. The reverse order would lose them
silently.

**Pull is insert-only and never overwrites.** The device is currently the only writer, so taking
the server's copy of a row that already exists locally would discard an edit made offline —
exactly the failure this feature exists to prevent. Real two-way reconciliation needs per-field
timestamps and a conflict rule, and only earns that complexity once a second device can write.

**`activeTrip` is ONE trip, so something else has to list the rest.** It returns the current
trip, else the earliest upcoming — and for a while nothing in the app listed trips at all, so
planning a second one that started later than the first appeared to do nothing. The home screen's
"Your trips" section is the only place they exist; upcoming in date order, then past
most-recent-first, because a finished trip is a record and an upcoming one is a plan.

**Sync runs on sign-in and on returning to the foreground.** Not on a timer — a trip log changes
a few times a day and a background poll spends battery in a park where signal is already bad.
Foreground is the honest trigger: log a meal, pocket the phone, and it uploads when you next pick
it up. This block's comment claimed foreground syncing for a while before it did it, which meant
"Everything on this phone is backed up" became false the moment anything was logged and stayed
false until the next launch.

**Push before pull.** On a fresh sign-in everything predates the account, so pulling first is a
round trip that returns nothing — and if the push then failed, the user would be looking at an
account that claims to be backed up and holds nothing.

**"Has this device ever synced?" is what separates a guest from somebody else's phone**, and
keying on the stored owner id alone was not enough — a device that synced before that id existed
looked exactly like a fresh guest, so the previous account's rows stayed in SQLite and showed as
the new user's. That failed in real testing, not in theory.

The rule: if anything on the device has a non-null `synced_at` and the account signing in is not
the recorded owner, **every** local user row is cleared. The wipe deliberately includes unsynced
rows — losing a row the previous user never uploaded beats handing it to whoever signs in next,
and `signOut` flushing first (warning when it cannot) is what makes that acceptable. A device
where nothing has ever synced is a true guest device and gets adopted whole.

**The device records which account owns its rows** (`sync_owner_id` in `app_settings`), and that
is what makes two accounts on one phone safe. Local tables carry no user column, so without it
the previous account's rows simply stay in SQLite and start appearing as the new user's — and
the moment one is edited, `synced_at` clears and it is pushed into the wrong account. On a user
switch the local user tables are wiped, which is safe only because those rows are already on the
server under their real owner.

Which is why **signing out flushes first.** Anything still pending is pushed before the session
ends, and if that fails the user is told rather than quietly losing it when the next person
signs in. Deleting an account calls `releaseOwnership()`, so the rows become genuinely ownerless
again and the next sign-in adopts rather than wipes them.

**There is no separate "claim" step.** An unsynced row has no owner, and the push stamps it with
whoever is signed in — so guest-to-account is just the first sync. `claimed` is counted before
the push only so the UI can say how many were adopted.

**Photos do not sync, and the UI says so.** They are `file:///var/mobile/...` URIs that mean
nothing on another device. Pushing the paths would give a second device broken images while
claiming they were backed up, which is worse than openly not having them.

---

## Premium

**Everything gated reads `isPremium` from `src/hooks/use-premium.tsx`, and nothing reads a store
SDK.** When RevenueCat is wired up, only `resolveEntitlement` in that file changes — every gate,
trigger and badge stays as written. Until then the entitlement is false for everyone, with a
`__DEV__`-only override stored in `app_settings`; `setSimulated` refuses to act in a release
build, because shipping a switch that unlocks premium is the business model behind a tap.

**Never paywall data entry.** Unlimited check-offs, unlimited ratings, the whole catalog, search,
the map and the passport percentages are free, permanently. Every rating a free user logs is what
makes a Top 10, trending and recommendations possible later, so charging for logging would starve
the thing that eventually makes premium worth buying. Premium sells depth and convenience:
notes, dishes, photos, trips past the first, near-me, export.

**Gate with `PremiumGate`, which shows what is behind the gate rather than hiding it.** A feature
nobody can see is a feature nobody buys, and a field that silently vanishes reads as a bug while a
labelled locked one reads as an upgrade. The paywall is always triggered contextually and opens
naming the feature that sent you there — never as a launch interstitial.

**Gate and guard.** The screens gate the UI, and the save path checks `isPremium` again before
writing a premium column. If a gate ever regressed, a free user still could not write the field.

**Premium content already written stays readable after a lapse.** The venue screen renders notes,
dishes and photos whenever they exist rather than behind a second check — taking away something
someone wrote is a different act from declining to let them write more.

Three things on the paywall are not optional and Apple rejects for each: a visible **Restore
Purchases** button, **price and renewal terms** at the purchase point rather than behind a link,
and reachable **terms and privacy** links. In-app **account deletion** becomes mandatory the
moment accounts exist.

### RevenueCat

**Nothing outside `src/lib/purchases.ts` imports `react-native-purchases`**, the same rule as
`supabase` and `use-catalog`. `use-premium` asks whether someone is entitled, the paywall asks
what they can buy, and neither knows who answers. That indirection is why wiring the real store
changed `resolveEntitlement` from a stub to one identifier and touched no gate anywhere.

**There are TWO API key variables, and that is a safety decision rather than a style one.** A
Test Store key (`test_…`) in a release build does not degrade — **the SDK shows an alert and
crashes the app.** With one variable holding a different value per environment, a single wrong
value in the EAS production environment ships a guaranteed launch crash to every user, and
nothing in the build output would say so. With `EXPO_PUBLIC_REVENUECAT_KEY_TEST` and
`EXPO_PUBLIC_REVENUECAT_KEY_APPLE`, a release build cannot select the test key, because the line
that chooses reads only the Apple one outside `__DEV__`. The remaining hole — somebody pasting a
`test_` key into the Apple variable — is caught at runtime and refused, because premium being
unavailable is a bad day and a launch crash is a one-star review.

**Every failure resolves to "not entitled".** Network down, SDK unconfigured, Expo Go: all false.
A paying customer who briefly sees a lock recovers on the next launch; premium handed out because
a call failed does not come back.

**The paywall reads `offerings.current`, never a hardcoded offering identifier.** `current` is
whichever offering is marked Default in the dashboard, so pricing, packaging, targeting and
experiments change without an App Store release. Looking up an identifier in code throws away
most of the reason for using RevenueCat at all.

**Prices come from `package.product.priceString`.** The paywall used to hold `'$24.99'` as a
literal, which shows dollars to a British customer who is then charged pounds — a rejection, and
wrong regardless. The literals survive only as `fallbackPrice`, rendered when the store cannot be
reached at all so the layout stays reviewable in Expo Go.

**`linkUser` ties purchases to the account.** Without it a guest's purchase lives under an
anonymous RevenueCat id, and signing in on a second phone finds nothing — the subscription they
paid for appears to have vanished. `logIn` aliases the anonymous id onto the real one, so buying
before signing up survives signing up. It runs BEFORE the entitlement is read, or the answer
belongs to whoever was signed in a moment ago.

**`logOut` throws when the current user is already anonymous**, which is the normal state on a
guest launch — so it is guarded by `isAnonymous()`. Calling it blind reports an error to Sentry
on most app starts and buries the real ones.

`PremiumProvider` depends on `user?.id`, a primitive, never the `user` object: an effect keyed on
a fresh object reference re-runs forever, and this codebase has already paid for that once.

**Permission strings are reviewed by a human.** `app.json` spells out what is collected, why, and
that it is optional, for photos and location. Location is foreground-only and taken as a single
reading at the point of use — background location is a second, much harder permission the app has
no reason to ask for.

---

## Dates

**`SyncProvider` is the innermost data provider**, below both `VisitsProvider` and
`TripsProvider`, because it has to refresh BOTH after a pull or a wipe. Mounted above
`TripsProvider` it could only refresh visits — so pulled trips were written to SQLite and never
displayed, and a wiped account's trips stayed on screen under the next user. Both looked like
sync failures when the database was in fact correct, which cost two rounds of testing.

**Never render a raw ISO date.** `2026-11-02 – 2026-11-06` reads badly for a specific reason:
ISO dates are full of hyphens, so a hyphen between two of them looks like more date rather than
a separator. `formatRange` collapses whatever the ends share — `Nov 2–6, 2026`,
`Oct 30 – Nov 3, 2026`, `Dec 30, 2026 – Jan 2, 2027` — and `formatDate` handles a date
standing alone.

**Never ask anyone to type a date.** `DateField` is a box the size of a text field that opens a
small calendar when tapped, and it is used for EVERY date in the app — trip dates, visit dates,
resort check-in and check-out. It takes `minISO`, an optional `maxISO`, and `openOn` for the
month to show when empty: a picker floored at the park's 1971 opening would otherwise open in
1971 and need fifty years of paging, and `src/lib/calendar.ts` holds the arithmetic. The calendar is a
`Modal`, not an absolutely-positioned popover — a popover inside the home screen's ScrollView
would be clipped by it and would scroll away from the field it belongs to. A typed date is the one input where a mistake is
silent and consequential: `2027-04-31` does not exist, `2072-04-03` is a plausible slip, and a
countdown that is wrong rather than broken is a countdown nobody questions. A grid cannot produce
a date that does not exist.

**All grid arithmetic goes through `Date.UTC`.** `new Date('2027-04-03')` parses as midnight UTC
and renders in local time, so west of Greenwich every cell would render as the day before. Build
with `Date.UTC`, read back with `getUTC*`, and a date stays a date rather than becoming an
instant. The single exception is "today", which must be genuinely local — `todayISO()` in
`local-db.ts` — because someone planning at 11pm in Florida means today.

The month grid is **always six rows**, never five, so the card does not resize under your thumb
mid-tap as you page through months.

**The depart field's minimum is the arrive date**, so a trip that ends before it starts is simply
not offerable rather than being validated after the fact. Picking an arrival later than an
existing departure clears the departure instead of silently keeping a choice that would be
rejected at save time.

`src/lib/calendar.ts` is pure and has no React in it, so it is testable headlessly — leap years,
year boundaries, the DST change, and all 132 months of a decade checked contiguous. Compile it
with `npx tsc src/lib/calendar.ts --ignoreConfig --outDir <tmp>` and import the output rather than
regex-stripping the types, which breaks on union return types.

---

## Onboarding

**A card's heading goes inside the card.** A section label floating above a surface makes the
surface look like a form bolted on under someone else's heading, and it cost a whole gradient
card to the empty state repeating what the card beneath it already said. If a screen and a card
would both carry the same title, the card wins and the screen's goes.

**The planner renders on the twilight gradient, and that is structural rather than decorative.**
It is the one surface the brand owns, shared with the countdown and the website hero, and a
planner that looks like a settings form is one nobody is excited to fill in. Everything on a
SkyCard is a colour literal — white, `#E5B45F` gold, or white at an explicit opacity — because
the gradient is dark in both schemes and theme tokens invert underneath it.

**Progress is shown by tinting, not only by a badge.** A visited venue row and a stayed resort row
carry a wash of their own area/tier colour at 0.10, so coverage is legible while scrolling rather
than only visible in the tick. Only the done rows get it — 366 tinted rows would be a wall, and
the done ones are the minority for a long time.

**`CatalogMap` knows nothing about venues or resorts.** Callers map their own rows to `MapPlace`
— id, name, coordinates, a `RampToken` tone, and two display lines — which is why Resorts got a
map for about thirty lines instead of a second copy of the file. The only real differences were
which colour map to index (`AreaTone` vs `TierTone`) and which strings go on the card, and both
are the caller's business. `SkySegment` is shared for the same reason: one copy means the
too-faint-to-read version of that control cannot come back on only one screen.

**Shared styles carry no `flex`.** `skyInput` had `flex: 1`, which is correct inside Dining's row
next to the Filters button and wrong as a direct child of the header's column, where it stretches
to fill the height instead of staying 48pt. Sizing is the layout's business; add `flex` at the
call site.

**List screens open with a `SkyHeader`.** Dining and Resorts were a black-on-grey title over a
grey search field, which is a settings screen. The twilight band gives them the surface the
planner and the countdown use, with the search field and the coverage bar inside it. The safe-area
inset goes INSIDE the gradient so the colour runs under the status bar instead of stopping in a
line beneath it, and only the bottom corners are rounded.

**To tint a surface in a theme colour, lay an absolutely-positioned fill at low opacity behind
the content** rather than computing an rgba. `AreaTone`/`TierTone` resolve to theme hexes, and a
wash View needs no colour maths and no new tokens. Used by the passport's area tiles and the
home screen's action and stat cards.

**The planner lives on the home screen, not behind a button.** Planning is the app's main job, so
it belongs on the first screen for the same reason Expedia and Trivago put the search box on
theirs. `TripPlanner` is defined once and rendered in both places it appears — inline on home and
in the `/new-trip` modal — because two copies of a form with a date range and a resort search in
it would drift within a week. It collapses to a header once a trip exists, since by then the
countdown is what someone opened the app for.

**The trip name is derived from the dates, not asked for.** "What do I call this trip?" is a
question nobody wants between choosing dates and seeing a countdown, and `April 2027` is what they
would have typed. It stays editable.

**The first-run pass is the retention play, not a nicety.** A new install gets "which of these
have you eaten at?" over two dozen well-known places, and thirty seconds later has a populated
passport, a percentage and usually a tier. The alternative is an empty grid and a "Log your first
visit" button.

**Those picks are computed, never typed.** `src/lib/onboarding-picks.ts` scores venues from flags
already verified in the catalog — signature, character dining, reservations, table service — with
a score floor and a per-area cap so the list spans the property. A hand-written list of famous
restaurants is exactly where a place that closed in 2019 gets in. It is a *recognisability proxy*
standing in for popularity data that does not exist yet; swap it for real counts when
`venue_stats` has them.

**Onboarding visits carry `date_exact = 0`.** Nobody remembers when they ate somewhere years ago,
so those rows get today's date as a sort key and every screen that would print it shows "date not
set" instead. Inventing a date the user later sees and does not recognise is worse than admitting
the gap.

**"Has onboarding run?" is stored, not inferred.** "Has any visit been logged?" looks like the
same question: someone who genuinely skipped would otherwise be asked again on every launch.

---

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

**Events are hidden unless asked for.** The 26 `venue_kind = 'event'` rows are ticketed parties
and festivals, not places you sit down to eat, so the default list excludes them and the Type
filter is the only way in. They are excluded from passport denominators for the same reason — a
seasonal dessert party must not make a park uncompletable for someone who visits in June.

**The eleven World Showcase pavilions are defined twice and must agree** —
`scripts/vocabulary.mjs` for the data tooling and `src/hooks/use-passport.ts` for the app.
`outpost` is a legal `sub_area` but is NOT one of the eleven. It was in the vocabulary list once,
and the result was the validator reporting Drinking Around the World as permanently uncompletable
because no bar would ever be tagged in Refreshment Outpost.

**Pavilion challenges count pavilions covered, not venues visited.** A drink at either Mexico bar
completes Mexico. `require: all` over the tagged venues would demand all 47 bars.

**The map is Apple Maps via `PROVIDER_DEFAULT`, and that is a choice, not a placeholder.** It
needs no API key and runs in Expo Go, so it works before the Apple Developer Program clears.
Styled Google Maps needs a key through a config plugin, which needs a development build, which
needs the paid account.

Two things about markers are load-bearing. `tracksViewChanges` must be `false` on any marker with
custom children, or the map re-renders every one of them continuously and visibly stutters — it
is only `true` for the selected pin, which genuinely needs one more frame. And
`react-native-maps` mounts every `<Marker>` child whether or not it is on screen, so
`src/lib/cluster.ts` culls to the viewport as well as clustering: without culling the deepest
zoom mounts all 366 pins at once. Together they keep the mounted count at roughly 14–57 instead
of 366.

Filtering and search happen **in memory**. The catalog is ~400 rows and already loaded, so a
round trip per keystroke would be slower and would break offline.

## Export

Every text field goes through the RFC 4180 quoting in `src/lib/export-csv.ts`, not just the ones
that look risky — a venue description with a comma is the normal case here. A value starting `=`,
`+`, `-` or `@` is prefixed with an apostrophe, because a spreadsheet will otherwise evaluate a
restaurant note as a formula. Exports are written to the cache directory, not documents: the file
exists to be handed to another app, and iOS reclaims it on its own.

---

## Crash reporting

Sentry, configured in `src/lib/sentry.ts`, which is the **first import in
`src/app/_layout.tsx`** — imports evaluate top-down, so that is what gets the SDK running before
`SQLiteProvider` starts migrating. A crash inside a migration is exactly the one nobody can
reproduce by hand, and initialising inside a component would be too late to see it.

**A render error caught by a boundary does not reach Sentry on its own.** React considers the
error handled the moment the boundary renders, so it never reaches the global `ErrorUtils`
handler the SDK hooks. This app has a custom `ErrorBoundary` in the root layout, which meant
every screen that threw would have shown "Something broke" to the one person who cannot fix it
and reported nothing to the one who can. `Sentry.wrapExpoRouterErrorBoundary` wraps it, keeps the
UI exactly as it was, and attaches the route name, path and params.

**The SDK is v8, deliberately against Expo's pin.** `npx expo install` resolves
`@sentry/react-native` to `~7.11.0` from `bundledNativeModules.json`, which was published two
weeks before Sentry v8 existed and still lists the deprecated `sentry-expo` beside it — it is
stale, not a judgement. The v7→v8 break is entirely native floors (iOS 15, Xcode 16.4, AGP 7.4,
Kotlin 1.8) and SDK 57 already requires iOS 16.4 and Xcode 26.4, so every floor is cleared and
the JS API is unchanged. `expo.install.exclude` in `package.json` is what stops `expo-doctor`
and `expo install --check` quietly pulling 7.11 back.

**`metro.config.js` exists only for Sentry.** There was none before; Metro used the default
implicitly. `getSentryExpoConfig` is that same default plus a Debug ID stamped into every bundle
and its source map, which is what matches a minified frame back to a line of TypeScript. Without
it a crash report is a wall of `index.bundle:1:84213`. Verify after a config change by grepping
an export for `sentry-dbid-`.

**`sendDefaultPii` is false, and that is a decision.** Sentry's own example sets it `true`, which
attaches the user's IP address and request headers to every event — making IP a collected
identifier that the Privacy Nutrition Label must declare and the privacy policy must describe. A
stack trace fixes a crash in a trip log; who was holding the phone does not.

**A missing DSN warns, it does not throw** — the opposite of `supabase.ts`, and for a reason. No
Supabase key means the app cannot work. No DSN means only that crashes go unrecorded, and taking
the app down over that would make the crash reporter the largest single source of crashes.

The real risk is the inverse, and it is the heartbeat workflow's `exit 0` again: **an empty
Sentry dashboard reads exactly like a stable app.** If `EXPO_PUBLIC_SENTRY_DSN` is missing from
an EAS environment, a release build reports nothing and nothing says so. Hence `SENTRY_ENABLED`,
and hence the line in Settings → About stating it in *every* build rather than only in dev.

**`SENTRY_AUTH_TOKEN` is build-time only.** It must never take an `EXPO_PUBLIC_` prefix and never
go in `app.json` — the plugin accepts an `authToken` prop and deletes it again precisely because
it would otherwise be written into the shipped package. Org and project slugs *do* appear in the
public manifest, which is fine: both are visible in any Sentry URL and the DSN encodes them
anyway.

Sentry needs a **new development build**; the config plugin adds native code, so Expo Go reports
JS errors over HTTP and nothing else. `isRunningInExpoGo()` gates the options that read native
frames, so Expo Go does not warn on every launch about a module that was never going to be there.

---

## Builds

The bundle identifier is **`com.greyfoxcreations.magicaltracker`** on both platforms, and it is
permanent — changing it after the first App Store submission means a new listing with no reviews
or ranking. Company prefix rather than product prefix because the LLC may own more than one app;
Disneyland and the other destinations are NOT one of them, they land inside this app via
`destination_id`.

`eas.json` uses `appVersionSource: "remote"`, which EAS has recommended since CLI 12. The build
numbers live on EAS servers and the values in `app.json` are ignored, so nothing needs committing
per build. `autoIncrement` is on for `production` only; it bumps `ios.buildNumber` and does not
touch the user-facing `version`, which you bump yourself for a release.

**EAS environments do not inherit from each other, and `.env` reaches none of them.** `.env` is
gitignored, so it exists only on this machine; EAS reads `development`, `preview` and
`production` as three separate buckets, and setting a variable in one puts it in exactly one.

That combination was nearly fatal once. The Supabase vars had been set in `development` and
nowhere else, which looked completely fine — every local run worked — while `preview` and
`production` held nothing at all. `supabase.ts` **throws at module scope** when its two vars are
missing, and `use-catalog` imports it into the root layout, so the first TestFlight or App Store
build would have thrown before rendering a single pixel. A crash on open is also an automatic
review rejection, so the failure would have arrived with a week of latency attached.

Nothing in the build output would have said so: a build with no env vars succeeds. **After adding
any `EXPO_PUBLIC_` variable, set it in all three environments and then `eas env:list` each one to
confirm** — the success line from `env:set` tells you a write happened, not that the other two
environments are complete.

Current state, which `eas env:list` should keep matching:

| Variable | development | preview | production | visibility |
|---|---|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | ✅ | ✅ | ✅ | sensitive |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | ✅ | ✅ | ✅ | sensitive |
| `EXPO_PUBLIC_SENTRY_DSN` | ✅ | ✅ | ✅ | plaintext |
| `SENTRY_AUTH_TOKEN` | — | ✅ | ✅ | **secret** |

`SENTRY_AUTH_TOKEN` is absent from `development` on purpose: a dev build serves JS from Metro, so
no source map is ever uploaded and the token has nothing to do. It is `secret` rather than
`sensitive` because secret values cannot be read back out of EAS at all — appropriate for a
credential that can write to the whole Sentry org, and unnecessary for a publishable key.

**Check what `eas init` writes into `app.json`.** It does not only add the project id — evaluating
the config also materialises whatever the installed config plugins ask for. It added
`android.permissions: [RECORD_AUDIO, ACCESS_COARSE_LOCATION, ACCESS_FINE_LOCATION]`, and
RECORD_AUDIO is wrong: `expo-image-picker`'s Android plugin requests it because the picker *can*
capture video with sound, which this app never does — `log-visit.tsx` passes
`mediaTypes: ['images']` and the plugin is configured with `cameraPermission: false`. A Play
Store listing claiming the app can record audio asks users to trust it for nothing. It is in
`android.blockedPermissions` now, which strips it from the merged manifest; the plugin re-adds it
on every prebuild, so the block has to stay even though the request is gone.

**Both location permissions are deliberate.** `ACCESS_COARSE_LOCATION` alone is 1–3 km on
Android, and Walt Disney World is about four miles across — EPCOT to Magic Kingdom is three — so
a coarse fix cannot order a restaurant list at all. `Accuracy.Balanced` needs FINE to be useful
here.

`ITSAppUsesNonExemptEncryption: false` is correct and worth keeping: the app uses only standard
HTTPS, which is exempt, and the key stops App Store Connect asking the export-compliance question
on every single upload.

**Expo Go and a development build are both usable.** Expo Go still runs everything built so far.
A development build is needed for anything native that Expo Go does not bundle: WidgetKit, Sign
in with Apple, push, RevenueCat, Sentry, styled Google Maps.

---

## Database

Schema lives in **two** files, and `drizzle.config.ts` must list both or the missing one is
silently absent from every generated migration:

| File | Holds |
|---|---|
| `src/db/schema.ts` | The read-mostly catalog. World-readable, written only by the import script |
| `src/db/user-schema.ts` | Per-user data, every row scoped to `auth.uid()` |

**User-data primary keys are generated on the device.** `local-db` already mints a UUID per row,
and reusing it server-side is what makes the push idempotent — an upsert on `id` that runs twice
is a no-op the second time. A server-generated key would force the client to keep a mapping, and
a retry after a dropped response would duplicate the row.

**The two foreign-key directions are deliberate.** `user_id` cascades from `auth.users`, so
in-app account deletion is one delete rather than a transaction that has to remember every
table. References into the catalog are `restrict`, so a catalog cleanup cannot silently erase
someone's history — "you may not delete a restaurant someone has eaten at" is the right thing to
tell whoever is tidying up.

Migrations are generated, never hand-written.

```
edit schema.ts → npm run db:generate → READ the generated SQL → npm run db:migrate
```

**The Free Plan pauses a project after ~7 days of inactivity, and restoring is manual.**
`.github/workflows/keep-supabase-awake.yml` pings daily to prevent it. Two things about it are
the point rather than the detail:

It **fails** when `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` are missing. It used to `exit 0`
with a friendly "not configured yet — skipping", so an unconfigured repo showed a column of
green ticks while pinging nothing. The project paused anyway, and the only symptom was a
screen that said "Could not load resorts". **A guard that turns "misconfigured" into "passing"
is worse than no guard** — it costs attention and returns nothing.

The secrets are **per Supabase project**. Recreate the project and the URL and key change, so the
workflow silently starts pinging a host that no longer exists. Re-add them, and use
"Run workflow" to prove it before trusting it.

`public.heartbeat` is the one table deliberately NOT in `src/db/schema.ts` — it is created by
`docs/supabase-heartbeat.sql` in the dashboard. It is pure ops, nothing reads it, and adding it
to the schema now would make `db:generate` emit a `CREATE TABLE` for a table that already
exists. Recorded here so the omission is a decision rather than a gap.

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
- `npm run check:catalog` passes, if `CATALOG_DDL` changed. A fresh install is not a test —
  this one upgrades an existing database, which is what every current user actually does.
- `npm run check:iap` passes, if a product identifier or the paywall changed. A mismatch has
  no symptom: the plan shows its fallback price, says "Not available here" when tapped, and the
  only sign is revenue that never arrives. It caught `premium_annual` vs `premium_yearly` on its
  very first run.
- Checked on a real device in **both** light and dark, **and on a device that already had the
  previous build installed.** A clean install exercises a different code path from an upgrade,
  and the upgrade path is the one with users on it.
- No color literals added outside `theme.ts`.
- No credentials in any committed file — real values go in `.env`, which is gitignored.
