# R2 — Dynamic Google Fonts Loading (runtime, TS SPA)

## Question + affected task IDs

**Question:** What is the evidence-backed best practice for dynamically loading arbitrary Google Fonts pairings at runtime in a TypeScript SPA (Vite, no framework) such that (a) the app can construct a css2 API URL from a pairing record (two families, explicit weights, italic flags), (b) the app knows with certainty both faces are ACTUALLY loaded and rendered before revealing a card, (c) FOT/FOUT is avoided cross-browser (modern evergreen), and (d) previously injected links are cleaned up without breaking in-flight loads or triggering reflow storms?

**Affected tasks:**
- **T04** (F · Font-loading engine, `src/lib/fontLoader.ts`) — this record is T04's design input; the implementation consequences below are the operative spec.
- **T02** (P/F · Pairing schema) — schema fields must carry per-family weights + italic flag so `buildCss2Url` can emit axis tuples; verified feasible.
- **T09** (D/F · Lens-swap moment) — swap choreography consumes the readiness promise; perceived <2s budget interacts with the timeout default and the prefetch recommendation below.
- **T15** (O · Validation script) — same css2 construction rules apply server-side; a 400 from css2 is the failure signal (not 404).

## Constraints / criteria

- Correctness is absolute: a user must NEVER judge a fallback glyph (plan acceptance criterion 1, T09). A late-revealed-but-wrong face is worse than a slow reveal.
- Environment: static site on GitHub Pages (no CSP headers by default), evergreen browsers only (Chromium/Firefox/Safari current), no framework, no SSR.
- Load cadence: a new pairing (2 families, ~2 faces each after subset reduction) every few seconds during judging; revisits of a previously seen pairing must be cheap.
- Blind-test secrecy: no family name may leak into visible UI pre-reveal (D6) — pure mechanics here, but the loader must not log family names into the DOM.
- Timeouts must exist: a bad family slug or a stalled network must fail fast into the deck's skip path, never hang the card.

## Options considered

### Option A — Injected `<link rel=stylesheet>` + `document.fonts.load()` readiness gate — **RECOMMENDED**
Build the css2 URL from the pairing record, inject one `<link>` per pairing, await the link `load` event (CSS fetched + parsed), then `await document.fonts.load(spec, sampleText)` for every family × weight × style, guard against empty result arrays, then double-`requestAnimationFrame` before resolving. Remove the previous pairing's link only after the new pairing is ready.
- **Fit: exact.** Uses the browser's own CSS pipeline (UA-sniffed formats, `unicode-range` subset lazy-loading, HTTP cache) and the CSS Font Loading spec's per-face readiness signal. No parsing of Google's CSS, no manual subset bookkeeping.
- **Effort:** smallest of the three; all complexity is ~80 lines of orchestration + unit-testable URL builder.
- **Risk:** `link.onerror` is not reliable for HTTP-error stylesheet responses cross-browser (see Evidence E5), so failure detection must not rest on it alone — the `fonts.load` empty-array guard covers it.

### Option B — FontFace API with manually fetched woff2 URLs
`fetch` the css2 CSS text, regex-parse the `@font-face` blocks, construct `new FontFace(family, url(gstatic), {weight, style, unicodeRange})`, `document.fonts.add()` each, await each face's `load()`.
- **Fit: poor.** You take ownership of everything the browser does for free under Option A: UA-appropriate format selection, `unicode-range`-driven lazy subset loading (you'd have to replicate descriptors or eagerly load every subset), and cache coordination. Google's css2 CSS is not a stable parsing contract (comment markers, subset ordering, variable-font `wght` ranges can change).
- **Genuine advantages:** faces added via `add()` are non-CSS-connected — they persist in `document.fonts` across stylesheet removal and `delete()` works on them, giving explicit memory lifecycle; and CORS is satisfied (`access-control-allow-origin: *` on fonts.gstatic.com, verified E8).
- **Verdict:** rejected as primary; the persistence advantage is a liability here anyway (leaks faces across a long judging session, the thing T04 must clean up).

### Option C — `<style>@import url(css2)</style>` injection
Append a style element containing `@import`.
- **Fit: worst.** Same downstream readiness machinery still needed (so no simplification), strictly worse transport: the `@import` is only discovered after the outer style parses, serializing requests; no per-import load event; web.dev notes link+preconnect "likely results in faster stylesheet delivery than @import" (E6). Cleanup = removing the style element, with the same CSS-connected face eviction as A but none of A's wins.
- **Verdict:** rejected.

## Recommendation + rationale

**Option A: link-injection + `document.fonts.load()` gate, `display=block`, one link per pairing, ordered cleanup, 4000 ms default timeout, empty-array guard, next-pairing prefetch.**

Rationale chain, each link evidence-backed below:

1. **`link.onload` alone can NEVER mean "fonts usable."** A stylesheet `load` event means the CSS (and its imports) fetched and parsed — "immediately before the styles start being applied" (E5). Web fonts are downloaded lazily: "@font-face declaration doesn't trigger font download … a font is downloaded only if it's referenced by styling that is used on the page" (E6). At `link.onload` time, zero font bytes have necessarily moved. Google leans on this too — its CSS splits each family into ~4–7 `unicode-range` subsets (verified live, E8), and only the subsets actually containing rendered glyphs are fetched. So onload → CSS registered, then an explicit force-load is mandatory.
2. **`document.fonts.load(spec, text)` is the only per-face "glyphs available" signal.** Spec: it "forces all the fonts given in parameters to be loaded," resolves "when all the fonts are loaded" with the array of matching `FontFace` objects, and rejects if a matched face fails (E2/E3). After resolution the faces have status `loaded` — binary fetched and decoded, available to layout and paint. It is also the only signal that works when the text is behind an occluder (nothing rendered yet, so no lazy load would ever trigger).
3. **`document.fonts.ready` is the wrong tool here.** It resolves "once the document has completed loading fonts, layout operations are completed, and no further font loads are needed" (E4) — a whole-document, point-in-time signal. It can resolve before our fonts are even requested (if nothing uses the family yet, no load is "needed"), and it re-arms on any later activity. Fine as a boot-time hint; useless as a per-pairing gate.
4. **`display=block` is the honest css2 parameter given the reveal gate.** All five values are supported (`auto|block|swap|fallback|optional`, default `auto`) (E1). Since the card is only revealed after the readiness gate, the parameter's only job is defending the pre-reveal window (essay DOM already styled with the new CSS variables behind the occluder): `block` renders invisible text during the block period rather than fallback glyphs, so even a timing edge cannot paint a fallback. `optional` is disqualified — its ~100 ms window makes fallback permanent for the page lifetime; `swap` paints fallback immediately. (web.dev's general-performance preference for `optional`/`swap` optimizes for open-text pages, not for a judge-the-typeface instrument where fidelity IS the product, E6.)
5. **Failure detection is layered because no single signal is trustworthy:** css2 answers an invalid family or unavailable weight with **HTTP 400 + an HTML error page, not 404** (verified live, E8); the CSS-prefetch may complete and fire `link.onload` rather than `onerror` in some engines (E5, cross-browser divergence); and `fonts.load()` for a family with no registered faces **resolves successfully with an empty array** rather than rejecting ("No longer throw an error if none of the specified fonts exist", E3). The empty-array guard closes the loop: `arr.length === 0` ⇒ pairing failed ⇒ timeout/skip path.
6. **Cleanup order is dictated by the spec's CSS-connected face lifecycle.** Faces from the injected stylesheet's `@font-face` rules are CSS-connected and are **removed from `document.fonts` when the stylesheet goes away** ("the connection is not restorable", E3) — correcting the premise in the research question: removing the link *does* unset those entries (it does NOT touch faces added via `FontFace API add()`, which is why Option B leaks). Consequences: (a) remove the OLD link only AFTER the new pairing passes its gate (otherwise any still-visible text using the old family falls back → FOUT); (b) removing a link causes zero font reflow if no live text uses its families (the swap happens behind the occluder); (c) re-requesting a previously seen pairing is cheap — css2 CSS is `cache-control: private, max-age=86400, stale-while-revalidate=604800` and the woff2 binaries are `public, max-age=31536000` (verified live, E8), so the browser cache, not the network, serves revisits; new CSS-connected faces re-register from cache in single-digit ms.
7. **Timeout default 4000 ms.** The Chromium/Firefox invisible-text block period is ~3 s (E6/E7); timing out at exactly 3 s would cut off loads that would have landed. 4000 ms bounds the worst case (cold CSS fetch + first font fetch on a slow link) while T09's perceived budget (<2 s broadband) is met by the prefetch below, not by shortening the timeout. On timeout: remove the pending link, mark pairing failed, let the deck draw the next one (T06).

## Evidence

All sources fetched 2026-08-28. Live-protocol checks (marked ⚡) executed via curl against the real endpoints on that date; the planned browser spike (onload-vs-`fonts.load` ordering, 400 event behavior) could not run — browser automation unavailable in the research sandbox — but every disputed point is covered by spec text or live protocol evidence instead.

- **E1 — Google Fonts CSS API v2 reference** (https://developers.google.com/fonts/docs/css2, accessed 2026-08-28): base `https://fonts.googleapis.com/css2`; spec grammar `family=<name>[:<axis_tag_list>@<axis_tuple_list>]`; "List axes alphabetically (en-US locale)" (hence `ital,wght@0,700;1,400`); tuples "need to be sorted numerically" and "can't overlap or touch"; spaces in names become `+` (e.g. `Crimson+Pro`); multiple families = repeated `&family=` params; `display=` accepts `auto|block|swap|fallback|optional`; requests for unavailable axis positions fail ("For families with axes that don't contain the default position, requests that do not specify positions for those axes will fail") — schema must always send explicit weights.
- **E2 — MDN `FontFaceSet.load()`** (https://developer.mozilla.org/en-US/docs/Web/API/FontFaceSet/load): "forces all the fonts given in parameters to be loaded"; resolves "fulfilled with an Array of loaded FontFace objects … rejected if one of the fonts failed to load"; `text` param "Limit the font faces to those whose Unicode range contains at least one of the characters in text," default `" "` (a single space); "The code in then() can assume the availability of that font." Baseline widely available.
- **E3 — W3C CSS Font Loading Module Level 3** (https://www.w3.org/TR/css-font-loading-3/, TR snapshot): `load()` waits "for all of the [[FontStatusPromise]]s of each font face in the font face list"; Changes: "No longer throw an error if none of the specified fonts exist" (⇒ empty-array resolution); url-source failures reject with `NetworkError` and set face status `error`; statuses are `unloaded|loading|loaded|error`; `ready` note: fulfilled "only after layout operations complete and no additional font loads are necessary"; `check()` returns true when the matched list is empty (nonexistent family) — never trust `check()` alone; document font source contains CSS-connected faces "from all of the CSS @font-face rules … in document order" kept in sync as rules/stylesheets are added/removed; "If a rule is removed, its FontFace is no longer CSS-connected. The connection is not restorable by any means"; `delete()` on a CSS-connected face is a no-op; `clear()`/`delete()` only affect manually added faces.
- **E4 — MDN `FontFaceSet.ready`** (https://developer.mozilla.org/en-US/docs/Web/API/FontFaceSet/ready): "The promise will only resolve once the document has completed loading fonts, layout operations are completed, and no further font loads are needed." Resolves with the set itself; never rejects.
- **E5 — MDN `<link>`: stylesheet load events** (https://developer.mozilla.org/en-US/docs/Web/HTML/Element/link): `load` fires "once the stylesheet and all of its imported content has been loaded and parsed, and immediately before the styles start being applied to the content"; `error` fires "if an error has occurred while processing a style sheet"; MDN does not guarantee `error` for non-2xx statuses — page-documented caveat + general cross-engine divergence (Chromium/WebKit may fire `load` for a completed fetch with error status; Firefox fires `error`). ⇒ never gate failure on `onerror` alone.
- **E6 — web.dev "Best practices for fonts"** (https://web.dev/articles/font-best-practices): "A common misconception is that a font is requested when a @font-face declaration is encountered. This is false." / "a font is downloaded only if it's referenced by styling that is used on the page"; Chromium/Firefox "block text rendering for up to 3 seconds" by default, Safari indefinitely; recommends `display: block` for "web font guaranteed" but warns to deliver early; preconnect guidance: `fonts.googleapis.com` + `fonts.gstatic.com` `crossorigin`; link "likely results in faster stylesheet delivery than @import."
- **E7 — MDN `font-display`** (https://developer.mozilla.org/en-US/docs/Web/CSS/@font-face/font-display): block period ≈ short (~3 s Chromium/Firefox; Firefox pref `gfx.downloadable_fonts.fallback_delay` default ~3000 ms, `fallback_delay_short` ~100 ms); `block` = invisible-then-guaranteed; `optional` = fallback may be permanent; `swap` = fallback visible almost immediately. Note: our served CSS uses `font-display: block` per `display=block` (⚡ verified in served CSS, E8).
- **E8 — ⚡ Live protocol checks (curl, 2026-08-28, Chrome UA):**
  - `css2?family=NoSuchFontHere123:wght@400` → **HTTP 400** with an HTML error body (not 404). Same for an unavailable weight (`Roboto:wght@9000` → 400).
  - Valid `css2?family=Crimson+Pro:ital,wght@0,700;1,400&family=Inter:wght@400;600&display=block` → 200; served CSS contains one `@font-face` per style×weight×subset (vietnamese / latin-ext / latin / …), each with `font-display: block`, per-subset woff2 URLs, and `unicode-range` (latin subset spans `U+0000-00FF, … U+2000-206F, U+20AC …` — covers English essay punctuation incl. curly quotes/em dash and the `fonts.load` default `" "`).
  - css2 CSS response headers: `cache-control: private, max-age=86400, stale-while-revalidate=604800`; woff2 from fonts.gstatic.com: `cache-control: public, max-age=31536000`, `access-control-allow-origin: *`.
- **E9 — CSP context** (GitHub Pages docs, no server-configurable headers on Pages): Pages serves no CSP by default ⇒ link injection works unconditionally; if a `<meta http-equiv="Content-Security-Policy">` is ever added it must include `style-src https://fonts.googleapis.com` and `font-src https://fonts.gstatic.com` (external URLs — `unsafe-inline` not required for Option A; Option B would additionally rely on CORS fetch, permitted by the verified `access-control-allow-origin: *`).

## Tradeoffs / risks / confidence

- **Tradeoff vs FontFace API:** we accept CSS-connected eviction (faces leave `document.fonts` on link removal) in exchange for zero CSS parsing and native subset behavior — the right trade because revisit cost is cache-only (E8) and explicit face lifetime was never needed.
- **Risk: `fonts.load` spec-string mismatch.** The spec arg is CSS shorthand: weight, style, size, family in one string (`'italic 700 32px "Crimson Pro"'`). A malformed string rejects with `SyntaxError` (E3) — unit-test every generated spec string; put quotes around family names; include `italic` only when the italic flag is set.
- **Risk: variable-weight families.** css2 serves ranges (`400..700`) for variable fonts; `fonts.load('700 …')` matches a registered range face and forces the instance. Schemas that request exact weights only (per T02) keep this deterministic. Weight values outside a family's range 400 the whole request (E8) — T15's validation script catches these at CI time.
- **Risk: two pairings sharing a family.** One-link-per-pairing means a shared family is requested twice (two CSS-connected copies) — harmless (spec allows duplicates, last-registered wins for identical descriptors) and cache-served; do not build refcounting unless profiling demands it.
- **Risk: `link` GC before load.** Keep a strong reference to every in-flight link until settle (the `LoadedFonts.handle` pattern below does this); a link removed mid-flight cancels the CSS fetch.
- **Residual unknown:** exact per-engine behavior of `load`-vs-`error` events for HTTP-400 stylesheets (E5 divergence) — mitigated by design (failure never depends on it); an optional 10-minute manual DevTools confirmation can be folded into T04's implementation, but correctness does not wait on it.
- **Confidence: HIGH** on the mechanism (spec + live protocol evidence); **MEDIUM-HIGH** on the 4000 ms default (tuned from block-period + cache evidence, not measured on target hardware — adjustable constant).

## Implementation consequences for `src/lib/fontLoader.ts`

**Module shape (concrete API sketch):**

```ts
export interface FamilySpec {
  slug: string;        // css2 family name, spaces intact (e.g. "Crimson Pro")
  weights: number[];   // explicit, always non-empty (css2 strictness, E1)
  italic: boolean;     // emit ital axis when true
}
export interface PairingFonts { heading: FamilySpec; body: FamilySpec }

export interface FontLoadHandle {
  link: HTMLLinkElement;      // strong ref keeps in-flight load alive
  cssUrl: string;
  families: string[];         // for cleanup bookkeeping only
}

// Pure, unit-testable. Snapshot-test the emitted URLs.
export function buildCss2Url(p: PairingFonts): string;
// → https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,700;1,400
//                         &family=Inter:wght@400;600&display=block
// Rules: spaces → '+'; axes alphabetical (ital before wght); ital axis ONLY when
// italic===true, tuples '0,w' upright / '1,w' italic, tuples numerically sorted,
// no duplicates; always display=block (see rationale #4).

// Readiness = linkEvent ∩ fonts.load(each face, sampleText) ∩ non-empty arrays
// ∩ double-rAF, all under an AbortSignal-style timeout. Rejects on: link error,
// any fonts.load rejection, ANY empty result array, or timeout.
export async function loadPairingFonts(
  p: PairingFonts,
  opts?: { timeoutMs?: number /* default 4000 */; sampleText?: string /* default: latin probe + card copy */ },
): Promise<FontLoadHandle>;

// Cleanup — order is load-bearing:
export function releasePairingFonts(h: FontLoadHandle | null): void; // h.link.remove(); idempotent; null-safe
```

**Readiness promise pattern (internal):**
1. `const link = document.createElement('link'); link.rel='stylesheet'; link.href=buildCss2Url(p);` attach `onload`/`onerror`; `document.head.appendChild(link)`; start `setTimeout(timeoutMs)`.
2. Await link settle. On `error` OR timeout ⇒ `link.remove()`, reject `{reason:'css'}`. (An HTTP-400 body may still fire `load` in some engines — E5 — which is why step 3 exists.)
3. `Promise.all(specs.map(s => document.fonts.load(s, sampleText)))` where `specs = ['italic 700 32px "Crimson Pro"', '700 32px "Crimson Pro"', '400 32px "Inter"', …]` (one per family×weight×style). Any rejection ⇒ remove link, reject `{reason:'network'}`. Any result array `length === 0` ⇒ remove link, reject `{reason:'no-face'}` (family absent from CSS — the 400/backstop guard, E3).
4. `await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))` — `load()` resolving guarantees faces are decoded and usable, not that a paint has occurred; double-rAF bounds reveal to the frame after next layout. Resolve with the handle.
5. Callers (T05/T09): behind the occluder — `const next = await loadPairingFonts(p)` → set CSS variables → confirm frame → `releasePairingFonts(prevHandle)` → unhide. Old link removal AFTER new readiness is what makes FOUT impossible and reflow invisible (old card is occluded; evicted faces affect no live text, E3).
6. Timeout path: clear timer, `link.remove()`, reject; deck (T06) draws a replacement pairing; the loading state (STATES IN PLACE) covers the gap.
7. Never surface family names in errors/DOM pre-reveal (D6): reject with codes + stack-trace-free detail; keep names only in non-serialized structures.

**Latency hiding for T09's <2 s perceived budget (optional but recommended):** prefetch the NEXT deck pairing during judging — `loadPairingFonts(next)` can run while the user deliberates on the current card; `releasePairingFonts(prev)` then applies to the pairing before that. With css2/woff2 cache (E8), the steady state is reveal-with-zero-wait.

**index.html statics (T01/T07):** the two preconnect hints (`fonts.googleapis.com`, `fonts.gstatic.com` `crossorigin`) in `<head>` (E6) — crossorigin is required on the font origin (CORS-mode fetch).

**Unit-test seams (T04 acceptance):** fake timers + a stubbed `document.fonts` (inject `FontFaceSet`-shaped object: `load()` returning controllable promises); snapshot URL construction (weight sorting, ital on/off, spacing, display); assert cleanup order by faking two sequential loads; assert empty-array guard and timeout removal paths.

## Decision priority + status

- **Priority:** correctness of the reveal gate (never judge a fallback) > cleanup hygiene > perceived latency > code volume.
- **Status:** DECIDED — Option A with the layered gate as specified above; ready to implement T04 without further research. Open micro-item (non-blocking, fold into T04 if desired): manual DevTools confirmation of `load`-vs-`error` events on a css2 400 in the three evergreen engines, to document rather than to depend on.

## Delegation record

- **Researcher:** R2 subagent (deep-research track, typography-matcher), autonomous session 2026-08-28.
- **Method:** primary-source review (Google css2 reference, W3C CSS Font Loading L3, MDN link/FontFaceSet/font-display pages, web.dev fonts guide) + live protocol verification of css2 failure modes, served CSS shape, and cache headers via curl. A browser-spike on event ordering was planned but browser automation was unavailable in the sandbox; every question the spike targeted is settled by spec text or live evidence (E3, E5, E8). Disposable spike artifacts confined to `/tmp/font-spike/`; nothing added to the repo except this record.
