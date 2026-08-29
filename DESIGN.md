---
name: '"Blind Test" Typography Matcher'
description: An optician's examination lane for font pairings — judged blind on a chart-paper essay, revealed only on the prescription pad.
colors:
  bone: "#F2EEE6"
  sheet: "#FBF9F4"
  ink: "#14181A"
  ink-soft: "#57534B"
  hairline: "#D9D2C3"
  cord-red: "#C1272D"
  cord-red-hover: "#AD2228"
  cord-green: "#1D7A4D"
  cord-green-hover: "#156340"
  scrim-ink: "rgba(20, 24, 26, 0.38)"
  scrollbar-thumb: "#9A9285"
typography:
  chrome-body:
    fontFamily: "IBM Plex Sans, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "1rem"
    fontWeight: 400
  chrome-strip:
    fontFamily: "IBM Plex Sans, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "0.78rem"
    fontWeight: 400
    letterSpacing: "0.02em"
  chrome-notice:
    fontFamily: "IBM Plex Sans, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "0.82rem"
    fontWeight: 400
  chrome-pill:
    fontFamily: "IBM Plex Sans, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "0.76rem"
    fontWeight: 600
    letterSpacing: "0.02em"
  chrome-judge:
    fontFamily: "IBM Plex Sans, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "0.95rem"
    fontWeight: 600
    letterSpacing: "0.01em"
  chrome-micro:
    fontFamily: "IBM Plex Sans, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "0.66rem"
    fontWeight: 500
    letterSpacing: "0.14em"
  rx-title:
    fontFamily: "IBM Plex Sans, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "1.22rem"
    fontWeight: 600
    letterSpacing: "0.01em"
  rx-name:
    fontFamily: "IBM Plex Sans, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "1.02rem"
    fontWeight: 600
    letterSpacing: "0.005em"
  judged-headline:
    fontFamily: "var(--font-heading)"
    fontSize: "clamp(1.9rem, 1.15rem + 1.9vw, 2.85rem)"
    fontWeight: "var(--weight-heading)"
    lineHeight: 1.08
    letterSpacing: "-0.01em"
  judged-standfirst:
    fontFamily: "var(--font-heading)"
    fontSize: "clamp(1rem, 0.92rem + 0.35vw, 1.18rem)"
    fontWeight: "var(--weight-heading-soft)"
    lineHeight: 1.45
  judged-quote:
    fontFamily: "var(--font-body)"
    fontSize: "clamp(1.05rem, 0.98rem + 0.4vw, 1.28rem)"
    fontWeight: "var(--weight-body)"
    lineHeight: 1.42
  judged-body:
    fontFamily: "var(--font-body)"
    fontSize: "clamp(0.95rem, 0.88rem + 0.3vw, 1.05rem)"
    fontWeight: "var(--weight-body)"
    lineHeight: 1.58
  judged-caption:
    fontFamily: "var(--font-body)"
    fontSize: "0.8rem"
    fontWeight: "var(--weight-body)"
    lineHeight: 1.45
    letterSpacing: "0.01em"
rounded:
  paper: "12px"
  bar-half: "8px"
  pill: "999px"
  code: "8px"
  judged-chrome: "2px"
spacing:
  lane-gutter: "clamp(1rem, 2.5vw, 2rem)"
  lane-inset: "clamp(0.75rem, 2vw, 1.5rem)"
  frame-pad-block: "clamp(1.1rem, 1.2vh + 0.9vw, 2.2rem)"
  frame-pad-inline: "clamp(1.4rem, 1vw + 1.2rem, 2.75rem)"
  sheet-gap: "clamp(1.5rem, 3.5vw, 3.25rem)"
  stack-gap: "clamp(0.9rem, 1.8vh, 1.5rem)"
  tick-gap: "4px"
components:
  judge-save:
    backgroundColor: "{colors.cord-green}"
    textColor: "{colors.sheet}"
    rounded: "{rounded.bar-half}"
    padding: "0.95em 1.4em"
    typography: "{typography.chrome-judge}"
  judge-save-hover:
    backgroundColor: "{colors.cord-green-hover}"
  judge-skip:
    backgroundColor: "{colors.cord-red}"
    textColor: "{colors.sheet}"
    rounded: "{rounded.bar-half}"
    padding: "0.95em 1.4em"
    typography: "{typography.chrome-judge}"
  judge-skip-hover:
    backgroundColor: "{colors.cord-red-hover}"
  judge-stood-down:
    backgroundColor: "transparent"
    textColor: "{colors.cord-green}"
  judge-stood-down-skip:
    textColor: "{colors.cord-red}"
  strip-pill:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0.32em 1.05em"
    typography: "{typography.chrome-pill}"
  strip-pill-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.bone}"
  prescription-route:
    backgroundColor: "transparent"
    textColor: "{colors.ink-soft}"
    typography: "{typography.chrome-strip}"
  prescription-route-hover:
    textColor: "{colors.ink}"
  rx-copy:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0.22em 0.85em"
  rx-copy-copied:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.bone}"
  rx-remove:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0.22em 0.85em"
  rx-remove-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.bone}"
---

# Design System: "Blind Test" Typography Matcher

<!-- Recorded from the built world (ground truth over intention). Direction contract:
     index.html first body child (THESIS / OWN-WORLD / STORY / FIRST VIEWPORT / FORM
     seed fab7b459 / FINISH). Sources of truth: src/style.css, src/styles/{dummy,
     chrome,motion,prescription}.css, src/components/{examinationRoom,dummyPage}.ts,
     src/views/savedList.ts. Divergences from the brief are recorded where they
     render, with their production-log rationale. -->

## Overview

**Creative North Star: "The Examination Room"**

The app is an optician's examination lane, built at 1:1 vocabulary. A thin instrument strip (wordmark, a graduated tick rail, the prescription count) tops the room; the judged essay sits center-stage as a sheet of chart paper pinned to a bone wall; a split red–green duochrome bar — skip left, save right — closes the viewport at the bottom. Every swap of pairing is a lens change: an instrument-black occluder drops over the paper, the faces swap beneath it, and the blind lifts to a stepped detent settle. The saved list is the prescription — a chart-paper pad placed over the room, where family names are finally written along engineering leader lines.

The chrome is deliberately clinical and recedes (visitor mode is Operate: task completion outranks expression). The ground is a bright bone lane, never a glowing dark panel — a designer judges type at a desk in daylight, and paper is read light. Nearly everything is bone, sheet, instrument-black ink, and hairline; exactly one mechanism carries saturated color (the red–green cord), and it is reserved exclusively for judgment. Motion is mechanical, never cinematic: every animation is a `steps()` timing — clicks and detents, nothing glides. States restyle in place; content never moves for state.

**Key Characteristics:**

- One-viewport instrument: strip / acuity lane / judgment bar as a fixed CSS grid row track (`auto minmax(0, 1fr) auto`); the lane scrolls internally, the room never does.
- Clinical neutral ground (bone `#F2EEE6`) so any judged pairing can star; the essay sheet rides one step whiter (`#FBF9F4`).
- One cord of color — ophthalmic red / chart green — on the judgment bar only; zero saturated pixels anywhere else (pixel-scan verified at finish).
- No eye-chart letterforms in chrome: progress is a 3px tick rail + tabular numerals, never letter displays.
- Strict reveal: family names exist in the DOM only while the prescription pad is open; `steps()`-only motion; `prefers-reduced-motion` collapses every animation to instant.
- Contrast floor ≥ 4.5:1 on every chrome text pair (minimum pair: cord green on bone, 4.60:1).

## Colors

A clinical instrument palette: warm bone ground, paper one step whiter, near-black instrument ink — with a single duochrome cord (ophthalmic red / chart green) reserved for judgment. All values are the custom properties declared on `.examination-room` in `src/styles/chrome.css` (lines 20–29); the body ground is repeated in `src/style.css`.

### Primary

- **Ophthalmic Red** (`--cord-red: #C1272D`, hover `#AD2228`): the left (Skip) half of the judgment bar fill; also the outlined cord text of every stood-down bar state. The "one or two?" duochrome's red filter.
- **Chart Green** (`--cord-green: #1D7A4D`, hover `#156340`): the right (Save) half of the judgment bar fill; the stood-down counterpart text color. Hover fills darken exactly one step; nothing else shifts.

### Secondary

- **Scrim Ink** (`rgba(20, 24, 26, 0.38)`): translucent instrument ink dimming the room while the prescription pad is up (`prescription.css` `.prescription-scrim`).

### Neutral

- **Bone** (`--bone: #F2EEE6`): the lane ground — body background, room background, `theme-color` meta, text on ink fills, and the occluder's label ink.
- **Sheet** (`--sheet: #FBF9F4`): chart paper — the essay frame and the prescription pad; label color on the live cord fills (declared literally `color: #fbf9f4` on `.judge`).
- **Instrument Black** (`--ink: #14181A`): chrome ink — wordmark, notice text, pill borders/hover fills, marker current tick, focus rings, `::selection` background, and the occluder panel itself.
- **Soft Ink** (`--ink-soft: #57534B`): secondary chrome — wordmark sub, marker count, prescription route label, leader lines, metadata. 6.61:1 on bone.
- **Hairline** (`--hairline: #D9D2C3`): strip/notice dividers, prescription entry rules, export textarea border. Decorative only (1.30:1 on bone — carries no state or boundary).
- **Scrollbar Thumb** (`#9A9285`): thin lane and ledger scrollbars (`scrollbar-width: thin; scrollbar-color: #9a9285 transparent`).

### Named Rules

**The One Cord Rule.** Red and green appear only on the judgment bar (solid fills when ready; outlined cord text when stood down). Every other surface is bone/sheet/ink/hairline — including the prescription pad, pill acts, and the "Copied" acknowledgment (ink fill, an instrument acknowledgment, not a judgment).

**The Bright Lane Rule.** The ground is light bone, always. Dark mode is a product non-goal; the occluder is the only large ink field, and it exists to be temporary.

**Contrast is computed, not felt.** Every chrome text pair ≥ 4.5:1 (verified WCAG arithmetic at finish): ink/bone 15.44:1 · ink-soft/bone 6.61:1 · sheet on red 5.55:1 / on green 5.06:1 (hovers 6.57/6.90) · red/bone 5.05:1 · green/bone 4.60:1 — the chrome's closest margin; any palette drift re-runs the numbers before commit.

## Typography

**Chrome Face:** IBM Plex Sans (weights 400/500/600, statically linked in `index.html`; stack `--font-chrome: 'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', sans-serif`)
**Judged Article:** variable-driven — every face/weight arrives through `:root` custom properties written by `applyPairing()` (`src/components/dummyPage.ts`)
**Label/Mono:** none for chrome; monospace appears only in the export fallback textarea (presentation of code, not chrome letterforms)

**Character:** The chrome is a workhorse product-UI face with instrument lineage — chosen at world-commit precisely because it has no chart-letterform spectacle (the honest-risk constraint: eye-chart letterforms would compete with the faces under judgment). Numerals in chrome counts use tabular figures (`font-variant-numeric: tabular-nums`), never a monospace costume. The judged article's typography is the product: two slots (`--font-heading` / `--font-body`) plus weight variables, so each pairing is judged in habitats.

### The pairing slots (the judged surface)

`applyPairing()` writes seven properties on `document.documentElement.style` and nothing else — the swap is variables-only:

- `--font-heading` / `--font-body` — quoted family token + a category-kindred system fallback stack (e.g. serif ⇒ `Georgia, 'Times New Roman', Times, serif`), so the pre-load/offline page degrades within-category.
- `--weight-heading` (heaviest heading weight → display headline), `--weight-heading-soft` (lightest heading → standfirst), `--weight-body` (lightest body → reading text, quote, caption), `--weight-body-strong` (heaviest body → the essay's own UI chrome). Both weights of both families always get a habitat.
- `--quote-font-style` — follows the body family's real italic inventory; a no-italic family is never oblique-synthesized on the blockquote (synthesis would misrepresent the pairing).

Defaults (pre-load) live in `src/styles/dummy.css` `:root` (Georgia / Iowan Old Style stacks).

### Hierarchy (chrome)

- **Strip text** (400, 0.78rem, 0.02em tracking): wordmark is 600, sub in soft ink.
- **Notices** (400, 0.82rem): explainer / exhaustion / swap-error / storage rows.
- **Pill acts** (600, 0.76rem, 0.02em): "Begin examination", "Reshuffle the deck", "Try the next lens", "Back to the deck", "Copy CSS"/"Remove".
- **Judgment labels** (600, 0.95rem, 0.01em): Skip / Save; key hints 500 at 0.78em.
- **Rx micro labels** (500, 0.66rem, 0.14em, uppercase): role labels ("HEADING"/"BODY"), Rx numbering (600, 0.7rem, 0.16em, tabular), occluder label (500, 0.78rem, 0.14em, uppercase).
- **Rx title** (600, 1.22rem) and **Rx names** (600, 1.02rem): the reveal's loudest text — still the chrome's hand.

### Hierarchy (judged article — dummy.css)

- **Headline** (`--weight-heading`, clamp(1.9rem, 1.15rem + 1.9vw, 2.85rem), 1.08, −0.01em, `text-wrap: balance`).
- **Standfirst** (`--weight-heading-soft`, clamp(1rem, 0.92rem + 0.35vw, 1.18rem), 1.45, opacity 0.92).
- **Pull quote** (`--weight-body`, clamp(1.05rem, 0.98rem + 0.4vw, 1.28rem), 1.42; 2px `currentColor` inline-start border, 1.2em padding; style via `--quote-font-style`).
- **Body** (`--weight-body`, clamp(0.95rem, 0.88rem + 0.3vw, 1.05rem), 1.58, `max-width: 66ch`, `text-wrap: pretty`).
- **Caption** (`--weight-body`, 0.8rem, 1.45, opacity 0.72).
- **Judged UI microcopy** (`--weight-body-strong`, 0.78rem, 0.08em): the essay's nav label + button — small-type habitat judged with the rest.

### Named Rules

**The Two Hands Rule.** Chrome text is always IBM Plex Sans; the judged article is always the pairing. The chrome face never leaks into the article (verified: computed wordmark family ≠ judged h1 family) and no judged face ever reaches the chrome — including the prescription reveal, where names are set in the chrome's hand (see Components).

**The No-Chart-Letterforms Rule.** No letter displays, no specimen alphabets, no A-B-C rows anywhere in chrome. Progress is ticks and tabular numerals; the largest chrome text is a 1.22rem title.

## Layout

One room, three regions, one viewport at the desktop target (1280×800 measured: strip 0–40, lane 90–725, judgment bar 725–800; the whole essay + bar fit without scroll).

- **`.examination-room`** (`chrome.css`): `display: grid; grid-template-rows: auto minmax(0, 1fr) auto` (strip / lane / bar); `height: 100vh / 100svh`; `position: relative` (the prescription overlay anchors here); bone ground, ink text, chrome face. `body { overflow: hidden }` (`src/style.css`) — the lane scrolls internally, the room never does.
- **Instrument strip** (`.lane-strip`): baseline-aligned flex row, `space-between`, gap `0.35rem 1.75rem`, padding `0.8rem clamp(1rem, 2.5vw, 2rem) 0.65rem`, hairline bottom border. Members: wordmark + sub, marker rail + tabular count (`role=status`), prescription route.
- **Acuity lane** (`.acuity-lane`): the scroll container — `overflow-y: auto; overflow-x: hidden; touch-action: pan-y` (vertical panning stays native; horizontal drags belong to the swipe controller); flex-centered; padding `clamp(0.75rem, 1.6vh, 1.25rem) clamp(0.75rem, 2vw, 1.5rem) clamp(0.85rem, 1.8vh, 1.35rem)`; thin scrollbar; `cursor: grab` (the card chrome is draggable; the reading surface keeps its text cursor).
- **Chart paper** (`.examination-room .dummy-frame`): `width: min(74rem, 100%)`, radius 12px, shadow-only elevation, padding `clamp(1.1rem, 1.2vh + 0.9vw, 2.2rem) clamp(1.4rem, 1vw + 1.2rem, 2.75rem)`.
- **Editorial spread** (`.dummy-sheet`, `dummy.css`): two-column grid `minmax(0, 0.85fr) minmax(0, 1.15fr)` (display rail / reading column), gap `clamp(1.5rem, 3.5vw, 3.25rem)`.
- **Judgment bar** (`.judgment-bar`): centered flex; row padding `0.8rem 1rem calc(0.8rem + env(safe-area-inset-bottom, 0px))` (mobile safe-area aware). Buttons `flex: 1 1 11rem; max-width: 16rem`.
- **Prescription overlay** (`.prescription-view`): absolute `inset: 0`, z-index 30 over the room; pad `width: min(44rem, 100%)`, `max-height: 100%`, its ledger scrolling internally (`min-height: 0; overflow-y: auto`).

Responsive behavior (as built):

- **≤ 56rem**: the editorial spread stacks to one column (`.dummy-sheet { grid-template-columns: minmax(0, 1fr) }`); the lane inner-scrolls.
- **≤ 48rem**: wordmark sub and the tick rail hide (the tabular count keeps the facts); judge buttons tighten to `flex-basis: 9rem`.
- **≤ 30rem**: Rx names step down to 0.94rem; the metadata register drops its leader-aligned inset.
- Mobile lane = reading mode: the sheet top stays reachable (`align-items: flex-start` + `margin-block: auto` centering — floors at 0 when content is taller); the bar pins above the safe-area inset.

Spacing rhythm is clamp-based against viewport, not a fixed step scale; the recurring measures are in the frontmatter `spacing` block.

## Elevation & Depth

Flat chrome, one shadow, one scrim. The room's bone surfaces carry no shadows at all — depth is conveyed by the hairline dividers and the paper's tonal step up from bone to sheet. Elevation is declared exactly twice, both times as a physical statement (paper floating on a wall; a pad placed over the room), and never as a hover effect.

### Shadow Vocabulary

- **Chart paper** (`box-shadow: 0 1.4rem 3.2rem rgba(20, 24, 26, 0.14), 0 0.2rem 0.55rem rgba(20, 24, 26, 0.08)`): the essay sheet on the lane wall. No border under the shadow (a border + shadow double-edge is the named craft-floor failure).
- **Prescription pad** (`box-shadow: 0 1.6rem 3.6rem rgba(20, 24, 26, 0.26), 0 0.2rem 0.55rem rgba(20, 24, 26, 0.12)`): the same paper shadow, one step heavier for the overlay.
- **Occluder** (`box-shadow: inset 0 0 0 1px rgba(242, 238, 230, 0.14)`): a 1px inset bone keyline on the instrument-black blind so it reads as an object, not a hole.
- **Stood-down bar** (`box-shadow: inset 0 0 0 1.5px currentColor`): the outline-as-shadow restyle — the cord color as a 1.5px inset ring on transparent ground.

### Named Rules

**The Shadow-Is-a-Statement Rule.** Shadows appear only on the two chart-paper surfaces and only at rest. Hover, focus, and state never add or change a shadow; states restyle outline and weight in place.

## Shapes

Radius is instrument-scale and small: the chart paper and prescription pad share **12px**; the judgment bar is a joined capsule of two **8px**-outer-radius halves meeting at a hard seam (8px 0 0 8px / 0 8px 8px 0); pill acts are fully round (**999px**); the export fallback textarea echoes **8px**; the judged article's own button is nearly square (**2px**) — the pairing's world, not the room's. The occluder inherits the paper's radius (`border-radius: inherit`) — the blind is card-shaped.

Line vocabulary is hairline engineering: 1px `--hairline` dividers; 3px-wide marker ticks (8px tall seen, 12px tall current, hollow upcoming via `inset 0 0 0 1px` soft-ink shadow); leader lines as dimension lines — a 1px soft-ink run with a 5px origin dot at the label end and a 6px 45°-rotated two-border arrowhead terminal pointing at the name; a 2px solid-ink global `:focus-visible` ring at 2px offset; the pull quote's 2px `currentColor` inline-start rule.

## Components

### The Judgment Bar (ONE CORD)

The room's only accent: a joined duochrome footer (`role=group`) — red **Skip ←** left, green **→ Save** right. Shape: two flex halves (flex `1 1 11rem`, max 16rem), 8px outer radii, hard center seam. Color: cord fills with sheet labels (600, 0.95rem; hints 500 at 0.78em). Hover: fill darkens one step (`#AD2228` / `#156340`). Focus: the global 2px ink ring. Three input paths converge on one funnel (buttons, ←/→ keys anywhere in the room, pointer-drag swipe) — identical in effect by construction.

**Stood-down restyle (STATES IN PLACE):** under `[data-state='loading']`, `[data-state='error']`, `[data-exhausted='true']`, or `[data-explainer='true']`, both buttons flip to transparent ground, cord-colored text, and a 1.5px `inset` currentColor ring; geometry never moves. During loading the label swaps in place ("Save" → "Setting lenses…", hint `visibility: hidden` to hold centering without reflow).

### The Instrument Strip

Baseline row: **wordmark** ("Blind Test — typography examination", 600 + soft-ink sub) · **distance markers** (one 3px tick per deck pairing — hollow upcoming / filled soft-ink seen / tall ink current — aria-hidden, with a tabular "N / M examined" polite status beside) · **prescription route** (a real button styled as quiet chrome text: soft ink, dotted underline + ink on hover — never loud, never cord). Route works at 0 saved; the empty state is designed.

### Strip Notices (one anatomy, four states)

One-line status + (where there is an act) one pill, restyling the strip in place, hairline top border, 0.82rem:

- **First-run explainer** — "Every page changes lenses — judge the setting, not the name. Identities arrive only on your prescription." + pill **Begin examination**. While it stands, the bar is stood down (`[data-explainer='true']`) and all three input paths are gated (dismissal is consent — T17's adjudication of the T16 finding).
- **Exhaustion (D7)** — "Cycle complete — every pairing examined once." + pill **Reshuffle the deck** (reshuffle is a user act, never automatic). Notice text is a polite live region.
- **Swap error** — "Lens change failed — the new pairing did not arrive." + pill **Try the next lens**; the previous pairing stands unchanged on the wall.
- **Storage degraded** — "Records can't be kept in this browser — saves and progress last this session only." No act, non-blocking by contract.

Pill style (shared): 999px radius, 1px ink border, transparent ground, 600 0.76rem; hover inverts to ink fill / bone text.

### The Acuity Lane + Chart Paper (the judged surface)

The essay mounts inside the scroll-clipped lane as `.dummy-frame` — bone-white chart paper (12px radius, paper shadow, no border) carrying the editorial spread (topbar microcopy, display rail: headline/standfirst/quote, reading column at 66ch, caption). The paper is also the direct-manipulation surface: during a committed drag it follows the pointer 1:1 with rubber-band resistance (56px free zone, then asymptotic damping toward +160px; `translate3d` inline transform, never transitioned — direct manipulation is not animation), and on release settles in discrete steps (`160ms steps(3, end)`). Mouse/pen drags starting on the reading surface are selection, not judgment (protected target); touch swipes anywhere on the paper. Commit thresholds: 80px travel or a 0.55px/ms same-direction flick with ≥ 24px travel; 10px slop dead zone; vertical intent wins arbiter ties.

### The Lens Swap (motion grammar — the focal moment)

Every animation in the app is `steps()`; there is no ease or linear curve anywhere. The choreography (`src/styles/motion.css`, sequenced by `src/main.ts` against the font-readiness gate):

1. **COVER** — the occluder (`.lens-blind`): a card-covering instrument-black panel, parked one card-height above its seat (`translateY(-100%)`), drops in **150ms `steps(3, end)`**, bone uppercase label "Setting lenses…". It stays down for the whole font load — variables swap only after the gate passes, so no fallback-glyph window is ever judgeable. Lane scroll resets under cover; the lane clips (`overflow: hidden` + `scrollbar-gutter: stable`) so the blind enters and leaves through the wall, never past a scrollbar.
2. **REVEAL** — the blind departs one whole card-height down (**240ms `steps(4, end)`**, top-first reveal), and the card answers with the **SNAP-STEP detent**: one step past its seat (**14px overshoot at the 45% keyframe**) then settle — **190ms `steps(2, end)` with a 90ms delay, `backwards` fill**. Controller timers mirror the CSS (BLIND_LIFT_MS 240 / DETENT_TOTAL_MS 280 / lane unlock 340ms).
3. **ERROR** — a failed gate (4000ms budget) lifts the blind the same way (no detent — nothing arrived) into the swap-error notice state.

**Reduced motion collapses all of it:** under `prefers-reduced-motion: reduce` the blind is `display: none` (and the room never mounts it — the CSS is the second belt), the detent and pad rise compute `animation-name: none`, the swipe settle loses its transition. The loading/error STATES remain — they restyle in place; they are not motion.

### The Prescription Pad (the reveal)

An overlay placed on the room: translucent ink scrim (instant) + chart-paper pad (`min(44rem, 100%)`, 12px radius, pad shadow) rising in one stepped **170ms `steps(3, end)`** traverse from `translateY(18px)`. Departure is always instant — closing strips the names, and that must read as immediate, not performed.

- **LEADER-LINE REVEAL:** each entry is an engineering annotation — role label (0.66rem uppercase, soft ink) — dimension-line leader (origin dot → arrowhead) — family name (1.02rem/600) — with a metadata register underneath (`category · tags`, 0.76rem soft ink, inset-aligned under the name). Entries carry `Rx 01`-style tabular numbering; a pad keeps no holes (removal renumbers).
- **Names in the chrome's hand** — a deliberate divergence from the brief's specimen impulse, recorded at T11: names render in IBM Plex Sans, never in the saved families' own faces. The examiner writes the prescription; the faces were already judged on the wall — and a network-dependent reveal could hide names at the exact moment it exists to deliver them (offline-safe by construction).
- **Strict reveal as a DOM property:** `open()` is the only code path that mints a family name into text content; `close()` empties the pad — closed is grep-level clean.
- **Export acts:** "Copy CSS" per entry — in-place label swap to "Copied" (ink fill, `min-width: 6.4em` holds geometry, restores after 2400ms); clipboard failure reveals a read-only, preselected monospace textarea beneath the annotation (bone ground, hairline border, 8px radius) — no modal, no clipboard required.
- **Modal recipe:** `role=dialog` / `aria-modal` / labelled title (focus target, ring suppressed — the pad is the indication); the room's three regions go `inert`; Tab wraps inside the pad; Escape / scrim / back pill funnel to one route-out returning focus to the strip route.
- **Empty state (designed):** "Nothing prescribed yet." + one soft-ink line, centered, max-width 38ch.

### Browser Surfaces

`::selection` inverts to ink ground / bone text; global `:focus-visible` is a 2px solid ink outline at 2px offset (1px offset on the export textarea); lane and ledger scrollbars thin with `#9A9285` thumbs.

### Style and Component File Boundaries

- `src/style.css` — base reset + the ground (body face/background/ink, `overflow: hidden`).
- `src/styles/dummy.css` — the judged article: structure, pairing-variable defaults, editorial scale. Chrome-agnostic by contract.
- `src/styles/chrome.css` — the palette custom properties, `--font-chrome`, strip/markers/notices, chart-paper restyle, judgment bar + stood-down states, browser surfaces, ≤ 48rem compaction.
- `src/styles/motion.css` — the lens-swap layer: occluder, detent, lane clip, swap-error notice (self-contained by T09 deviation; its notice styles intentionally duplicate the chrome row anatomy).
- `src/styles/prescription.css` — the overlay, pad, leader lines, export fallback, empty state.
- `src/components/examinationRoom.ts` — chrome shell + controller (states, input funnel, choreography surface). `src/components/dummyPage.ts` — essay DOM + `applyPairing`. `src/views/savedList.ts` — the prescription view. `src/lib/gestures.ts` (swipe engine), `src/lib/export.ts` (snippet builder), `src/lib/fontLoader.ts` (readiness gate) are behavior, not style.

## Do's and Don'ts

### Do:

- **Do** keep every animation a `steps()` timing — clicks and detents, never eases or glides (the world's motion rule; audited: no ease/linear exists in any stylesheet).
- **Do** restyle states in place (outline, weight, label) — geometry and content never move for state.
- **Do** set chrome text in IBM Plex Sans with tabular numerals for counts, and keep every chrome text pair ≥ 4.5:1 (re-run the arithmetic before any palette change; green-on-bone at 4.60:1 is the floor).
- **Do** give both weights of both judged families a habitat when extending the pairing surface (the four `--weight-*` policy in `applyPairing`).
- **Do** keep family names inside the open prescription subtree — any future name-bearing feature mints through `open()` or lives inside `.prescription-view`.
- **Do** route any new judgment-adjacent gate through the room's single `inputOpen()` funnel (the explainer gate joined it; so should anything after it).

### Don't:

- **Don't** use red or green anywhere but the judgment bar — not on the prescription, not on hovers, not on acknowledgment states (ink is the acknowledgment).
- **Don't** put letter displays, specimen alphabets, or chart-row letterforms in the chrome; progress is ticks + numerals only.
- **Don't** add borders under the paper shadows, shadows to hover/focus states, or a dark ground — the lane is bright, flat, and hairline-divided.
- **Don't** glide: no transition-timing but `steps()`, no animated scroll, no confetti — feedback is a detent, a label swap, or a live-region line.
- **Don't** let the chrome face leak into the judged article or judged faces leak into the chrome (computed-family separation is a verified invariant).
- **Don't** animate the prescription's departure — closing strips names; it must read as instant.
