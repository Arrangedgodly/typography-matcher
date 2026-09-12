import pairingsJson from './pairings.json'
import { validatePairings } from '../types'

/**
 * Full deck: 61 editorial pairings followed by catalog-wide pairings from
 * `scripts/expand-font-catalog.mjs`. Validated — shape +
 * invariants — at import time, exactly like the T02 sample: a malformed
 * record throws `PairingValidationError` at startup rather than surfacing
 * as a half-loaded card mid-judgement.
 *
 * Provenance: the first 61 are the project's editorial selections documented
 * in `docs/ultron/research/T14-curation-notes.md`. Generated records use only
 * Google Fonts catalog facts and the deterministic rules documented in
 * `docs/FONT_CATALOG.md`; no third-party pairing list supplies them.
 *
 * The three-pairing sample (`src/data/pairings.sample.ts`) stays for the
 * test suites' deterministic 3-card deck.
 */
export const pairings = validatePairings(pairingsJson)
