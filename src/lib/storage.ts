/**
 * T10 — Storage layer (plan T10; acceptance criterion 7).
 *
 * localStorage is the only committed persistence substrate (town-hall D2),
 * and it is a hostile one: private modes throw on the mere ACCESS, blocked
 * cookie settings throw on `setItem`, quotas throw mid-session, and any
 * record can arrive corrupted. The layer's whole job is to absorb that so
 * the rest of the app never thinks about it:
 *
 * - **One interface, two backings.** `createAppStorage()` returns the same
 *   `AppStorage` surface whether localStorage is healthy or not. The
 *   seen-set slot implements T06's `SeenSetStore` verbatim (whole-set
 *   `save`, `clear` on reshuffle) — `createDeck` cannot tell it apart from
 *   the in-memory default.
 * - **Detect once.** Availability is probed exactly once, at construction:
 *   write → read back → remove on a probe key. Any throw (SecurityError on
 *   access, quota on write, a silent write) ⇒ in-memory from the start.
 * - **Degrade, never crash.** A failure that appears LATER (quota filling
 *   up mid-session) flips the shared core to memory mode on first failure:
 *   the call does not throw, the session's records live on in the slot
 *   mirrors, and degradation is sticky — one `QuotaExceededError` means the
 *   browser has spoken; we do not re-probe behind its back.
 * - **Degraded is observable, not blocking.** `degraded` + `onDegraded()`
 *   let the chrome surface a non-blocking notice (STATES IN PLACE strip
 *   row, criterion 7): the examination keeps working, saves keep counting,
 *   only their survival past reload is lost. `onDegraded` fires immediately
 *   when registered after a degradation, so one registration covers both
 *   the boot-time and mid-session cases.
 * - **Corruption recovery.** Every slot parses defensively: unreadable or
 *   wrong-shaped JSON loads as the empty default, never throws — the next
 *   write repairs the key. Non-string entries inside an id array are
 *   dropped (salvage the valid ids, dedupe, keep order).
 *
 * Records are minimal per D2: the seen-set and the save list persist ids
 * only; the app resolves ids against its bundled dataset (the same
 * stale-id rule the deck already applies — an id the dataset no longer
 * contains is pruned by the caller, not the store). One boolean-flag record
 * carries the first-run explainer dismissal.
 */

import type { SeenSetStore } from './deck'

/** Which backing is live: real localStorage, or the in-memory mirror. */
export type StorageMode = 'local' | 'memory'

/**
 * Saved-pairings store (ids only, D2 minimal records). Ordered — the
 * prescription list (T11) reveals saves in judgment order — and deduped.
 */
export interface SavedListStore {
  /** Persisted saved ids in save order; empty array when nothing was saved. */
  load(): string[]
  /**
   * Whole-list write, the same contract the seen-set gives the deck (T06's
   * whole-set write): the caller sends the complete current list every time,
   * so a remove is `save(listWithoutTheId)` and a reorder is just a new order.
   */
  save(ids: readonly string[]): void
}

/** Small named boolean flags (first-run explainer dismissal). */
export interface FlagStore {
  get(key: string): boolean
  set(key: string, value: boolean): void
}

/**
 * Small named string records (the on-wall pairing id, so a reload restores
 * the examined pairing instead of consuming a new one). `null` ⇔ absent.
 */
export interface StringStore {
  get(key: string): string | null
  set(key: string, value: string): void
}

/** The storage surface the app consumes. */
export interface AppStorage {
  /** T06's seen-set interface — hand straight to `createDeck`. */
  readonly seen: SeenSetStore
  /** Saved pairing ids (T11 reveals them; removal is a whole-list write). */
  readonly saves: SavedListStore
  /** Boolean flags (explainer dismissal). */
  readonly flags: FlagStore
  /** String records (the on-wall pairing id for reload-restore). */
  readonly strings: StringStore
  /** `'local'` ⇔ records persist; `'memory'` ⇔ session-only. */
  readonly mode: StorageMode
  /** true ⇔ records will NOT survive a reload — the chrome's notice condition. */
  readonly degraded: boolean
  /**
   * Register the degradation hook. Fires on the transition to memory mode,
   * or immediately on registration if degradation already happened (probe
   * failure included) — one call site covers every timing.
   */
  onDegraded(handler: () => void): void
}

export interface AppStorageOptions {
  /**
   * Storage accessor seam (inject a mock in tests). Default: read
   * `globalThis.localStorage`, itself guarded — privacy modes can throw on
   * the access, and non-DOM environments simply have none.
   */
  getStorage?: () => Storage | null | undefined
}

/** Flag names for `AppStorage.flags` — the first-run explainer dismissal. */
export const EXPLAINER_DISMISSED_FLAG = 'explainer-dismissed'

/**
 * String-record name for the on-wall pairing: written on every successful
 * swap so a reload restores the SAME pairing (a refresh must never consume a
 * fresh unseen pairing — that would be an implicit skip). Resolved against
 * the bundled dataset at boot; a stale id falls back to a fresh draw.
 */
export const CURRENT_PAIRING_KEY = 'current-pairing'

/** localStorage keys, namespaced and versioned (bump to invalidate records). */
const KEYS = {
  seen: 'blind-test.seen.v1',
  saves: 'blind-test.saves.v1',
  flags: 'blind-test.flags.v1',
  strings: 'blind-test.strings.v1',
  probe: 'blind-test.probe.v1',
} as const

function defaultGetStorage(): Storage | null | undefined {
  try {
    return globalThis.localStorage
  } catch {
    return undefined // the access itself threw — private mode's signature
  }
}

/** Dedupe an id iterable preserving first-occurrence order; drop non-strings. */
function toIdList(ids: Iterable<string>): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const id of ids) {
    if (typeof id === 'string' && !seen.has(id)) {
      seen.add(id)
      out.push(id)
    }
  }
  return out
}

/** Parse a persisted id list: an array is salvaged, anything else is absent. */
function parseIdList(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null
  return toIdList(raw)
}

/** Parse a persisted flag record: keep boolean-valued entries, drop the rest. */
function parseFlags(raw: unknown): Record<string, boolean> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {}
  const flags: Record<string, boolean> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'boolean') flags[key] = value
  }
  return flags
}

/** Parse a persisted string record: keep string-valued entries, drop the rest. */
function parseStrings(raw: unknown): Record<string, string> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {}
  const strings: Record<string, string> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'string') strings[key] = value
  }
  return strings
}

/**
 * The shared availability core. Every slot routes reads/writes through it,
 * so one quota failure degrades the WHOLE storage (seen, saves, flags) at
 * once and the mirrors — which slots update before writing — carry the
 * session from that moment.
 */
interface StorageCore {
  readonly mode: StorageMode
  readonly degraded: boolean
  onDegraded(handler: () => void): void
  /** Parsed JSON of a key; `undefined` when memory-mode, absent, or corrupt. */
  read(key: string): unknown
  write(key: string, value: unknown): void
  remove(key: string): void
}

function createStorageCore(getStorage: () => Storage | null | undefined): StorageCore {
  let storage: Storage | null = null
  let local = false
  let degraded = false
  const handlers: Array<() => void> = []

  // Detect once (criterion 7): a real write that reads back. Covers the
  // throw-on-access and throw-on-setItem privacy modes, quota exhaustion at
  // boot, storage implementations that silently drop writes — and the total
  // absence of a storage API, which is equally notice-worthy (records will
  // not survive a reload there either).
  try {
    const candidate = getStorage()
    if (!candidate) throw new Error('no storage API')
    candidate.setItem(KEYS.probe, '1')
    const echoed = candidate.getItem(KEYS.probe)
    candidate.removeItem(KEYS.probe)
    if (echoed !== '1') throw new Error('storage write did not read back')
    storage = candidate
    local = true
  } catch {
    storage = null
    local = false
    degraded = true
  }

  function degrade(): void {
    if (degraded) return
    degraded = true
    local = false // mirrors own the session from here
    const toFire = handlers.slice()
    handlers.length = 0
    for (const handler of toFire) handler()
  }

  return {
    get mode(): StorageMode {
      return local ? 'local' : 'memory'
    },
    get degraded(): boolean {
      return degraded
    },
    onDegraded(handler: () => void): void {
      if (degraded) {
        handler() // already degraded: late registrants hear it now
        return
      }
      handlers.push(handler)
    },
    read(key: string): unknown {
      if (!local || !storage) return undefined
      try {
        const raw = storage.getItem(key)
        return raw === null ? undefined : (JSON.parse(raw) as unknown)
      } catch {
        return undefined // corrupted record — the slot falls back to default
      }
    },
    write(key: string, value: unknown): void {
      if (!local || !storage) return
      try {
        storage.setItem(key, JSON.stringify(value))
      } catch {
        degrade() // quota / mid-session revocation: degrade, never throw
      }
    },
    remove(key: string): void {
      if (!local || !storage) return
      try {
        storage.removeItem(key)
      } catch {
        degrade()
      }
    },
  }
}

/** One JSON record: parsed once at construction, mirrored in memory, defensively replaced. */
function createSlot<T>(
  core: StorageCore,
  key: string,
  parse: (raw: unknown) => T | null,
  fallback: () => T,
): { get(): T; set(next: T): void; clear(): void } {
  let value: T = parse(core.read(key)) ?? fallback()
  return {
    get: () => value,
    set: (next) => {
      value = next // mirror first: a failed write must not lose the session's fact
      core.write(key, next)
    },
    clear: () => {
      value = fallback()
      core.remove(key)
    },
  }
}

/**
 * Build the app storage. Safe to call anywhere: without a usable localStorage
 * it returns the fully functional in-memory implementation with
 * `degraded === true`.
 */
export function createAppStorage(options: AppStorageOptions = {}): AppStorage {
  const core = createStorageCore(options.getStorage ?? defaultGetStorage)
  const seenSlot = createSlot(core, KEYS.seen, parseIdList, () => [] as string[])
  const savesSlot = createSlot(core, KEYS.saves, parseIdList, () => [] as string[])
  const flagsSlot = createSlot(core, KEYS.flags, parseFlags, () => ({}) as Record<string, boolean>)
  const stringsSlot = createSlot(core, KEYS.strings, parseStrings, () => ({}) as Record<string, string>)

  return {
    seen: {
      load: () => new Set(seenSlot.get()),
      save: (ids) => {
        seenSlot.set(toIdList(ids))
      },
      clear: () => {
        seenSlot.clear()
      },
    },
    saves: {
      load: () => savesSlot.get().slice(),
      save: (ids) => {
        savesSlot.set(toIdList(ids))
      },
    },
    flags: {
      get: (key) => flagsSlot.get()[key] === true,
      set: (key, value) => {
        flagsSlot.set({ ...flagsSlot.get(), [key]: value })
      },
    },
    strings: {
      get: (key) => stringsSlot.get()[key] ?? null,
      set: (key, value) => {
        stringsSlot.set({ ...stringsSlot.get(), [key]: value })
      },
    },
    get mode(): StorageMode {
      return core.mode
    },
    get degraded(): boolean {
      return core.degraded
    },
    onDegraded: (handler) => {
      core.onDegraded(handler)
    },
  }
}
