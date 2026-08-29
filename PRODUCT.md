# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Vite + TypeScript, compiled to a static bundle; deployed to GitHub Pages. Chosen by the user 2026-08-28 (recommended option accepted).

## Users

Primary: working web/UI designers hunting a heading+body font pairing for a real project, and developers with design responsibility who want a defensible, fast choice. They know fonts by name — which is exactly the problem. Secondary: design-curious people who enjoy the swipe mechanic.

Situation: mid-project, evaluating pairings in seconds each, prone to defaulting to familiar typefaces (Inter, Roboto, Helvetica) for reasons of recognition rather than merit.

## Product Purpose

"Blind Test" Typography Matcher removes brand bias from font-pairing selection. A fixed dummy webpage (hero, standfirst, paragraphs, blockquote, small UI chrome) receives random curated Google Fonts pairings with identities hidden. Users swipe right to save, left to skip. Font names are revealed **only** on the saved list, where each save can be copied as ready-to-paste CSS + Google Fonts link.

Success means: a designer completes the loop unaided (judge → save → reveal → export) in one short session and leaves with usable CSS.

## Positioning

Every existing pairing gallery (fontpair.co, Typewolf, Archetype) shows names before or during evaluation, so brand bias operates before judgment begins. This tool withholds identities until after the verdict — a protocol neighbors cannot copy without abandoning their name-first format.

## Operating Context

- Static site, no backend, no accounts; localStorage persistence on-device.
- Curated pairing dataset (~60 at launch) embedded in the app; unseen-first random draw; seen-set persists; exhaustion state offers reshuffle.
- Runtime dependency: Google Fonts CSS API (fonts loaded dynamically per pairing; card reveals only after both faces load — users never judge a fallback font).
- English content. Modern browsers. Clipboard available (secure context on GitHub Pages).

## Capabilities and Constraints

Confirmed (approved scoping brief `docs/ultron/town-hall.md`, decisions D1–D8):
- Blind review loop via injected Google Fonts stylesheets + CSS custom properties (`--font-heading`, `--font-body`).
- Input parity: pointer-drag swipe (touch + mouse), visible buttons, ←/→ keyboard — all identical in effect.
- Saved list: names + roles + categories revealed, remove, cross-reload persistence, one-click clipboard export (`<link>` + CSS variables snippet).
- Graceful degradation when storage unavailable (in-memory saves + notice).
- `prefers-reduced-motion` respected; keyboard-only completable; chrome contrast ≥ 4.5:1 (pairings change type, never color).
- Strict reveal: names appear only on the saved list — no micro-reveal on save.
- No analytics.

Explicit non-goals: accounts/backend/cloud sync, multiple templates, custom user text, live algorithmic pairing generation, typographic controls (size/weight/leading sliders), dark mode, i18n, shareable URLs.

Undecided / open (owners in town-hall dispositions): pairing-list provenance & licensing (research, blocks curation data task); launch list size target ~60 quality-barred (research-informed).

## Brand Commitments

Product name: **"Blind Test" Typography Matcher** (working name as supplied by the user; not flagged as final).

## Evidence on Hand

None. No real content, assets, testimonials, or metrics exist yet. The dummy-page copy is unwritten (design phase owns it) and the curated pairing list is unresearched. Future work must not fabricate either.

## Product Principles

1. **The blind is sacred.** Any feature that leaks or softens identity-withholding (e.g., micro-reveals, name hints) is out by construction.
2. **Judge in context, not on specimen sheets.** The dummy page is the interface; realism of the evaluation surface outranks decoration.
3. **Seconds per verdict.** The loop must stay fast: font-load readiness, one-decision-per-card, no modal friction.
4. **Leave with something real.** Every saved pairing is exportable as working CSS; no dead-ends.
5. **A tool, not a destination.** Single-session utility is accepted; the tool earns its keep by the quality of what users take away.

## Accessibility & Inclusion

Keyboard parity is a core mechanic, not a fallback (←/→ keys are first-class save/skip inputs). Swipe is never the only input. `prefers-reduced-motion` disables card animation (vestibular sensitivity). Chrome text contrast ≥ 4.5:1 at all times; pairing changes affect typefaces only, never color.
