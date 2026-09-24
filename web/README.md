# MagicalTracker — marketing site

Static Next.js site for magicaltracker.com. Exists primarily because Apple
requires a live **Support URL** and **Privacy Policy URL** before you can submit
to the App Store.

## Commands

```bash
cd web
npm install
npm run dev     # http://localhost:3000
npm run build   # static export to web/out/
```

`output: "export"` means the build emits plain HTML/CSS/JS. There is no server,
no edge runtime, and no adapter needed.

## Before going live

The legal pages contain deliberately visible placeholders, rendered in gold with
a dotted underline so they cannot be missed:

- `[LEGAL ENTITY NAME]`
- `[BUSINESS ADDRESS]`
- `[EFFECTIVE DATE]`
- `[STATE / JURISDICTION]`
- `[RETENTION PERIOD]`
- `[RESPONSE WINDOW]`

Check none remain:

```bash
npm run build && grep -o "\[[A-Z][^]]*\]" out/*.html | sort -u
```

You also need working mailboxes for `support@`, `privacy@`, and `data@`
magicaltracker.com. Apple sends review correspondence to the support address.

## Deploying

Cloudflare Pages, connected to this repo.

| Setting | Value |
|---|---|
| Root directory | `web` |
| Build command | `npm run build` |
| Output directory | `out` |
| Node version | `22` |

Vercel's free Hobby tier forbids commercial use and a landing page for a paid
app counts, so this is not hosted there.

## Design

Tokens in `app/globals.css` mirror `src/constants/theme.ts` in the app, so the
site and the product read as one thing. Change them in both places.

Dark mode works by redefining CSS variables under `prefers-color-scheme`, which
is why there are no `dark:` variants anywhere in the markup.

The non-affiliation disclaimer in `components/site-footer.tsx` is required and
must not be removed.
