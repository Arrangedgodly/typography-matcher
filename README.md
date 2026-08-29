# "Blind Test" Typography Matcher

Judge font pairings on merit, not on name recognition.

Every pairing gallery shows you the font names first — and brand bias kicks in before you've judged anything. This tool flips the order: a fixed dummy webpage (hero, standfirst, paragraphs, blockquote, small UI chrome) receives random pairings from a curated set of 61 Google Fonts combinations, with identities **hidden**. Swipe right to save, left to skip. Font names are revealed **only on the saved list**, where each save can be copied as a ready-to-paste Google Fonts `<link>` + CSS snippet.

**Live:** [font.graydonwasil.com](https://font.graydonwasil.com)

## How it works

1. A random unseen pairing is drawn and loaded dynamically from Google Fonts. The card only appears once both faces have loaded — you never judge a fallback font.
2. Judge in context on the dummy page: drag/swipe (touch or mouse), the on-screen buttons, or the ←/→ arrow keys — all identical in effect.
3. Saved pairings appear on the saved list with names, roles, and categories revealed, and persist in `localStorage` across reloads. Each save exports to your clipboard as working CSS.
4. When you've seen everything, the exhaustion state offers a reshuffle.

## Stack

- [Vite](https://vite.dev/) + TypeScript, compiled to a static bundle — no backend, no accounts, no analytics
- Vitest (unit) + Playwright (e2e)
- Deployed to GitHub Pages via GitHub Actions

## Development

```sh
npm install
npm run dev            # local dev server
npm run build          # type-check + production build
npm test               # unit tests
npm run test:e2e       # e2e (local gate — drives system Chrome over live Google Fonts)
npm run validate:fonts # validate the curated pairing dataset
```

Curated pairings live in [`src/data/pairings.json`](src/data/pairings.json) and are shape-validated at build and runtime.

## Accessibility

Keyboard parity is a core mechanic, not a fallback — the arrow keys are first-class save/skip inputs. `prefers-reduced-motion` disables card animation, and UI chrome contrast is ≥ 4.5:1 at all times (pairings change typefaces, never color).

## Docs

- [`PRODUCT.md`](PRODUCT.md) — product brief and principles
- [`DESIGN.md`](DESIGN.md) — design decisions
- [`docs/DEPLOY.md`](docs/DEPLOY.md) — deployment (GitHub Pages + Cloudflare DNS)
- [`docs/CREDITS.md`](docs/CREDITS.md) — credits
