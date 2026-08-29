# Plan — "Blind Test" Typography Matcher

Status: PENDING USER REVIEW
Inputs: town-hall.md (D1–D8, approved), design-brief.md (The Examination Room, approved), PRODUCT.md, .impeccable/config.json (buildPath: code)
Stack: Vite + TypeScript → static → GitHub Pages (publish behind user halt)

## Fixed by scope (no re-litigation in tasks)

Stack Vite+TS (user-chosen) · GitHub Pages via gh (D8, push = halt) · localStorage only (D2) · one dummy page = editorial essay on typography (confirmed) · one-viewport desktop focus, inner-scroll mobile, swipe-on-chrome · strict reveal on saved list only (D6) · export = clipboard CSS+link (D5) · exhaustion state + reshuffle (D7) · no analytics · code-led build (no comp round; ambition lives in design-brief + direction contract) · The Examination Room world with four named raises (SNAP-STEP DECK, LEADER-LINE REVEAL, ONE CORD, STATES IN PLACE).

## Lanes

P = product/UX · D = UI/visual design · F = frontend · Q = QA/test · O = DevOps · R = research (via deep-research-supreme)

## Task index

### M0 — Skeleton

**T01 · O · Repo + Vite scaffold** — `small` · `completed`
- Outcome: git-initialized repo, Vite+TS scaffold, `npm run build` produces `dist/`, baseline index.html renders.
- Scope: enabling. Files: repo root, `index.html`, `src/main.ts`, `tsconfig`, `vite.config.ts` (base path for GH Pages project URL).
- Deps: none. Parallel with nothing (first).
- Accept: `npm run build` exits 0; `dist/index.html` exists; `git log` has initial commit.
- Risk: none material.

**T02 · P/F · Pairing schema** — `small` · `completed`
- Outcome: TypeScript types + sample JSON for a pairing: two families (heading/body), each with Google-Fonts family slug, category/archetype tags, required weights+styles, role. Deck-level fields (id).
- Scope: planning-owned schema decision. Files: `src/types.ts`, `src/data/pairings.sample.json`.
- Deps: none (T01 parallel). Accept: schema compiles; sample validates; fields satisfy acceptance criteria 1/3 (weights carried) and reveal metadata (names/roles/categories).
- Assumption to verify in T04: css2 API URL construction from these fields.
- R2 note: schema must carry sampleText-compatible fields — family + weights + ital flags sufficient for css2 URL and `document.fonts.load()` calls.

**T03 · P · Dummy essay copy** — `small` · `completed`
- Outcome: production-grade editorial copy about typography: display headline (4–8 words), standfirst, 2–3 paragraphs, one blockquote, UI-chrome microcopy (nav label, button, caption).
- Scope: content authoring at full fidelity (design-brief §5); no factual claims needing citation.
- Deps: none. Accept: copy reads as a real design-magazine essay; lengths render one-viewport on desktop (checked in T07).
- Risk: copy that flatters some typefaces over others — neutral prose, no numerals-heavy or all-caps-dependent passages.

### M1 — Thin end-to-end path

**T04 · F · Font-loading engine** — `medium` · `completed` · *research-informed (R2, non-blocking)*
- Outcome: module that takes a pairing and injects an `<link rel=stylesheet>` per pairing (css2 URL, two families + weights, `display=block`); readiness gate = link-settle → per-face `document.fonts.load()` with sampleText → empty-array guard → double-rAF; old link removed only AFTER the new pairing is ready; 4000ms default timeout; optional next-pairing prefetch. Rejected alternative: manual FontFace/woff2 (unstable CSS parsing, subsetting replication). No leak of family names into visible UI. Committed via deep-research — auto-approved (ultron-supreme), evidence: research/R2-font-loading.md
- Files: `src/lib/fontLoader.ts`. Deps: T02 (schema). Parallel: T05, T06.
- Accept (unit): fake-timers tests for resolve-on-load, timeout, cleanup of previous link; URL construction snapshots.
- Research: R2. Risks: cross-browser load-event differences (mitigate: FontFace API readiness + link error listeners).

**T05 · F · Dummy page + CSS-variable swap** — `small` · `completed`
- Outcome: essay (T03) rendered in a structural layout; pairing applied via `:root` custom properties `--font-heading`/`--font-body` (+ weight vars); swap function updates variables only.
- Files: `src/components/DummyPage.ts` (or plain DOM module), `src/styles/dummy.css`. Deps: T01, T02, T03.
- Accept: swapping two hardcoded pairings changes typefaces instantly with no layout explosion; semantics (h1/section/blockquote) correct.

**T06 · F · Deck logic (pure)** — `small` · `completed`
- Outcome: pure TS deck: unseen-first random draw over pairing list with injected seen-set, exhaustion detection, reshuffle-clears-seen; no DOM.
- Files: `src/lib/deck.ts`. Deps: T02. Parallel: T04, T05, T10.
- Accept (unit): no repeat until exhaustion; exhaustion flag after N unique draws; reshuffle resets; deterministic under seeded RNG.

### M2 — The instrument

**T07 · D/F · Commit the Examination Room world** — `medium` · `completed`
- Outcome: direction contract (THESIS/OWN-WORLD/STORY/FIRST VIEWPORT/FORM/FINISH) as first-child HTML comment in the root layout; committed chrome: clinical neutral palette (bone/instrument-black family), chrome face chosen under the no-chart-letterforms constraint, red-green judgment bar as save/skip code (ONE CORD: accent reserved for judgment controls), acuity-lane framing of the dummy page, first-run explainer, progress vocabulary (distance markers).
- Scope: this is the world-commit — color strategy + faces decided here, per design-brief §7. Files: `index.html` (contract comment), `src/styles/*`, app chrome components.
- Deps: T01, T05. Accept: first viewport matches contract's FIRST VIEWPORT block; chrome never uses chart letterforms; contrast ≥ 4.5:1 on chrome text.
- Risk: world sliding toward generic dashboard — verifier checks contract blocks present and honored.

**T08 · F · Input parity** — `medium` · `completed`
- Outcome: pointer-drag swipe (touch+mouse) on card chrome with threshold + intent separation from inner scroll; green/red buttons; ←/→ keyboard; all three identical in effect; focus management.
- Files: `src/lib/gestures.ts`, review-screen wiring. Deps: T06, T07.
- Accept: acceptance criterion 2 (parity); swipe never fires while content scroll is active; keyboard-only operable.

**T09 · D/F · The lens-swap moment** — `medium` · `completed`
- Outcome: swap choreography: occluder blink + SNAP-STEP deck advance (whole card-height, one-step overshoot, settle; nothing glides); STATES IN PLACE loading state; `prefers-reduced-motion` → instant swap, no occluder.
- Files: `src/styles/motion.css`, review-screen. Deps: T04, T06, T07, T08.
- Accept: swap perceives-ready < 2s broadband; reduced-motion honored (criterion 6); no FOUT judgment window (criterion 1).
- R2 note: swap choreography must sequence with the readiness gate — reveal after double-rAF.

### M3 — Prescription card

**T10 · F · Storage layer** — `small` · `completed`
- Outcome: localStorage-backed store (saves, seen-set) behind an interface; storage-unavailable path → in-memory + non-blocking notice.
- Files: `src/lib/storage.ts`. Deps: none (interface from T06). Parallel: M2 tasks.
- Accept (unit): save/persist/remove round-trip; quota/private-mode simulation degrades without crash (criterion 7).

**T11 · F · Saved list (reveal)** — `medium` · `completed`
- Outcome: prescription-card view: names + roles + categories revealed with LEADER-LINE REVEAL styling; remove; back-to-deck; persists across reload; empty state; no name appears anywhere in review states (strict reveal, D6).
- Files: `src/views/savedList.ts`, styles. Deps: T07, T10.
- Accept: criteria 3 (reveal/persist/remove); grep-level check that review DOM never contains family names.

**T12 · F · Export** — `small` · `completed`
- Outcome: one-click clipboard copy: Google Fonts `<link>` + CSS variables snippet (family stacks + weights) from the pairing record; clipboard-failure fallback (selectable textarea).
- Files: `src/lib/export.ts` + button in saved list. Deps: T11.
- Accept: criterion 4 (valid CSS); pasted snippet actually loads the fonts when opened in a bare page.

### M4 — Dataset + validation

**T13 · R · Provenance & licensing disposition** — `small` · `completed` · **blocks T14 only**
- Outcome: research record in `docs/ultron/research/` answering: may the launch list derive from third-party pairing galleries' selections (fontpair.co et al. ToS), from Google Fonts popularity metadata, or must pairings be independently composed? Plus attribution format if derivation is permitted. RESOLVED via deep-research — disposition: independent editorial curation, galleries as per-pairing inspiration only, ≤20% single-gallery overlap, courtesy Credits note. auto-approved (ultron-supreme), evidence: research/R1-pairing-provenance.md
- Owner: deep-research-supreme track. Deps: none. Accept: disposition recorded in plan (committed decision) + evidence trail.

**T14 · P · Curate ~60 pairings** — `medium` · `completed`
- Outcome: `src/data/pairings.json` with ~60 quality-barred pairings per T13 disposition: category tags, weights/styles per family, verified slugs. Curation rules per R1: compose independently using Google Fonts facts (popularity/category); galleries may inspire individual pairs but no list-level derivation; single-gallery overlap ≤ ~20%; ship a courtesy Credits note in the repo.
- Deps: T02, T13, T15 (validation). Accept: T15 passes clean; spot-render of 10 random pairings looks intentional (typography-domain check).
- Risk: editorial effort underestimated — may split into two batches (30+30) if sizing proves out.
- DELIVERED (2026-08-28): 61 pairings, 110 unique families, none used more than twice; facts verified against the google/fonts mirror + per-tuple css2 probes; `npm run validate:fonts` PASS 61/61 + 115/115 woff2; build + 132/132 tests green; 12-pairing headless spot-render clean. App rewired to `src/data/pairings.ts` (sample stays the test deck via six one-block `vi.mock`s). Courtesy note at `docs/CREDITS.md`; rationale + overlap statement at `research/T14-curation-notes.md`. Evidence: production-log.md (T14 entry).

**T15 · O · Google Fonts validation script** — `small` · `completed`
- Outcome: node script: every family/weight in pairings.json still serves (css2 API 200 + family present); CI-runnable (`npm run validate:fonts`).
- Files: `scripts/validate-fonts.mjs`. Deps: T02. Accept: passes on sample; fails loudly on a deliberately-broken slug.
- R2 note: validation must expect css2 failures as HTTP 400 HTML (not 404) and check woff2 cache headers.

### M5 — Quality gates + ship prep

**T16 · Q · E2E happy path** — `medium` · `completed`
- Outcome: automated browser flow: fresh visit → explainer → judge 3 pairings → save 2 → saved list reveals → export copies → reload → persistence; deck exhaustion + reshuffle exercised.
- Deps: T09, T11, T12, T14. Accept: green run against production build.

**T17 · Q · Accessibility walkthrough** — `small` · `completed`
- Outcome: keyboard-only journey; reduced-motion verification; contrast measurements; focus order between deck and saved list; escape-on-render spot check (names, categories from dataset).
- Deps: T07–T12. Accept: criteria 6 + 8 verified and logged.
- DELIVERED (2026-08-28): walkthrough + the T16-adjudicated fix (judgment now GATED while the first-run explainer stands — `inputOpen()` term + stood-down bar restyle + pinned in `src/main.explainer-gate.test.ts`); contrast recomputed numerically for every chrome text pair incl. stood-down bar, all four strip notices, prescription surfaces, export feedback, blind label (min 4.60:1, hairline separator decorative/exempt); reduced-motion extended with a rendered-CSS e2e (blind never mounts, `animation-name: none` on pad/paper under emulated `reduce`); escape-on-render audit = zero HTML-injection sinks (textContent/dataset discipline throughout); aria: exhaustion notice promoted to polite status; exhaustion + T11 window.close hazard verified regression-free. Evidence: production-log.md (T17 entry).

**T18 · O · GitHub Pages prep** — `small` · `awaiting-approval` · **publish = halt**
- Outcome: production build configured (base path), deploy workflow or documented gh command sequence; NO push, NO publish — user halt gate.
- Deps: T16, T17. Accept: `npm run build` output serves correctly from a project subpath (local preview verified).
- DELIVERED (2026-08-28): subpath serving proven TWO ways — `vite preview` and a plain `python3 -m http.server` with the app nested under `/typography-matcher/` (index + both hashed assets 200, 404-sanity) — plus `.github/workflows/deploy.yml` (standard actions/deploy-pages pattern on push to main; Node 24 pinned since validate-fonts type-strips .ts, needing ≥ 23.6; runs `validate:fonts` + `npm test` + `npm run build`; e2e deliberately local — it drives system Chrome) and `docs/DEPLOY.md` (exact web-UI + gh CLI publish sequences with the halt-gate framing). Whole working tree committed (3 conventional commits: app T02–T17 / ci T18 / docs T18); repo clean; `git remote -v` empty; NOTHING pushed. Evidence: production-log.md (T18 entry).

## Milestones

| Milestone | Tasks | Independently testable outcome |
|---|---|---|
| M0 Skeleton | T01–T03 | Build passes; schema + copy exist |
| M1 Thin path | T04–T06 | Two hardcoded pairings swap live on the essay; deck cycles without repeats |
| M2 The instrument | T07–T09 | World-committed review screen; full input parity; swap moment under 2s |
| M3 Prescription card | T10–T12 | Save → persist → reveal → export works end-to-end |
| M4 Dataset | T13–T15 | 60 validated pairings in the deck |
| M5 Ship prep | T16–T18 | E2E + a11y green; deploy-ready bundle; halt at publish |

Critical path: T01 → T05 → T07 → T08 → T09 → T16 → T18, with T13 → T14 feeding T16.
Widest parallelism: T02/T03/T06/T10/T15 independent of the M2 chain.

## Research queue (deep-research-supreme)

- **R1 (=T13, blocking T14 only):** May the curated list derive from third-party pairing galleries or Google Fonts popularity data, under their terms — or must it be independently composed? What attribution is required where derivation is permitted?
  - **COMMITTED:** independent editorial curation using Google Fonts facts; galleries as per-pairing inspiration only (no list-level derivation), ≤ ~20% single-gallery overlap, courtesy Credits note — evidence: research/R1-pairing-provenance.md
- **R2 (non-blocking, informs T04):** What is the evidence-backed best practice for dynamic Google Fonts loading in a TypeScript SPA — css2 URL construction with weights/styles, `document.fonts.load` vs link-load events vs FontFace API, avoiding FOUT cross-browser, and cleaning up injected links?
  - **COMMITTED:** injected `<link rel=stylesheet>` per pairing (css2 URL, two families + weights, `display=block`) + readiness gate (link-settle → per-face `document.fonts.load()` with sampleText → empty-array guard → double-rAF); old link removed only after new pairing ready; 4000ms default timeout; optional next-pairing prefetch — evidence: research/R2-font-loading.md

### Decision matrix

| # | Status | Approval | Evidence |
|---|---|---|---|
| R1 | committed | auto-approved (ultron-supreme) | research/R1-pairing-provenance.md |
| R2 | committed | auto-approved (ultron-supreme) | research/R2-font-loading.md |

## Handoff

- **Build order:** M0 → M1 → M2/M3 interleaved → M4 → M5. First useful truth at M1.
- **Fixed by scope:** see header list.
- **Delegated to research:** R1 (blocks T14), R2 (informs T04).
- **Assumptions that return to Town Hall if broken:** ~60 quality pairings are achievable under the licensing disposition; Google Fonts CDN reliability is acceptable; clipboard is available in target secure contexts; one-viewport essay density fits desktop at ~1280px.
- **Approval needed before research begins:** this plan (single user review — supreme's one plan gate).

## Sizing summary

Small: T01, T02, T03, T05, T06, T10, T12, T13, T15, T17, T18. Medium: T04, T07, T08, T09, T11, T14, T16. Split-required risk: T14 only (noted in-task).
