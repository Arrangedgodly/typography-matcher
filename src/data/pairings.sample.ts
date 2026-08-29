import sampleJson from './pairings.sample.json'
import { validatePairings } from '../types'

/**
 * The three sample pairings (T02). Validated — shape + invariants — at import
 * time; a malformed record throws `PairingValidationError` at startup rather
 * than surfacing as a half-loaded card mid-judgement (R2: correctness first).
 *
 * T05/T06 consume this until T14 lands the full ~60-pairing dataset
 * (`src/data/pairings.json`, same validation pattern).
 */
export const samplePairings = validatePairings(sampleJson)
