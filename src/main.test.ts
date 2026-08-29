// @vitest-environment jsdom
/**
 * T08 re-dispatch regression — the verdict/exhaustion boundary in main.ts.
 *
 * The failed-verification defect (production-log.md, T08 verification): the
 * judgment issued on a cycle's LAST pairing was silently dropped when its
 * draw triggered the D7 exhaustion state — `advance()` returned on the
 * exhausted branch BEFORE `recordSave()` ran, so a Save on the final
 * on-wall pairing never reached the prescription.
 *
 * This suite pins the corrected boundary by booting the REAL `src/main.ts`
 * (real chrome, real deck, real judgment funnel — only the font network is
 * stubbed, using the T04 suite's seams: a `document.fonts` stub whose `load`
 * resolves non-empty, and a MutationObserver that settles each injected
 * css2 link with a `load` event, since jsdom never fetches stylesheets):
 *
 *   - save on the LAST pairing (keyboard ArrowRight — the exact falsified
 *     scenario) must record: exhaustion AND "Prescription · 3 saved";
 *   - skip on the LAST pairing (button) must exhaust cleanly with the save
 *     count untouched;
 *   - gated input while exhausted judges nothing;
 *   - reshuffle restarts the cycle with the save ledger intact (dedupe).
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

// T14: the app boots the full 61-pairing dataset; this suite pins the
// deterministic 3-card sample deck (the sample's remaining purpose) so the
// cycle-boundary assertions keep their known exhaustion point.
vi.mock('./data/pairings', async () => {
  const { samplePairings } = await import('./data/pairings.sample')
  return { pairings: samplePairings }
})

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

const DECK_SIZE = 3

const appRoot = (): HTMLElement => {
  const root = document.querySelector<HTMLElement>('.examination-room')
  if (!root) throw new Error('examination room not mounted')
  return root
}
const markerCount = (): string => document.querySelector('.marker-count')?.textContent ?? ''
const prescription = (): string => document.querySelector('.lane-prescription')?.textContent ?? ''
const exhaustedNotice = (): HTMLElement | null => document.querySelector<HTMLElement>('#lane-exhausted')
const required = <T extends Element>(selector: string): T => {
  const el = document.querySelector<T>(selector)
  if (!el) throw new Error(`required element missing: ${selector}`)
  return el
}
const saveButton = (): HTMLButtonElement => required<HTMLButtonElement>('.judge-save')
const skipButton = (): HTMLButtonElement => required<HTMLButtonElement>('.judge-skip')
const reshuffleButton = (): HTMLButtonElement =>
  required<HTMLButtonElement>('.lane-exhausted-reshuffle')

async function waitFor(label: string, predicate: () => boolean, timeoutMs = 4000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(`waitFor timed out: ${label}`)
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
}

/** Real key path: a keydown that bubbles body → document → window. */
function pressKey(key: 'ArrowLeft' | 'ArrowRight'): void {
  document.body.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
}

/** Wait out one swap (gate → variables → frame → release) back to ready. */
async function waitForSwap(examined: number): Promise<void> {
  await waitFor(`state ready at ${examined} / ${DECK_SIZE} examined`, () => {
    const root = appRoot()
    return root.dataset.state === 'ready' && markerCount() === `${examined} / ${DECK_SIZE} examined`
  })
}

/** Wait for the D7 state: exhaustion is reached without a loading flip. */
async function waitForExhausted(): Promise<void> {
  await waitFor('deck exhausted', () => appRoot().dataset.exhausted === 'true')
}

let linkSettler: MutationObserver | null = null

beforeAll(async () => {
  // Font seams (T04 patterns): every face resolves, every injected css2 link
  // settles on arrival. The 3-sample deck then cycles at full speed.
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

  const app = document.createElement('div')
  app.id = 'app'
  document.body.appendChild(app)

  await import('./main') // boots: initial draw → gate → markers 1 / 3
  await waitForSwap(1)

  // T17: judgment is gated until the first-run explainer is dismissed —
  // dismiss it once here so this suite's verdict flows run as before.
  required<HTMLButtonElement>('.lane-explainer-dismiss').click()
})

afterAll(() => {
  linkSettler?.disconnect()
  vi.unstubAllGlobals()
})

// ---------------------------------------------------------------------------
// The boundary (one continuing session, exactly like a user's).
// ---------------------------------------------------------------------------

describe('verdict on the cycle-final pairing (T08 re-dispatch boundary)', () => {
  it('records a save issued on the LAST pairing — keyboard path (the falsified scenario)', async () => {
    expect(prescription()).toBe('Prescription · 0 saved')

    saveButton().click() // save #1 — button path
    await waitForSwap(2)
    expect(prescription()).toBe('Prescription · 1 saved')

    pressKey('ArrowRight') // save #2 — keyboard path
    await waitForSwap(3)
    expect(prescription()).toBe('Prescription · 2 saved')

    // Save #3: the on-wall pairing is the cycle's LAST — the verdict that
    // trips exhaustion must still count. THE regression assertion: the
    // pre-fix code left the prescription stuck at "2 saved" here.
    pressKey('ArrowRight')
    await waitForExhausted()

    expect(prescription()).toBe('Prescription · 3 saved')
    expect(markerCount()).toBe(`3 / ${DECK_SIZE} examined`)
    expect(exhaustedNotice()?.hidden).toBe(false)
    expect(saveButton().disabled).toBe(true)
    expect(skipButton().disabled).toBe(true)
  })

  it('judges nothing while exhausted — gated keyboard input is inert', async () => {
    pressKey('ArrowRight')
    pressKey('ArrowLeft')
    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(appRoot().dataset.exhausted).toBe('true')
    expect(prescription()).toBe('Prescription · 3 saved')
    expect(markerCount()).toBe(`3 / ${DECK_SIZE} examined`)
  })

  it('reshuffles into a fresh cycle with the save ledger intact', async () => {
    reshuffleButton().click()
    await waitForSwap(1)

    expect(appRoot().dataset.exhausted).toBe('false')
    expect(exhaustedNotice()?.hidden).toBe(true)
    expect(saveButton().disabled).toBe(false)
    expect(prescription()).toBe('Prescription · 3 saved') // deduped across cycles
  })

  it('skip on the LAST pairing exhausts cleanly with no side effects — button path', async () => {
    pressKey('ArrowLeft') // skip #1 — keyboard path
    await waitForSwap(2)

    skipButton().click() // skip #2 — button path
    await waitForSwap(3)

    skipButton().click() // skip #3 — the cycle-final pairing, button path
    await waitForExhausted()

    expect(markerCount()).toBe(`3 / ${DECK_SIZE} examined`)
    expect(prescription()).toBe('Prescription · 3 saved') // skip never records
    expect(exhaustedNotice()?.hidden).toBe(false)
    expect(appRoot().dataset.state).toBe('ready')
  })
})
