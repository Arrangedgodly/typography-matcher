// @vitest-environment jsdom
/**
 * T09 — `prefers-reduced-motion` (plan acceptance criterion 6, design-brief
 * §3: "under prefers-reduced-motion it is instant").
 *
 * A fresh boot of the REAL app (src/main.ts) with `matchMedia` stubbed to
 * report reduced motion BEFORE the import — only the font network is stubbed
 * (the main.swap.test.ts seams). Pins the instant path:
 *
 *   - the occluder NEVER mounts (no blind in the DOM from boot through any
 *     number of swaps — observed via MutationObserver, not just post-hoc);
 *   - no snap-step detent class ever lands on the paper;
 *   - the lane is never clip-locked for a swap;
 *   - the swap itself still completes: loading → ready, the pairing's CSS
 *     variables applied exactly once on readiness (the STATE remains —
 *     STATES IN PLACE is a restyle, not motion; only the choreography goes).
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

// T14: the app boots the full 61-pairing dataset; this suite pins the
// deterministic 3-card sample deck (the sample's remaining purpose).
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
const lane = (): HTMLElement => {
  const el = document.querySelector<HTMLElement>('.acuity-lane')
  if (!el) throw new Error('required element missing: lane')
  return el
}
const paper = (): HTMLElement => {
  const el = document.querySelector<HTMLElement>('.dummy-frame')
  if (!el) throw new Error('required element missing: paper')
  return el
}
const required = <T extends Element>(selector: string): T => {
  const el = document.querySelector<T>(selector)
  if (!el) throw new Error(`required element missing: ${selector}`)
  return el
}
const saveButton = (): HTMLButtonElement => required<HTMLButtonElement>('.judge-save')
const headingVar = (): string => document.documentElement.style.getPropertyValue('--font-heading')

async function waitFor(label: string, predicate: () => boolean, timeoutMs = 4000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(`waitFor timed out: ${label}`)
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
}

type FaceResolve = (faces: unknown[]) => void
let pendingFaces: FaceResolve[] = []

function releaseFaces(): void {
  const resolvers = pendingFaces
  pendingFaces = []
  for (const resolve of resolvers) resolve([{} as FontFace])
}

/**
 * Wait until the in-flight gate has engaged its `fonts.load()` calls, then
 * release them (the engagement travels a microtask chain a synchronous
 * waitFor can outrun — see main.swap.test.ts).
 */
async function releaseGate(): Promise<void> {
  await waitFor('fonts gate engaged', () => pendingFaces.length > 0)
  releaseFaces()
}

/** Observed across the whole session: any blind insertion, any detent class. */
let blindEverMounted = false
let detentEverPlayed = false
let domWatcher: MutationObserver | null = null

beforeAll(async () => {
  // Reduced motion, live for every probe the room makes.
  vi.stubGlobal(
    'matchMedia',
    (query: string) =>
      ({
        matches: query.includes('prefers-reduced-motion'),
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => true,
      }) as MediaQueryList,
  )

  Object.defineProperty(document, 'fonts', {
    value: {
      load: () =>
        new Promise((resolve) => {
          pendingFaces.push(resolve as FaceResolve)
        }),
    },
    configurable: true,
  })
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback): number =>
    setTimeout(() => cb(0), 0),
  )

  const linkSettler = new MutationObserver((records) => {
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

  domWatcher = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node instanceof HTMLElement && node.classList.contains('lens-blind')) {
          blindEverMounted = true
        }
      }
      if (
        record.type === 'attributes' &&
        record.target instanceof HTMLElement &&
        record.attributeName === 'class' &&
        record.target.classList.contains('is-detenting')
      ) {
        detentEverPlayed = true
      }
    }
  })
  domWatcher.observe(document.body, { childList: true, subtree: true, attributes: true })

  const app = document.createElement('div')
  app.id = 'app'
  document.body.appendChild(app)

  await import('./main') // boots under reduce: instant path from the first draw

  // T17: judgment is gated until the first-run explainer is dismissed —
  // dismiss it once at boot so the swap below can be driven by the bar.
  document.querySelector<HTMLButtonElement>('.lane-explainer-dismiss')?.click()
})

afterAll(() => {
  domWatcher?.disconnect()
  vi.unstubAllGlobals()
})

describe('reduced motion — instant swap, no occluder, no overshoot (T09)', () => {
  it('keeps the boot covered only as a STATE — no blind, no lock — and swaps instantly on readiness', async () => {
    expect(appRoot().dataset.state).toBe('loading') // the state remains…
    expect(document.querySelector('.lens-blind')).toBeNull() // …the occluder does not
    expect(lane().classList.contains('is-swapping')).toBe(false) // never clip-locked
    expect(headingVar()).toBe('')

    await releaseGate()
    await waitFor('instant swap ready', () => appRoot().dataset.state === 'ready')
    expect(markerCount()).toBe(`1 / ${DECK_SIZE} examined`)
    expect(headingVar()).not.toBe('')
  })

  it('never mounts the occluder or plays the detent across subsequent swaps', async () => {
    const previous = headingVar()
    saveButton().click()
    await waitFor('second swap loading', () => appRoot().dataset.state === 'loading')
    expect(headingVar()).toBe(previous) // variables still gate on readiness

    await releaseGate()
    await waitFor('second swap ready', () => appRoot().dataset.state === 'ready')
    expect(headingVar()).not.toBe(previous)

    // Session-long observation, not just post-hoc: no blind ever entered the
    // DOM, no detent class ever landed on the paper.
    expect(blindEverMounted).toBe(false)
    expect(detentEverPlayed).toBe(false)
    expect(paper().classList.contains('is-detenting')).toBe(false)
    expect(document.querySelector('.lens-blind')).toBeNull()
  })
})
