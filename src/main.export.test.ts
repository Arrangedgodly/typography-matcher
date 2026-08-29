// @vitest-environment jsdom
/**
 * T12 — export wiring in the REAL app (src/main.ts booted under jsdom),
 * same seams as the T08–T11 suites: `document.fonts` stub resolving
 * non-empty + a MutationObserver settling each injected css2 link.
 *
 * Pins:
 *   1. COPY ACT     every saved entry carries one "Copy CSS" act; a click
 *                   during the open pad routes the record through
 *                   `buildExportSnippet` into `clipboard.writeText`.
 *   2. FEEDBACK     success swaps the label in place ("Copied") and reveals
 *                   nothing else; STATES IN PLACE.
 *   3. FALLBACK     a refused/unavailable clipboard reveals the entry's
 *                   read-only textarea with the snippet, PRESELECTED and
 *                   focused (selection spans the whole value).
 *   4. STRICT REVEAL the fallback's name-bearing value exists only inside
 *                   the open pad; close() strips the whole ledger.
 *   5. COEXISTENCE  the export act does not disturb remove/renumber or the
 *                   Tab wrap (the revealed textarea joins the wrap order).
 *
 * Harness note (same as the prescription suite): input goes through BUTTON
 * clicks only — window-level keydown listeners stack across re-boots.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildExportSnippet } from './lib/export'
import { samplePairings } from './data/pairings.sample'

// T14: the app boots the full 61-pairing dataset; this suite pins the
// deterministic 3-card sample deck (the sample's remaining purpose) so the
// export round-trips resolve against known pairing records.
vi.mock('./data/pairings', async () => {
  const { samplePairings } = await import('./data/pairings.sample')
  return { pairings: samplePairings }
})

const SAVES_KEY = 'blind-test.saves.v1'
const DECK_SIZE = 3

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
const markerCount = (): string => document.querySelector('.marker-count')?.textContent ?? ''
const roomState = (): string | undefined => required<HTMLElement>('.examination-room').dataset.state

/** The pairing records the ledger currently holds (test-side, from storage). */
const savedPairingRecords = () => {
  const ids = JSON.parse(localStorage.getItem(SAVES_KEY) ?? '[]') as string[]
  return ids
    .map((id) => samplePairings.find((p) => p.id === id))
    .filter((p): p is (typeof samplePairings)[number] => p !== undefined)
}

async function waitFor(label: string, predicate: () => boolean, timeoutMs = 4000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(`waitFor timed out: ${label}`)
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
}

async function bootApp(): Promise<void> {
  document.querySelector('#app')?.remove()
  const app = document.createElement('div')
  app.id = 'app'
  document.body.appendChild(app)
  vi.resetModules()
  await import('./main')
  // T17: judgment is gated until the first-run explainer is dismissed —
  // dismiss it when present (this suite always boots over cleared storage,
  // so the explainer is always there to dismiss).
  document.querySelector<HTMLButtonElement>('.lane-explainer-dismiss')?.click()
}

async function waitForSwap(examined: number): Promise<void> {
  await waitFor(`state ready at ${examined} / ${DECK_SIZE} examined`, () => {
    return roomState() === 'ready' && markerCount() === `${examined} / ${DECK_SIZE} examined`
  })
}

async function saveN(n: number): Promise<void> {
  for (let i = 0; i < n; i += 1) {
    saveButton().click()
    await waitForSwap(i + 2) // boot draw is 1; each save advances the count
  }
  expect(prescriptionButton().textContent).toBe(`Prescription · ${n} saved`)
}

function openView(): void {
  prescriptionButton().click()
  expect(required<HTMLElement>('.prescription-view').hidden).toBe(false)
}

// Controllable clipboard: one definition, per-test behavior.
let writeTextImpl: ((text: string) => Promise<void>) | undefined
let writeTextCalls: string[] = []

let linkSettler: MutationObserver | null = null

beforeAll(() => {
  Object.defineProperty(document, 'fonts', {
    value: { load: () => Promise.resolve([{} as FontFace]) },
    configurable: true,
  })
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback): number =>
    setTimeout(() => cb(0), 0),
  )
  Object.defineProperty(Navigator.prototype, 'clipboard', {
    get: () =>
      writeTextImpl
        ? {
            writeText: (text: string) => {
              writeTextCalls.push(text)
              return writeTextImpl!(text)
            },
          }
        : undefined,
    configurable: true,
  })
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
  writeTextImpl = undefined
  writeTextCalls = []
})

afterAll(() => {
  linkSettler?.disconnect()
  delete (Navigator.prototype as unknown as Record<string, unknown>).clipboard
  vi.unstubAllGlobals()
})

describe('export wiring (T12)', () => {
  it('copies the exact snippet through the clipboard and swaps the label in place', async () => {
    writeTextImpl = () => Promise.resolve()
    await bootApp()
    await waitForSwap(1)
    await saveN(2)
    openView()

    const copies = all<HTMLButtonElement>('.rx-copy')
    expect(copies).toHaveLength(2) // one export act per saved pairing
    expect(copies[0].textContent).toBe('Copy CSS')

    const [first] = savedPairingRecords()
    copies[0].click()
    await waitFor('copied label', () => copies[0].textContent === 'Copied')

    expect(writeTextCalls).toHaveLength(1)
    expect(writeTextCalls[0]).toBe(buildExportSnippet(first))
    expect(copies[0].dataset.state).toBe('copied')
    // Nothing else revealed — STATES IN PLACE
    expect(required<HTMLElement>('.rx-export').hidden).toBe(true)
    expect(required<HTMLTextAreaElement>('.rx-export-text').value).toBe('')

    // The label restores itself after the beat.
    await waitFor('label restored', () => copies[0].textContent === 'Copy CSS', 4000)
    expect(copies[0].dataset.state).toBeUndefined()
    expect(writeTextCalls).toHaveLength(1) // restore is display-only, no re-copy
  })

  it('a refused clipboard reveals the preselected fallback — and close() strips it', async () => {
    writeTextImpl = () => Promise.reject(new DOMException('denied', 'NotAllowedError'))
    await bootApp()
    await waitForSwap(1)
    await saveN(1)
    openView()

    const [record] = savedPairingRecords()
    required<HTMLButtonElement>('.rx-copy').click()
    await waitFor('fallback revealed', () => !required<HTMLElement>('.rx-export').hidden)

    const area = required<HTMLTextAreaElement>('.rx-export-text')
    expect(area.readOnly).toBe(true)
    expect(area.value).toBe(buildExportSnippet(record))
    // PRESELECTED + focused: the manual copy is one keystroke.
    expect(document.activeElement).toBe(area)
    expect(area.selectionStart).toBe(0)
    expect(area.selectionEnd).toBe(area.value.length)

    // STRICT REVEAL: the name-bearing payload exists only while the pad is
    // open. Escape strips the whole ledger — the textarea with it.
    document.activeElement!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    )
    expect(required<HTMLElement>('.prescription-view').hidden).toBe(true)
    expect(document.querySelector('.rx-export-text')).toBeNull()
    expect(document.querySelector('.rx-copy')).toBeNull()
    expect(JSON.parse(localStorage.getItem(SAVES_KEY) ?? 'null')).toEqual([record.id])
  })

  it('the absent API (insecure context) takes the same fallback path', async () => {
    writeTextImpl = undefined // navigator.clipboard → undefined
    await bootApp()
    await waitForSwap(1)
    await saveN(1)
    openView()

    required<HTMLButtonElement>('.rx-copy').click()
    await waitFor('fallback revealed', () => !required<HTMLElement>('.rx-export').hidden)
    expect(required<HTMLTextAreaElement>('.rx-export-text').value).toContain('fonts.googleapis.com/css2')
    expect(writeTextCalls).toHaveLength(0)
  })

  it('export coexists with remove and the Tab wrap', async () => {
    writeTextImpl = () => Promise.resolve()
    await bootApp()
    await waitForSwap(1)
    await saveN(2)
    openView()

    // Reveal entry 1's fallback, then remove entry 2 — the ledger survives.
    writeTextImpl = () => Promise.reject(new DOMException('denied', 'NotAllowedError'))
    all<HTMLButtonElement>('.rx-copy')[0].click()
    await waitFor('fallback revealed', () => !required<HTMLElement>('.rx-export').hidden)

    const removes = all<HTMLButtonElement>('.rx-remove')
    removes[removes.length - 1].click()
    expect(all('.rx-entry')).toHaveLength(1)
    expect(required('.rx-entry-rx').textContent).toBe('Rx 01') // renumbered
    expect(required('.rx-count').textContent).toBe('1 saved')
    // The re-render rebuilds the ledger — transient export state (the
    // revealed fallback) resets with it; the copy act is fresh again.
    expect(required<HTMLElement>('.rx-export').hidden).toBe(true)
    expect(required<HTMLTextAreaElement>('.rx-export-text').value).toBe('')

    // Tab wraps over a revealed fallback (order: back, copy, remove, textarea).
    required<HTMLButtonElement>('.rx-copy').click()
    await waitFor('fallback revealed', () => !required<HTMLElement>('.rx-export').hidden)
    const area = required<HTMLTextAreaElement>('.rx-export-text')
    area.focus()
    area.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }),
    )
    expect(document.activeElement).toBe(required('.rx-back')) // last → first
    required<HTMLButtonElement>('.rx-back').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }),
    )
    expect(document.activeElement).toBe(area) // first → last
  })
})
