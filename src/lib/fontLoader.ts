/**
 * T04 — Font-loading engine. Implements R2's committed Option A verbatim
 * (docs/ultron/research/R2-font-loading.md, "Implementation consequences";
 * evidence IDs cited below refer to that record):
 *
 * 1. One injected `<link rel="stylesheet">` per pairing — css2 URL built from
 *    the pairing's family fields (`buildCss2Url`), two families + explicit
 *    weights, always `display=block` (rationale #4: the pre-reveal window
 *    renders invisible text, never fallback glyphs).
 * 2. Readiness gate = link settle (CSS fetched + parsed) → per-face
 *    `document.fonts.load(spec, sampleText)` for every family × weight ×
 *    style → empty-array guard (css2 400s can still fire `load`, E5/E8;
 *    absent families resolve empty rather than rejecting, E3) → double-rAF
 *    (a resolved `load()` guarantees decoded faces, not a completed paint).
 *    All under a 4000 ms default timeout (rationale #7: above the ~3 s
 *    invisible-text block period, E6/E7).
 * 3. Every failure path removes the pending link and rejects with a typed
 *    `FontLoadError` — reason codes + slot/weight detail only, never family
 *    names or URLs (blind-test secrecy, D6). The handle carries names for
 *    cleanup bookkeeping; errors never do.
 * 4. The OLD pairing's link is released by the caller only AFTER the new
 *    pairing's gate passes (R2 caller sequence: `next = await
 *    loadPairingFonts(p)` → set CSS variables → confirm frame →
 *    `releasePairingFonts(prev)` → unhide). Removing a stylesheet evicts its
 *    CSS-connected faces (E3) — that ordering is what makes FOUT impossible.
 * 5. `prefetchPairingFonts` warms the next deck pairing during deliberation
 *    (css2 CSS and woff2 are long-cached, E8) for T09's <2 s perceived
 *    swap budget.
 *
 * This module never writes visible DOM text — family names appear only in
 * link `href` attributes and the non-serialized handle.
 */

import type { FamilySpec } from '../types'

/**
 * css2 loading input: the two families of a pairing in their roles.
 * T02's `pairingFonts()` projects a `Pairing` onto exactly this shape.
 */
export interface PairingFonts {
  heading: FamilySpec
  body: FamilySpec
}

/** Strong reference to one pairing's injected stylesheet, post-gate. */
export interface FontLoadHandle {
  /** The injected `<link>`; holding the handle keeps the faces CSS-connected. */
  link: HTMLLinkElement
  /** The css2 URL the link carries. */
  cssUrl: string
  /** Family names — cleanup bookkeeping only, never rendered (D6). */
  families: string[]
}

/** Gate failure modes; machine-readable for the deck's skip path (T06). */
export type FontLoadFailureReason =
  /**
   * The stylesheet request errored (`link` error event). Unreliable for
   * HTTP-error responses cross-browser (E5) — the `no-face` guard backstops.
   */
  | 'css'
  /** The gate did not settle within `timeoutMs`. */
  | 'timeout'
  /** A `document.fonts.load()` call rejected (face fetch/decode failure). */
  | 'network'
  /**
   * A load resolved zero faces — family/weight absent from the served CSS.
   * The css2-400 backstop: absent families resolve empty, not rejected (E3).
   */
  | 'no-face'

/** Typed gate failure. Message carries reason + slot/weight detail only. */
export class FontLoadError extends Error {
  readonly reason: FontLoadFailureReason
  readonly detail: string

  constructor(reason: FontLoadFailureReason, detail: string) {
    // D6: no family names, no URLs — codes and slot/weight facts only.
    super(`fontLoader: ${reason} — ${detail}`)
    this.name = 'FontLoadError'
    this.reason = reason
    this.detail = detail
  }
}

export interface FontLoadOptions {
  /**
   * Gate budget in milliseconds. Default 4000 — above the ~3 s invisible-text
   * block period (E6/E7), below any acceptable hang; on timeout the deck
   * (T06) draws a replacement pairing behind the loading state (T09).
   */
  timeoutMs?: number
  /**
   * Text forwarded to every `document.fonts.load()` call — limits matched
   * faces to subsets whose Unicode ranges cover these glyphs (E2). Default:
   * latin probe + the essay's typographic punctuation (E8 latin-subset span).
   */
  sampleText?: string
}

/** Default gate budget (R2 rationale #7). */
export const DEFAULT_FONT_LOAD_TIMEOUT_MS = 4000

/** Default sample text (R2 sketch: "latin probe + card copy"). */
export const DEFAULT_FONT_SAMPLE_TEXT =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz 0123456789 .,;:!?()&\u2014\u2013\u2018\u2019\u201C\u201D'

const CSS2_BASE = 'https://fonts.googleapis.com/css2'
/** Parsed but not load-bearing for face matching (R2 sketch examples use 32px). */
const FONT_SPEC_SIZE = '32px'

/** Ascending, de-duplicated weights (schema guarantees this; builder stays total). */
function normalizedWeights(weights: number[]): number[] {
  return [...new Set(weights)].sort((a, b) => a - b)
}

/** css2 family component: spaces → `+`; beyond URL-unreserved, percent-encode (E1). */
function encodeFamilyName(slug: string): string {
  return slug.replace(/ /g, '+').replace(/[^A-Za-z0-9._+-]/g, (ch) => encodeURIComponent(ch))
}

/** CSS font shorthand family token — quoted and backslash-escaped (R2 spec-string risk). */
function quotedFamily(slug: string): string {
  return `"${slug.replace(/["\\]/g, '\\$&')}"`
}

/** One per-face `document.fonts.load()` request: spec string + name-free guard detail. */
interface FaceRequest {
  slot: 'heading' | 'body'
  weight: number
  italic: boolean
  spec: string
}

function faceRequests(p: PairingFonts): FaceRequest[] {
  const requests: FaceRequest[] = []
  for (const slot of ['heading', 'body'] as const) {
    const family = p[slot]
    for (const weight of normalizedWeights(family.weights)) {
      requests.push({
        slot,
        weight,
        italic: false,
        spec: `${weight} ${FONT_SPEC_SIZE} ${quotedFamily(family.slug)}`,
      })
      if (family.italic) {
        requests.push({
          slot,
          weight,
          italic: true,
          spec: `italic ${weight} ${FONT_SPEC_SIZE} ${quotedFamily(family.slug)}`,
        })
      }
    }
  }
  return requests
}

/**
 * Pure css2 URL builder (snapshot-tested). Rules (E1):
 * - spaces → `+`; families in pairing order as repeated `family=` params;
 * - axes alphabetical (`ital,wght`), `ital` axis only when `italic` is true;
 * - tuples numerically sorted (E1) — all upright `0,w` ascending, then all
 *   italic `1,w` ascending (lexicographic tuple order, per the live-verified
 *   `Crimson+Pro:ital,wght@0,400;0,600;1,400;1,600`);
 * - weights deduplicated defensively; always `display=block` (rationale #4).
 */
export function buildCss2Url(p: PairingFonts): string {
  const familyParams = [p.heading, p.body].map((family) => {
    const name = encodeFamilyName(family.slug)
    const weights = normalizedWeights(family.weights)
    if (weights.length === 0) return name // schema violation tolerated → bare default-weight request; css2 fails there
    const axis = family.italic
      ? `ital,wght@${[...weights.map((w) => `0,${w}`), ...weights.map((w) => `1,${w}`)].join(';')}`
      : `wght@${weights.join(';')}`
    return `${name}:${axis}`
  })
  return `${CSS2_BASE}?family=${familyParams.join('&family=')}&display=block`
}

/** Bounds the reveal to the frame after next layout (R2 gate step 4). */
function doubleRaf(): Promise<void> {
  return new Promise<void>((resolveFrame) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolveFrame()))
  })
}

/**
 * Load one pairing's fonts and gate on real readiness.
 *
 * Sequence (R2 readiness pattern): inject link → await link settle →
 * `document.fonts.load()` every family × weight × style with `sampleText` →
 * reject if ANY result array is empty → double-rAF → resolve with the handle.
 * Rejects with `FontLoadError` on link error (`css`), any load rejection
 * (`network`), any empty face array (`no-face`), or budget expiry (`timeout`);
 * every failure removes the pending link.
 */
export async function loadPairingFonts(p: PairingFonts, opts: FontLoadOptions = {}): Promise<FontLoadHandle> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_FONT_LOAD_TIMEOUT_MS
  const sampleText = opts.sampleText ?? DEFAULT_FONT_SAMPLE_TEXT

  if (p.heading.slug.length === 0 || p.body.slug.length === 0) {
    throw new FontLoadError('no-face', 'a family slot carried an empty slug (schema violation)')
  }
  const requests = faceRequests(p)
  if (requests.length === 0) {
    throw new FontLoadError('no-face', 'a family carried no explicit weights (schema violation)')
  }

  const cssUrl = buildCss2Url(p)
  const families = [p.heading.slug, p.body.slug]

  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = cssUrl

  return new Promise<FontLoadHandle>((resolve, reject) => {
    let settled = false
    let timer: number | undefined

    const detach = (): void => {
      link.removeEventListener('load', onLinkLoad)
      link.removeEventListener('error', onLinkError)
    }

    const fail = (reason: FontLoadFailureReason, detail: string): void => {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      detach()
      link.remove()
      reject(new FontLoadError(reason, detail))
    }

    const onLinkError = (): void => {
      fail('css', 'stylesheet request failed (link error event)')
    }

    const onLinkLoad = (): void => {
      void gateFaces()
    }

    // Phase 2 — runs only after the CSS is fetched and parsed. Never trust
    // link settle alone: zero font bytes have necessarily moved at that
    // point (E5/E6); the empty-array guard covers engines that fire `load`
    // for HTTP-400 stylesheet responses (E5/E8).
    async function gateFaces(): Promise<void> {
      try {
        await Promise.all(
          requests.map((req) =>
            document.fonts.load(req.spec, sampleText).then((faces) => {
              if (faces.length === 0) {
                throw new FontLoadError(
                  'no-face',
                  `zero faces matched (slot: ${req.slot}, weight: ${req.weight}, italic: ${req.italic})`,
                )
              }
              return faces
            }),
          ),
        )
        if (settled) return
        await doubleRaf()
        if (settled) return
        settled = true
        window.clearTimeout(timer)
        detach()
        resolve({ link, cssUrl, families })
      } catch (err) {
        if (err instanceof FontLoadError) fail(err.reason, err.detail)
        else fail('network', 'a document.fonts.load() call rejected')
      }
    }

    timer = window.setTimeout(() => fail('timeout', `gate did not settle within ${timeoutMs}ms`), timeoutMs)

    // A strong reference to `link` lives in this closure until settle and in
    // the handle after — a link dropped mid-flight cancels the CSS fetch (R2).
    link.addEventListener('load', onLinkLoad)
    link.addEventListener('error', onLinkError)
    document.head.appendChild(link)
  })
}

/**
 * Remove a pairing's stylesheet. Idempotent, null-safe.
 *
 * ORDER IS LOAD-BEARING (R2 caller sequence): call with the PREVIOUS handle
 * only after the new pairing's gate has passed — removing the link evicts
 * its CSS-connected faces (E3), so premature removal would flash fallback on
 * any text still using the old family.
 */
export function releasePairingFonts(handle: FontLoadHandle | null): void {
  handle?.link.remove()
}

/**
 * Best-effort warm-up of the NEXT deck pairing while the user deliberates
 * (R2 latency hiding; css2 CSS + woff2 are long-cached, E8, so the steady
 * state is reveal-with-zero-wait). Failures are contained — an ignored
 * prefetch never crashes the session — yet stay observable: the returned
 * promise rejects with the usual `FontLoadError` if awaited. Release the
 * handle like any other once superseded.
 */
export function prefetchPairingFonts(p: PairingFonts, opts: FontLoadOptions = {}): Promise<FontLoadHandle> {
  const attempt = loadPairingFonts(p, opts)
  attempt.catch(() => {}) // containment only; the real draw re-surfaces failures
  return attempt
}
