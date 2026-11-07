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
| `accent` / `accentPressed` / `onAccent` | Primary action FILLS, borders, icons | Text |
| `accentText` | Any teal that is a WORD | Fills, borders, icons |
| `gold` / `goldSurface` / `onGold` / `goldText` | **Achievement unlocks, premium, and the wordmark** | General emphasis |
| `success` / `warning` / `danger` | State and outcomes | Branding |
| `brandTeal` … `brandViolet` | Sequential/categorical things | Body text, semantic state |

**Text on a gold fill uses `onGold`, never `onAccent` and never a literal.**
Light-mode gold is dark (`#B07818`) and dark-mode gold is light (`#E5B45F`), so the ink has to
invert with the scheme. Three places had `#23133A` hardcoded, which was correct on dark-mode gold
and roughly 2.3:1 — unreadable — on light-mode gold. That is exactly the bug the no-literals rule
exists to prevent, and it shipped anyway because nobody opened those screens in light mode.

**`gold` is a fill, `goldText` is ink, and they are not interchangeable.**
Light-mode `gold` (`#B07818`) is 3.79:1 on white — fine behind a 9px uppercase badge or under a
button label, below the 4.5:1 that 14px body text needs. `goldText` is the darkened, saturated
variant for gold *text on a background*; in dark mode both are `#E5B45F`, which is already
8.06:1, so the distinction only bites in light mode and is therefore easy to miss. Visited dining
rows and stayed-at resort rows name themselves in `goldText`.

`goldText` has now been darkened **twice** (`#9A6A0F` → `#865B0D`), and the second time is the
instructive one. The first value was picked against a bare card and cleared 4.5:1 there. It is
never on a bare card: a visited row's name sits on that row's area wash, which took it to 3.9:1.
**Check a colour against the surface it actually lands on, not the surface the token is named
after.** It now holds 4.81:1 over the heaviest wash.

**`accent` is a fill and `accentText` is ink, for exactly the same reason.** This pair is newer
and covers the much more common case: 41 sites were setting type in `accent`. White on an
`accent` fill is 4.78:1 and was left alone; `accent` AS type is 3.94:1 on the ground, so every
one of those 41 now reads `accentText`. `accent` stays the ramp's first stop, so a primary
button, a row stripe and an EPCOT chip remain the same teal — the deeper one appears only where
the teal has to be read as a word. A lowercase `color:` is the giveaway; `tintColor`,
`borderColor` and `backgroundColor` all want the fill and all need 3:1, not 4.5:1.

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

**Gold means finished, and it has to win the card it is on.** A completed challenge in the
passport was reported as "on dark mode it just changes to a different shade of blue/teal and can
be missed", which was accurate. The two loudest elements never moved on completion: the 5px spine
kept the area's brand colour, and the medal went to Platinum's own `#8FD6D2` — a pale teal. The
only things that did change were the fill, `#18272E` to `#2A2313` (two near-blacks), and a
hairline border. So `ChallengeCard` now overrides the stripe and the medal to `gold`, takes the
border to 2px, and swaps the tier tag for a filled COMPLETE pill.

Use `onGold` for ink on any gold fill, never the `#1B1205` the tier colours use. Light-mode gold
is itself dark (`#B07818`), so that ink lands around 2:1 and the mark all but disappears — the
reason `onGold` exists as a token in the first place.

**`textFaint` is for asides, not for content, and a tappable card must look tappable.** Both
halves of this come from one report — "when you click on the monorail bar crawl it still does not
show which bars" — about a screen that was already showing all ten of them.

The `ChallengeCard` printed every remaining name joined with commas: 221 characters for that
challenge, in `textFaint`. The information was complete and it read as a grey paragraph, so it
was not read at all. It now stops at three names and a count (`namePreview`) at
`textSecondary`, with the full checklist one tap away where there is room for it.

And the tap had no affordance — no chevron, no label, nothing separating a card that opens a
checklist from the static progress readouts stacked around it. Every card had been tappable since
the detail screen shipped and nothing said so, so the feature was reported missing twice by
people looking straight at the control that opens it. There is now a `See all 10 ›` row on the
card. When a feature is reported missing and the code is demonstrably correct, suspect the
affordance before suspecting delivery.

### Light mode is tinted paper, and the numbers were the argument

Reported as "it looks good, however it needs a lot more color, it has a lot of white", which was
measurable rather than a matter of taste. The old light scheme was a ground of `#F4F7F7` under
cards of pure `#FFFFFF`:

| | ground → card separation | ground chroma |
|---|---|---|
| light, before | **3.0 L\*** | **1.0** |
| dark | 8.8 L\* | 7.7 (card) |
| light, now | 6.1 L\* | 6.5 |

Two separate faults, and the first one explains the complaint better than the second. At 3.0 L\*
of separation **the cards did not read as cards** — ground and card were one white field with
hairlines on it, so "a lot of white" was the accurate description of a surface system that had
collapsed into a single surface. And at 1.0 chroma not one surface in the scheme carried any hue
at all, while dark mode's card is a visibly teal-navy `#18272E`. Only one of the two schemes ever
looked like this app, and it was not the one anybody had been checking.

**The fix was anchored to dark mode's numbers rather than to "warmer".** The ground is now
`#DBEDEA` — teal paper at hue 185, matching the brand rather than a grey that happens to be
green — and cards are `#F6FCFB`, a 98.5 L\* near-white, which keeps the contrast of white without
being white. `backgroundSelected` went deeper too (5.8 L\* below the ground): a pressed state on
tinted paper has to travel further than one on white before a thumb notices it.

**A surface change silently breaks colours that never moved.** Re-anchoring the ground put
`success` at 4.37:1 and `warning` at 4.27:1 — both had cleared 4.5:1 on the old ground, and
neither value had been touched. The paper under them moved. `borderSoft` landed at 1.03:1 on the
new ground, which is a hairline nobody can see, and the collapsed filter bar draws one straight
onto it. All three were adjusted. `textFaint` went the other way and ended up BETTER than before
(3.83:1 on a card against 3.32:1 on white), because it was re-anchored deliberately instead of
inherited.

So: **after changing any surface token, re-measure every ink token against it.** There is a
contrast harness in the scratchpad notes of the commit that did this; the cheap version is the
`/theme` screen in both schemes, which catches collapse but not a 4.37.

Two gaps are known and were left alone:

- **`onGold` on a `gold` fill is 3.82:1 in light mode and cannot be fixed from the ink side.**
  White is 3.82:1 and dark mode's violet ink is 4.23:1 on the same gold, because light-mode gold
  sits mid-range. The way out is to move `gold`, which is a brand colour, mirrored to the
  website, carrying "earned". Not something to change while fixing something else. The affected
  text is a tick and two 9pt badges. The comment in `theme.ts` claimed 4.75:1 for years; it was
  wrong, and it is now corrected in place.
- **Dark `borderSoft` is 1.07:1 on the dark card.** Pre-existing, in the scheme nobody has
  complained about.

### Colour has to be there before the user has done anything

The second half of the same report, and the more interesting half. Almost every colour in the app
was gated on state: the area wash appeared on *visited* rows, gold appeared on *earned* stamps,
the ramp appeared in *progress* fills. A new user has no state, so a new user saw grey.

**Washes are no longer gated.** Every dining row and every resort row carries its park or tier
colour at `opacity: 0.05`, with `0.10` for a visited one — so a list reads as EPCOT-teal and
Magic-Kingdom-blue from the first launch, and the visited rows keep the same margin over their
neighbours they had over a bare card. The comment this replaced said 366 tinted rows would be a
wall; what gating it actually produced was a wall of white, and a long list of restaurants is
most of what the app shows anybody on day one. `venue-row.tsx` and `resorts.tsx` must stay in
step on this — they diverged once before and it took a while to notice.

**Section headings are teal.** `Section` is on nearly every screen, two or three times, so one
token there puts the brand on Stats, a trip, Settings, a venue and a resort at once. A heading is
also the right thing to colour: the colour then says "heading" alongside the capitals and the
tracking rather than instead of them.

**A detail screen echoes the row that opened it.** `venue/[id]` and `resort/[id]` now head their
title block with the same 5pt stripe and 10% wash the list row had. The list was the only place
in the app that said in COLOUR which park a restaurant belongs to, so tapping one dropped that
colour and landed on a white page of facts.

A filled chip in the area's tone was the first attempt at that and was dropped: a fill needs
`onAccent` ink, which is 4.21:1 on dark-mode indigo. **A wash takes no ink of its own**, so the
heading keeps the 13:1 it already had, in both schemes. Prefer a wash to a fill when the thing
being coloured already contains type.

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
with all five screens remounted.

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

**Leaving the task navigates to an explicit destination, never `back()`.** A tester reported
"once you add a restaurant it takes you back to the main screen — I'd rather it take me back to
my trip itinerary, so I can keep adding restaurants." The end of this task is the trip it was
adding to, and that has to be stated rather than inferred from a stack a tab push left untidy.
`router.dismissTo({ pathname: '/trip/[id]', params: { id } })` pops back to the trip when it is
still in the stack and replaces the current screen with it when it is not, so it lands there
either way.

**The abandonment listener must not arm before the screen has been focused once.** While that
second tab navigator settles, its focused route can briefly be the group's default tab — which
the listener reads as "walked away", cancelling the task before the screen has ever been seen
and leaving the user on the main screen with no sign of the trip they just asked to add places
to. Gate it on `useIsFocused` having been true at least once. Keep that flag in a SINGLE effect
depending on both the focus and the trip id: split into "true when focused" and "false for a new
task", the two race in declaration order, and on mount the reset lands second and leaves the
flag false on a screen that is already focused.

### The back button needs `headerBackButtonDisplayMode: 'minimal'`

iOS labels the back button with the PREVIOUS screen's title. The previous screen is always the
tab group, which has no title, so navigation fell back to the route name and every detail screen
showed **"‹ (tabs)"**. Giving `(tabs)` a title does not fix it either: one title has to serve
five tabs, so opening a restaurant from Dining would read "‹ Home". A bare chevron is correct and
is what Apple itself falls back to when a label will not fit. It is set once in the root Stack's
`screenOptions`.

### Re-tapping a tab scrolls it to the top, and it is wired in JS

`src/hooks/use-scroll-to-top.ts`, used by Home.

`NativeTabs` already passes `scrollToTop: !disableScrollToTop` to UIKit and that prop defaults to
true, so in principle this is free. **In practice the native side has to FIND the scroll view**,
and it does that by looking for the first one inside the screen — the same heuristic
`disableAutomaticContentInsets` exists to work around two sections up, where it was picking the
horizontal filter strip on Dining and Resorts instead of the list underneath. A screen with a
nested horizontal `ScrollView` is exactly the shape it gets wrong, and Home has one.

So the behaviour hangs off a ref the screen names explicitly. If the native side is already doing
it the two agree — both scroll to offset zero — and if it is not, this is what makes it work. The
outcome ruled out is the one before it, where whether it happened depended on the order of scroll
views in a tree nobody was thinking about.

**`navigation.isFocused()` inside the listener is the whole trick.** `tabPress` fires on the
target tab's own navigation object whenever its button is tapped, INCLUDING when arriving from
another tab, and focus has not moved yet at that point. So true means the tab was already in
front of you and the tap was a second one. Without the guard, switching from Dining to Home would
scroll Home to the top and throw away where somebody had been reading.

`'tabPress'` is cast to `never` because the native tabs navigator emits it but it is absent from
the base navigation prop's event union. Cast the event NAME and the listener, never `navigation`
itself — casting the object would drop the typing on every other method on it.

**This is unverified on a device.** It typechecks and the logic is the standard React Navigation
recipe, but whether `tabPress` reaches JS on a re-tap of the ALREADY-selected native tab is a
UIKit behaviour that cannot be tested from Windows. If it turns out not to fire, the native
`scrollToTop` is still in play and the JS is simply inert — the feature degrades to what it was,
not to broken.

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

**Adding a table to sync means SEVEN places, not one.** `challenge_marks` needed: `USER_TABLES`
(the wipe list), a row type, a `pushTable` call in `push()`, an entry in `pull()`'s table list, a
branch in `insertPulled`, the `synced > 0` foreign-device test, and `pendingCount`. Miss the last
two and the backup card lies in both directions — it reports everything uploaded while a row
waits, and a device that has only ever synced that one table reads as a fresh guest, so another
account's rows survive a sign-in. The provider also has to be mounted ABOVE `SyncProvider` in
`_layout.tsx` and refreshed in the pull branch, or pulled rows land in SQLite and stay invisible
until the next launch.

**`challenge_marks` is the one table whose unique constraint can reject a pulled row**, and
`INSERT OR IGNORE` is load-bearing for that rather than just defensive. Locally the constraint is
`UNIQUE (challenge_id, step_id)`; two devices that tick the same step before either syncs mint two
rows with two different ids, both upsert server-side, and the second one to arrive collides on a
constraint that is not its primary key. Both rows are the same claim, so keeping whichever landed
first is correct and the loser simply never inserts.

**The day planner is structured, and capped on purpose.** `trip_days` holds one choice per day
of a trip plus an optional note, and nothing else. A free-text itinerary was the obvious cheaper
option — `trips.note` and `trip_plans.note` both already exist and neither is exposed in any
screen — and it was rejected because prose cannot be read back. "You are at EPCOT tomorrow,
here are twelve places you have not eaten at" needs a park id; it is the reason the feature
exists, and a notes blob cannot drive it, cannot drive a notification, and cannot feed the
passport.

**A non-park day is a `kind` column, not a row in `areas`.** Not every day is a park day, so a
day is either an `area_id` or one of `DAY_KINDS` — `rest` or `resort` — and two CHECK
constraints enforce both the value and that the two are never set at once. A sentinel area
(`area: 'rest-day'`) was the cheaper option and is the wrong one: `area_id` is a real foreign key
into the catalog, and a non-place in that table would surface in every area filter, every map and
every venue count in the app. The column is nullable with two values rather than an enum
including `park`, which means every row written before it existed is already correct — no
backfill, and no window where a day means one thing on one device and another on the next.

**`resort` is a kind because it reads back; `rest` is one because nothing else can say it.** A
resort day drives the same suggestion a park day does — "you are at the resort tomorrow, you
have never been to Trader Sam's" — which is why it is a stored choice rather than the absence of
one. It deliberately does not name WHICH resort: the trip's stays already cover the dates, and a
second copy here would be one more thing to keep in step with a changed booking. `rest` means
there is nothing to suggest, which is itself worth knowing before sending a notification.

**`setDay` clears the other side rather than trusting the caller.** Setting `areaId` nulls
`kind` and vice versa, because the server CHECK will reject a row claiming both — and a rejected
push is invisible: the edit looks saved and silently never leaves the device. The guard belongs
at the write, where it fails in front of the person who caused it.

**Each day carries its meals, and `trip_plans.planned_on` is how.** The dining list was one
flat block at the bottom of the trip screen: it told you five restaurants were on the trip and
nothing about when, which is the question the screen is open to answer. A meal with a day shows
under that day; a meal without one stays in the block, which is now explicitly the pool of things
still to place and says so when it is empty rather than rendering a blank box.

`planned_on` is a plain date, NOT a reference to `trip_days`. Day rows are written lazily, so the
day a meal sits on may well have no row, and creating one to hang a meal off would undo the
laziness that keeps a trip's dates editable. Nothing constrains it to the trip's range either —
it cannot, from a single row — and both the day cards and the pool read a date outside the range
as unplaced. So moving a trip's dates returns a stranded meal to the pool instead of leaving it
attached to a day nobody can reach.

**There is no TIME on a meal, so a day's meals are in the order you added them.** Inventing a 7pm
would be inventing data the user never gave, and sorting alphabetically would be an order that
means nothing. This is the same cap as the rest of the planner: reservation times are the next
thing someone will ask for and the first thing that turns this into an itinerary app.

**One destructive action per scope.** The ✕ on a meal under a day takes it off THAT DAY and back
to the pool; the ✕ in the pool takes it off the trip. So deleting a scheduled meal is two steps,
deliberately: the ✕ on the crowded row is the recoverable one. `PlaceOnDay` is the other
direction, and it is exported from `trip-days.tsx` rather than written on the trip screen because
it needs the derived date list and `weekday` — a second copy of either is a second place to get
the UTC date handling wrong.

**`addPlan` is an upsert, and `planDay` is why.** Adding a restaurant from a specific day has to
place one that is already on the trip but unplaced, and the `INSERT OR IGNORE` it used to be
would silently do nothing — which reads as a tap that failed. Without a `planDay` it still does
nothing on conflict, because re-adding a venue must not clear a day somebody already gave it. On
the Dining screen, `planDay` also changes what tapping an already-planned venue means: it MOVES
it onto that day rather than removing it from the trip, since the day is the thing being edited
and removing from there would be a trap.

**Day rows are written lazily and the day LIST is derived**, never stored. An untouched trip
holds zero rows rather than one per night, and moving a trip's dates cannot strand a row outside
the range it now covers. `datesBetween` builds the list from the trip's own start and end with
`Date.UTC`, like all date arithmetic here.

**The day picker offers parks and districts, never the five `resort_area` areas.** They are a
grouping for the dining list, not an answer to "what are we doing today", and offering them put
five near-identical options next to a "Resort day" that means exactly that — with "EPCOT" two
rows above "EPCOT Resort Area". The name lookup still covers every area, so a day stored against
one before they were withdrawn renders with its name rather than its id.

**The day sheet's dim is a Pressable, and it is a SIBLING painted behind the sheet.** It was a
plain View, so the only way out of the sheet was Save — and the thing people reach for first is
the back chevron, which sits under the backdrop, because a Modal renders above the navigation
header. That tap landed on the backdrop and did nothing. Wrapping the sheet in the Pressable
instead would put a press responder above the ScrollView and the note field and have them
negotiate every touch.

**Choosing what the day is stays free; the day note is premium — under `dayNotes`, not `notes`.**
They share an implementation and nothing else: a visit note is written afterwards about a meal
you ate, so "write down what the meal was actually like" on a day you have not had yet reads as a
bug rather than an upgrade. The split follows the existing rule
rather than inventing one: notes are already premium on a visit, so a free day note would be the
inconsistency. And the day's choice is data entry, which is never paywalled — it is also exactly
the data that makes the recommendation layer possible later, so charging for it would starve the
thing that eventually justifies the subscription.

**The cap is the point, not a first pass.** A day planner is the feature most likely to grow
into a full itinerary app — ride plans, reservation times, transport, travel party. One choice
and one note, until somebody actually uses it.

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
the map and **the whole passport — all 33 stamps, not just the coverage percentages** — are free,
permanently. Every rating a free user logs is what makes a Top 10, trending and recommendations
possible later, so charging for logging would starve the thing that eventually makes premium worth
buying. Premium sells depth and convenience: notes, dishes, photos, trips past the first, near-me,
export.

**The passport is free, and that settles a conflict between two documents.** `docs/build-plan.html`
lists "full passport" in v1 premium; the rule above says the passport is free permanently. The
marketing site was following the build plan and promised "The complete challenge set" under Premium,
which no code ever implemented — `PremiumFeature` has never had a challenges value. Resolved in
favour of free (decided 2026-11-05), for three reasons: the share card is the only organic
acquisition channel and a stamp is the thing worth sharing, so gating stamps feeds that channel only
from people who already paid; a stamp is a readout of data entry, which the rule protects; and
premium already sells six things that are all depth and convenience, which is a coherent pitch in a
way "also your trophies" is not. **The build-plan line is superseded. Do not add a challenges
gate.**

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

**Wired and verified end to end** — a real StoreKit sandbox purchase on a `preview` build: Apple's
sheet, Face ID, Apple's own "[Environment: Sandbox]" confirmation, the entitlement granted, and
the gates opening without a relaunch. That run is what proves the parts no script can reach: the
`appl_` key resolving in a build where `__DEV__` is false, Apple actually serving the products,
and the In-App Purchase Key being accepted.

`npm run check:iap` validates RevenueCat's configuration and **nothing about Apple's willingness
to serve the products**. It caught `premium_annual` vs `premium_yearly`, which was worth having,
but a green run is not evidence that a purchase works. Only a device purchase is.

**Verified on a device since:** Restore Purchases, which App Store review does test, and a
lapsed subscription re-locking the gates.

**Still unverified:** `linkUser` carrying a guest's purchase onto a new account. It needs a
sandbox purchase made as a guest and then a fresh sign-in, which is the one sequence no script
can stand in for.

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

## The share card

`src/app/share.tsx` previews the card and `src/components/share-card.tsx` draws it. Free and
ungated, permanently: it is the only organic acquisition channel the app has, and behind the
paywall it would only ever be posted by people who already paid.

**The card must be on screen to be captured.** `captureRef` snapshots what the render server
actually drew, so parking the card off-screen at `left: -9999` yields a blank or a failure on iOS
depending on how the view was culled. The preview screen is not courtesy, it is the mechanism —
and it also means nobody posts a readout of their own travel sight-unseen.

**`collapsable={false}` on the captured wrapper is required.** React Native flattens a view with no
styling of its own out of the native hierarchy, and a view that does not exist natively cannot be
snapshotted. The failure is a null ref that looks like a bug in view-shot.

**Square, and literal colours only.** 1:1 survives an Instagram post, a story, a text message and
Facebook uncropped; anything else means picking one platform to look right on. Every colour is a
literal because the card is the sky gradient, which is dark in both schemes — a theme token would
invert to near-black in light mode and ship an unreadable image.

**It shows totals and nothing else.** No place, no date, no rating. The card is designed to be
posted publicly, so what goes on it is a privacy decision rather than a layout one.

## Split stays and reservation times

Added 2026-11-06 at local `SCHEMA_VERSION 11` and drizzle `0010_pale_christian_walker.sql`.
Three columns: `trips.resort_id_2`, `trips.resort_switch_on`, `trip_plans.reservation_time`.

### The migration MUST be live in Postgres before this code SHIPS

Same rule and same failure as `challenge_marks`, and worth restating because it bites the same
way: `pull()` names its columns explicitly, so the moment a phone runs the new `sync.ts` it asks
Postgres for `resort_id_2, resort_switch_on, reservation_time` on **every sync**. Missing columns
fail the whole cycle for **every user**, including the ones who never split a stay.
`npm run db:migrate` comes before `npm run update:prod`, not after.

### Two columns, not a `trip_resorts` table

A join table keyed on (trip_id, resort_id, nights) is the general answer and the wrong size for
the problem. A split stay is two hotels in practice — "a few nights here, then there" — and the
table buys a third at the cost of another sync table, another RLS policy, and a UI that has to
teach people what a stay segment is. If three ever turns out to be real the way out is
mechanical: each trip becomes one or two rows in the new table and these columns drop.

**`resort_switch_on` is the day you CHECK IN to the second resort**, so 14th–18th switching on
the 16th is two nights at each. Storing the changeover rather than two ranges means the halves
cannot contradict each other or leave a gap, which two independent date pairs would.

Two server CHECKs hold the shape, because RLS lets an authenticated request POST at Postgres
directly and the app is not the only possible writer:

| constraint | says |
|---|---|
| `trips_split_needs_first` | a second resort requires a first |
| `trips_split_needs_date` | the second resort and the changeover are both null or both set |

`setResort(id, null)` therefore clears the split too. Leaving `resort_id_2` behind would make a
row that fails to sync forever, and it is right on its own terms: "not staying anywhere yet"
cannot be true of half a trip.

**The changeover cannot be the first or last day.** Moving on arrival means you never stayed at
the first resort; moving on departure means you never stayed at the second. Both are one stay
entered wrongly, and either would print a zero-night range.

### `reservation_time` is `text`, and is not a timestamp

'HH:MM', 24-hour, park-local.

**Not a timestamp**, because a reservation is a wall-clock time at a restaurant. It does not move
when the person planning is in another zone, which is exactly what storing an instant would do:
book 7:40pm from California, fly to Florida, and a UTC-backed field reads 10:40pm. The date is
already on the row as `planned_on`.

**`text` rather than Postgres `time`**, because sync is a straight column copy and `time` comes
back as '19:40:00' — a different string from the '19:40' the app wrote, so a row would change
shape on every round trip. Matching the local representation beats a self-describing column type.

Helpers are in `src/lib/clock.ts`: `formatTime`, `isValidTime`, `byTimeThenName`. Pure, and kept
out of any `.tsx` for the `datesBetween` reason — `trip-share.ts` formats itineraries outside
React and must not pull React Native in to print a time.

**Untimed meals sort LAST within a day.** A day's plan is read as a schedule, so rows with a place
in it come first and the loose ones gather at the bottom as "also, some time today", which is
what they are. Sorting them to the top would put the least settled thing at the hour somebody is
checking. Lexicographic comparison is correct for zero-padded 24-hour times, so nothing parses.

### `TimeField` is hand-rolled, and has to be

`src/components/time-field.tsx`. `@react-native-community/datetimepicker` is the obvious answer
and is a **native dependency**, so adding it changes the runtime fingerprint and forces a new
binary — a fortnight of TestFlight, to pick a time. Hours then minutes rather than one list of
slots: five-minute granularity from 6am to 11pm is 205 rows.

Nothing is typed, for `DateField`'s reason. A mistyped time is silent and consequential —
`07:40` for a dinner booking is a plausible slip, and an itinerary telling four people to turn up
twelve hours early is wrong rather than broken, which is the kind nobody questions.

The half-finished selection lives inside the sheet, not in the row. Writing `19:00` the moment
somebody taps 7pm would leave a wrong time behind every time a sheet was dismissed.

### `TripStay` is also the first way to change a trip's resort at all

`src/components/trip-stay.tsx`. Before this, the resort was chosen once in `TripPlanner` and
**`setResort` had no caller** — "Choose a resort" pushed to the resorts tab and nothing there
wrote back, so a trip created without one could never get one. Building a picker for the second
resort meant the first got one for free. Long-standing gap, closed incidentally.

## Sharing a trip

`src/app/trip-share.tsx`, reached from a **Share** button in the trip screen's header. Two
outputs: the poster (`src/components/itinerary-card.tsx`) and plain text. Also free and ungated,
for the same reason the passport card is.

**One `Itinerary`, two formatters.** `src/lib/trip-share.ts` turns the trip tables into a single
shape and both outputs read it. Two formatters going at the tables directly would drift the first
time a rule changed — "a meal planned outside the trip's own dates counts as unplaced" is exactly
the sort of rule that gets fixed in one and not the other, and the drift is invisible because one
of the two is a picture.

**Both, rather than one, because they carry different messages.** The poster is "look where we are
going": sky gradient, wordmark, the acquisition channel. The text is "here is the plan" — it
pastes into the group chat where the trip is actually being organised, a recipient who has never
heard of the app can read it, and a restaurant name can be copied straight out of it to go and
book. Shipping only the image would have been the prettier choice and the wrong one, because an
itinerary's job is to be acted on.

**`Share` from react-native, not `expo-sharing`.** expo-sharing shares a FILE and there is no file
in the text case. The two share paths on this screen genuinely use different APIs.

**The text is plain, never Markdown.** It lands in Messages, WhatsApp and Mail, none of which
render it — `**EPCOT**` would arrive with the asterisks. Two leading spaces and a bullet survive
everywhere.

**Spacing differs between the two text shapes, deliberately.** With the dining list on, each day
is a block and a blank line separates the blocks. With it off, every day is one line and the same
blank lines would double the length of the message for nothing. The right spacing depends on what
is being spaced.

**An undecided day keeps its row** and reads "Nothing planned yet" in both outputs. Dropping it
would make a seven-night trip look like five, and `—` leaves a recipient guessing whether it
means a rest day or an oversight.

**The poster is not square.** The passport card is 1:1 because it is one number going into a feed;
this is a list, and a list forced into a square either sets the week in type too small to read or
crops it. It grows with the trip, caps at `MAX_DAYS` 14 days and 3 meals a day, and is sent in a
message where a tall image scrolls fine. Everything else about capture — on-screen,
`collapsable={false}`, literal colours — is identical to the passport card above.

**Meals within a day sort alphabetically**, because `trip_plans` has no time column. Breakfast-to-
dinner order would be better and is not available; alphabetical is at least stable.

### `datesBetween` lives in `calendar.ts`, not `use-trips`

Moved 2026-11-06. It is pure date arithmetic with no state and no React in it, and while it sat in
a hooks module **importing it pulled React Native in** — which is what stopped `trip-share.ts`
being a plain transform runnable outside the app. It is now testable with `npx tsx` against a
made-up trip, which is how the text output above was checked before it shipped. Keep pure helpers
out of `.tsx` hook files for this reason.

### The sharer picks what goes on the card

Nought to three stats, chosen on the share screen with the card visible above the chooser, stored
as a JSON array of ids in `app_settings` under `share_card_stats`. `src/lib/share-stats.ts` owns
the list, because three things need it and none of them should own it: the card renders the chosen
stats, the screen offers the choice, and the stored preference is a list of names that has to
still mean something next release.

**Three is a property of the layout, not a preference.** The footer is one row on a square image,
and four stats at that type size start to wrap on a phone-width card — a wrapped footer on an
image somebody posts is not a bug they report, they just do not post it. The cap is enforced
where the selection is made, and at the cap a new pick **drops the oldest** rather than refusing:
a disabled fourth chip means someone who wants Months instead of Resorts has to work out that
they must deselect something first, and a chip that does nothing when tapped reads as broken.

**Every option is a number that already exists somewhere else in the app.** That is the criterion
for being on the list at all — a stat invented for the share card is a number nobody can find
anywhere else, which on an image shared publicly is the beginning of "where did that come from?".
Order comes from the options list and never from the stored array, so the card reads the same way
whichever order someone tapped them in, and an id a later release drops is simply not shown
rather than rendered as a gap.

Why it is on the share screen rather than in Settings: picking numbers for an image you cannot
see is guesswork, and a preference buried two taps from the thing it affects is a preference
nobody finds.

### A font size above the inherited line height MUST set its own

This cost a bug report — "the number in the middle of the ring gets cut off, like a block is
overlapping it". Nothing was overlapping it. `ThemedText` defaults to `type="default"`, which sets
`lineHeight: 24`, and **a style further down the cascade that sets only `fontSize` leaves that 24
in place.** A ~48pt numeral was being drawn into a 24pt line box and cropped top and bottom.

So: any `ThemedText` whose font size exceeds 24 has to set `lineHeight` alongside it. The share
card computes both from the ring diameter for that reason. The footer stats deliberately do NOT
set one — 17 and 9 are both below the inherited 24, so their line boxes are roomy rather than
cropped, and adding numbers there would move spacing that is already right.

---

## Steps

`src/hooks/use-steps.ts` rolls `expo-sensors` into the `step_days` table (schema 9).

**This is a rollup, not a read, and it cannot be anything else.** CMPedometer keeps seven days:
"Specifying a start date that is more than seven days in the past returns only the available
data." So "how far did we walk in October" is not a question the sensor can ever answer — only
something that was copying the totals down at the time can. The window is re-read on mount and on
every foreground, all seven days rather than just today, so opening the app once a week loses
nothing. Ten days closed loses the first three, and nothing can recover them; that gap is real and
is documented rather than hidden.

**Days are written with `MAX(existing, incoming)`, never overwritten.** If motion access is revoked
or the phone is restored from a backup, the sensor answers 0 for days that really had 12,000
steps, and an overwrite would destroy the only copy. MAX cannot lose data; the worst it can do is
keep a number that is too high, which is visible and recoverable, whereas a zeroed trip is
neither.

**Failures are per-day.** The oldest day drifting past the seven-day edge mid-run should cost that
day, not the six that would have come after it.

**Days are LOCAL days.** A guest walking Magic Kingdom until midnight walked on that day, not on
tomorrow in UTC. Today's range is clamped to now, because asking a sensor about the rest of the
afternoon is asking about the future. The window logic was verified headlessly against month, year
and leap-day crossings, and against the **25-hour DST fall-back day** in America/New_York — which
Florida trips in early November actually straddle, so the range has to cover all 25 hours rather
than stopping an hour short. That test was not committed: it mirrored the implementation by
copy-paste, and a copied test gives false confidence the moment the original changes. These rules
are the thing to preserve.

**Distance is deliberately absent.** It would have to come from CMPedometer's stride estimate,
which is guessed from height and wrong by a wide margin for most people. A step count is a number
someone can trust; "4.2 miles" invites an argument the app cannot win.

**`challenge_marks` (schema 10) is the opposite call, and deliberately so.** Step counts stay on
the phone because they are health-adjacent and the only reader is the device that generated them.
A ticked quest step is the same kind of thing as a visit — a fact a person entered about their own
trip — so losing it to a reinstall would be the same loss, and it gets the same backup. The
contrast is the useful part: "does this sync?" is answered by who needs to read it and what it
costs to disclose, not by which table happened to be added first.

**`step_days` is local-only on purpose** — no `synced_at`, no server table. Step counts are
health-adjacent, so a server copy means a new RLS policy, a new line in the privacy policy and a
new answer on the App Privacy questionnaire, none of which buys anything while the only reader is
the phone that generated them. Adding sync later is an ALTER and a backfill, which is a smaller
act than retracting a disclosure.

**`StepsSection` renders nothing — heading included — when there is no pedometer.** A simulator, an
iPad and an Android device without Health Connect all land there, and a bare "STEPS" label over
empty space reads as a broken feature rather than an absent sensor. That is why `Section` lives in
`src/components/section.tsx` instead of inside the Stats screen: a section has to be able to
return null and take its own title with it.

**Denied is final.** iOS will not show the system prompt twice, so the denied state names the
Settings path instead of offering a button that would do nothing.

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

**The picker has two levels, and the second one is what makes the 1971 floor mean anything.**
The month arrows move one month per tap, which is right for a trip next spring and useless for a
meal eaten on a trip in 2019 — eighty-four taps, so in practice the past was unreachable and the
floor was a promise the picker did not keep. Tapping the month name opens a year stepper over a
twelve-month grid, and picking a month drops back onto the day grid there. Deliberately only two
levels deep: a decade grid above that is a third thing to learn, for the few people logging
something from the nineties.

The year stepper's ceiling bounds **navigation, not selection**. `log-visit` has no `maxISO` on
purpose — logging a meal on a date the phone thinks is tomorrow is a real thing across time
zones — so the stepper stops two years past the month it opened on only to stop the arrow
walking to the year 9999. The day grid still enforces the real minimum and maximum, so nothing
the stepper can reach becomes selectable that was not already.

**Months do not compare as numbers**, which is why `compareMonths` exists: `{2026, 0}` is after
`{2025, 11}` despite the smaller month field. The month grid asks it whether a whole month falls
outside the range, rather than comparing an ISO date — October 1971 is open even though only the
1st of it is.

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

**A list row shows CHARACTERS as well as SIGNATURE.** The detail screen had said "Character
dining" from the start and the row said nothing, so the only way to find a character meal while
scrolling was to already know which ones they are. Both badges are gold, matching the detail
screen: a row that marks a fact one colour and a screen that marks it another reads as two
different facts. The data was never the problem — all 13 character venues agree across
`venues.csv`, the bundle and Postgres, in both the `is_character_*` columns and the
`character-dining` tag.

**`CatalogMap` knows nothing about venues or resorts.** Callers map their own rows to `MapPlace`
— id, name, coordinates, a `RampToken` tone, and two display lines — which is why Resorts got a
map for about thirty lines instead of a second copy of the file. The only real differences were
which colour map to index (`AreaTone` vs `TierTone`) and which strings go on the card, and both
are the caller's business. `SkySegment` is shared for the same reason: one copy means the
too-faint-to-read version of that control cannot come back on only one screen.

**The row-to-`MapPlace` mapping lives in `src/lib/map-places.ts`, not in the callers.** It
started in the two tabs, which was fine at two; the focused map made it three, and three copies
of "which ramp and which two strings" is how a venue comes to read one way on the Dining map and
another on the map you reach from the restaurant itself. Plain functions, not hooks — the callers
already memoise, and a hook would force them to.

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

### Celebrating an achievement: a badge and a banner are different things

`use-achievements` splits them deliberately, and conflating them is the bug waiting to happen.

**The badge is derived, the banner is a transition.** Only the acknowledged set is stored, as
`achievements_seen` in `app_settings`; the unread count is `current \ seen`, computed. There is
no counter to increment, so there is nothing to drift out of step with what the user has
actually reached. The banner, by contrast, fires on a change observed WITHIN a session, tracked
in a ref. A badge should survive a relaunch; a celebration should not. Being congratulated on
launch for something earned last Tuesday is confusing rather than exciting.

**The first computation after load is a silent baseline, and the feature is unusable without
it.** Onboarding backfills twenty-odd visits in one go, so a ledger starting empty would open
the app on a stack of banners for achievements the user did not just earn — and a device pulling
a synced account's history would celebrate meals eaten years ago. Seeding the baseline costs
nothing and is the difference between a reward and a spam folder.

**A challenge card opens its own screen, and `steps` is why that screen is trustworthy.** Every
`Challenge` carries the full checklist — each place, done or not — so `challenge/[id]` renders
what the card was counting instead of re-deriving it. The rules that decide what counts (events
and closed venues excluded, pavilions counted by pavilion, tiers rounded up with `tierTarget`)
are the thing that must not fork: a detail screen with its own query is how it ends up
disagreeing with the card that opened it, which is why `useChallenge` is `usePassport` plus a
`find` rather than something narrower.

**A pavilion step has no `venueId`.** Several places inside Mexico satisfy Mexico, so the row
does not navigate and `options` carries the candidates as separate taps. Picking one for the
user would be guessing.

**A step's second line names the resort when the venue is at one**, falling back to the area.
This is the difference between a list that is complete and one that is useful: the Monorail Bar
Crawl promises "Grand Floridian, Contemporary and Polynesian" and then labelled all ten of its
bars "MK Resorts", because they share an area and not one of them carries a `sub_area`. The one
fact needed to plan the crawl was the one fact the checklist withheld. Signature dining had the
same problem for the half of it that is at resorts. Area-scoped challenges still name the LAND
instead, since repeating "Magic Kingdom" down forty rows says nothing.

**The tier ladder exists because percentages are not a plan.** `TIERS` stores fractions, which
is right for scoring and useless for someone deciding where to eat — the detail screen runs them
back through `tierTarget` so Silver reads as "31" rather than "50%".

**`remaining` is only for sets short enough to read on a card**, and stays undefined on the
tiered challenges. It is derived from `steps` rather than computed separately, and it arrives
already formatted — the Passport used to run it through `titleCase`, which lowercases first and
turned "D-Luxe Burger" into "D Luxe Burger".

**One milestone per challenge, not one per tier crossed.** Somebody who logs a backlog and jumps
from nothing to Gold is told they got Gold. Three banners climbing the ladder they skipped would
bury the actual news.

**The milestone key is `challengeId@Tier`**, so Silver on the same challenge is a distinct
unlock from Bronze and gets its own celebration. All-or-nothing challenges use `@earned`.

**Looking is acknowledging, but the highlight outlives the badge.** Opening the Passport clears
the count immediately and captures what was new into component state for the length of the
visit. Without that capture, arriving from the banner would clear the badge and show nothing to
explain why you came — `unseen` is empty by the time the list renders.

**Every milestone takes over the screen, and what separates them is intensity rather than
format.** This went through two wrong answers first. Platinum and Bronze originally arrived in
the same slim card with the same single buzz, which a tester correctly called underwhelming —
the biggest moment in the app presented as a notice. Splitting it so that only completions got
`AchievementCelebration` fixed that end and broke the other: three out of every four medals
still looked like a notification from another app, so earning one never registered as a reward.

`GRADE` in `achievement-celebration.tsx` now scales confetti, dwell and haptic beats per tier —
Bronze 14 pieces, 5.2s, one beat, up to Platinum at 30, 9s, three. Give every tier the same
fanfare and finishing stops meaning anything; give the lower tiers a different FORM and they read
as something other than a reward. `AchievementBanner` is a router over this and nothing else.

**The card's wording is per-tier, and it was wrong when only completions reached it.** Every
tier read `BRONZE — COMPLETE / All 30 of them`, which is wrong twice: Bronze completes nothing,
and you have eight of the thirty rather than all of them. `headline()` gives a rung
`BRONZE EARNED / 8 of 30 · 7 more for Silver`, computing the next target with `tierTarget` — the
same function the scoring uses, rounding included — so the number it promises is the one actually
measured against.

**"See it" opens the challenge, not the Passport.** Landing on the tab left you to find the card
that had just changed; the detail screen opens on the checklist, which for a rung is the question
being asked — which ones have I done, and what is left.

**The confetti is twenty-six plain Views, not a library, and that is a shipping decision as much
as a taste one.** A native animation dependency would change the fingerprint, which strands
every installed build from over-the-air updates — the trap documented under EAS Update. Pure
`Animated` transform and opacity ships OTA. One `Animated.Value` drives all the pieces, each
reading it through its own clamped interpolation window, so the stagger costs one native
animation rather than twenty-six.

**Confetti is suppressed under reduce-motion; the card and medal are not.** Lots of independent
peripheral movement is the pattern that actually makes people unwell, while a celebration with
no motion at all is not a celebration. `calm` starts false and may flip a frame later, which is
the right way round: the setting is usually off, and guessing late shows one extra burst instead
of silently removing it for everybody.

**All haptics live in `src/lib/haptics.ts`.** They used to be two inline calls in the banner,
which meant the only thing in the entire app you could feel was an achievement unlock — rare
enough that the first tester concluded haptics were broken, with nothing to compare against.
Logging a visit, logging a stay and adding a restaurant to a trip now tap too.

**Match the pattern to the act.** `tapSaved` is the success notification and means something was
filed away. `tapPicked` is `selectionAsync`, the light tick under a picker wheel, and is what
toggling rows in a list gets — adding places to a trip is a run of taps down a long list, where
a notification-weight buzz on each one would be both wrong and quickly unbearable.
`tapCelebrate(beats)` takes 1, 2 or 3 beats rather than being
one fixed pattern, because a lone Success pattern is exactly what an arriving text message feels
like — and because every tier gets a celebration now, so the haptic is one of the few things
left to tell Bronze from Platinum. It returns a cancel, so an early dismissal stops the phone
buzzing at someone who has already moved on.

**When haptics seem dead, suspect the phone first.** `expo-haptics` resolves its native module
with `requireOptionalNativeModule`, so every failure is silent by design — a simulator, an older
binary, and Settings → Sounds & Haptics → System Haptics being off are indistinguishable from
no haptic having been requested.

**The dwell is per-tier, and the entrance eats the front of it.** The medal lands at 140ms and
the confetti falls for 2.6s, so the card is only STILL for the remainder — which is why an
earlier 4.2s read as the thing flashing past, being three lines and a decision in about two
seconds. When another unlock is already queued behind this one, `DWELL_QUEUED_MS` applies
instead of the tier's: one visit can tip two challenges at once, and two full takeovers back to
back is eighteen seconds of scrim for a single tap.

**The dwell and the beat count are frozen at mount with `useState` initialisers.** `queued` can
flip true while the card is up, and reading it live would put it in the entrance effect's
dependencies — replaying the animation and re-firing the haptic on a card already sitting still.

**Every animation here is `useNativeDriver: true`**, which is possible only because
nothing animated is a layout property — transform and opacity, no height, no margin. It runs on
the UI thread and cannot be stuttered by whatever JS is doing. The header collapse animates
height and therefore cannot do this; the two are different for a reason, not by accident.
Reanimated is not used here either, for the reason recorded above: it silently did nothing on
device twice, and a celebration that fails invisibly means the user never learns the feature
exists.

**Known gap:** switching accounts does not clear `achievements_seen`, so the next user may see
the previous one's acknowledgements. It is in `app_settings`, which the user-table wipe does not
touch. Harmless today — worst case a badge that should have appeared does not — but it belongs
in the wipe once a second account on one phone is a real scenario rather than a test.

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

**A tap on a pin fires TWO native handlers, and nothing orders them.** On Apple Maps the marker
has its own `UITapGestureRecognizer` and the map's runs alongside it — `cancelsTouchesInView = NO`,
`shouldRecognizeSimultaneouslyWithGestureRecognizer` returns `YES`, and `handleMapTap:` never
checks whether the tap landed on an annotation. So `MapView.onPress` fires on a pin tap as well
as on bare map. The marker's handler selected the place and the map's cleared it, in the same
React batch — so **tapping a pin did nothing at all**, and had done since the map shipped. The
card was selected and deselected before anything rendered, which is indistinguishable from a
dead tap target.

`stopPropagation` on the `<Marker>` closes the React-level bubble, which is only ONE of the two
routes. The map's own recognizer is the other and no JS can stop it, so `onMapPress` defers a
tick and backs off if a marker claimed the same tap. Deferring rather than reading a flag
synchronously is deliberate: the observed order on one device is not a contract, and a guard
that depends on it is a guard that breaks on the next iOS release.

**Pin names appear below `LABEL_MAX` individual pins on screen, and not above it.** Labelling
all 366 is the version nobody can read: at the default framing the dots already touch, so a name
on each would be a grey smear across the resort. Counted from the pins on screen rather than from
`places`, so it follows the zoom rather than the size of the catalog. Clusters are never
labelled — a cluster is several places and has no one name.

**A labelled marker needs a DIFFERENT anchor, and that is the whole reason the label's box is
fixed.** A marker is anchored as a fraction of its own view, so anything below the dot moves the
dot off its coordinate unless the anchor moves too — `LABELLED_ANCHOR` is the dot's centre over
the total height. Hence one line, a fixed `LABEL_H`, and `allowFontScaling={false}`: a label that
grew with the system font size would silently drag every pin north of where it belongs. The dot
keeps its own 34pt box either way, so the hit area never depends on the name under it.

`showLabels` is also in `tracksViewChanges`, which is not optional. Markers with custom children
keep the snapshot they were first drawn with, so without it a name appears only when something
else happens to force a redraw.

**The pin's hit area is a transparent 34pt box around an 18pt dot.** Apple asks for 44pt and an
18pt marker is less than half of that, but 44 has neighbouring pins overlapping each other's hit
areas at the closest zoom, which trades a missed tap for a wrong one.

**A detail screen's "Show on map" opens OUR map; "Directions" is the one that leaves.** Handing
the coordinates to Apple Maps used to be the only option, and it answers a different question:
Apple Maps knows where the building is and nothing about whether you have eaten there, what else
is within walking distance, or which of those you have not tried. Inside a park you cannot drive
through, it is the worse answer. Directions stayed as the secondary action because routing is
real and `CatalogMap` cannot do turn-by-turn — but it is secondary.

**`show-on-map` plots the WHOLE catalog, focused on one place, and is a pushed route.** A single
pin on an empty map is just a coordinate; the neighbours are the reason to look, and tapping one
makes the screen double as "what else is near here". It is a route rather than a map embedded in
the detail screen because mounting a `MapView` is not cheap and every restaurant you opened would
pay for one whether or not you looked. It is also NOT the Dining tab with a pin pre-selected:
that rewrites which tab the user was on, and the back gesture then lands on the tab's list rather
than the restaurant they came from.

**`focusId` seeds the viewport STATE, not just `initialRegion`, and is read exactly once.**
`viewport` is what the clustering reads and `onRegionChangeComplete` fires after a change rather
than on mount, so seeding only the map would cluster the first frame as though it still showed
all four parks. It is read in a `useState` initialiser rather than a `useMemo` because the
catalog loads asynchronously: re-framing whenever `places` changed would yank the camera back
from wherever the user had panned. `show-on-map` therefore waits for the catalog before mounting
the map at all — an empty first render is a map that opens on the whole resort and never corrects
itself.

**`clusterPins` takes a `keepId` that is never folded into a cluster.** The focused place has to
be its own pin: a screen opened to see where Cinderella's Royal Table is, that answers with a
circle reading "4", has failed at its only job. `regionAround` opens below `MIN_CLUSTER_DELTA`
so nothing clusters anyway, but that is belt and braces — the map widens the region to fit the
view's aspect ratio and reports the adjusted one back, which can land above the threshold.

Filtering and search happen **in memory**. The catalog is ~400 rows and already loaded, so a
round trip per keystroke would be slower and would break offline.

**A JS-only change goes out with `npm run update:prod`, not a build.** EAS Update is configured,
so the loop for anything that is not native is seconds rather than a seven-minute build plus up
to half an hour of Apple processing. What still needs a full build: a new native dependency, a
change to `app.json`'s native surface (permissions, plugins, icons, bundle id), or a version bump.
If in doubt, compare `npx expo-updates fingerprint:generate --platform ios` against the build's
fingerprint — a difference means the update cannot reach that binary and a build is required.

**The runtime version policy is `fingerprint`, and `appVersion` would be a bug waiting to
happen.** `eas update:configure` writes `appVersion`, which makes the runtime version "1.0.0" —
so an update would be offered to ANY 1.0.0 binary whether or not its native code matches. This
project has already shipped that exact failure once, when `expo-image-manipulator`'s JS reached a
binary without the native module and the app crashed on launch. `fingerprint` ties the runtime
version to the real native fingerprint, so a mismatched update is never offered at all. Note that
`eas.json` is itself a fingerprint source, so editing it changes the runtime version.

**`eas update` needs `--environment`.** Required from SDK 55 on, and it is also what loads
`SENTRY_AUTH_TOKEN` for `--upload-source-maps`. Without the source maps an OTA bundle's Sentry
traces are unsymbolicated, which would have made the `ExpoImageManipulator` crash unreadable —
and reading that trace is how it was found. Both flags are baked into the npm scripts; publish
through those rather than by hand.

**`eas update:configure` wrote back the RESOLVED app config, and that is destructive.** It baked
plugin-added Android permissions into `app.json` as source, duplicating the two already there and
adding `RECORD_AUDIO` to `permissions` while it was still in `blockedPermissions`. Check
`git diff app.json` after running any Expo configure command and keep only the lines it was
supposed to add — here, `updates.url`.

**`UpdateBanner` prompts; it does not reload by itself.** The default is to download in the
background and apply on the next launch, which means a tester sees a fix two cold starts after
being told it is fixed — indistinguishable from the fix not working, and the whole point of
shipping in seconds is lost to a silent handover. It is not automatic either: `reloadAsync` tears
the JS context down and would take an unsaved visit note with it. It sits at the BOTTOM because
`AchievementBanner` owns the top, and this one persists until acted on while that one is
transient.

**Getting a change to TestFlight is one command**, and the submit profile is why:

    eas build --platform ios --profile production --auto-submit

`eas update` additionally needs `--message` in non-interactive mode, which the `update:prod`
script does not hardcode — pass it through: `npm run update:prod -- --message "..."`.

`--auto-submit` submits the binary it just built, so there is no gap in which the wrong build can
be picked. The TestFlight group lives in `eas.json` as `submit.production.ios.groups`, NOT on the
command line, because `--auto-submit` reads the submit profile — the `-g` flag only exists on a
standalone `eas submit`. Running `eas build` and `eas submit` as two separate commands at the
same time is how this went wrong once: the submit had no finished store build to find, offered a
menu of development builds, and App Store Connect rejects those.

**`eas.json` is one of the fingerprint's 133 sources, so editing it orphans every installed
build from over-the-air updates.** This is the trap that cost a build: adding `ascAppId` — pure
submission metadata, nothing the binary can observe — moved the iOS runtime version from
`ed8385a7…` to `d41cd429…`, and the next `eas update` published to a runtime version that no
shipped app had. The update succeeded, reported a healthy-looking update group, and reached
nobody.

Check before publishing, not after:

    npx expo-updates fingerprint:generate --platform ios   # hash + the 133 sources
    npx eas build:list --platform ios --limit 1            # the shipped build's Fingerprint

**Use `npx expo-updates`, never `npx @expo/fingerprint@latest`.** The standalone package at
`@latest` is a different version with a different source list, and it prints a different hash for
an unchanged tree — `0f59f0a3…` where the real runtime version was still `d41cd429…`. That looks
exactly like the orphaning bug above and sends you hunting for a native change that was never
made. The only hash that means anything is the one the project's own pinned `expo-updates`
computes.

If they differ, an `eas update` is wasted and the change needs a build. Do NOT reach for
`.fingerprintignore` to exclude `eas.json`: build profiles there genuinely do affect the native
binary, and silencing the whole file to buy back a metadata field trades a visible annoyance for
the invisible kind — an OTA landing on a binary that cannot run it, which is the
`expo-image-manipulator` crash this project already shipped once.

**An orphaned build does not look orphaned — it looks like your code is broken**, which is what
makes the trap expensive rather than merely annoying. A phone on a cut-off runtime reports
missing features with complete accuracy, and the code it is talking about is fine.

**But do not reach for this explanation first — it was wrong here, twice.** Two tester reports
were diagnosed as build 4 being orphaned, from the update history, the runtime hashes, the commit
each update was built from, and an in-app restart prompt. All of that reasoning was sound and the
conclusion was false: App Store Connect showed build 4 with **six invites and zero installs**,
and build 5 with five installs and fourteen sessions. Nobody was on build 4. The feature was in
build 5's own embedded bundle the whole time, and the real cause was that the control which
opened it had no affordance — see the discoverability note under Design tokens.

The lesson is about evidence, not about fingerprints: **the install counts on App Store Connect's
TestFlight tab settle in one glance what the update history can only suggest.** Delivery
mechanics tell you what COULD have reached a phone; only the install count tells you what did.
Read it before theorising, and treat "the tester is on a stale build" as a hypothesis to check
rather than a conclusion to act on.

**No publish fixes this. Only installing the newer build from TestFlight does.** An update is
offered to a binary only when the fingerprints match exactly, so republishing, bumping the
message, or waiting changes nothing for an orphaned phone — it will run the JS it shipped with
until it is replaced. When a fingerprint moves, assume every installed copy is frozen and get a
new build to testers before publishing anything else.

Therefore: **when a tester says a feature is missing, establish which build they are on BEFORE
reading any code.** Settings → This build answers it, and `eas build:list --platform ios` maps a
build number to its fingerprint.

**The `scripts` block of `package.json` is a fingerprint source too.** Adding a one-line npm
alias — `"update:legacy": "node scripts/update-legacy.mjs"`, no dependency, no native anything —
moved the hash from `d41cd429…` to `510c7a7b…` and would have orphaned build 5 exactly as
`ascAppId` orphaned build 4. A file under `scripts/` does NOT count, so the script is invoked as
`node scripts/update-legacy.mjs` rather than through npm. Check the hash after touching
`package.json` for any reason at all, including ones that look like pure convenience.

**`scripts/update-legacy.mjs` reaches the orphaned builds when TestFlight cannot.** It removes
`ascAppId`, which puts the runtime version back to `ed8385a7…`, publishes, and restores the file
in a `finally`. This is only sound because nothing native has changed since that build — it
verifies that itself and refuses otherwise — so the fingerprint difference is bookkeeping rather
than an incompatibility. Run it in addition to `npm run update:prod`, never instead: one reaches
builds 3 and 4, the other reaches build 5.

**`submit.production.ios.ascAppId` is what makes the submission work unattended.** Without it,
EAS has to ask which App Store Connect app it is submitting to, so `--auto-submit` paired with
`--non-interactive` fails the instant the upload finishes — `Set ascAppId in the submit profile
(eas.json) or re-run this command in interactive mode` — while the build itself carries on and
succeeds. The recovery is a standalone `eas submit --platform ios --id <build id>` once it is
done. The value is the app's ten-digit Apple ID from App Store Connect's App Information page
(`6824630095`), which is public — it is the number in every App Store URL — so it belongs in
`eas.json` and not in the environment.

**Do NOT pass `--what-to-test`.** It maps to the submission's `changelog` parameter, which EAS
gates behind the Enterprise plan, and the submission is rejected before it is even scheduled —
`Failed to schedule iOS submission ... available for Enterprise plan only`. The build still
runs, so the recovery is a plain `eas submit --platform ios --id <build id>` afterwards. Release
notes for testers go in App Store Connect's TestFlight tab, by hand, for free.

**Before any build that changes a synced column, the migration has to be live.** Production and
local point at the same Supabase project, so `npm run db:migrate` covers both — but the ORDER
matters: the push sends every column the local row has, so a build that knows about a column
Postgres does not will fail to sync, silently, on a tester's phone. Migration first, build
second.

## The passport and the stats tab

**They were one screen and it did not work.** Passport rendered an area grid of twelve tiles,
then five challenge cards, then the SAME twelve areas again as full cards — seventeen cards,
each with a stripe, a medal, a title, a badge, a blurb, a progress bar and up to three further
lines. Over a hundred text elements in one scroll, and the bottom half was a second rendering of
the top. It was reported as overwhelming by the person it was built for.

The split follows what the two halves actually are:

| Tab | Holds | Shape |
|---|---|---|
| **Stats** | coverage percentages, the area grid, resort progress | numbers |
| **Passport** | the stamps, on three pages | a keepsake |

The three pages are split **by what earns the stamp**, via `STAY_CHALLENGE_IDS` and
`QUEST_CHALLENGE_IDS` in `use-passport.ts`:

| Page | Earned by | Count |
|---|---|---|
| **Food and drink** | eating — finishing a list, or covering a park or area | 9 + 12 |
| **Resort stays** | sleeping somewhere — no meal involved | 4 |
| **Quests** | the ones the app cannot observe, tickable by hand | 6 |

The area half holds **12**, not 14: `byArea` groups the venues that exist, so Typhoon Lagoon and
Disney's BoardWalk have no stamp because they have no eligible venue. An area appears the day it
gets its first row.

**It was four pages, and the areas had one of their own captioned "Also food".** That caption was
the tell: the page needed a sentence explaining that it belonged with the one three scrolls above
it, which is what a page break in the wrong place looks like. Both halves are earned by eating —
one by finishing a list someone set out to finish, the other by covering a place — and while the
distinction is real it is not a distinction between PAGES. Splitting them meant somebody looking
for "how am I doing on EPCOT" had to know that food lived in two places. Merged 2026-11-05 at
Jake's request, who said the earlier split was never what he had meant.

Inside the page, **named challenges come before coverage.** The named ones have a hook — Drinking
Around the World is a thing people set out to do — while "every place to eat in Disney Springs" is
a long grind that reads better as the back half of a page than the front of one.

Each area tile on Stats opens `challenge/area-<id>`, which is what the duplicate card list used to
do. Deleting a list and making the thing above it tappable is usually the better trade: the
content was never the problem, the second copy was.

### Stamps

`src/components/stamp.tsx`. Three states, and the distance between them is the point — the
complaint that started this was that completing something "can be missed":

| state | ring | disc | lean | ink | legend |
|---|---|---|---|---|---|
| complete | 3px | yes | crooked | `gold` | `EARNED` on an arc |
| in progress | 1.5px | no | square | `accent` | `4/26`, straight |
| untouched | 1px at 40% opacity | no | square | `textFaint` | `0/26`, straight |

**There are exactly three inks, and `gold` means EARNED and nothing else.** An earlier version
inked an unfinished tiered stamp in its tier's metal, which was reported as confusing and was:
`TIER_COLOR.Gold` and `theme.gold` are the same hex, so a stamp three-quarters of the way through
a long challenge was painted the exact colour of a finished one. "I assumed gold meant complete"
is the correct reading of the only colour on the page carrying a meaning, and two things cannot
share it. The medal was not legible even when it did not collide — the tier was shown as a colour
and NOWHERE as a word, so bronze versus silver was a difference nobody could name, while the
untiered stamps borrowed `accent` and made the same teal mean "in progress" on one stamp and "no
tier yet" on its neighbour. Colour on the passport now answers one question, how far along is
this, with three answers. The tier still exists and is still worth something; it is shown on the
challenge's own screen as a ladder with the names and counts spelled out, which is the only place
with room to say what Silver means.

**And the three are labelled.** `StampKey`, above the first page — three miniature stamps
carrying the ring weight and disc of the state they stand for, so the key teaches the visual
language and not just the hue. Three unlabelled colours are still three colours someone has to
guess at, which is how the collision above got as far as a tester in the first place.

It is a **rubber** stamp, not a postage stamp — no serrated edge, no
perforations, no rectangle with a picture in it. What makes an entry stamp
recognisable is all of these together and no one of them alone: a thick outer
ring with a thin second ring inside it, a rule across the middle splitting the
face into mark and legend, short wide-tracked all-caps type, ink that is not
quite opaque, and a lean. A single ring with an icon in it is an icon chip,
which is what the first version was and what it was reported as.

**A stamp's glyph is a THING, never a diagram.** The transportation stamp was
`arrow.triangle.branch` — a branching arrow, which is what a transport network looks like drawn
on a map, and which reads as a git merge or a detour sign. It is now `bus.fill`: the challenge is
about riding things, so the mark is a thing you ride. A bus rather than a monorail or a boat
because both of those already have their own stamps on the same page, and the bus is the one mode
that reaches every resort on property. Same family as the earlier Magic Kingdom fix, where
`building.columns` was read as a courthouse — at 34% of a ~99pt circle there is no room for a
glyph that needs interpreting.

**The disc is a wash of the ink, not `goldSurface`.** The first version filled
a finished stamp with `goldSurface` — which is the colour of the page it sits
on, so there was nothing to see. That is why "I completed some and it doesn't
look much like a stamp" was the report.

**Everything inside a stamp is a fraction of the MEASURED diameter**, captured with `onLayout` —
nothing inside is in points. A stamp is ~99pt wide in the passport grid and 84pt in the home
strip, and a version of this used a fixed 22pt mark for both, which is 22% of the grid cell and
reads as a small icon lost in a big circle. The ratios: mark `0.34`, straight legend `0.115`, arc
legend `0.105`, inner-ring inset `0.05`, rule width `0.28`. A percentage width cannot be resolved
during render, so the grid draws its rings on the first frame and their contents on the second.

**The arc is hand-placed letters, because there is no text-on-a-path and no SVG.** Each letter is
its own absolutely-positioned box filling the circle — which puts its transform origin exactly at
the centre — and then `transform: [{ rotate: a }, { translateY: r }]`. Transforms compose left to
right as in CSS, so the frame turns by `a` first and the letter then slides `r` down that turned
axis, landing on the circle of radius `r` already rotated tangentially. A **positive** angle lands
left of bottom-centre, so the angles count DOWN across the word for it to read left to right.
Spacing is one approximated advance width (`0.66em + 0.16em`) per letter rather than measured
metrics: measuring costs a layout pass per character for a six-letter word nobody will kern.
**Only the completed state gets the arc.** "4/26" on a curve is unreadable at this size and the
arc is there to mark the one state worth marking.

**The inner ring is a full point, not a hairline.** At `StyleSheet.hairlineWidth` over a tinted
disc it was invisible, which left one visible ring — and one ring is a badge.

**Only an earned stamp leans**, and the angle is hashed from the challenge id rather than random —
a random angle re-rolls on every render and the page wobbles. Square to the page is what a printed
form looks like; the lean is the whole illusion.

Glyphs are SF Symbols that shipped in **SF Symbols 4 or earlier**. A name iOS does not recognise
renders as empty space with no error, and an empty stamp is indistinguishable from a layout bug,
so this is not the place for a new glyph.

Cells are **30% wide with an 8pt column gap**. At 31% with a 16pt gap the third cell overflows a
393pt screen by 9pt and silently wraps to two per row. If you change either number, check it
against a 320pt screen.

`borderStyle: 'dashed'` is deliberately not used for the unearned ring: combined with a corner
radius it renders solid on iOS, so the dashes would appear on web and Android only.

### Rings

`react-native-svg` landed in the native batch of 2026-11-05, so the Stats headline is a ring now
rather than a bare number. `ProgressRing` takes a diameter, a 0–1 fraction and two colours, and
centres whatever you pass as children.

**The radius is `(size - stroke) / 2`, not `size / 2`.** A stroke straddles its path, so half of it
falls outside a radius measured to the edge and the ring is clipped on all four sides.

**The rotation is on a `<G>`, not the `<Circle>`.** A dash array starts at three o'clock and
progress has to start at twelve. Rotating the group leaves `r` and the circumference readable as
the numbers they are, and circle-level `rotation` is honoured on iOS but dropped by some web
renderers — and this component renders on web.

**Nothing is drawn at zero.** `strokeLinecap="round"` paints a dot for a zero-length dash, so an
empty ring would carry a bead at twelve o'clock that reads as one visit logged out of hundreds.

**Text inside a ring is sized against the bore, not the diameter.** The 92pt ring on Stats has an
8pt stroke, leaving 76pt of usable width; the 44pt number that used to sit there alone is half
again wider than that. It is 26pt now.
---

## Challenges

Thirty-three of them, and all but one need **no catalog import**. They are derived from
columns the rows already carry — `venue_kind`, `dining_style`, `price_tier`,
`cuisine`, `resort_id`, `area_id`, `sub_area`, `tags`, resort `tier` and
`transport` — plus the dates already on the visit and stay log. That is what
makes a new challenge an over-the-air change rather than a new binary.

Every builder ends in **`fromSteps`**, which counts the ticks and fills in either the tier ladder
or the all-or-nothing fields. Each builder therefore decides one thing only: which rows become
steps. Six of them were each writing out the same eight properties before this.

| builder | shape | used by |
|---|---|---|
| `tagChallenge` | tiered, one step per tagged venue | Character, Signature |
| `setChallenge` | all-or-nothing, one step per tagged venue | Monorail Bar Crawl |
| `pickChallenge` | either, one step per venue matching a predicate | the crawls and collections |
| `stayChallenge` | either, one step per RESORT matching a predicate | Skyliner Line, Resort Collector |
| `pavilionChallenge` / `cuisineChallenge` / `groupedStayChallenge` | all-or-nothing, one step per GROUP, ticked by any member | Drinking/Snacking Around the World, A Taste of Everywhere, Monorail Resorts, Every Kind of Stay |

The group shape is the one to reach for whenever several places satisfy one
step. `venueId` is null there unless exactly one place would tick it, because
picking one on the user's behalf is guessing.

**`ChallengeStep.kind` decides which detail screen a tap opens** — `'resort'` for the stays
challenges, a venue otherwise. And a step can have no `venueId` and no `options` at all: a month
of the year is a real step with nothing to open. That is why `options` is left `undefined` there
rather than empty, because an EMPTY array means "this step is a choice and the catalog has
nothing to offer for it", and the detail screen says exactly that.

**Steps are sorted by their second line, then alphabetically inside it.** The catalog's own order
is alphabetical by name across the whole list, which scatters a crawl: the Monorail Bar Crawl's
three Contemporary bars came out first, fourth and eighth, interleaved with the Grand Floridian's.
A list that named every resort correctly still could not be walked in the order it was printed.
On an area challenge the same sort groups by land, which is what the second line is for there.

### The half that is not about eating

Everything up to this point was something you ate or drank. These are scored off the **stay log**
and the **dates on it**, so none of them needs a meal:

| challenge | counts | target |
|---|---|---|
| The Monorail Resorts | a night at each of the three, either half of each | 3 |
| The Skyliner Line | a night at each resort whose `transport` has `skyliner` | 4 |
| Every Kind of Stay | a night in each resort `tier` | 4 |
| Resort Collector | every Disney-owned resort, tiered | 31 |
| All Year Round | a visit or a stay in each calendar month | 12 |
| Four Parks, One Day | the four parks on your BEST single day | 4 |

**The monorail resorts are grouped, not listed.** Six rows carry `monorail`, because each of the
three resorts has a DVC half — Bay Lake Tower is the Contemporary, the Villas are the Grand
Floridian, the Bungalows are the Polynesian. Scoring over six rows would quietly require buying
into Disney Vacation Club, so either half ticks the resort off and both are offered as ways in.

**Only exactly dated visits count toward All Year Round.** The onboarding backfill writes today's
date with `date_exact = 0` against everything someone ticks off, so counting those hands whoever
installed the app in March a free March for a hundred meals from years ago — and the one month it
filled would be the one month they could never then earn honestly.

**Four Parks, One Day is scored on the best single day, not cumulatively.** Four parks across four
trips is not park hopping. Three of four means one day got close, not that three parks are banked.

`stayable` is `eligible`'s counterpart: Disney-owned and open. The resort percentage on Stats and
every stay challenge count from it, so the two cannot disagree about the total.

### Quests

| challenge | counts | target |
|---|---|---|
| Four Parks, One Day | the four parks on your best single day | 4 |
| The Transportation Challenge | reaching a resort served by each way of getting around | 5 |
| Under the Fireworks | the four free nighttime shows, hand-ticked only | 4 |
| The EPCOT Festivals | the four festivals, hand-ticked only | 4 |
| The Holiday Parties | the three after-hours parties, hand-ticked only | 3 |
| All Year Round | a visit or a stay in each calendar month | 12 |

The page is captioned **"More fun challenges."** Not "where you were, when you were here, and
how you got around", which was accurate and said nothing — four stamps whose only shared trait
is that none of them is a meal. Nobody needs that taxonomy; they need to know there is more in
here.

#### Four food challenges were removed on 2026-11-06

**The Buffet Line**, **Street Eats**, **Set Menu** and **Top Dollar** are gone from the array in
`use-passport.ts` and their glyphs are gone from `stamp.tsx`. Jake's wife judged them surplus, and
the reasoning holds up: three of the four sorted venues by a property nobody plans a trip around.
"Every prix-fixe restaurant" and "every four-dollar-sign restaurant" are facts about a price
column, not things anyone sets out to do, and the passport works because its challenges name an
outing someone would actually describe to a friend.

**Nothing is lost by removing one.** A challenge is derived from the log on every render, so a
stamp is a view over meals that are still there — delete the challenge and the meals remain, add
it back and the stamp returns at exactly the progress it had. The only casualty is
`achievements_seen`, which keeps the orphaned milestone keys forever; they are inert, and a
re-added challenge would simply not re-celebrate a tier it had already acknowledged.

Food and drink went 13 named challenges to **9**, so the page now holds 9 + 12 area stamps.

#### These six, and ONLY these six, can be ticked by hand

`MANUAL_CHALLENGE_IDS` in `use-passport.ts`, which is `QUEST_CHALLENGE_IDS`. The reason it is
exactly the quests is that they are the only challenges **the app cannot observe**, and each one
fails differently:

- **Four Parks, One Day** is scored off MEALS in four parks on one date. Park hopping is done
  with your feet; a day in all four parks that involved no sit-down meal counts for nothing.
- **The Transportation Challenge** infers a mode from a resort you ate or slept at. But the
  monorail runs between Magic Kingdom and EPCOT, the Skyliner stops at two parks, and the ferry
  needs no resort at all — so the most obvious way to ride each of them is exactly the one with
  no resort to infer it from.
- **Under the Fireworks** has nothing whatsoever to score from — see below.
- **The EPCOT Festivals** looks observable and is not. A festival is a DATE RANGE over a park,
  and the log holds dates and areas, so "ate at EPCOT in October" seems like it ought to settle
  it. The dates move every year, nothing in the app knows them, and hardcoding four moving
  ranges would be a calendar to maintain forever that silently mislabels a trip the first year
  it goes stale.
- **The Holiday Parties** are separate tickets and nothing about buying one reaches the app.
  A party is not a meal either: somebody can spend a whole evening at Not-So-Scary eating
  nothing but the free candy.
- **All Year Round** reads dates off the log, which a day trip with no meal and no hotel never
  leaves behind.

Three of the six — fireworks, festivals and parties — **the log can never move at all.** Every
step is `done: false` at birth and only a tick changes it.

#### The festivals and the parties are hardcoded too

Added 2026-11-06 at Jake's request. `EPCOT_FESTIVALS` and `HOLIDAY_PARTIES` in
`use-passport.ts`, beside `NIGHTTIME_SHOWS` and for the same reason: neither a festival nor a
party is a place you book a table at, so neither belongs in `catalog_venues`.

**The catalog is a trap for both, in exactly the fireworks shape.** It carries three festival
DINING PACKAGES — the Candlelight Processional package, Disney on Broadway, the Food & Wine
Concert Series — and two Not-So-Spooky dessert parties. Every one is a paid add-on. Scoring
either challenge off them would count the people who bought a dinner and miss everyone who
walked the booths or wore a costume, which is what attending actually is.

**The free-with-admission rule does NOT apply to the parties, and that is deliberate.** Under the
Fireworks excludes the Halloween and Christmas party fireworks because they need a party ticket;
this challenge is ABOUT that ticket. A separate ticket is the defining feature of a hard-ticket
party, not a barrier that crept in. Do not "fix" one of these by applying the other's rule.

The festivals carry no `where`, because all four are at EPCOT and the challenge says so in its
title. The parties do, because they are not all in the same park — Jollywood Nights is at
Hollywood Studios and the other two are Magic Kingdom.

**`party.popper.fill` is the obvious stamp for the parties and cannot be used.** It is SF
Symbols 4, so iOS 16, and this app's deployment floor is 15.1 — where an unknown symbol renders
as empty space, indistinguishable from a layout bug. `moon.stars.fill` has shipped since SF
Symbols 1 and says the thing all three parties actually share, which is that they happen after
the park has closed to everyone else.

#### Under the Fireworks counts SHOWS, and they are hardcoded

`NIGHTTIME_SHOWS` in `use-passport.ts`, beside `TRANSPORT_ORDER`. Four steps: Happily Ever After,
Luminous, Fantasmic! and Fantasy in the Sky.

**Everything in it is free with park admission, and that is the rule for editing it.** Until
2026-11-06 the challenge was scored off the fifteen catalog rows tagged `fireworks`, and every
one of them is a BOOKING — California Grill, the Rose & Crown and Spice Road dining packages, the
three Magic Kingdom dessert parties, the Not-So-Spooky and Minnie's Christmastime parties. Jake's
wife put it plainly: it should not be the fireworks you pay for, nor the restaurants near them.
She is right, and the mislabelling was worse than the undercount — a tick on "Rose & Crown
Fireworks Dining Package" claims you attended THAT, so somebody who watched the show from a bench
had no honest way to record it.

The Halloween and Christmas party fireworks stay out because they need a separate party ticket.
Fantasy in the Sky is in because New Year's Eve needs nothing but admission.

**A show is not a catalog row and must not become one.** It has no menu, no price tier and no
reservation, and giving it a `catalog_venues` row would put a thing you cannot eat at into every
list that reads from that table. The list is also volatile — Luminous replaced Harmonious,
Happily Ever After replaced Enchantment — so expect to edit it, and re-check the
park-admission rule each time rather than adding whatever is newest.

**This is the only challenge the log can never score.** Every step is `done: false` at birth and
stays there until someone ticks it, because standing in a crowd leaves no row behind. The other
three quests are at least partly observable — four parks from meals, a transport mode from a
resort reached — which makes this the purest case for `MANUAL_CHALLENGE_IDS` rather than an
exception to it. Not tiered: four steps is a ladder you can read at a glance.

In every case the app is not WRONG about what it saw; it cannot see the thing being asked about.
Everything else in the passport is derived — a stamp is the shadow of a meal or a night already
logged, so a checkbox there would be a second, contradictory source of truth for something
already known. **Do not add a tick to a derived challenge.**

**Marks are additive only, and that is a safety property rather than a storage decision.** A mark
can ADD a tick the log did not earn; it can never remove one the log did. There is no "not done"
row and no override — un-ticking is a DELETE, which drops the step back to whatever the log says.
In code it is one line, `done: st.done || marked`, and it lives in `fromSteps` — the single place
every challenge passes through — because `earned` is derived from `done` on the next line, and a
builder that marked its own steps and forgot to recount would show ticked boxes above a count
that disagreed with them.

Be precise about what the asymmetry promises. It guarantees **nothing the log earned can be taken
away by a tap**: a step backed by a logged meal is not tappable, so no sequence of taps un-earns a
stamp the log is holding up. It does NOT mean a stamp can never be lost — un-ticking a mark that
was carrying a stamp on its own drops that stamp back to incomplete, which is correct, because
retracting a claim should retract what the claim earned. The celebration does not fire twice on a
re-tick: `achievements_seen` only ever grows, so the milestone key stays acknowledged.

A step the log earned is deliberately **not tappable**. There is nothing a tap could do there
that would be honest: un-ticking cannot un-log the meal, so the circle would either lie or bounce
back. `step.marked` is true only when the mark is doing the work, which is what the "Marked by
you" line under a row is keyed on — saying it under a step the log earned would be false, and
saying nothing at all leaves no way to tell which ticks are yours to undo.

**On a manual step the WHOLE ROW is the control, and a chevron does the navigating.** The first
cut made only the circle tappable, reasoning that the row's tap belonged to navigation. That was
wrong in the most ordinary way: three of the four manual challenges — park-hopper, transportation,
all-year-round — build steps with `venueId: null` and no options, so on those the row had nothing
to navigate to and was simply **inert**. A tester tapped the box, nothing happened, and there was
no way to discover that a 20pt circle was the only live part of a full-width row.

**A control you have to be told about is not a control.** The circle still looks different on a
markable row — `borderWidth: 1.5` in `theme.accent` against a hairline `theme.border` — but it now
says "this row is a checkbox" rather than "aim here".

The chevron renders only when `canMark && venueId`; on every other row the row itself navigates
and a chevron would point at the thing already under your thumb. It is the ordinary trade — the
row does the main thing, a small button does the secondary thing — and marking is unambiguously
the main thing on a screen that exists BECAUSE the app cannot observe the achievement.

**It was built for Under the Fireworks, which no longer needs it, so right now it is dormant:**
no manual challenge has steps with a `venueId` any more. Keep it. The condition is self-checking
and the alternative is that the next manual challenge with venue steps silently loses its
navigation, which is the bug this whole section is about.

Marks live in `challenge_marks`, carry NOTHING but the challenge id and step id, and **sync** —
see Sync and Database. No date, no place, no note: the step id is the whole claim. "I rode the
Skyliner" is the fact worth keeping; when and from where is a trip diary this is not, and storing
it would be collecting data no part of the app reads.

**A resort counts as REACHED if you stayed there OR ate there**, because both mean you travelled
to it — you cannot have dinner at the Polynesian without a monorail, a boat or a bus. What the
app cannot know is which one you took. "The monorail, the Skyliner, a bus and a ferry in the same
trip" was the request, and nothing short of a transport log would support it, so the blurb
promises only what is counted. Transport steps carry no `options`: bus serves 32 resorts, and a
row of 32 chips is not a checklist, so the second line names them under five and counts them
above.

**`eligible` excludes events; `withEvents` does not, and which one a builder uses depends on its
SHAPE.** The rule at the top of `use-passport.ts` keeps events out of a denominator, and that is
right for a flat challenge, where one more tagged row is one more thing you must do — the
Signature Dining bug was a New Year's Eve party standing between every user and a finished
challenge. It is wrong for a GROUPED challenge, where an event can only add a way in. Routing
the pavilions through `eligible` quietly stopped six real ways in from counting: La Cava, the
Rose & Crown and Shiki-Sai fireworks packages, and the three festival packages at the American
Adventure. `data/README.md` had said so all along.

**Under the Fireworks used to be the other half of this note, and no longer is.** It was counted
from `withEvents` because every row it matched was an event — a dessert party, a dining package,
a rooftop reception — and it was tiered so that two Halloween-only and two Christmas-only parties
did not mean three trips before the first sign of progress. It now reads no catalog rows at all;
see the section on it below.

**Every challenge counts from `eligible`, never from the raw catalog.** This
was a live bug: Signature Dining counted from all rows, and "The Magic of New
Year's Eve at California Grill" carries the `signature` tag and is an `event`,
so finishing the challenge required attending one specific New Year's Eve
party. The rule at the top of `use-passport.ts` — events and permanently
closed venues never appear in a denominator — was being applied to the area
percentages and not to the challenges. Target went 25 to 24; Monorail (10) and
Character (13) were unaffected.

**Cuisines are lower-cased before grouping.** The catalog holds `american` and
`American`, and `Norwegian` and `norwegian`. Without normalising, one cuisine
becomes two steps and the second is one almost nobody would ever tick. Fixing
the CSV would be better, but surviving it is required either way, because the
import runs on data people type by hand.

### Challenges still blocked on catalog data

A Skyliner crawl and a Bay Lake crawl are both real, popular routes and both
come out too thin to ship — two stops each — because the resort pool bars are
missing from `venues.csv`: Petals Pool Bar (Pop Century), The Drop Off (Art of
Animation), and on the BoardWalk side Jellyrolls, Atlantic Dance Hall and
Boardwalk Joe's. Add those rows and both challenges become one `pickChallenge`
call each.

Two name defects show up in a checklist, where the full name is printed rather than a card
heading: **"The Perch at Disneys Grand Floridian Resort and Spa"** repeats its own resort — which
is already the row's second line — and several rows have lost their apostrophes (`Narcoossees`,
`Trader Sams Grog Grotto`). Fixing these is a `venues.csv` edit and an import, not a code change.

---

## Export

Every text field goes through the RFC 4180 quoting in `src/lib/export-csv.ts`, not just the ones
that look risky — a venue description with a comma is the normal case here. A value starting `=`,
`+`, `-` or `@` is prefixed with an apostrophe, because a spreadsheet will otherwise evaluate a
restaurant note as a formula. Exports are written to the cache directory, not documents: the file
exists to be handed to another app, and iOS reclaims it on its own.

---

## Editing something already logged

`updateVisit` / `updateStay` in `src/hooks/use-visits.tsx`, reached by passing `visitId` or
`stayId` to the existing `log-visit` / `log-stay` modal. The modal switches to edit mode on that
param rather than being duplicated: same fields, same validation, same date picker, with
`addVisit` swapped for `updateVisit` and the title and button relabelled.

**`synced_at = NULL` is what makes an edit real.** Push selects rows where it is null and upserts
them on `id`, so clearing it is the entire sync story. Omit it and the correction looks saved,
survives a restart, and silently reverts the next time that row is pulled — the worst shape of
bug available here, because the UI confirmed it.

**The venue and the resort are deliberately not editable**, which is why the input types are
`Omit<AddVisitInput, 'venueId'>` and `Omit<AddStayInput, 'resortId'>`. Moving a visit to a
different restaurant is not a correction: it rewrites passport progress and can un-earn a medal
that has already been celebrated. Logging the right place and deleting the wrong one says the
same thing visibly.

**Premium fields pass through UNGUARDED on an edit, and must.** The add path guards `note`,
`dishes` and `photos` behind `isPremium` as defence in depth. Copying that to the edit path is a
data-loss bug: all three sit behind `PremiumGate` and are seeded from the row, so the guard
cannot prevent a write the UI already prevents — it just erases a lapsed subscriber's notes and
photos the moment they fix a date. `log-stay` carries `note` across explicitly for the same
reason: that form has no note field at all, so letting it default would wipe any note that
arrived from another device.

**`existing` is read once, in a `useState` initialiser.** Reading it from `visits` on every
render means a pull landing mid-edit swaps the fields out from under whoever is typing. If the
row is missing the form refuses rather than falling back to the blank one — otherwise an edit of
a row deleted on another device becomes a duplicate visit.

Deleting a visit or stay now **confirms**. It was a single unguarded tap, survivable while it was
the only control on the row; Edit sits beside it now, and a mis-tap destroyed a visit, its rating
and its note with no undo.

---

## Telling a tester which build they are on

`src/lib/build-info.ts` plus the **This build** section of `src/app/settings.tsx`. It exists
because for the first week the app named its version nowhere, so neither a tester nor a developer
could answer "which build is this" without going to App Store Connect — and two bug reports were
misdiagnosed in the gap. It is the cheap version of the install-count check above: in the app,
in one screenshot, from the person actually holding the phone.

Everything it shows is read from the **binary**, never the manifest, and the distinction is the
whole point — an update can rewrite the manifest, so asking the manifest which update is running
lets the suspect supply its own alibi:

- `Constants.platform.ios.buildNumber` is the embedded `Info.plist` `CFBundleVersion`, fixed for
  a given binary. `Constants.expoConfig.ios.buildNumber` is NOT the same value and travels with
  updates.
- `Updates.runtimeVersion` is the fingerprint this binary will accept. Two phones differing here
  can never run the same update, which makes it the single most useful line on the screen.
- `Updates.isEmbeddedLaunch` distinguishes "running the JS I shipped" from "running an update".

**Do not add a native module to display this.** `expo-application` is the documented home for
`nativeBuildVersion`, it is not a dependency here, and adding it would move the fingerprint and
orphan build 5 — the diagnostic for the orphaning bug would have caused one. `expo-constants`
and `expo-updates` are already in the binary and between them cover every field. Verified: the
whole feature left the hash at `d41cd429…`/130 sources, so it shipped over the air.

**"Check for an update" must not say "you are up to date" when `isAvailable` is false.** The
server filters by runtime version before replying, so an orphaned build and a current one get the
identical `noUpdateAvailableOnServer`. Reassuring a phone that can never be updated again is the
one actively harmful answer, so the copy splits on `isEmbeddedLaunch` and points at TestFlight
instead of making a claim it cannot support.

`describeBuild` is kept pure and import-free so Node can check it headlessly — the 12am/12pm
hour wrap is the part that silently breaks.

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

### `challenge_marks` MUST be live in Postgres before the code that reads it SHIPS

Added 2026-11-05 at local `SCHEMA_VERSION 10` and drizzle `0009_chilly_ironclad.sql`. This is the
rule below about synced columns in its sharpest form, and the failure is worse than a missing
column: `pull()` selects from `challenge_marks` on **every sync, unconditionally**, so if the
table does not exist the whole cycle throws and every user — including the ones who never tick a
quest step — gets a sync error instead of a backup.

**"Ships" means the binary OR the over-the-air update, whichever carries the code.** The rule is
easy to mis-state as "before the build", which is wrong in the common case: this work was pure JS
on an unchanged fingerprint, so it reached build 6 through `npm run update:prod` and never saw a
build at all. The gate is the moment the new `sync.ts` starts running on somebody's phone.
`npm run db:migrate` comes first either way.

Build 6 itself was cut from `6e23f26`, which predates `challenge_marks`, so a phone sitting on the
shipped bundle queries nothing that does not exist. That is the only reason there was no window
of broken syncs between the commit and the migration.

### The native batch landed on 2026-11-05, and the runtime version moved

`react-native-svg`, `react-native-view-shot` and `expo-sensors` were added together, on purpose.
Each one is a native dependency, so each one alone would have moved the fingerprint and cost a
build; batching them cost one. The hash went from **`d41cd429e25dcb2a8513567d4b7617f6a1a7e7fa`**
(130 sources, build 5) to **`5e3f743684cfbce7aa186d72159a3e88cb955b2b`** (136 sources, build 6) —
among the new sources being `node_modules/expo-sensors/ios`, `node_modules/react-native-svg` and
`node_modules/react-native-view-shot`, plus both autolinking configs rehashing.

**`bd1bedc58beaa998a1332aaeed19f4eb6894371e` (133 sources) was recorded here earlier and is
wrong.** It never corresponded to a build. `eas build:list` reports build 6's Fingerprint as
`5e3f7436…`, which is exactly what `expo-updates fingerprint:generate` returns on this machine,
so the two agree and the 133 reading was simply bad. Corrected 2026-11-05.

The lesson is the procedural one and it is worth more than the hash: **a fingerprint written down
by hand is a claim; `eas build:list --platform ios` is the evidence.** Comparing the local
fingerprint against a number in a file risks concluding "the binary is orphaned, cut a new build"
when nothing of the kind is true — which is a wasted build, a wasted TestFlight round, and an
install your testers did not need.

**Builds 4 and 5 are therefore orphaned and cannot be reached over the air again.** An
`eas update` published while they were the newest thing installed would succeed, report a healthy
update group, and reach nobody — exactly the trap documented under Over-the-air updates. There
was no OTA path to the new fingerprint; the testers had to install the binary.

**That window closed on 2026-11-05: build 6 (`5e3f7436…`) is in TestFlight and OTA works again.**
Anything that does not move the fingerprint now reaches build-6 phones through
`npm run update:prod` with no build at all. Before reaching for a build, check whether the change
actually touches a fingerprint source — nothing under `src/` does, so the honest answer for most
work is no.

Still unanswered, and it matters before `expo-widgets` is added: **whether widget JS is reachable
over the air at all.** A widget component compiles into a separate bundle inside the extension,
and neither the SDK 57 docs nor Expo's own announcement says whether `expo-updates` reaches it. If
it does not, every widget tweak is a new binary.

### Identifiers

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
| `EXPO_PUBLIC_REVENUECAT_KEY_APPLE` | — | ✅ | ✅ | sensitive |
| `SENTRY_AUTH_TOKEN` | — | ✅ | ✅ | **secret** |

`EXPO_PUBLIC_REVENUECAT_KEY_APPLE` is absent from `development` deliberately, and the mechanism
is worth understanding because it is not obvious: a development build gets its NATIVE code from
EAS but its JAVASCRIPT from Metro, and Metro inlines `EXPO_PUBLIC_*` from the local `.env`. So
`EXPO_PUBLIC_REVENUECAT_KEY_TEST` in `.env` is what a dev build actually reads, and it never
needs to exist in EAS at all. The table above is the EAS state; `.env` is a separate, local
fourth column that only development uses.

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

### Photo storage will outgrow the Free Plan, and a date is the wrong alarm

Measured on a device, not estimated: a resized photo is **~500 KB**, a visit holds up to six, so
a fully-photographed visit is **~3 MB**. The Free Plan's 1 GB of file storage is therefore about
**340 six-photo visits across every user combined** — not per user. Pro's 100 GB is the answer
and is deliberately NOT a launch requirement: at launch there is no photo sync at all, and the
first users will not fill a gigabyte.

**The upgrade trigger is usage, not a date.** A calendar reminder set today fires when the
calendar says so, which is uncorrelated with when the storage actually fills — it will go off
while the bucket is at 4%, get dismissed, and not go off again on the month that matters. So:

- The daily `keep-supabase-awake` workflow is where the check belongs, and it **fails** above a
  threshold rather than printing a warning nobody reads. Same reasoning as that workflow's
  `exit 0` bug: a check that cannot fail is a check that costs attention and returns nothing.
- Alert at **60% of the plan's storage**, not 90%. The point is to have time to upgrade
  deliberately, not to be told while uploads are already failing.
- Reading the number needs `storage.objects`, which PostgREST does not expose. A
  `SECURITY DEFINER` function in `public` is the way in, with the same four protections as
  `delete_own_account`.

**What happens at the limit is an app problem, not only a billing one.** Uploads start failing,
and the photo-sync work must treat that as expected: the photo stays on the device, the visit
still saves, and nothing tells the user their picture was rejected by a quota. A failed upload
that loses the photo, or blocks the visit from saving, turns a bill into data loss.

Build the check as part of the storage migration, not as a follow-up. An alarm added after the
thing it watches is an alarm that gets added after the thing it watches overflows.

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

**`npm run db:check` now enforces `withCheck`, and `npm run db:check:verify -- --yes` proves
that it does.** The guard used to print "RLS on, 1 policy" for a correct table and for one whose
write policy carried only `using`, which is to say it could not see the rule this section calls
non-optional. It now fails when any table with a `user_id` column has an `ALL`/`INSERT`/`UPDATE`
policy with no `with_check`, and prints a `writes` column so the state is visible rather than
asserted. "User-owned" comes from the presence of that column, not a list, so the next table is
covered the day it is added rather than the day somebody remembers.

The verifier exists because a guard nobody has watched fail is a guard nobody should trust — the
same lesson as the heartbeat workflow's `exit 0` and the catalog seed test. It creates one empty
table with a deliberately broken policy, asserts `db:check` rejects it and says why, fixes the
policy, asserts it passes, and drops the table in a `finally`. It **writes to the database it is
pointed at**, so it refuses to run without `--yes` and is deliberately not part of `db:check`.

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

### A CSV edit that has not been imported does not exist

This one reached a phone, and its symptom pointed nowhere near its cause: **the Monorail Bar
Crawl opened to an empty checklist** — the banner, the blurb, the progress bar, and nothing
underneath.

`data/venues.csv` had grown a `monorail-bar-crawl` tag on ten rows and `src/data/catalog.json`
had been regenerated from it, so the change looked shipped. `npm run db:import` was never run, so
Supabase still held those ten rows untagged. On a device:

1. **install or update** — SQLite is seeded from the bundled `catalog.json`, which HAS the tag.
   The challenge works.
2. **first refresh** — `writeCatalog(..., source: 'remote')` DELETEs every row and rewrites it
   from Supabase, which does not. The challenge silently drops to zero steps.

So it was broken only on devices that had been online, which is the opposite of how a
missing-data bug is expected to behave, and it looked like a layout bug rather than a data one.
`use-catalog`'s guard catches a refresh that returns NOTHING — the loud failure. Nothing caught
one that returned rows that were merely old.

**The remote catalog always wins on a device.** Regenerating the bundle makes a CSV change look
live right up until the first refresh takes it away again, which is worse than not shipping it.
So the order is always: edit CSV → `npm run db:import` → `npm run data:bundle` → publish.

    node scripts/check-catalog-sync.mjs

compares every verified CSV row against the deployed catalog, field by field, using the same
publishable key and the same columns the app reads — so it sees what a phone sees and needs no
`DATABASE_URL`. Coordinates are compared to 1e-9 degrees, because PostgREST serialises a double
to 15 significant digits and 28.371383424602794 comes back as 28.3713834246028: a rendering
difference, not a data difference. Orphans are reported and do not fail, since the importer never
deletes.

**It is deliberately not an npm script.** The `scripts` block of `package.json` is a fingerprint
source (`packageJson:scripts`), so one more line in it moves the runtime version and orphans
every binary already on a phone. A developer convenience is never worth a new build. Same reason
`check-catalog-sync.mjs` and `import-catalog.mjs` share their CSV cell converters out of
`scripts/vocabulary.mjs`: a guard with its own private idea of what an empty cell means is a
guard that will eventually disagree with the thing it guards.

---

## Before saying something works

- `npm run typecheck` passes.
- `npm run db:check` passes, if the schema changed.
- `npm run validate:data` passes, if the CSVs changed.
- `npm run check:catalog` passes, if `CATALOG_DDL` changed. A fresh install is not a test —
  this one upgrades an existing database, which is what every current user actually does.
- `node scripts/check-catalog-sync.mjs` passes, if either CSV changed. A bundle rebuild is not an
  import, and the device prefers the server — see "A CSV edit that has not been imported does not
  exist".
- `npm run check:iap` passes, if a product identifier or the paywall changed. A mismatch has
  no symptom: the plan shows its fallback price, says "Not available here" when tapped, and the
  only sign is revenue that never arrives. It caught `premium_annual` vs `premium_yearly` on its
  very first run.
- Checked on a real device in **both** light and dark, **and on a device that already had the
  previous build installed.** A clean install exercises a different code path from an upgrade,
  and the upgrade path is the one with users on it.
- No color literals added outside `theme.ts`.
- No credentials in any committed file — real values go in `.env`, which is gitignored.
