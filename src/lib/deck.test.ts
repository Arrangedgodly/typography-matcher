/**
 * T06 unit tests — deck contract from plan.md's accept line plus the worker
 * contract's edge list:
 *
 * - no repeat until exhaustion over full-cycle draws
 * - exhaustion flag after N unique draws (post-draw stats + refused N+1 draw)
 * - reshuffle resets (mid-cycle and from exhaustion; clears the store)
 * - deterministic under a seeded/scripted rng (exact draw sequences)
 * - deck smaller than expected: stale persisted ids, singleton deck,
 *   duplicate ids in the input list
 * - empty-list safety: empty deck is exhausted from birth, no rng roll,
 *   no throw, reshuffle still safe
 *
 * Plus the persistence seam behaviors T10 must be able to rely on:
 * save-after-every-draw with the accumulated set, no save on a refused draw,
 * clear on reshuffle, and cycle resumption across deck instances (the
 * reload flow). Pure module — node environment, no DOM.
 */
import { describe, expect, it, vi } from 'vitest'
import { createDeck, createMemorySeenSetStore, type Rng, type SeenSetStore } from './deck'
import { samplePairings } from '../data/pairings.sample'
import type { Pairing } from '../types'

// ---------------------------------------------------------------------------
// Fixtures + harness
// ---------------------------------------------------------------------------

const SAMPLE_IDS = samplePairings.map((p) => p.id)

/** Minimal well-shaped pairing — deck logic is id-driven; families are cargo. */
const makePairing = (id: string): Pairing => ({
  id,
  heading: { slug: `Head ${id}`, role: 'heading', category: 'sans-serif', tags: ['synthetic'], weights: [400, 700], italic: false },
  body: { slug: `Body ${id}`, role: 'body', category: 'serif', tags: ['synthetic'], weights: [400], italic: true },
})

const syntheticDeck = (n: number): Pairing[] =>
  Array.from({ length: n }, (_, i) => makePairing(`p${i + 1}`))

/** Deterministic seeded PRNG (mulberry32) — standard, tiny, adequate here. */
function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Wraps a real store, recording every save payload and clear call. */
function recordingStore(initial?: Iterable<string>) {
  const base = createMemorySeenSetStore(initial)
  const saves: Array<ReadonlySet<string>> = []
  let clears = 0
  const store: SeenSetStore = {
    load: base.load,
    save: (seen) => {
      saves.push(new Set(seen))
      base.save(seen)
    },
    clear: () => {
      clears += 1
      base.clear()
    },
  }
  return { store, base, saves, clears: () => clears }
}

/** Drain the deck to exhaustion; returns the drawn ids in order. */
const drainCycle = (deck: ReturnType<typeof createDeck>): string[] => {
  const ids: string[] = []
  for (let result = deck.draw(); result.status === 'pairing'; result = deck.draw()) {
    ids.push(result.pairing.id)
  }
  return ids
}

// ---------------------------------------------------------------------------
// Full cycle — no repeat until exhaustion (plan accept line 1)
// ---------------------------------------------------------------------------

describe('full cycle', () => {
  it('visits every pairing exactly once across a full cycle — no repeat, none missing', () => {
    const rng = vi.fn(mulberry32(7))
    const deck = createDeck(samplePairings, { rng })
    const drawn: string[] = []

    for (let i = 0; i < samplePairings.length; i++) {
      const result = deck.draw()
      expect(result.status).toBe('pairing')
      if (result.status !== 'pairing') throw new Error('unreachable')
      drawn.push(result.pairing.id)
      expect(deck.stats().seen).toBe(i + 1)
      expect(deck.stats().unseen).toBe(samplePairings.length - (i + 1))
    }

    expect(drawn).toHaveLength(samplePairings.length)
    expect(new Set(drawn).size).toBe(samplePairings.length) // no repeats
    expect(drawn.slice().sort()).toEqual([...SAMPLE_IDS].sort()) // nothing missing
    expect(rng).toHaveBeenCalledTimes(samplePairings.length) // exactly one roll per card
  })

  it('holds at 30 pairings (T14 scale): 30 draws, 30 unique, no rng overrun', () => {
    const deck = createDeck(syntheticDeck(30), { rng: mulberry32(42) })
    const ids = drainCycle(deck)
    expect(ids).toHaveLength(30)
    expect(new Set(ids).size).toBe(30)
    expect(deck.stats()).toEqual({ total: 30, seen: 30, unseen: 0, exhausted: true })
  })
})

// ---------------------------------------------------------------------------
// Exhaustion (plan accept line 2)
// ---------------------------------------------------------------------------

describe('exhaustion', () => {
  it('flags exhaustion after exactly N unique draws — the last draw already reports it', () => {
    const deck = createDeck(samplePairings, { rng: mulberry32(3) })
    let lastStats = deck.draw().stats
    for (let i = 1; i < samplePairings.length; i++) {
      expect(lastStats.exhausted).toBe(false) // not premature
      lastStats = deck.draw().stats
    }
    expect(lastStats).toEqual({ total: 3, seen: 3, unseen: 0, exhausted: true })

    const refused = deck.draw()
    expect(refused.status).toBe('exhausted')
    if (refused.status !== 'exhausted') throw new Error('unreachable')
    expect(refused.stats).toEqual({ total: 3, seen: 3, unseen: 0, exhausted: true })
  })

  it('a refused draw is inert: no rng roll, no store write', () => {
    const { store, saves } = recordingStore()
    const rng = vi.fn(mulberry32(5))
    const deck = createDeck(samplePairings, { seenStore: store, rng })
    drainCycle(deck)

    const rollsBefore = rng.mock.calls.length
    const savesBefore = saves.length
    expect(deck.draw().status).toBe('exhausted')
    expect(deck.draw().status).toBe('exhausted') // stays refused, not one-shot
    expect(rng.mock.calls.length).toBe(rollsBefore)
    expect(saves.length).toBe(savesBefore)
  })
})

// ---------------------------------------------------------------------------
// Reshuffle resets (plan accept line 3)
// ---------------------------------------------------------------------------

describe('reshuffle', () => {
  it('clears seen from exhaustion and yields a fresh full cycle', () => {
    const deck = createDeck(samplePairings, { rng: mulberry32(9) })
    drainCycle(deck)
    expect(deck.stats().exhausted).toBe(true)

    deck.reshuffle()
    expect(deck.stats()).toEqual({ total: 3, seen: 0, unseen: 3, exhausted: false })

    const secondCycle = drainCycle(deck)
    expect(new Set(secondCycle).size).toBe(3)
    expect(secondCycle.slice().sort()).toEqual([...SAMPLE_IDS].sort())
    expect(deck.draw().status).toBe('exhausted')
  })

  it('works mid-cycle (D7 reshuffle is available at any time) and the just-seen card can reappear', () => {
    // Scripted rng: roll 0 → always first of the pool ⇒ same id every time.
    const deck = createDeck(samplePairings, { rng: () => 0 })
    const first = deck.draw()
    if (first.status !== 'pairing') throw new Error('unreachable')
    expect(deck.stats()).toEqual({ total: 3, seen: 1, unseen: 2, exhausted: false })

    deck.reshuffle()
    expect(deck.stats()).toEqual({ total: 3, seen: 0, unseen: 3, exhausted: false })

    const after = deck.draw()
    expect(after.status).toBe('pairing')
    if (after.status !== 'pairing') throw new Error('unreachable')
    expect(after.pairing.id).toBe(first.pairing.id) // pool re-opened
  })

  it('clears the persisted store too', () => {
    const { store, base, clears } = recordingStore()
    const deck = createDeck(samplePairings, { seenStore: store })
    deck.draw()
    expect(base.load().size).toBe(1)

    deck.reshuffle()
    expect(clears()).toBe(1)
    expect(base.load().size).toBe(0)
    // The next save starts a fresh cycle set — no zombie ids from cycle 1.
    const next = deck.draw()
    expect(next.status).toBe('pairing')
    expect(base.load().size).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// Determinism (plan accept line 4)
// ---------------------------------------------------------------------------

describe('determinism', () => {
  it('a scripted rng maps rolls onto pool positions exactly (first / middle / last)', () => {
    const rolls = [0, 0.5, 0.999]
    const deck = createDeck(samplePairings, { rng: () => rolls.shift() as number })

    // Pool starts in deck order: [fraunces-newsreader, space-grotesk-crimson-pro, instrument-sans-lora]
    const first = deck.draw()
    expect(first.status).toBe('pairing')
    if (first.status !== 'pairing') throw new Error('unreachable')
    expect(first.pairing.id).toBe('fraunces-newsreader') // floor(0 * 3) = 0

    // Remaining pool: [space-grotesk-crimson-pro, instrument-sans-lora]; floor(0.5 * 2) = 1
    const second = deck.draw()
    expect(second.status).toBe('pairing')
    if (second.status !== 'pairing') throw new Error('unreachable')
    expect(second.pairing.id).toBe('instrument-sans-lora')

    // Remaining pool: [space-grotesk-crimson-pro]; floor(0.999 * 1) = 0
    const third = deck.draw()
    expect(third.status).toBe('pairing')
    if (third.status !== 'pairing') throw new Error('unreachable')
    expect(third.pairing.id).toBe('space-grotesk-crimson-pro')
  })

  it('same seed ⇒ identical full-cycle sequence; seeds diverge', () => {
    const run = (seed: number) => drainCycle(createDeck(syntheticDeck(8), { rng: mulberry32(seed) }))
    expect(run(1)).toEqual(run(1)) // identical, card for card
    expect(run(1)).not.toEqual(run(2)) // different seeds, different shuffle
    expect(new Set(run(1)).size).toBe(8) // …and still a full permutation
  })

  it('a hostile rng (always 1) is clamped to the last pool slot — never undefined, never a crash', () => {
    const deck = createDeck(samplePairings, { rng: () => 1 })
    const ids = drainCycle(deck)
    expect(new Set(ids).size).toBe(3)
    expect(ids.slice().sort()).toEqual([...SAMPLE_IDS].sort())
  })

  it('a NaN-rolling rng is clamped to the first slot instead of poisoning the draw', () => {
    const deck = createDeck(samplePairings, { rng: () => NaN })
    expect(deck.draw().status).toBe('pairing')
    expect(deck.draw().status).toBe('pairing')
    expect(deck.draw().status).toBe('pairing')
    expect(deck.draw().status).toBe('exhausted')
  })
})

// ---------------------------------------------------------------------------
// Deck smaller than expected (worker contract)
// ---------------------------------------------------------------------------

describe('deck smaller than expected', () => {
  it('stale persisted ids (dataset shrank) neither phantom-exhaust nor inflate counts', () => {
    const deckList = syntheticDeck(2) // p1, p2 — the dataset shrank from 3+
    const { store, base } = recordingStore(['p1', 'p2', 'p3', 'ghost-id'])
    const deck = createDeck(deckList, { seenStore: store, rng: mulberry32(11) })

    // p3/ghost are not in this deck; only p1+p2 count ⇒ genuinely exhausted.
    expect(deck.stats()).toEqual({ total: 2, seen: 2, unseen: 0, exhausted: true })
    expect(deck.draw().status).toBe('exhausted')

    deck.reshuffle()
    const ids = drainCycle(deck)
    expect(ids.slice().sort()).toEqual(['p1', 'p2'])
    // First post-reshuffle save carries deck ids only — stale ids were pruned.
    expect([...base.load()].sort()).toEqual(ids.slice().sort())
  })

  it('a stale seen-set smaller than the deck leaves the remainder to draw', () => {
    const { store } = recordingStore(['p1'])
    const deck = createDeck(syntheticDeck(3), { seenStore: store, rng: mulberry32(13) })
    const ids = drainCycle(deck)
    expect(ids).toHaveLength(2)
    expect(ids).not.toContain('p1')
    expect(ids.slice().sort()).toEqual(['p2', 'p3'])
  })

  it('a singleton deck draws once, then exhausts', () => {
    const deck = createDeck([makePairing('only-one')], { rng: mulberry32(17) })
    const result = deck.draw()
    expect(result.status).toBe('pairing')
    if (result.status !== 'pairing') throw new Error('unreachable')
    expect(result.pairing.id).toBe('only-one')
    expect(result.stats).toEqual({ total: 1, seen: 1, unseen: 0, exhausted: true })
    expect(deck.draw().status).toBe('exhausted')
  })

  it('duplicate ids in the input list are deduped — a duplicate can never double-draw', () => {
    const original = makePairing('twin')
    const clone: Pairing = { ...original, heading: { ...original.heading } }
    const deck = createDeck([original, makePairing('other'), clone], { rng: mulberry32(19) })
    expect(deck.stats().total).toBe(2)
    const ids = drainCycle(deck)
    expect(ids.slice().sort()).toEqual(['other', 'twin'])
    // The deduped twin keeps the FIRST occurrence — identity preserved for the caller.
    const twinDraw = createDeck([original, clone], { rng: () => 0 }).draw()
    expect(twinDraw.status === 'pairing' && twinDraw.pairing).toBe(original)
  })
})

// ---------------------------------------------------------------------------
// Empty-list safety (worker contract)
// ---------------------------------------------------------------------------

describe('empty list safety', () => {
  it('an empty deck is exhausted from birth: refuses draws, rolls no rng, never throws', () => {
    const { store } = recordingStore()
    const rng = vi.fn(mulberry32(23))
    const deck = createDeck([], { seenStore: store, rng })

    expect(deck.stats()).toEqual({ total: 0, seen: 0, unseen: 0, exhausted: true })
    expect(deck.draw().status).toBe('exhausted')
    expect(deck.draw().status).toBe('exhausted')
    expect(rng).not.toHaveBeenCalled()

    expect(() => deck.reshuffle()).not.toThrow() // reshuffle stays safe too
    expect(deck.draw().status).toBe('exhausted')
    expect(rng).not.toHaveBeenCalled()
  })

  it('an empty deck over a non-empty persisted seen-set stays safe (nothing to resume)', () => {
    const deck = createDeck([], { seenStore: createMemorySeenSetStore(['p1']), rng: mulberry32(29) })
    expect(deck.stats()).toEqual({ total: 0, seen: 0, unseen: 0, exhausted: true })
    expect(deck.draw().status).toBe('exhausted')
  })
})

// ---------------------------------------------------------------------------
// Persistence seam — the contract T10 implements against (reload flow)
// ---------------------------------------------------------------------------

describe('persistence seam', () => {
  it('saves after every successful draw with the accumulated set — never mid-draw', () => {
    const { store, saves } = recordingStore()
    const deck = createDeck(samplePairings, { seenStore: store, rng: mulberry32(31) })

    deck.draw()
    expect(saves).toHaveLength(1)
    expect(saves[0].size).toBe(1)
    deck.draw()
    deck.draw()
    expect(saves).toHaveLength(3)
    expect(saves[2].size).toBe(3)
    expect([...saves[2]].sort()).toEqual([...SAMPLE_IDS].sort())
  })

  it('a fresh deck over the same store resumes the cycle — no repeats across reloads', () => {
    const { store } = recordingStore()
    const first = createDeck(samplePairings, { seenStore: store, rng: mulberry32(37) })
    first.draw()
    first.draw()
    expect(first.stats().seen).toBe(2)

    // "Reload": a new deck instance restores the persisted seen-set.
    const reloaded = createDeck(samplePairings, { seenStore: store, rng: mulberry32(101) })
    expect(reloaded.stats()).toEqual({ total: 3, seen: 2, unseen: 1, exhausted: false })

    const remainder = drainCycle(reloaded)
    expect(remainder).toHaveLength(1)
    expect(reloaded.stats().exhausted).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Default seams
// ---------------------------------------------------------------------------

describe('defaults', () => {
  it('runs without injected options (Math.random + in-memory store) and still exhausts correctly', () => {
    const deck = createDeck(samplePairings)
    const ids = drainCycle(deck)
    expect(ids.slice().sort()).toEqual([...SAMPLE_IDS].sort())
    expect(deck.draw().status).toBe('exhausted')
  })

  it('the in-memory store round-trips load/save/clear in isolation', () => {
    const store = createMemorySeenSetStore(['a'])
    expect([...store.load()]).toEqual(['a'])

    store.save(new Set(['a', 'b']))
    expect([...store.load()].sort()).toEqual(['a', 'b'])

    const copy = store.load() as Set<string> // cast: the leak test must attempt mutation
    copy.add('c') // caller mutation must not leak in
    expect([...store.load()].sort()).toEqual(['a', 'b'])

    store.clear()
    expect(store.load().size).toBe(0)
  })
})
