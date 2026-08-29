# Design Brief — "Blind Test" Typography Matcher

Status: APPROVED (user-confirmed 2026-08-28; direction locked via decision page, seed fab7b459)
Phase: impeccable `shape` output (direction settled by decision-page choice, 2026-08-28)
Seed: fab7b459 · chosen: **The Examination Room** (assigned roll, kept) · build path: **code-led** (no image generation in this environment; comp-led impossible)

## 1. Job and audience

Working designers and design-responsible developers, mid-project, hunting a heading+body pairing. They arrive with brand bias they want suppressed, judge in seconds per card, and leave with CSS. Visitor mode: **Operate** — task completion outranks expression; the tool's chrome recedes, the judged content owns the visual center.

## 2. Outcome and proof

Primary task: judge → save/skip → reveal → export, completed unaided in one short session. Proof of value: a saved list whose names are revealed only there, each exportable as working CSS + Google Fonts link. Product-specific truth: no name appears anywhere during review — the strict reveal is the product.

## 3. Selected direction — The Examination Room

**Visual authority:** new world, rolled and user-locked (seed fab7b459). Lineage: the optician's exam — phoropter dials, acuity-lane distance markers, trial-lens tray, the Snellen red-green bar.

**Thesis:** pairings are judged the way lenses are — *which is better, one or two?* — with identities withheld until the prescription is written. The dummy essay sits in the acuity lane; each swap is a lens change; the saved list is the prescription, revealed at the end.

**Structure and sequence:** land → one-line protocol explainer → card in the acuity lane (fonts awaited, occluder blink on swap) → judge via red-green bar (green saves, red skips) → repeat → open the prescription card (saved list) → names + roles revealed along leader lines → copy CSS → done.

**Focal moment:** the lens swap — an occluder sweep and detent settle as the new pairing arrives; under `prefers-reduced-motion` it is instant.

**Named raises carried into the build** (donors from the roll's declined challengers):
- **SNAP-STEP DECK** (depot blind) — deck advances in whole card-heights, one-step overshoot and settle; nothing glides.
- **LEADER-LINE REVEAL** (tensegrity column) — saved-list reveal pins role labels to specimens along engineering leader lines.
- **ONE CORD** (drawcord cape) — a single accent mechanism reserved exclusively for judgment controls, never decoration.
- **STATES IN PLACE** (variety telop) — loading, exhausted, saved states restyle weight/outline in place; content never moves for state.

**Honest risk (kept visible):** eye-chart letterforms in the chrome would compete with the very faces being judged. Charts appear only as abstracted devices (distance markers, the red-green bar) — never as letter displays. The chrome's own face is chosen at world-commit time under that constraint.

**Implementation consequences:** clinical neutral ground (bone/instrument-black family) so any pairing can star; the red-green bar doubles as the save/skip color code; prescription-card drawer for saves; acuity-lane depth markers as progress vocabulary.

## 4. Scope and boundaries

Production-ready full flow: review loop, saved list with reveal + clipboard export, deck exhaustion + reshuffle, storage-degradation fallback, first-run explainer. Untouched: town-hall decisions D1–D8 and the non-goals list. Anti-goals: no name leakage in any review state; no typographic controls; no second template; no analytics.

## 5. States and ranges

Seven states: first-run explainer · loading/swapping · review · saved-list empty · saved-list populated · deck exhausted · storage-unavailable. Content ranges: ~60 curated pairings at launch; seen-set in localStorage; essay copy fixed (one display headline, standfirst, 2–3 paragraphs, one blockquote, small UI chrome — an editorial essay *about typography*, per confirmed decision).

## 6. Interaction and layout

One-viewport judgment focus on desktop (whole dummy page visible); mobile scrolls content inside the card. Swipe attaches to card chrome so it never fights reading; pointer-drag (touch + mouse), visible buttons, and ←/→ keys are equal citizens. Feedback is clinical, not gamified: detent settle, row-lamp-style state colors, no confetti ever.

## 7. Constraints and open decisions

Vite + TypeScript static build → GitHub Pages (push behind user halt). Accessibility acceptance criteria from town-hall (keyboard parity, reduced motion, contrast ≥ 4.5:1, escape-on-render). Code-led: no comp round; ambition lives in this brief and the direction contract's FIRST VIEWPORT block, audited at finish. Open decisions owned downstream: exact chrome palette/face + color strategy (world-commit, production); pairing schema (planning); font-load strategy and gesture separation (production).
