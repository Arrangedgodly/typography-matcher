/**
 * T10 unit tests — storage contract from plan.md's accept line plus the
 * worker contract's failure list, all against a mocked localStorage:
 *
 * - save/persist/remove round-trips for the seen-set, the save list, flags
 * - reload semantics: a fresh `createAppStorage` over the same backing
 *   restores what the previous instance wrote (deck resumption included)
 * - storage UNAVAILABLE at probe: access-throwing (SecurityError/private
 *   mode), setItem-throwing (quota/blocked), silent-drop, absent entirely
 *   → in-memory implementation behind the same interface, degraded flag,
 *   no crash (criterion 7)
 * - storage failing MID-SESSION (quota after a healthy probe): no throw,
 *   one degradation event, session data survives in the mirror, and the
 *   degradation is shared by every slot + sticky once tripped
 * - JSON corruption recovery: garbage, wrong shapes, salvageable entries
 */
import { describe, expect, it, vi } from 'vitest'
import { createDeck } from './deck'
import { createAppStorage, EXPLAINER_DISMISSED_FLAG } from './storage'
import { samplePairings } from '../data/pairings.sample'

// ---------------------------------------------------------------------------
// Mock localStorage (node environment — the real one does not exist here,
// which is itself one of the tested conditions via the default seam)
// ---------------------------------------------------------------------------

class MockStorage implements Storage {
  private map = new Map<string, string>()
  private getItemError: Error | null = null
  private setItemError: Error | null = null
  private removeItemError: Error | null = null

  /** Make subsequent `setItem` calls throw (quota simulation). */
  failSetItem(error: Error | null): void {
    this.setItemError = error
  }
  failGetItem(error: Error | null): void {
    this.getItemError = error
  }
  failRemoveItem(error: Error | null): void {
    this.removeItemError = error
  }

  /** Test helpers: seed raw (corrupt) records, inspect the raw backing. */
  seed(key: string, value: string): void {
    this.map.set(key, value)
  }
  peek(key: string): string | null {
    return this.map.get(key) ?? null
  }
  keys(): string[] {
    return [...this.map.keys()]
  }

  get length(): number {
    return this.map.size
  }
  clear(): void {
    this.map.clear()
  }
  getItem(key: string): string | null {
    if (this.getItemError) throw this.getItemError
    return this.map.get(key) ?? null
  }
  key(index: number): string | null {
    return [...this.map.keys()][index] ?? null
  }
  removeItem(key: string): void {
    if (this.removeItemError) throw this.removeItemError
    this.map.delete(key)
  }
  setItem(key: string, value: string): void {
    if (this.setItemError) throw this.setItemError
    this.map.set(key, String(value))
  }
}

const SEEN_KEY = 'blind-test.seen.v1'
const SAVES_KEY = 'blind-test.saves.v1'
const FLAGS_KEY = 'blind-test.flags.v1'
const PROBE_KEY = 'blind-test.probe.v1'

const over = (mock: MockStorage) => createAppStorage({ getStorage: () => mock })

// ---------------------------------------------------------------------------
// Healthy storage — round-trips (plan accept line 1)
// ---------------------------------------------------------------------------

describe('available storage', () => {
  it('seen-set round-trips across store instances (the reload contract)', () => {
    const mock = new MockStorage()
    const first = over(mock)
    first.seen.save(new Set(['a', 'b']))

    const reloaded = over(mock)
    expect([...reloaded.seen.load()].sort()).toEqual(['a', 'b'])
    expect(reloaded.mode).toBe('local')
    expect(reloaded.degraded).toBe(false)
  })

  it('seen save is a whole-set write; clear empties the record and the key', () => {
    const mock = new MockStorage()
    const store = over(mock)
    store.seen.save(new Set(['a', 'b']))
    store.seen.save(new Set(['a'])) // whole-set semantics: last write wins
    expect([...over(mock).seen.load()]).toEqual(['a'])

    store.seen.clear()
    expect(store.seen.load().size).toBe(0)
    expect(over(mock).seen.load().size).toBe(0)
    expect(mock.peek(SEEN_KEY)).toBeNull()
  })

  it('saves round-trip in judgment order, deduped; remove = whole-list write without the id', () => {
    const mock = new MockStorage()
    const store = over(mock)
    store.saves.save(['p2', 'p1'])
    store.saves.save(['p2', 'p1', 'p2']) // dedupe, order preserved

    expect(over(mock).saves.load()).toEqual(['p2', 'p1'])

    store.saves.save(['p2']) // the remove round-trip (T11's list will do this)
    expect(over(mock).saves.load()).toEqual(['p2'])
    expect(JSON.parse(mock.peek(SAVES_KEY) as string)).toEqual(['p2'])
  })

  it('flags round-trip; absent flags read false and false persists distinctly', () => {
    const mock = new MockStorage()
    const store = over(mock)
    expect(store.flags.get(EXPLAINER_DISMISSED_FLAG)).toBe(false) // default

    store.flags.set(EXPLAINER_DISMISSED_FLAG, true)
    const reloaded = over(mock)
    expect(reloaded.flags.get(EXPLAINER_DISMISSED_FLAG)).toBe(true)

    reloaded.flags.set(EXPLAINER_DISMISSED_FLAG, false)
    expect(over(mock).flags.get(EXPLAINER_DISMISSED_FLAG)).toBe(false)
  })

  it('slots are isolated — a seen write never clobbers saves or flags', () => {
    const mock = new MockStorage()
    const store = over(mock)
    store.saves.save(['p1'])
    store.flags.set(EXPLAINER_DISMISSED_FLAG, true)
    store.seen.save(new Set(['p1', 'p2']))
    store.seen.clear()

    const reloaded = over(mock)
    expect(reloaded.saves.load()).toEqual(['p1'])
    expect(reloaded.flags.get(EXPLAINER_DISMISSED_FLAG)).toBe(true)
    expect(reloaded.seen.load().size).toBe(0)
  })

  it('the probe leaves no residue on a healthy backing', () => {
    const mock = new MockStorage()
    over(mock)
    expect(mock.peek(PROBE_KEY)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Unavailable at probe — criterion 7's head (private mode / blocked / absent)
// ---------------------------------------------------------------------------

describe('unavailable at probe', () => {
  it('a throwing localStorage ACCESS (private-mode SecurityError) degrades to memory without crashing', () => {
    const mock = new MockStorage()
    const store = createAppStorage({
      getStorage: () => {
        throw new DOMException('Access denied', 'SecurityError')
      },
    })
    expect(store.mode).toBe('memory')
    expect(store.degraded).toBe(true)

    // The same interface serves the whole session from memory.
    store.seen.save(new Set(['a']))
    store.saves.save(['p1'])
    store.flags.set(EXPLAINER_DISMISSED_FLAG, true)
    expect([...store.seen.load()]).toEqual(['a'])
    expect(store.saves.load()).toEqual(['p1'])
    expect(store.flags.get(EXPLAINER_DISMISSED_FLAG)).toBe(true)
    expect(() => store.seen.clear()).not.toThrow()
    expect(mock.keys()).toHaveLength(0) // nothing was ever written anywhere
  })

  it('a throwing setItem (quota / blocked cookies) fails the probe the same way', () => {
    const mock = new MockStorage()
    mock.failSetItem(new DOMException('Quota exceeded', 'QuotaExceededError'))
    const store = over(mock)
    expect(store.mode).toBe('memory')
    expect(store.degraded).toBe(true)
    expect(() => store.saves.save(['p1'])).not.toThrow()
    expect(mock.peek(SAVES_KEY)).toBeNull()
  })

  it('a write that does not read back fails the probe (silently dropping storage)', () => {
    const mock = new MockStorage()
    mock.failGetItem(new Error('partitioned read'))
    const store = over(mock)
    expect(store.mode).toBe('memory')
    expect(store.degraded).toBe(true)
  })

  it('no localStorage at all (non-DOM environment) degrades quietly via the default seam', () => {
    const store = createAppStorage() // node: globalThis.localStorage is undefined
    expect(store.mode).toBe('memory')
    expect(store.degraded).toBe(true)
    expect(store.saves.load()).toEqual([])
  })

  it('degraded stores still satisfy the SeenSetStore contract in-memory for the session', () => {
    const mock = new MockStorage()
    mock.failSetItem(new DOMException('Quota exceeded', 'QuotaExceededError'))
    const store = over(mock)
    const deck = createDeck(samplePairings, { seenStore: store.seen })
    expect(deck.draw().status).toBe('pairing')
    expect(deck.stats().seen).toBe(1) // judged within the session
    expect(() => deck.reshuffle()).not.toThrow()
    expect(deck.stats().seen).toBe(0)
  })

  it('onDegraded fires immediately when registered after the degradation', () => {
    const mock = new MockStorage()
    mock.failSetItem(new DOMException('Quota exceeded', 'QuotaExceededError'))
    const store = over(mock)
    const late = vi.fn()
    store.onDegraded(late)
    expect(late).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// Mid-session failure — quota AFTER a healthy probe
// ---------------------------------------------------------------------------

describe('mid-session failure', () => {
  it('a setItem QuotaExceededError on save: no throw, degraded flips, one event, data survives', () => {
    const mock = new MockStorage()
    const store = over(mock)
    expect(store.degraded).toBe(false)

    store.saves.save(['p1']) // healthy write
    const onDegraded = vi.fn()
    store.onDegraded(onDegraded)

    mock.failSetItem(new DOMException('Quota exceeded', 'QuotaExceededError'))
    expect(() => store.saves.save(['p1', 'p2'])).not.toThrow()

    expect(store.degraded).toBe(true)
    expect(store.mode).toBe('memory')
    expect(onDegraded).toHaveBeenCalledTimes(1) // exactly once, not per write

    // The session's records survive via the mirror — includes the failed write.
    expect(store.saves.load()).toEqual(['p1', 'p2'])
    // The backing holds the last healthy write only.
    expect(JSON.parse(mock.peek(SAVES_KEY) as string)).toEqual(['p1'])

    // Degradation is sticky: a healed setItem does not resurrect persistence.
    mock.failSetItem(null)
    store.saves.save(['p1', 'p2', 'p3'])
    expect(mock.peek(SAVES_KEY)).not.toContain('p3')
    expect(onDegraded).toHaveBeenCalledTimes(1)
  })

  it('degradation is shared: a seen-write failure degrades saves and flags too', () => {
    const mock = new MockStorage()
    const store = over(mock)
    const noticed = vi.fn()
    store.onDegraded(noticed)

    mock.failSetItem(new DOMException('Quota exceeded', 'QuotaExceededError'))
    store.seen.save(new Set(['a'])) // the seen slot trips it

    expect(store.degraded).toBe(true)
    expect(noticed).toHaveBeenCalledTimes(1)

    // The other slots serve from memory without touching the broken backing.
    expect(() => store.saves.save(['p1'])).not.toThrow()
    expect(() => store.flags.set(EXPLAINER_DISMISSED_FLAG, true)).not.toThrow()
    expect(store.saves.load()).toEqual(['p1'])
    expect(store.flags.get(EXPLAINER_DISMISSED_FLAG)).toBe(true)
    expect(mock.peek(SAVES_KEY)).toBeNull()
    expect(mock.peek(FLAGS_KEY)).toBeNull()
  })

  it('a failing removeItem (clear path) degrades without throwing', () => {
    const mock = new MockStorage()
    const store = over(mock)
    store.seen.save(new Set(['a', 'b']))

    mock.failRemoveItem(new DOMException('SecurityError'))
    expect(() => store.seen.clear()).not.toThrow()
    expect(store.degraded).toBe(true)
    expect(store.seen.load().size).toBe(0) // the mirror was cleared
    expect(mock.peek(SEEN_KEY)).not.toBeNull() // the stale record stays orphaned
  })
})

// ---------------------------------------------------------------------------
// Corruption recovery
// ---------------------------------------------------------------------------

describe('corruption recovery', () => {
  it('garbage JSON in the seen key loads as empty and is repaired by the next save', () => {
    const mock = new MockStorage()
    mock.seed(SEEN_KEY, '{"unterminated":')
    const store = over(mock)
    expect(store.seen.load().size).toBe(0)
    expect(store.degraded).toBe(false) // corrupt data is not unavailability

    store.seen.save(new Set(['a']))
    expect(JSON.parse(mock.peek(SEEN_KEY) as string)).toEqual(['a'])
    expect([...over(mock).seen.load()]).toEqual(['a'])
  })

  it('wrong-shaped records load as their defaults without throwing', () => {
    const mock = new MockStorage()
    mock.seed(SEEN_KEY, '{"a": 1}') // valid JSON, not an array
    mock.seed(SAVES_KEY, '"just a string"')
    mock.seed(FLAGS_KEY, '["not", "an", "object"]')
    const store = over(mock)
    expect(store.seen.load().size).toBe(0)
    expect(store.saves.load()).toEqual([])
    expect(store.flags.get(EXPLAINER_DISMISSED_FLAG)).toBe(false)
  })

  it('a saves array with non-string entries salvages the valid ids', () => {
    const mock = new MockStorage()
    mock.seed(SAVES_KEY, JSON.stringify(['p1', 42, null, 'p2', 'p1']))
    const store = over(mock)
    expect(store.saves.load()).toEqual(['p1', 'p2'])
  })

  it('a flags record with non-boolean values keeps only the booleans', () => {
    const mock = new MockStorage()
    mock.seed(FLAGS_KEY, JSON.stringify({ yes: true, no: 'true', gone: 1 }))
    const store = over(mock)
    expect(store.flags.get('yes')).toBe(true)
    expect(store.flags.get('no')).toBe(false)
    expect(store.flags.get('gone')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Deck integration — T06's interface, implemented by T10
// ---------------------------------------------------------------------------

describe('deck integration', () => {
  it('a deck drawing through the store resumes its cycle after a reload', () => {
    const mock = new MockStorage()
    const session = createDeck(samplePairings, { seenStore: over(mock).seen })
    session.draw()
    session.draw()
    expect(session.stats().seen).toBe(2)

    // "Reload": fresh storage instance AND fresh deck over the same backing.
    const reloaded = createDeck(samplePairings, { seenStore: over(mock).seen })
    expect(reloaded.stats()).toEqual({ total: 3, seen: 2, unseen: 1, exhausted: false })

    const last = reloaded.draw()
    expect(last.status).toBe('pairing')
    expect(reloaded.stats().exhausted).toBe(true)
    expect([...over(mock).seen.load()].sort()).toEqual(
      [...samplePairings.map((p) => p.id)].sort(),
    )

    reloaded.reshuffle()
    expect(over(mock).seen.load().size).toBe(0) // clear reached the backing
  })
})
