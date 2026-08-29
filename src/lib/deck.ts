/**
 * T06 — Deck logic (pure).
 *
 * Unseen-first random draw over the pairing list, with the seen-set behind an
 * injected persistence seam so a reload (or a storage-unavailable fallback,
 * D2/T10) resumes the same cycle instead of repeating judged pairings.
 *
 * Contract decisions (docs/ultron/plan.md T06 + town-hall D7):
 *
 * - **Unseen-first:** every successful `draw()` picks uniformly at random from
 *   the pairings NOT yet seen this cycle, then marks the pick seen. A full
 *   cycle therefore visits every pairing exactly once — no repeat until
 *   exhaustion, whatever the rng does.
 * - **Exhaustion is a state, not an event:** when nothing unseen remains,
 *   `draw()` returns `{ status: 'exhausted' }` and refuses. Reshuffling is a
 *   separate, explicit act (`reshuffle()`) — D7 puts that choice in the user's
 *   hands, never the deck's.
 * - **Reshuffle clears seen** (in memory AND the persisted store) and nothing
 *   else; the deck list itself is immutable.
 * - **No DOM, no timing, no globals but `Math.random` as the default rng** —
 *   inject `rng` for determinism (tests, T16 E2E reproducibility).
 *
 * Safety behaviors beyond the happy path (all unit-tested):
 *
 * - Empty deck ⇒ immediately exhausted; `draw()` never throws and never
 *   consumes an rng roll.
 * - A persisted seen-set may contain ids the current deck no longer has
 *   (dataset changed between sessions, T14): stale ids are pruned at
 *   construction so counts stay honest and storage stays bounded.
 * - Duplicate ids in the input list are deduped (first occurrence wins).
 * - A misbehaving injected rng (returns 1, a negative, NaN…) is clamped to a
 *   valid index — the deck picks something, never `undefined`.
 */

import type { Pairing } from '../types'

/** Uniform random source in `[0, 1)` — `Math.random`'s contract. */
export type Rng = () => number

export const defaultRng: Rng = Math.random

/**
 * Persistence seam for the seen-set. Defined here (T06); implemented by T10
 * (`src/lib/storage.ts`) as the localStorage-backed store, whose
 * storage-unavailable path is an in-memory stand-in plus a non-blocking
 * notice (criterion 7). The deck only ever talks to this interface.
 */
export interface SeenSetStore {
  /** Restores the persisted seen ids; empty set when nothing was persisted. */
  load(): ReadonlySet<string>
  /** Persists the full current seen set (whole-set write; values are pairing ids). */
  save(seen: ReadonlySet<string>): void
  /** Clears the persisted seen set — called by `deck.reshuffle()`. */
  clear(): void
}

/**
 * In-memory `SeenSetStore` — the default when none is injected, and the shape
 * of T10's storage-unavailable fallback. Also the test double for save/clear
 * round-trips.
 */
export function createMemorySeenSetStore(initial?: Iterable<string>): SeenSetStore {
  let ids = new Set(initial ?? [])
  return {
    load: () => new Set(ids),
    save: (seen) => {
      ids = new Set(seen)
    },
    clear: () => {
      ids.clear()
    },
  }
}

/** Cycle counters for the review screen's progress vocabulary (distance markers, T07). */
export interface DeckStats {
  /** Distinct pairings in the deck (deduped by id). */
  total: number
  /** Seen this cycle, counted within the deck (stale persisted ids don't count). */
  seen: number
  /** Unseen this cycle — the pool `draw()` picks from. */
  unseen: number
  /** true ⇔ no unseen pairing remains; `draw()` will refuse until `reshuffle()`. */
  exhausted: boolean
}

export type DrawResult =
  | { readonly status: 'pairing'; readonly pairing: Pairing; readonly stats: DeckStats }
  | { readonly status: 'exhausted'; readonly stats: DeckStats }

export interface Deck {
  /**
   * Draw one unseen pairing at random and mark it seen (persisted via the
   * store). Returns `exhausted` — without rolling the rng or mutating
   * anything — when the cycle is complete or the deck is empty.
   * The returned `stats` are post-draw (the drawn pairing already counts as seen).
   */
  draw(): DrawResult
  /**
   * Look up a deck pairing by id WITHOUT drawing: no rng roll, no seen-set
   * mutation, no store write. `null` when the id is not in the deck (stale
   * persisted id — dataset changed between sessions). The reload-restore path
   * uses this so a refresh re-mounts the on-wall pairing instead of
   * consuming a new one (which would be an implicit skip).
   */
  recall(id: string): Pairing | null
  /** End the cycle and start a fresh one: clears seen in memory AND storage. */
  reshuffle(): void
  /** Current cycle counters. */
  stats(): DeckStats
}

export interface DeckOptions {
  /** Seen-set persistence (T10). Default: an in-memory store. */
  seenStore?: SeenSetStore
  /** Random source. Default: `Math.random`. */
  rng?: Rng
}

/**
 * Build a deck over a pairing list. Pure with respect to the DOM and time;
 * the only observable side effects are the injected store's `save`/`clear`.
 * The input array is copied, so caller-side mutation afterwards cannot
 * reshape the deck.
 */
export function createDeck(pairings: readonly Pairing[], options: DeckOptions = {}): Deck {
  const rng = options.rng ?? defaultRng
  const store = options.seenStore ?? createMemorySeenSetStore()

  // Dedupe by id (first occurrence wins) and copy — keeps unseen-count math
  // exact even if an unvalidated list slips through T02's guard.
  const deck: Pairing[] = []
  const deckIds = new Set<string>()
  for (const pairing of pairings) {
    if (!deckIds.has(pairing.id)) {
      deckIds.add(pairing.id)
      deck.push(pairing)
    }
  }

  // Prune persisted ids that are no longer in the deck (dataset changed
  // between sessions): counts stay honest, storage stays bounded, and a
  // stale "everything seen" id can never phantom-exhaust the current deck
  // unless every current id really is seen.
  const seen = new Set<string>()
  for (const id of store.load()) {
    if (deckIds.has(id)) seen.add(id)
  }

  function stats(): DeckStats {
    const unseen = deck.length - seen.size
    return { total: deck.length, seen: seen.size, unseen, exhausted: unseen === 0 }
  }

  function draw(): DrawResult {
    const pool = deck.filter((pairing) => !seen.has(pairing.id))
    if (pool.length === 0) {
      return { status: 'exhausted', stats: stats() }
    }
    // floor(roll * n) is uniform for roll ~ U[0,1). The clamp keeps a
    // hostile injected rng (1, negatives, NaN) on a valid index.
    const roll = rng()
    const index = Number.isFinite(roll)
      ? Math.min(Math.max(Math.floor(roll * pool.length), 0), pool.length - 1)
      : 0
    const pairing = pool[index]
    seen.add(pairing.id)
    store.save(seen)
    return { status: 'pairing', pairing, stats: stats() }
  }

  function recall(id: string): Pairing | null {
    return deck.find((pairing) => pairing.id === id) ?? null
  }

  function reshuffle(): void {
    seen.clear()
    store.clear()
  }

  return { draw, recall, reshuffle, stats }
}
