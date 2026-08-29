// @vitest-environment jsdom
/**
 * T17 — the explainer gate (adjudication of T16's verified finding: the
 * judgment bar was NOT inert while the first-run explainer stood, and a single
 * ArrowRight judged + saved beneath it).
 *
 * Adjudicated outcome: dismissal is a consent act — "Begin examination" opens
 * the instrument. Until then judgment is CLOSED on every input path, through
 * the single funnel the room already routes (src/components/examinationRoom.ts):
 *
 *   - the bar stands down disabled, restyled in place like every other
 *     stood-down state ([data-explainer='true'], STATES IN PLACE);
 *   - ←/→ judge nothing (the keydown listener still claims/preventDefaults
 *     the arrows — scroll suppression — but the funnel refuses them);
 *   - the swipe path is the same gate (gestures' canBegin = inputOpen, pinned
 *     in gestures.test.ts);
 *   - dismissal re-opens input and hands focus to the first judgment control,
 *     after which the keyboard path judges for real.
 *
 * Boots the REAL app once (the established seams: `document.fonts` stub
 * resolving non-empty + a MutationObserver settling each injected css2 link)
 * against a FRESH localStorage — the explainer is present, exactly as a
 * first-visit keyboard user meets it.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

// The 3-card sample deck keeps the cycle arithmetic exact.
vi.mock('./data/pairings', async () => {
  const { samplePairings } = await import('./data/pairings.sample')
  return { pairings: samplePairings }
})

const DECK_SIZE = 3
const SAVES_KEY = 'blind-test.saves.v1'

const appRoot = (): HTMLElement => {
  const root = document.querySelector<HTMLElement>('.examination-room')
  if (!root) throw new Error('examination room not mounted')
  return root
}
const required = <T extends Element>(selector: string): T => {
  const el = document.querySelector<T>(selector)
  if (!el) throw new Error(`required element missing: ${selector}`)
  return el
}
const saveButton = (): HTMLButtonElement => required<HTMLButtonElement>('.judge-save')
const skipButton = (): HTMLButtonElement => required<HTMLButtonElement>('.judge-skip')
const dismissButton = (): HTMLButtonElement =>
  required<HTMLButtonElement>('.lane-explainer-dismiss')
const markerCount = (): string => document.querySelector('.marker-count')?.textContent ?? ''
const prescription = (): string =>
  document.querySelector('.lane-prescription')?.textContent ?? ''

/** Real key path: a keydown that bubbles body → document → window. */
function pressKey(key: 'ArrowLeft' | 'ArrowRight'): void {
  document.body.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
}

async function waitFor(label: string, predicate: () => boolean, timeoutMs = 4000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(`waitFor timed out: ${label}`)
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
}

let linkSettler: MutationObserver | null = null

beforeAll(async () => {
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

  await import('./main') // fresh visit: explainer rendered, boot draw → 1 / 3
  await waitFor('boot ready under the explainer', () => appRoot().dataset.state === 'ready')
})

afterAll(() => {
  linkSettler?.disconnect()
  vi.unstubAllGlobals()
})

describe('the explainer gate (T17 adjudication of the T16 finding)', () => {
  it('closes judgment on every path while the first-run explainer stands', async () => {
    expect(required('.lane-explainer')).toBeTruthy() // the notice is up…
    expect(appRoot().dataset.explainer).toBe('true') // …and the room says so

    // The bar stands down: disabled buttons, the STATES IN PLACE restyle hook.
    expect(saveButton().disabled).toBe(true)
    expect(skipButton().disabled).toBe(true)

    // Keyboard path: arrows are claimed (scroll suppression) but judge
    // NOTHING — the exact falsified scenario was one ArrowRight saving.
    pressKey('ArrowRight')
    pressKey('ArrowLeft')
    await new Promise((resolve) => setTimeout(resolve, 80))

    expect(markerCount()).toBe(`1 / ${DECK_SIZE} examined`) // nothing advanced
    expect(prescription()).toBe('Prescription · 0 saved') // nothing saved
    expect(appRoot().dataset.state).toBe('ready') // still at rest, not broken
    expect(localStorage.getItem(SAVES_KEY)).toBeNull() // no record was written
  })

  it('dismissal ("Begin examination") opens the instrument for the keyboard', async () => {
    dismissButton().click()

    expect(document.querySelector('.lane-explainer')).toBeNull() // notice gone
    expect(appRoot().dataset.explainer).toBeUndefined() // restyle hook cleared
    expect(saveButton().disabled).toBe(false) // the bar re-arms…
    expect(skipButton().disabled).toBe(false)
    expect(document.activeElement).toBe(skipButton()) // …at the first control

    // The same key that was refused now judges — the gate, not the key,
    // was the difference.
    pressKey('ArrowRight')
    await waitFor('gated-open save completes', () => markerCount() === `2 / ${DECK_SIZE} examined`)
    expect(prescription()).toBe('Prescription · 1 saved')
    expect(JSON.parse(localStorage.getItem(SAVES_KEY) ?? '[]')).toHaveLength(1)
  })
})
