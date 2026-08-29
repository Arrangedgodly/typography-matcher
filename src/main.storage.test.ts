// @vitest-environment jsdom
/**
 * T10 — the storage layer wired into the REAL app (src/main.ts booted under
 * jsdom against jsdom's REAL localStorage — the persistence assertions read
 * the actual keys a reload will find). Font seams are the established ones
 * (T04/T08/T09 suites): a `document.fonts` stub resolving non-empty + a
 * MutationObserver settling each injected css2 link.
 *
 * Pins, per plan T10 + acceptance criterion 7:
 *
 *   1. PERSIST    save → localStorage keys written (saves, seen-set, flag);
 *                 reload (fresh module instance + fresh DOM over the same
 *                 localStorage) → prescription count, explainer dismissal,
 *                 and the seen-set all resume; the reloaded deck finishes
 *                 the cycle without repeating judged pairings.
 *   2. RESHUFFLE  clears the persisted seen-set — the fresh cycle restarts
 *                 its record from the first draw.
 *   3. BLOCKED    a throwing localStorage ACCESS at boot (private-mode
 *                 SecurityError) → storage-degraded notice visible, judgment
 *                 fully functional, nothing persisted.
 *   4. QUOTA      setItem failing MID-session (after a healthy boot + save)
 *                 → notice appears, the save still counts, no crash.
 *
 * Harness note: input goes through the judgment BUTTONS only. Each boot
 * attaches a window-level keydown listener; a re-booted file session would
 * stack them and double-drive stale instances. The T08 suite already pins
 * button/keyboard parity, so nothing is lost here.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { samplePairings } from './data/pairings.sample'

// T14: the app boots the full 61-pairing dataset; this suite pins the
// deterministic 3-card sample deck (the sample's remaining purpose) so the
// seen-set / saves persistence assertions keep their known id universe.
vi.mock('./data/pairings', async () => {
  const { samplePairings } = await import('./data/pairings.sample')
  return { pairings: samplePairings }
})

const DECK_SIZE = 3
const SEEN_KEY = 'blind-test.seen.v1'
const SAVES_KEY = 'blind-test.saves.v1'
const FLAGS_KEY = 'blind-test.flags.v1'

const SAMPLE_IDS = samplePairings.map((p) => p.id)

const appRoot = (): HTMLElement => {
  const root = document.querySelector<HTMLElement>('.examination-room')
  if (!root) throw new Error('examination room not mounted')
  return root
}
const markerCount = (): string => document.querySelector('.marker-count')?.textContent ?? ''
const prescription = (): string => document.querySelector('.lane-prescription')?.textContent ?? ''
const storageNotice = (): HTMLElement => {
  const el = document.querySelector<HTMLElement>('#lane-storage-notice')
  if (!el) throw new Error('storage notice not mounted')
  return el
}
const required = <T extends Element>(selector: string): T => {
  const el = document.querySelector<T>(selector)
  if (!el) throw new Error(`required element missing: ${selector}`)
  return el
}
const saveButton = (): HTMLButtonElement => required<HTMLButtonElement>('.judge-save')
const skipButton = (): HTMLButtonElement => required<HTMLButtonElement>('.judge-skip')
const reshuffleButton = (): HTMLButtonElement =>
  required<HTMLButtonElement>('.lane-exhausted-reshuffle')

const readKey = (key: string): unknown => {
  const raw = localStorage.getItem(key)
  return raw === null ? null : (JSON.parse(raw) as unknown)
}

async function waitFor(label: string, predicate: () => boolean, timeoutMs = 4000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(`waitFor timed out: ${label}`)
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
}

/** Wait out one swap (gate → variables → frame → release) back to ready. */
async function waitForSwap(examined: number): Promise<void> {
  await waitFor(`state ready at ${examined} / ${DECK_SIZE} examined`, () => {
    const root = appRoot()
    return root.dataset.state === 'ready' && markerCount() === `${examined} / ${DECK_SIZE} examined`
  })
}

async function waitForExhausted(): Promise<void> {
  await waitFor('deck exhausted', () => appRoot().dataset.exhausted === 'true')
}

/**
 * Boot the app the way a reload does: a fresh module registry (vi.resetModules
 * re-evaluates main.ts and its whole import graph) over a fresh #app mount,
 * against whatever localStorage currently holds.
 */
async function bootApp(): Promise<void> {
  document.querySelector('#app')?.remove()
  const app = document.createElement('div')
  app.id = 'app'
  document.body.appendChild(app)
  vi.resetModules()
  await import('./main')
}

let linkSettler: MutationObserver | null = null

beforeAll(() => {
  Object.defineProperty(document, 'fonts', {
    value: { load: () => Promise.resolve([{} as FontFace]) },
    configurable: true,
  })
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback): number =>
    setTimeout(() => cb(0), 0),
  )
  linkSettler = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (
          node instanceof HTMLLinkElement &&
          node.rel === 'stylesheet' &&
          node.href.includes('fonts.googleapis.com/css2')
        ) {
          queueMicrotask(() => node.dispatchEvent(new Event('load')))
        }
      }
    }
  })
  linkSettler.observe(document.head, { childList: true })
})

beforeEach(() => {
  localStorage.clear()
})

afterAll(() => {
  linkSettler?.disconnect()
  vi.unstubAllGlobals()
})

describe('persistence across reload (T10 wiring)', () => {
  it('save → reload → saves, seen-set, and the explainer dismissal all resume', async () => {
    await bootApp()
    await waitForSwap(1)
    expect(prescription()).toBe('Prescription · 0 saved')

    // Dismiss the explainer FIRST (T17: judgment is gated until it is) — the
    // dismissal persists too.
    required<HTMLButtonElement>('.lane-explainer-dismiss').click()
    expect(readKey(FLAGS_KEY)).toEqual({ 'explainer-dismissed': true })

    saveButton().click() // save #1 — the on-wall pairing
    await waitForSwap(2)
    expect(prescription()).toBe('Prescription · 1 saved')

    // The persisted payloads a reload will find: one saved id (a deck id),
    // two seen ids, the saved one among them.
    const saves = readKey(SAVES_KEY) as string[]
    expect(Array.isArray(saves)).toBe(true)
    expect(saves).toHaveLength(1)
    expect(SAMPLE_IDS).toContain(saves[0])
    const seen = readKey(SEEN_KEY) as string[]
    expect(seen).toHaveLength(2)
    expect(seen).toContain(saves[0])

    // --- RELOAD: fresh modules + fresh DOM over the same localStorage -----
    await bootApp()
    // The reload RESTORES the on-wall pairing — no fresh draw is consumed
    // (a refresh must never be an implicit skip): the count stands at 2.
    await waitForSwap(2)
    expect((readKey(SEEN_KEY) as string[])).toHaveLength(2) // nothing consumed

    expect(prescription()).toBe('Prescription · 1 saved') // the ledger resumed
    expect(document.querySelector('.lane-explainer')).toBeNull() // dismissal resumed
    expect(storageNotice().hidden).toBe(true) // storage is healthy

    // The reloaded cycle is genuinely continued, not restarted: one unseen
    // pairing remains, and the restored on-wall pairing can still be saved.
    saveButton().click() // the restore did not re-save it behind the user's back
    await waitForSwap(3)
    expect(prescription()).toBe('Prescription · 2 saved')
    skipButton().click() // the cycle-final pairing → exhaustion
    await waitForExhausted()
    expect(markerCount()).toBe(`3 / ${DECK_SIZE} examined`)

    const savesAfter = readKey(SAVES_KEY) as string[]
    expect(savesAfter).toHaveLength(2)
    expect(new Set(savesAfter).size).toBe(2)
  })

  it('reshuffle clears the persisted seen-set — the fresh cycle restarts its record', async () => {
    await bootApp()
    await waitForSwap(1)
    // T17: judgment is gated until the first-run explainer is dismissed.
    required<HTMLButtonElement>('.lane-explainer-dismiss').click()

    skipButton().click()
    await waitForSwap(2)
    skipButton().click()
    await waitForSwap(3)
    skipButton().click() // the cycle-final pairing → exhaustion
    await waitForExhausted()
    expect((readKey(SEEN_KEY) as string[])).toHaveLength(3)

    reshuffleButton().click()
    await waitForSwap(1)

    // The record now holds ONLY the fresh cycle's first draw — reshuffle
    // cleared the persisted set before the deck wrote again.
    expect((readKey(SEEN_KEY) as string[])).toHaveLength(1)
    expect(prescription()).toBe('Prescription · 0 saved') // no saves this session
  })
})

describe('storage unavailable (criterion 7)', () => {
  it('a blocked localStorage ACCESS at boot: notice up, session fully works, nothing persisted', async () => {
    const original = Object.getOwnPropertyDescriptor(window, 'localStorage')
    expect(original).toBeDefined()
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get: () => {
        throw new DOMException('Access is denied for this document', 'SecurityError')
      },
    })

    try {
      await bootApp()
      await waitForSwap(1)

      expect(storageNotice().hidden).toBe(false) // the non-blocking notice
      expect(appRoot().dataset.state).toBe('ready') // …and nothing is blocked
      // T17: with the explainer standing the bar is gated for EVERYONE —
      // dismiss it, then storage health is the only variable left.
      required<HTMLButtonElement>('.lane-explainer-dismiss').click()
      expect(saveButton().disabled).toBe(false)

      saveButton().click()
      await waitForSwap(2)
      expect(prescription()).toBe('Prescription · 1 saved') // the in-memory ledger counts
    } finally {
      Object.defineProperty(window, 'localStorage', original as PropertyDescriptor)
    }

    // With access restored: nothing was ever written — not even the probe.
    expect(localStorage.getItem(SAVES_KEY)).toBeNull()
    expect(localStorage.getItem(SEEN_KEY)).toBeNull()
    expect(localStorage.getItem(FLAGS_KEY)).toBeNull()
  })

  it('a mid-session quota failure: notice appears, the save still counts, no crash', async () => {
    await bootApp()
    await waitForSwap(1)
    expect(storageNotice().hidden).toBe(true)
    // T17: judgment is gated until the first-run explainer is dismissed.
    required<HTMLButtonElement>('.lane-explainer-dismiss').click()

    saveButton().click() // healthy write
    await waitForSwap(2)
    expect(prescription()).toBe('Prescription · 1 saved')
    expect((readKey(SAVES_KEY) as string[])).toHaveLength(1)

    // The quota fills up mid-session: setItem starts throwing. jsdom's
    // Storage instance swallows own-property patches (it is a Proxy), so the
    // failure is injected at the prototype — the one seam that reaches the
    // object the storage core actually holds.
    const originalSetItem = Storage.prototype.setItem
    Storage.prototype.setItem = function () {
      throw new DOMException('The quota has been exceeded', 'QuotaExceededError')
    }
    try {
      saveButton().click()
      await waitForSwap(3)
      expect(prescription()).toBe('Prescription · 2 saved') // the session ledger
      expect(storageNotice().hidden).toBe(false) // the surfaced notice
      expect(appRoot().dataset.state).toBe('ready') // the examination continues
    } finally {
      Storage.prototype.setItem = originalSetItem
    }

    // The backing holds the last healthy write only; degradation is sticky.
    expect((readKey(SAVES_KEY) as string[])).toHaveLength(1)
  })
})
