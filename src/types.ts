/**
 * T02 — Pairing schema.
 *
 * Two consumers constrain this shape (see docs/ultron/plan.md + research/R2-font-loading.md):
 *
 * - Font loading (T04, `src/lib/fontLoader.ts`): `FamilySpec` fields — `slug`
 *   + `weights` + `italic` — are the committed minimum for css2 URL construction
 *   and per-face `document.fonts.load()` spec strings (R2 implementation
 *   consequences). `pairingFonts()` projects a record onto R2's exact input.
 * - Reveal (T11 saved list): name (`slug`), `role`, `category`, `tags` travel on
 *   the record itself — no post-hoc lookups, nothing to reconstruct.
 *
 * T15 (`scripts/validate-fonts.mjs`) re-checks every slug/weight against the
 * live css2 API at CI time.
 */

/** Google Fonts category — the API's closed five-value set. */
export const FONT_CATEGORIES = ['serif', 'sans-serif', 'display', 'handwriting', 'monospace'] as const

export type FontCategory = (typeof FONT_CATEGORIES)[number]

/** A family's slot in a pairing. Mirrors the JSON key it sits under. */
export type FontRole = 'heading' | 'body'

/**
 * The font-loading subset of a family — exactly the input T04's
 * `buildCss2Url` / `loadPairingFonts` consume (R2 sketch).
 */
export interface FamilySpec {
  /**
   * css2 family name, spaces intact (e.g. "Crimson Pro" — never "Crimson+Pro").
   * Doubles as the display name for the saved-list reveal.
   */
  slug: string
  /** Explicit weights; css2 strictness requires them (R2/E1). Non-empty, ascending, unique, 100–900. */
  weights: number[]
  /**
   * true ⇔ the pairing renders italic faces of this family. Emits the css2
   * `ital` axis and `italic …` fonts.load() specs. Load-bearing correctness
   * metadata: css2 may silently drop unsupported italic tuples (verified live,
   * Space Grotesk), which would then trip the empty-array readiness guard.
   */
  italic: boolean
}

/** One family within a pairing: loading spec + reveal metadata. */
export interface PairingFamily extends FamilySpec {
  /** Must match the key this object sits under. */
  role: FontRole
  /** Google Fonts category (lowercase canonical form of the metadata value). */
  category: FontCategory
  /** Archetype descriptors, reveal metadata only (1–4, lowercase, no duplicates). */
  tags: string[]
}

/** A deck entry: two families in their roles. */
export interface Pairing {
  /** Unique deck id, kebab-case (e.g. "space-grotesk-crimson-pro"). */
  id: string
  heading: PairingFamily
  body: PairingFamily
}

/** Project a pairing onto T04's load input (R2's `PairingFonts` sketch). */
export function pairingFonts(p: Pairing): { heading: FamilySpec; body: FamilySpec } {
  return {
    heading: { slug: p.heading.slug, weights: p.heading.weights, italic: p.heading.italic },
    body: { slug: p.body.slug, weights: p.body.weights, italic: p.body.italic },
  }
}

export class PairingValidationError extends Error {
  constructor(detail: string) {
    super(`pairings: ${detail}`)
    this.name = 'PairingValidationError'
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function fail(detail: string): never {
  throw new PairingValidationError(detail)
}

const KEBAB_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const MIN_WEIGHT = 100
const MAX_WEIGHT = 900
const MAX_TAGS = 4

function checkFamily(raw: unknown, slot: FontRole, where: string): void {
  if (!isRecord(raw)) fail(`${where}.${slot}: expected an object`)
  const { slug, role, category, tags, weights, italic } = raw

  if (typeof slug !== 'string' || slug.length === 0) fail(`${where}.${slot}.slug: non-empty string required`)
  if (slug.trim() !== slug || slug.includes('+')) fail(`${where}.${slot}.slug: "${slug}" is not a family name (trim it; "+" belongs only in URLs)`)

  if (role !== slot) fail(`${where}.${slot}.role: expected "${slot}", got ${JSON.stringify(role)}`)

  if (typeof category !== 'string' || !(FONT_CATEGORIES as readonly string[]).includes(category)) {
    fail(`${where}.${slot}.category: ${JSON.stringify(category)} is not one of ${FONT_CATEGORIES.join(' | ')}`)
  }

  if (!Array.isArray(tags) || tags.length === 0 || tags.length > MAX_TAGS) {
    fail(`${where}.${slot}.tags: 1–${MAX_TAGS} tags required`)
  }
  const seenTags = new Set<string>()
  for (const tag of tags) {
    if (typeof tag !== 'string' || tag.length === 0) fail(`${where}.${slot}.tags: non-empty strings required`)
    if (tag !== tag.toLowerCase()) fail(`${where}.${slot}.tags: "${tag}" must be lowercase`)
    if (seenTags.has(tag)) fail(`${where}.${slot}.tags: duplicate "${tag}"`)
    seenTags.add(tag)
  }

  if (!Array.isArray(weights) || weights.length === 0) fail(`${where}.${slot}.weights: non-empty array required`)
  let prev = 0
  for (const weight of weights) {
    if (typeof weight !== 'number' || !Number.isInteger(weight) || weight < MIN_WEIGHT || weight > MAX_WEIGHT) {
      fail(`${where}.${slot}.weights: ${JSON.stringify(weight)} is not an integer in ${MIN_WEIGHT}–${MAX_WEIGHT}`)
    }
    if (weight <= prev) fail(`${where}.${slot}.weights: ${weights.join(',')} must be strictly ascending`)
    prev = weight
  }

  if (typeof italic !== 'boolean') fail(`${where}.${slot}.italic: boolean required`)
}

/**
 * Structural + invariant validation for an embedded pairing list.
 * Throws `PairingValidationError` with a located message; returns the input
 * typed as `Pairing[]` for consumers (deck, loader, reveal).
 */
export function validatePairings(input: unknown): Pairing[] {
  if (!Array.isArray(input) || input.length === 0) fail('expected a non-empty array')

  const seenIds = new Set<string>()
  input.forEach((raw, index) => {
    const where = `pairing[${index}]`
    if (!isRecord(raw)) fail(`${where}: expected an object`)

    const id = raw.id
    if (typeof id !== 'string' || !KEBAB_ID.test(id)) fail(`${where}.id: kebab-case string required, got ${JSON.stringify(id)}`)
    if (seenIds.has(id)) fail(`${where}.id: duplicate "${id}"`)
    seenIds.add(id)

    checkFamily(raw.heading, 'heading', where)
    checkFamily(raw.body, 'body', where)

    const headingSlug = (raw.heading as Record<string, unknown>).slug
    const bodySlug = (raw.body as Record<string, unknown>).slug
    if (headingSlug === bodySlug) fail(`${where}: heading and body are the same family ("${headingSlug}")`)
  })

  return input as Pairing[]
}
