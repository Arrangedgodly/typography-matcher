// @vitest-environment jsdom
/**
 * T09 — the lens-swap moment, wired against the REAL app (src/main.ts booted
 * under jsdom: real chrome, real deck, real judgment funnel — only the font
 * network is stubbed, using the established seams: a `document.fonts` stub
 * whose `load()` calls resolve on demand (or hang forever, for the timeout
 * path) and a MutationObserver that settles each injected css2 link, since
 * jsdom never fetches stylesheets).
 *
 * Pins, per plan T09 acceptance + the R2 sequencing note:
 *
 *   1. SEQUENCE      judgment → occluder covers (loading state, in place) →
 *                    gate → variables swap under cover → reveal (ready). The
 *                    page is BORN covered — the pre-gate fallback stacks are
 *                    never a judgeable window.
 *   2. NO FOUT       the CSS font variables hold the PREVIOUS pairing until
 *                    the next gate passes (criterion 1: no blank/fallback
 *                    window mid-swap — the occluder covers the interim).
 *   3. TIMEOUT       the 4000 ms font-gate budget degrades to a recoverable
 *                    STATES-IN-PLACE error state (notice + retry act, bar
 *                    disabled in place, previous pairing's variables and
 *                    stylesheet untouched) — exercised at boot AND mid-cycle.
 *   4. RETRY         the retry act recovers the session through the same
 *                    advance path; exhaustion (D7) and reshuffle interleave
 *                    cleanly with the error state.
 *
 * One continuing session, one draw per judgment (the 3-pairing sample deck
 * therefore orders these `it` blocks; the reshuffle midway refills it).
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

// T14: the app boots the full 61-pairing dataset; this suite pins the
// deterministic 3-card sample deck (the sample's remaining purpose) so the
// one-continuing-session assertions keep their known cycle.
vi.mock('./data/pairings', async () => {
  const { samplePairings } = await import('./data/pairings.sample')
  return { pairings: samplePairings }
})

const DECK_SIZE = 3

const appRoot = (): HTMLElement => {
  const root = document.querySelector<HTMLElement>('.examination-room')
  if (!root) throw new Error('examination room not mounted')
  return root
}
const markerCount = (): string => document.querySelector('.marker-count')?.textContent ?? ''
const prescription = (): string =>
  document.querySelector('.lane-prescription')?.textContent ?? ''
const lane = (): HTMLElement => {
  const el = document.querySelector<HTMLElement>('.acuity-lane')
  if (!el) throw new Error('acuity lane not mounted')
  return el
}
const blind = (): HTMLElement | null => document.querySelector<HTMLElement>('.lens-blind')
const paper = (): HTMLElement => {
  const el = document.querySelector<HTMLElement>('.dummy-frame')
  if (!el) throw new Error('dummy frame not mounted')
  return el
}
const required = <T extends Element>(selector: string): T => {
  const el = document.querySelector<T>(selector)
  if (!el) throw new Error(`required element missing: ${selector}`)
  return el
}
const saveButton = (): HTMLButtonElement => required<HTMLButtonElement>('.judge-save')
const skipButton = (): HTMLButtonElement => required<HTMLButtonElement>('.judge-skip')
const retryButton = (): HTMLButtonElement => required<HTMLButtonElement>('.lane-swap-error-retry')
const errorNotice = (): HTMLElement => required<HTMLElement>('#lane-swap-error')
const saveLabel = (): string => document.querySelector('.judge-save .judge-label')?.textContent ?? ''
const headingVar = (): string => document.documentElement.style.getPropertyValue('--font-heading')
const dynamicCss2Links = (): HTMLLinkElement[] =>
  [...document.head.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')].filter(
    (link) => link.href.includes('fonts.googleapis.com/css2') && link.href.includes('display=block'),
  )

async function waitFor(label: string, predicate: () => boolean, timeoutMs = 4000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(`waitFor timed out: ${label}`)
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
}

// --- Font seams -------------------------------------------------------------

type FaceResolve = (faces: unknown[]) => void
let pendingFaces: FaceResolve[] = []
let hangLoads = false

function releaseFaces(): void {
  const resolvers = pendingFaces
  pendingFaces = []
  for (const resolve of resolvers) resolve([{} as FontFace])
}

/**
 * Wait until the in-flight gate has actually engaged its `fonts.load()`
 * calls, then release them. The engagement travels a microtask chain (link
 * append → observer → link load event → gateFaces) that a synchronous
 * waitFor can outrun — releasing before engagement is a no-op that hangs the
 * gate, so every release first waits for the pending faces to register.
 */
async function releaseGate(): Promise<void> {
  await waitFor('fonts gate engaged', () => pendingFaces.length > 0)
  releaseFaces()
}

let linkSettler: MutationObserver | null = null

beforeAll(async () => {
  Object.defineProperty(document, 'fonts', {
    value: {
      load: () =>
        new Promise((resolve) => {
          if (hangLoads) return // never settles → the 4000 ms gate timeout fires
          pendingFaces.push(resolve as FaceResolve)
        }),
    },
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

  const app = document.createElement('div')
  app.id = 'app'
  document.body.appendChild(app)

  // Boot with the font gate hanging: the page is born covered, then the
  // 4000 ms budget expires — the full degradation path from first paint.
  hangLoads = true
  await import('./main')

  // T17: judgment is gated until the first-run explainer is dismissed —
  // dismiss it once at boot (mid-load is a supported moment: the bar simply
  // stays down until the room reaches ready) so the verdict flows below run.
  document.querySelector<HTMLButtonElement>('.lane-explainer-dismiss')?.click()
})

afterAll(() => {
  linkSettler?.disconnect()
  vi.unstubAllGlobals()
})

describe('the lens-swap moment (T09)', () => {
  it('is born covered, degrades a gate timeout to the recoverable error state, and recovers via retry', async () => {
    // BORN COVERED: the boot draw sits in the loading state under the
    // occluder — the fallback stacks render beneath it, never as a window.
    expect(appRoot().dataset.state).toBe('loading')
    expect(blind()?.hidden).toBe(false)
    expect(lane().classList.contains('is-swapping')).toBe(true)
    expect(saveButton().disabled).toBe(true)
    expect(skipButton().disabled).toBe(true)
    expect(saveLabel()).toBe('Setting lenses…')
    expect(headingVar()).toBe('') // variables untouched before the gate
    expect(errorNotice().hidden).toBe(true)

    // TIMEOUT (4000 ms): recoverable error state, in place.
    await waitFor('swap error after gate timeout', () => appRoot().dataset.state === 'error', 6500)
    expect(errorNotice().hidden).toBe(false)
    expect(saveButton().disabled).toBe(true)
    expect(skipButton().disabled).toBe(true)
    expect(document.activeElement).toBe(retryButton()) // the retry act is the move
    expect(markerCount()).toBe(`1 / ${DECK_SIZE} examined`) // the failed draw consumed a slot
    expect(dynamicCss2Links()).toHaveLength(0) // its pending link was removed
    expect(headingVar()).toBe('') // nothing was ever applied
    await waitFor('blind hidden after failed lift', () => blind()?.hidden === true)

    // Judging while the error stands is gated (single funnel, state gate).
    saveButton().click()
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    await new Promise((resolve) => setTimeout(resolve, 60))
    expect(appRoot().dataset.state).toBe('error')
    expect(markerCount()).toBe(`1 / ${DECK_SIZE} examined`)

    // RETRY: same advance path, covered again, then revealed on readiness.
    hangLoads = false
    retryButton().click()
    await waitFor('retry covered the paper', () => appRoot().dataset.state === 'loading')
    expect(errorNotice().hidden).toBe(true) // cleared the moment the retry moves
    expect(blind()?.hidden).toBe(false)
    expect(headingVar()).toBe('') // still covered, still nothing applied

    await releaseGate()
    await waitFor('state ready after retry', () => appRoot().dataset.state === 'ready')
    expect(markerCount()).toBe(`2 / ${DECK_SIZE} examined`) // failed draw + retry draw
    expect(headingVar()).not.toBe('')
    expect(dynamicCss2Links()).toHaveLength(1)

    // The reveal's decoration cleans itself up: blind hidden, lane unlocked,
    // detent class released.
    await waitFor('blind hidden after reveal', () => blind()?.hidden === true)
    await waitFor('lane unlocked after reveal', () => !lane().classList.contains('is-swapping'))
    await waitFor('detent released', () => !paper().classList.contains('is-detenting'))
  }, 12000) // includes a real 4000 ms gate budget

  it('holds the previous pairing until the next gate passes — no fallback window mid-swap', async () => {
    const previous = headingVar()

    saveButton().click()
    await waitFor('second swap loading', () => appRoot().dataset.state === 'loading')
    // THE no-FOUT assertion: while the next fonts load, the variables still
    // serve the PREVIOUS pairing — the occluder covers the interim, the
    // variables swap only on readiness.
    expect(headingVar()).toBe(previous)
    expect(blind()?.hidden).toBe(false)
    expect(dynamicCss2Links().length).toBeGreaterThanOrEqual(1) // previous stays mounted

    await releaseGate()
    await waitFor('state ready at 3 / 3', () => appRoot().dataset.state === 'ready')
    expect(markerCount()).toBe(`${DECK_SIZE} / ${DECK_SIZE} examined`)
    expect(headingVar()).not.toBe(previous) // swapped exactly once, under cover
    expect(dynamicCss2Links()).toHaveLength(1) // old released, new alone
    expect(prescription()).toBe('Prescription · 1 saved')
  })

  it('exhausts cleanly when the next judgment finds the deck empty (D7)', async () => {
    skipButton().click()
    await waitFor('deck exhausted', () => appRoot().dataset.exhausted === 'true')
    expect(appRoot().dataset.state).toBe('ready')
    expect(required<HTMLElement>('#lane-exhausted').hidden).toBe(false)
    expect(saveButton().disabled).toBe(true)
    expect(document.activeElement).toBe(required<HTMLButtonElement>('.lane-exhausted-reshuffle'))
    expect(prescription()).toBe('Prescription · 1 saved') // the skip never records
  })

  it('reshuffles into a fresh cycle (refills the deck for the second timeout pass)', async () => {
    const previous = headingVar()
    required<HTMLButtonElement>('.lane-exhausted-reshuffle').click()

    await waitFor('reshuffle swap loading', () => appRoot().dataset.state === 'loading')
    expect(appRoot().dataset.exhausted).toBe('false')
    expect(errorNotice().hidden).toBe(true)
    expect(headingVar()).toBe(previous) // still the old pairing until the gate

    await releaseGate()
    await waitFor('reshuffle swap ready', () => appRoot().dataset.state === 'ready')
    expect(markerCount()).toBe(`1 / ${DECK_SIZE} examined`)
    // A fresh cycle may legally redraw the on-wall pairing (seen was cleared),
    // so the variable VALUE need not differ — only the draw/gate/reveal cycle
    // had to run. The next tests' no-repeat guarantees hold within one cycle.
    expect(headingVar()).not.toBe('')
  })

  it('degrades a second timeout the same way — previous pairing fully intact', async () => {
    const before = headingVar()

    hangLoads = true
    skipButton().click()
    await waitFor('second swap error', () => appRoot().dataset.state === 'error', 6500)

    expect(markerCount()).toBe(`2 / ${DECK_SIZE} examined`) // the failed draw consumed a slot
    expect(headingVar()).toBe(before) // the on-wall pairing never changed
    expect(dynamicCss2Links()).toHaveLength(1) // its stylesheet still serves it
    expect(errorNotice().hidden).toBe(false)
    expect(document.activeElement).toBe(retryButton())
    await waitFor('blind hidden after failed lift', () => blind()?.hidden === true)
  }, 12000) // includes a real 4000 ms gate budget

  it('recovers from that error too — retry draws through the same advance path', async () => {
    const before = headingVar()

    hangLoads = false
    retryButton().click()
    await waitFor('retry covered the paper', () => appRoot().dataset.state === 'loading')
    expect(headingVar()).toBe(before) // still covered, still the old pairing

    await releaseGate()
    await waitFor('state ready after second retry', () => appRoot().dataset.state === 'ready')
    expect(markerCount()).toBe(`${DECK_SIZE} / ${DECK_SIZE} examined`)
    expect(headingVar()).not.toBe(before)
    expect(errorNotice().hidden).toBe(true)
    expect(prescription()).toBe('Prescription · 1 saved')
  })
})
