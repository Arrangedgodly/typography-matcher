// @vitest-environment jsdom
/**
 * T11 — the prescription view (strict reveal) wired into the REAL app
 * (src/main.ts booted under jsdom). Font seams are the established ones
 * (T04/T08–T10 suites): a `document.fonts` stub resolving non-empty + a
 * MutationObserver settling each injected css2 link.
 *
 * Pins, per plan T11 + acceptance criteria 3 and 11:
 *
 *   1. STRICT REVEAL   family names are absent from the whole body DOM in
 *                      review states — before any open, with saves sitting
 *                      in the ledger, and after the view closes (close()
 *                      strips the entries: the guarantee is a DOM property,
 *                      not a promise).
 *   2. REVEAL CONTENT  names + roles + categories (+ tags, leader-line
 *                      annotations) render per saved pairing, in judgment
 *                      order, only while the pad is open; the room stands
 *                      down inert and judgment keys are not claimed.
 *   3. REMOVE          entry removal → whole-list persistence (T10 write),
 *                      live ledger counts, renumbered entries, focus kept
 *                      in context.
 *   4. RELOAD          saves persist; the resumed ledger still reveals zero
 *                      names until the view is opened.
 *   5. EMPTY STATE     the route works at 0 saved; scrim closes.
 *   6. KEYBOARD        focus starts on the pad title; Escape closes and
 *                      returns focus to the route control; Tab wraps inside
 *                      the pad while the room is inert.
 *
 * Harness note (same as the T10 suite): input goes through BUTTON clicks
 * only — each boot attaches one window-level keydown listener, and re-boots
 * in one file session would stack them. The single window-key assertion
 * (gated arrows while prescribing) therefore lives in the FIRST test, which
 * runs after exactly one boot. The view's own Escape/Tab handling listens
 * on its root element, so element-level dispatches stay safe in every test.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { samplePairings } from './data/pairings.sample'

// T14: the app boots the full 61-pairing dataset; this suite pins the
// deterministic 3-card sample deck (the sample's remaining purpose) so the
// strict-reveal grep set and save-order assertions stay exact.
vi.mock('./data/pairings', async () => {
  const { samplePairings } = await import('./data/pairings.sample')
  return { pairings: samplePairings }
})

const DECK_SIZE = 3
const SAVES_KEY = 'blind-test.saves.v1'

/** Every family name in the dataset — the strict-reveal grep set. */
const ALL_FAMILY_NAMES = samplePairings.flatMap((p) => [p.heading.slug, p.body.slug])

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
const all = <T extends Element>(selector: string): T[] =>
  Array.from(document.querySelectorAll<T>(selector))

const saveButton = (): HTMLButtonElement => required<HTMLButtonElement>('.judge-save')
const prescriptionButton = (): HTMLButtonElement =>
  required<HTMLButtonElement>('.lane-prescription')
const viewRoot = (): HTMLElement => required<HTMLElement>('.prescription-view')
const markerCount = (): string => document.querySelector('.marker-count')?.textContent ?? ''

const readKey = (key: string): unknown => {
  const raw = localStorage.getItem(key)
  return raw === null ? null : (JSON.parse(raw) as unknown)
}

/** The strict-reveal grep: no dataset family name anywhere in the body's
    DOM — text nodes AND attributes (innerHTML), the verifier's method. */
const namesInDom = (): string[] => {
  const html = document.body.innerHTML.toLowerCase()
  return ALL_FAMILY_NAMES.filter((name) => html.includes(name.toLowerCase()))
}

const openView = (): void => {
  prescriptionButton().click()
  expect(viewRoot().hidden).toBe(false)
}

async function waitFor(label: string, predicate: () => boolean, timeoutMs = 4000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(`waitFor timed out: ${label}`)
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
}

async function waitForSwap(examined: number): Promise<void> {
  await waitFor(`state ready at ${examined} / ${DECK_SIZE} examined`, () => {
    const root = appRoot()
    return root.dataset.state === 'ready' && markerCount() === `${examined} / ${DECK_SIZE} examined`
  })
}

/** Save `n` pairings through the judgment bar (the on-wall pairing each time). */
async function saveN(n: number): Promise<void> {
  for (let i = 0; i < n; i += 1) {
    saveButton().click()
    await waitForSwap(i + 2) // boot draw is 1; each save advances the count
  }
  expect(prescriptionButton().textContent).toBe(`Prescription · ${n} saved`)
}

/** The pairing records the ledger currently holds (test-side, from storage). */
const savedPairingRecords = () => {
  const ids = readKey(SAVES_KEY) as string[]
  return ids.map((id) => samplePairings.find((p) => p.id === id)).filter((p) => p !== undefined)
}

async function bootApp(): Promise<void> {
  document.querySelector('#app')?.remove()
  const app = document.createElement('div')
  app.id = 'app'
  document.body.appendChild(app)
  vi.resetModules()
  await import('./main')
  // T17: judgment is gated until the first-run explainer is dismissed —
  // dismiss it when present (re-boots over a persisted flag render none).
  document.querySelector<HTMLButtonElement>('.lane-explainer-dismiss')?.click()
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

describe('prescription view (T11 wiring)', () => {
  it('reveals names + roles + categories only while open; Escape closes, strips names, re-gates', async () => {
    await bootApp()
    await waitForSwap(1)
    expect(prescriptionButton().textContent).toBe('Prescription · 0 saved')
    expect(namesInDom()).toEqual([]) // review DOM clean before any reveal

    await saveN(2)
    expect(namesInDom()).toEqual([]) // two saves in the ledger — still clean

    // --- OPEN: the route control, the room stands down --------------------
    openView()
    for (const selector of ['.lane-strip', '.acuity-lane', '.judgment-bar']) {
      expect(required(selector).hasAttribute('inert')).toBe(true)
    }
    expect(appRoot().dataset.prescribing).toBe('true')

    // Judgment keys are NOT claimed while the pad is open (single-boot
    // context — the only window-key assertion in this file, see header).
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true }))
    expect(appRoot().dataset.exhausted).toBeUndefined() // gated: judged nothing
    expect(appRoot().dataset.state).toBe('ready')

    // --- REVEAL CONTENT: names, roles, categories, leader lines -----------
    const saved = savedPairingRecords()
    expect(saved).toHaveLength(2)
    const entriesText = required('.rx-entries').textContent ?? ''
    const removeNames: string[] = []
    for (const pairing of saved) {
      for (const family of [pairing.heading, pairing.body]) {
        expect(entriesText).toContain(family.slug)
        expect(entriesText).toContain(`${family.category} · ${family.tags.join(', ')}`)
        removeNames.push(family.slug)
      }
    }
    expect(all('.rx-entry')).toHaveLength(2)
    expect(all('.rx-role-label').map((el) => el.textContent)).toEqual([
      'heading',
      'body',
      'heading',
      'body',
    ])
    const leaders = all('.rx-leader')
    expect(leaders).toHaveLength(4)
    for (const leader of leaders) expect(leader.getAttribute('aria-hidden')).toBe('true')
    expect(required('.rx-count').textContent).toBe('2 saved')
    // The reveal is real: names ARE in the DOM while open (and only the saved
    // four — the unsaved pairing's names stay absent).
    const unsaved = samplePairings.find((p) => !saved.some((s) => s.id === p.id))
    if (unsaved) {
      expect(entriesText).not.toContain(unsaved.heading.slug)
      expect(entriesText).not.toContain(unsaved.body.slug)
    }

    // --- CLOSE via Escape: names stripped, focus returned, room re-gated ---
    expect(document.activeElement?.id).toBe('prescription-title')
    document.activeElement?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    )
    expect(viewRoot().hidden).toBe(true)
    expect(namesInDom()).toEqual([]) // the D6 pin: closed view = clean DOM
    expect(document.activeElement).toBe(prescriptionButton())
    expect(required('.lane-strip').hasAttribute('inert')).toBe(false)
    expect(appRoot().dataset.prescribing).toBe('false')
    // Judgment is live again — the 3/3-seen deck would exhaust on a verdict;
    // assert the gate re-opened by state alone (markers already 3/3).
    expect(appRoot().dataset.state).toBe('ready')
  })

  it('remove strikes the entry, persists the whole remaining list, renumbers, keeps focus in context', async () => {
    await bootApp()
    await waitForSwap(1)
    await saveN(2)

    openView()
    const beforeIds = readKey(SAVES_KEY) as string[]
    const beforeRecords = savedPairingRecords()
    expect(beforeIds).toHaveLength(2)

    all<HTMLButtonElement>('.rx-remove')[0].click()

    // View state: one entry left, renumbered from Rx 01.
    expect(all('.rx-entry')).toHaveLength(1)
    expect(required('.rx-entry-rx').textContent).toBe('Rx 01')
    expect(required('.rx-count').textContent).toBe('1 saved')
    expect(viewRoot().hidden).toBe(false)

    // Persistence: whole-list write without the removed id.
    const afterIds = readKey(SAVES_KEY) as string[]
    expect(afterIds).toHaveLength(1)
    expect(beforeIds).toContain(afterIds[0])

    // The strip ledger followed live (behind the scrim).
    expect(prescriptionButton().textContent).toBe('Prescription · 1 saved')

    // Focus kept in context: the surviving entry's remove act.
    expect(document.activeElement?.classList.contains('rx-remove')).toBe(true)

    // Reopen shows only the survivor's names.
    required<HTMLButtonElement>('.rx-back').click()
    expect(viewRoot().hidden).toBe(true)
    openView()
    const survivor = beforeRecords.find((p) => p.id === afterIds[0])
    expect(survivor).toBeDefined()
    const entriesText = required('.rx-entries').textContent ?? ''
    expect(entriesText).toContain(survivor!.heading.slug)
    expect(entriesText).toContain(survivor!.body.slug)
    const removed = beforeRecords.find((p) => p.id !== afterIds[0])
    expect(removed).toBeDefined()
    expect(entriesText).not.toContain(removed!.heading.slug)
    expect(entriesText).not.toContain(removed!.body.slug)
  })

  it('removing the last entry swaps to the empty state in place', async () => {
    await bootApp()
    await waitForSwap(1)
    await saveN(1)

    openView()
    all<HTMLButtonElement>('.rx-remove')[0].click()

    expect(all('.rx-entry')).toHaveLength(0)
    expect(required<HTMLElement>('.rx-empty').hidden).toBe(false)
    expect(required('.rx-count').textContent).toBe('0 saved')
    expect(readKey(SAVES_KEY)).toEqual([])
    expect(prescriptionButton().textContent).toBe('Prescription · 0 saved')
    expect(viewRoot().hidden).toBe(false) // still open — the state changed in place
    // Focus moved to the title: the pad just emptied.
    expect(document.activeElement?.id).toBe('prescription-title')
  })

  it('saves persist across reload; the resumed ledger reveals nothing until opened', async () => {
    await bootApp()
    await waitForSwap(1)
    await saveN(1)

    // --- RELOAD: fresh modules + fresh DOM over the same localStorage -----
    await bootApp()
    // The reload RESTORES the on-wall pairing without consuming a draw —
    // a refresh must never be an implicit skip — so the count stands at 2.
    await waitForSwap(2)

    expect(prescriptionButton().textContent).toBe('Prescription · 1 saved')
    expect(namesInDom()).toEqual([]) // resumed ledger, still name-free

    openView()
    const [resumed] = savedPairingRecords()
    expect(resumed).toBeDefined()
    const entriesText = required('.rx-entries').textContent ?? ''
    expect(entriesText).toContain(resumed!.heading.slug)
    expect(entriesText).toContain(resumed!.body.slug)
    expect(required('.rx-count').textContent).toBe('1 saved')
  })

  it('empty state: the route works at zero saves; the scrim closes and returns focus', async () => {
    await bootApp()
    await waitForSwap(1)
    expect(prescriptionButton().textContent).toBe('Prescription · 0 saved')

    openView()
    expect(required<HTMLElement>('.rx-empty').hidden).toBe(false)
    expect(all('.rx-entry')).toHaveLength(0)
    expect(required('.rx-count').textContent).toBe('0 saved')
    expect(required('.rx-empty-title').textContent).toBe('Nothing prescribed yet.')
    expect(namesInDom()).toEqual([]) // an open EMPTY pad still names nothing

    required('.prescription-scrim').dispatchEvent(new MouseEvent('click'))
    expect(viewRoot().hidden).toBe(true)
    expect(document.activeElement).toBe(prescriptionButton())
  })

  it('Tab wraps inside the pad while the room is inert', async () => {
    await bootApp()
    await waitForSwap(1)
    await saveN(2)
    openView()

    // Focusables in DOM order: back act, then each entry's remove act.
    const removes = all<HTMLButtonElement>('.rx-remove')
    expect(removes).toHaveLength(2)

    // Tab on the LAST focusable wraps to the first (the back act).
    removes[removes.length - 1].focus()
    removes[removes.length - 1].dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }),
    )
    expect(document.activeElement).toBe(required('.rx-back'))

    // Shift+Tab on the FIRST focusable wraps to the last.
    required<HTMLButtonElement>('.rx-back').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }),
    )
    expect(document.activeElement).toBe(removes[removes.length - 1])
  })
})
