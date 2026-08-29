import pairingsJson from './pairings.json'
import { validatePairings } from '../types'

/**
 * T14 — the full deck dataset (~60 curated pairings). Validated — shape +
 * invariants — at import time, exactly like the T02 sample: a malformed
 * record throws `PairingValidationError` at startup rather than surfacing
 * as a half-loaded card mid-judgement.
 *
 * Provenance (research/R1-pairing-provenance.md): pairings are this
 * project's own editorial selections composed from Google Fonts catalog
 * facts (categories, weights, popularity) — galleries were at most
 * per-pairing inspiration, never a list-level source. Courtesy credits
 * live in docs/CREDITS.md; per-pairing curation rationale in
 * docs/ultron/research/T14-curation-notes.md.
 *
 * The three-pairing sample (`src/data/pairings.sample.ts`) stays for the
 * test suites' deterministic 3-card deck.
 */
export const pairings = validatePairings(pairingsJson)
