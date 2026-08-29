# Town Hall — "Blind Test" Typography Matcher

Status: APPROVED — all clusters signed off 2026-08-28
Date: 2026-08-28

## Problem statement

Designers choosing typefaces suffer from brand bias: familiar fonts (Inter, Roboto, Helvetica, Playfair) win by recognition rather than merit. Existing pairing galleries (fontpair.co, Typewolf, Archetype) show names first, so the bias operates before evaluation begins. No tool lets a designer judge a font pairing purely on how it performs in a realistic page layout, with identities withheld until after the verdict.

## Target users

- Working web/UI designers hunting for a heading+body pairing for a project.
- Developers with design responsibility who want a defensible, fast pairing choice.
- Design-curious people who enjoy the swipe mechanic (secondary).

## Confirmed scoping decisions

| # | Decision | Choice | Rationale |
|---|---|---|---|
| D1 | Pairing source | **Curated list, embedded** (~60 known-good pairings shipped in-app; local unseen-first random draw) | Deterministic, fast, blind by construction, works offline after first load |
| D2 | Persistence | **localStorage only** | No accounts/backend; static site |
| D3 | Test surface | **One rich dummy page** (hero + paragraphs + blockquote + small UI chrome) | Fastest to polish; pairing maps to heading/body roles |
| D4 | Audience | **Public web tool** | Success = strangers complete the journey end-to-end |
| D5 | Export | **Copy CSS + link** on saved list (clipboard) | Take-home value + word-of-mouth hook; ~an hour of work |
| D6 | Reveal timing | **Strictly on the saved list** | Save confirms without naming; keeps the blind test honest |
| D7 | Deck exhaustion | **Exhaustion state + reshuffle**; seen-set persists in localStorage; reshuffle clears it | Left-swipe promises a *new* look; silent wrap-around would break that |
| D8 | Deployment | **GitHub Pages** via gh CLI | Deploy is external publishing — coordinator halts for explicit go-ahead before any push |

## MVP scope

1. **Blind review loop.** Random unseen pairing applied to the dummy page via dynamically injected Google Fonts stylesheet + CSS custom properties (`--font-heading`, `--font-body`); identities hidden; card reveals only after both faces are actually loaded (no FOUT judgment window).
2. **Input parity.** Swipe (pointer drag, touch + mouse), visible buttons, and ←/→ keyboard keys all save/skip identically. `prefers-reduced-motion` disables card animation.
3. **Saved list.** Reveals family names + roles + categories; remove; persists across reloads; one-click clipboard export (`<link>` tag + CSS variables snippet).
4. **Deck mechanics.** Unseen-first draw; exhaustion state ("you've seen everything") offering reshuffle.
5. **Graceful degradation.** Storage unavailable (private mode) → in-memory session saves + non-blocking notice.
6. **Curated pairing dataset.** ~60 pairings with category/archetype metadata and required weights/styles per family.

## Non-goals

Accounts/backend/cloud sync · multiple templates · custom user text · live algorithmic pairing generation · typographic controls (size/weight/leading sliders) · dark mode · i18n · shareable URLs · analytics · micro-reveal on save.

## Primary journeys & states

**Journey:** land → one-line how-it-works (first visit) → card loads (fonts awaited; "shuffling" moment designed, not accidental) → judge → swipe/button/keys → repeat → open saved list → names + categories revealed → copy CSS → done.

**States:** first-run explainer · loading/swapping · review · saved-list empty · saved-list populated · deck exhausted · storage-unavailable degradation.

## Success measures & acceptance criteria

**Measures (D-decided):** no analytics at MVP. Success = all acceptance criteria pass + one unaided tester completes the journey + font-swap perceived-ready under ~2s on broadband.

**Acceptance criteria:**
1. Fresh visit → explainer → first pairing renders with both fonts actually loaded (no fallback-font judgment) within ~2s on broadband.
2. Pointer-drag swipe, button click, and ←/→ keys all save/skip identically.
3. Saved list reveals names + roles + categories; remove works; persists across reload.
4. Export copies valid CSS (family stacks + Google Fonts link) to clipboard.
5. Deck never repeats until all unseen consumed; exhaustion state offers reshuffle which clears the seen-set.
6. `prefers-reduced-motion` disables card animation; keyboard-only journey completable; chrome text contrast ≥ 4.5:1 (pairings change type, never color).
7. Storage unavailable → in-memory saves + non-blocking notice; no crash.
8. Font names from the dataset are escaped when rendered.

## Constraints, assumptions, risks

**Constraints:** static hosting (GitHub Pages) · runtime Google Fonts CDN dependency · English content · localStorage · modern browsers.
**Assumptions:** ~60 quality-barred launch pairings are achievable; CDN reliability acceptable; clipboard available (secure context — true on GH Pages).
**Risks (accepted):** curation provenance/licensing → research before data task ships; font-family deprecation breaking old saves (mitigate: validation script + fallback stacks); cross-browser font-load timing (mitigate: await both faces before reveal); swipe/scroll collision (mitigate: gesture separation, buttons/keys always available); structurally weak retention (accepted for MVP — tool, not destination).

## Role Perspectives

*(as drafted during the session — retained verbatim below for traceability)*

### Product / user value
Supports: the blind protocol is the entire value proposition — "judge the pairing, not the brand"; swipe cadence (seconds per pairing) beats name-first galleries. Concern: single-session utility; the hidden product is the curated list — mediocrity collapses the gimmick. Cost/opportunity: editorial effort is the real cost; export is the take-home hook. Experiment: saves-per-session as list-quality proxy.

### UX / UI
Supports: universal swipe grammar; one decision per screen; the dummy page IS the interface. Concern: swipe/scroll collision — gesture separation plus buttons/keys; FOUT — never judge a fallback font. Dependency: fonts.googleapis.com at runtime; design the load moment. Experiment: card-container prototype proving scroll-inside vs swipe-outside.

### Frontend
Supports: pure static app; `:root` custom properties make a swap one `setProperty` call; dynamic `<link>` injection is well-trodden. Concern: await both faces (`document.fonts.load`) before reveal; pairing schema must carry weights/styles. Dependency: Google Fonts CDN only.

### Backend / data / integrations
Supports: none needed — static hosting, localStorage, embedded JSON; Google Fonts CSS API only integration. Concern: curation provenance/licensing; family deprecation/rename. Experiment: build-time check that every curated family still serves.

### Quality / reliability
Supports: small deterministic surface — pairing loader, storage layer, reveal logic unit-testable. Concern: cross-browser font loading; localStorage unavailability; saves outliving families. Experiment: e2e happy path + storage-unavailable fallback.

### Security / privacy
Supports: no PII, no accounts, no backend; localStorage holds pairing IDs only. Concern: standard CDN IP exposure (acceptable); escape dataset-sourced names on render; cheap basic CSP. Experiment: escape-on-render convention in acceptance criteria.

### Accessibility
Supports: swipe never the only input — keyboard and buttons mandatory; `prefers-reduced-motion`. Concern: vestibular sensitivity; focus management between card and saved list; pairings change type, never color. Experiment: keyboard-only walkthrough in acceptance criteria.

### Typography domain (content accuracy)
Supports: good pairings follow teachable rules — category contrast, complementary proportions (x-height), role separation; carry category metadata for reveal-time education later. Concern: "highly-rated" is hidden editorial work; weight/style dependence (display 700/800, italic) must be requested or the pairing renders a lie. Experiment: ~60 pairings with category tags; validate rendering weights. *(Directional check; evidence-backed version routes to `$deep-research`.)*

## Grilling rounds

**Round 1 (frontier after intake):** Q1 export (→ D5), Q2 reveal timing (→ D6), Q3 exhaustion (→ D7), Q5 deployment (→ D8), plus non-goals list, success-measures Challenger/Advocate (analytics rejected; unaided-tester criterion adopted), risk acceptance, and disposition table — presented together; answered same round. No Round 2 questions unlocked: remaining items are implementation- or research-owned.

**Challenger/Advocate record (judgment calls):**
- *Export:* Challenger said scope creep; Advocate carried it — minimal clipboard-only export included (D5).
- *Reveal timing:* Challenger argued micro-reveal UX; Advocate rejected it — save-to-peek breaks the blind (D6).
- *Success measures:* Challenger argued for mechanical criteria only; Advocate adopted unaided-tester as a real test, rejected analytics.

## Open-question dispositions

| Question | Owner | Blocking status |
|---|---|---|
| Pairing-list provenance & licensing | research | blocks the curation **data task** in production; does not block planning |
| Pairing schema (weights, categories, roles) | planning | informs plan structure; non-blocking |
| Font-loading strategy (link injection vs FontFace API; readiness await) | production | non-blocking implementation choice |
| Swipe/scroll gesture separation technique | production | non-blocking |
| Launch list size (~60, quality-barred) | research-informed | non-blocking |
| Google Fonts deprecation validation script | production | non-blocking task |
| Visual world + dummy-page copy | design phase (impeccable) | next phase |

## Decisions & rejected alternatives

- **D1 curated embedded list** over live API composition (unverified quality) and hybrid (deferred complexity).
- **D2 localStorage** over session-only (accidental data loss) and accounts (scope blowout).
- **D3 single rich template** over multiple (doubles layout work) and custom-text (scope).
- **D5 clipboard export** over none (toy without take-home) and richer export management (scope creep).
- **D6 strict reveal** over micro-reveal (breaks blind).
- **D7 exhaustion state + reshuffle** over silent wrap (breaks "new look" promise) and hard stop (dead-end).
- **D8 GitHub Pages** over user-manual deploy and Netlify-style.
- **No analytics** — privacy-role alignment; static site stays static.

## Cluster sign-off status

| Cluster | Status |
|---|---|
| 1. Problem & users | SIGNED OFF 2026-08-28 |
| 2. MVP boundary & non-goals | SIGNED OFF 2026-08-28 |
| 3. Journeys, states, success measures | SIGNED OFF 2026-08-28 |
| 4. Constraints, assumptions, risks | ACCEPTED AS RISKS 2026-08-28 |
| 5. Open-question dispositions | SIGNED OFF 2026-08-28 |

Final gate: "Approved — close Town Hall" (user, 2026-08-28). Conditions: none.

## Handoff note for plan-it-out

UI-surface product → design phase (`$impeccable` init + shape) runs **before** planning per supreme routing. Planning receives: this brief; D1–D8; the acceptance criteria as verification anchors; the disposition table (research question on provenance must be dispositioned before the curation data task, not before planning). Repo is not yet git-initialized; GitHub Pages target (D8) implies repo init + gh setup as early production tasks, with push/publish behind the halt list.
