// @vitest-environment jsdom
/**
 * T04 unit tests — R2's committed test seams (docs/ultron/research/R2-font-loading.md,
 * "Unit-test seams"): fake timers + a stubbed `document.fonts` whose `load()`
 * returns controllable promises. Link settle is driven by dispatching
 * `load`/`error` events on the real injected element (jsdom never fetches
 * stylesheets, so nothing fires spontaneously); `requestAnimationFrame` is
 * shimmed onto the faked timer clock so the double-rAF gate advances
 * deterministically frame by frame.
 *
 * Covered (plan T04 accept line + R2 risks): resolve-on-load happy path,
 * empty-array guard, timeout (bare + mid-gate), link error, fonts.load
 * rejection, late-event inertness, cleanup ordering (old link lives until
 * the new gate passes; release is idempotent/null-safe), prefetch adoption
 * + failure containment, css2 URL snapshots (ital tuples, multi-weight,
 * sorting, dedup, display=block), spec-string generation, and D6
 * name-leakage checks on every rejection message.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_FONT_LOAD_TIMEOUT_MS,
  DEFAULT_FONT_SAMPLE_TEXT,
  FontLoadError,
  buildCss2Url,
  loadPairingFonts,
  prefetchPairingFonts,
  releasePairingFonts,
  type FontLoadHandle,
  type FontLoadFailureReason,
  type PairingFonts,
} from './fontLoader'

// ---------------------------------------------------------------------------
// Fixtures — real sample-pairing shapes from T02 (live-verified css2 URLs).
// ---------------------------------------------------------------------------

const frauncesNewsreader: PairingFonts = {
  heading: { slug: 'Fraunces', weights: [600, 700], italic: false },
  body: { slug: 'Newsreader', weights: [400, 500], italic: true },
}

const spaceGroteskCrimsonPro: PairingFonts = {
  heading: { slug: 'Space Grotesk', weights: [500, 700], italic: false },
  body: { slug: 'Crimson Pro', weights: [400, 600], italic: true },
}

const SAMPLE_FAMILY_NAMES = ['Fraunces', 'Newsreader', 'Space Grotesk', 'Crimson Pro']

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

/** rAF → faked setTimeout(16ms): the double-rAF gate becomes clock-driven. */
const rafShim = (cb: FrameRequestCallback): number => window.setTimeout(() => cb(0), 16)

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('requestAnimationFrame', rafShim)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.head.replaceChildren()
})

type LoadBehavior = (spec: string) => FontFace[] | Promise<FontFace[]>

const makeFace = (): FontFace => ({}) as FontFace

/** Replace `document.fonts` with a FontFaceSet-shaped stub; returns the `load` mock. */
function stubFontSet(behavior: LoadBehavior) {
  const load = vi.fn((spec: string) => Promise.resolve(behavior(spec)))
  Object.defineProperty(document, 'fonts', { value: { load }, configurable: true })
  return load
}

const injectedLinks = (): HTMLLinkElement[] =>
  Array.from(document.head.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'))

function currentLink(): HTMLLinkElement {
  const links = injectedLinks()
  expect(links, 'exactly one injected stylesheet expected').toHaveLength(1)
  return links[0]
}

/** Drive a load through link settle + both rAF frames; returns the handle. */
async function settlePairing(p: PairingFonts): Promise<FontLoadHandle> {
  const pending = loadPairingFonts(p)
  currentLink().dispatchEvent(new Event('load'))
  await vi.advanceTimersByTimeAsync(2 * 16 + 8)
  return pending
}

/** Await a gate failure, assert its reason code, and check D6 name-leakage. */
async function expectGateFailure(
  pending: Promise<FontLoadHandle>,
  reason: FontLoadFailureReason,
): Promise<FontLoadError> {
  let caught: unknown
  try {
    await pending
  } catch (err) {
    caught = err
  }
  expect(caught).toBeInstanceOf(FontLoadError)
  const failure = caught as FontLoadError
  expect(failure.reason).toBe(reason)
  // D6: rejections carry codes + slot/weight facts only — never family names or URLs.
  for (const name of SAMPLE_FAMILY_NAMES) {
    expect(failure.message).not.toContain(name)
    expect(failure.detail).not.toContain(name)
  }
  expect(failure.message).not.toContain('fonts.googleapis.com')
  return failure
}

// ---------------------------------------------------------------------------
// URL construction (pure) — snapshot the committed rules.
// ---------------------------------------------------------------------------

describe('buildCss2Url', () => {
  it('renders the sample pairings exactly as live-verified against css2 (T02 evidence)', () => {
    expect(buildCss2Url(frauncesNewsreader)).toBe(
      'https://fonts.googleapis.com/css2?family=Fraunces:wght@600;700&family=Newsreader:ital,wght@0,400;0,500;1,400;1,500&display=block',
    )
    expect(buildCss2Url(spaceGroteskCrimsonPro)).toBe(
      'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Crimson+Pro:ital,wght@0,400;0,600;1,400;1,600&display=block',
    )
  })

  it('emits the ital axis only when italic is true; tuples grouped upright-then-italic, weights sorted + deduped', () => {
    const pairing: PairingFonts = {
      heading: { slug: 'Test Serif', weights: [700, 400, 700], italic: true },
      body: { slug: 'Body Sans', weights: [400], italic: false },
    }
    expect(buildCss2Url(pairing)).toBe(
      'https://fonts.googleapis.com/css2?family=Test+Serif:ital,wght@0,400;0,700;1,400;1,700&family=Body+Sans:wght@400&display=block',
    )
  })

  it('single upright weight requests the bare wght axis and always pins display=block', () => {
    const pairing: PairingFonts = {
      heading: { slug: 'One Weight', weights: [400], italic: false },
      body: { slug: 'Two Words', weights: [300], italic: false },
    }
    expect(buildCss2Url(pairing)).toBe(
      'https://fonts.googleapis.com/css2?family=One+Weight:wght@400&family=Two+Words:wght@300&display=block',
    )
  })
})

// ---------------------------------------------------------------------------
// Readiness gate.
// ---------------------------------------------------------------------------

describe('loadPairingFonts', () => {
  it('resolves only after link settle → non-empty per-face fonts.load → double-rAF', async () => {
    const load = stubFontSet(() => [makeFace()])
    const pending = loadPairingFonts(spaceGroteskCrimsonPro, { sampleText: 'probe text' })
    let gateResolved = false
    void pending.then(() => {
      gateResolved = true
    })

    const link = currentLink()
    expect(link.rel).toBe('stylesheet')
    expect(link.getAttribute('href')).toBe(buildCss2Url(spaceGroteskCrimsonPro))

    link.dispatchEvent(new Event('load'))

    // Link settle alone is NOT readiness: the gate parks at the double-rAF
    // (fonts.load already resolved here) and must survive a first frame.
    await vi.advanceTimersByTimeAsync(0)
    expect(gateResolved).toBe(false)
    await vi.advanceTimersByTimeAsync(16) // first frame
    expect(gateResolved).toBe(false)
    await vi.advanceTimersByTimeAsync(16) // second frame
    expect(gateResolved).toBe(true)

    const handle = await pending
    expect(handle.link).toBe(link)
    expect(handle.link.isConnected).toBe(true)
    expect(handle.cssUrl).toBe(buildCss2Url(spaceGroteskCrimsonPro))
    expect(handle.families).toEqual(['Space Grotesk', 'Crimson Pro'])

    // One fonts.load per family × weight × style, deterministic order, sampleText
    // forwarded — every generated spec string exercised (R2 spec-string risk).
    expect(load.mock.calls as unknown as [string, string][]).toEqual([
      ['500 32px "Space Grotesk"', 'probe text'],
      ['700 32px "Space Grotesk"', 'probe text'],
      ['400 32px "Crimson Pro"', 'probe text'],
      ['italic 400 32px "Crimson Pro"', 'probe text'],
      ['600 32px "Crimson Pro"', 'probe text'],
      ['italic 600 32px "Crimson Pro"', 'probe text'],
    ])

    // Success disarms the timeout: advancing past the budget must neither
    // reject nor detach the link.
    await vi.advanceTimersByTimeAsync(DEFAULT_FONT_LOAD_TIMEOUT_MS + 100)
    expect(handle.link.isConnected).toBe(true)
    await expect(pending).resolves.toBe(handle)
  })

  it('forwards the default sample text when none is given', async () => {
    const load = stubFontSet(() => [makeFace()])
    await settlePairing(spaceGroteskCrimsonPro)
    const calls = load.mock.calls as unknown as [string, string][]
    expect(calls.length).toBeGreaterThan(0)
    for (const text of calls.map((call) => call[1])) {
      expect(text).toBe(DEFAULT_FONT_SAMPLE_TEXT)
    }
  })

  it('rejects "timeout" and removes the pending link when the stylesheet never settles', async () => {
    stubFontSet(() => [makeFace()])
    const pending = loadPairingFonts(frauncesNewsreader)
    const link = currentLink()
    const outcome = expectGateFailure(pending, 'timeout') // handler attached before the clock fires the reject

    await vi.advanceTimersByTimeAsync(DEFAULT_FONT_LOAD_TIMEOUT_MS - 1)
    expect(link.isConnected).toBe(true)

    await vi.advanceTimersByTimeAsync(1)
    const failure = await outcome
    expect(failure.message).toContain('4000ms')
    expect(link.isConnected).toBe(false)
    expect(injectedLinks()).toHaveLength(0)
  })

  it('rejects "timeout" when fonts.load stalls past the budget (mid-gate timeout)', async () => {
    stubFontSet(() => new Promise<FontFace[]>(() => {})) // never settles
    const pending = loadPairingFonts(frauncesNewsreader)
    const link = currentLink()
    const outcome = expectGateFailure(pending, 'timeout')
    link.dispatchEvent(new Event('load'))

    await vi.advanceTimersByTimeAsync(DEFAULT_FONT_LOAD_TIMEOUT_MS)
    await outcome
    expect(link.isConnected).toBe(false)
    expect(injectedLinks()).toHaveLength(0)
  })

  it('rejects "no-face" when every fonts.load resolves empty (css2 400 backstop)', async () => {
    stubFontSet(() => [])
    const pending = loadPairingFonts(frauncesNewsreader)
    const link = currentLink()
    link.dispatchEvent(new Event('load'))

    await expectGateFailure(pending, 'no-face')
    expect(link.isConnected).toBe(false)
    expect(injectedLinks()).toHaveLength(0)
  })

  it('rejects "no-face" when ANY single face resolves empty (guard is per-face)', async () => {
    stubFontSet((spec) => (spec.startsWith('italic') ? [] : [makeFace()]))
    const pending = loadPairingFonts(frauncesNewsreader)
    const link = currentLink()
    link.dispatchEvent(new Event('load'))

    await expectGateFailure(pending, 'no-face')
    expect(link.isConnected).toBe(false)
  })

  it('rejects "network" and removes the link when a fonts.load call rejects', async () => {
    stubFontSet(() => Promise.reject(new Error('decode failed')))
    const pending = loadPairingFonts(frauncesNewsreader)
    const link = currentLink()
    link.dispatchEvent(new Event('load'))

    await expectGateFailure(pending, 'network')
    expect(link.isConnected).toBe(false)
    expect(injectedLinks()).toHaveLength(0)
  })

  it('rejects "css" on the link error event, before any fonts.load call', async () => {
    const load = stubFontSet(() => [makeFace()])
    const pending = loadPairingFonts(frauncesNewsreader)
    const link = currentLink()
    link.dispatchEvent(new Event('error'))

    await expectGateFailure(pending, 'css')
    expect(link.isConnected).toBe(false)
    expect(load.mock.calls).toHaveLength(0)
  })

  it('treats late link events after a timeout as inert (no second settle, no resurrection)', async () => {
    stubFontSet(() => [makeFace()])
    const pending = loadPairingFonts(frauncesNewsreader)
    const link = currentLink()
    const outcome = expectGateFailure(pending, 'timeout')

    await vi.advanceTimersByTimeAsync(DEFAULT_FONT_LOAD_TIMEOUT_MS)
    await outcome

    link.dispatchEvent(new Event('load'))
    await vi.advanceTimersByTimeAsync(2 * 16 + 8)
    expect(link.isConnected).toBe(false)
    expect(injectedLinks()).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Cleanup ordering (plan accept: "cleanup of previous link").
// ---------------------------------------------------------------------------

describe('cleanup ordering', () => {
  it('keeps the previous pairing mounted until the new gate passes; release removes exactly the superseded link', async () => {
    stubFontSet(() => [makeFace()])

    const first = await settlePairing(frauncesNewsreader)
    const firstLink = first.link
    expect(firstLink.isConnected).toBe(true)

    const secondPending = loadPairingFonts(spaceGroteskCrimsonPro)
    const links = injectedLinks()
    expect(links).toHaveLength(2)
    const secondLink = links.find((l) => l !== firstLink) as HTMLLinkElement
    expect(secondLink.isConnected).toBe(true)

    // New pairing settles — the old link must STILL be mounted here:
    // removal is deliberately the caller's post-gate step (R2 step 5).
    secondLink.dispatchEvent(new Event('load'))
    await vi.advanceTimersByTimeAsync(2 * 16 + 8)
    await secondPending
    expect(firstLink.isConnected).toBe(true)
    expect(secondLink.isConnected).toBe(true)

    releasePairingFonts(first) // AFTER new ready — the load-bearing order
    expect(firstLink.isConnected).toBe(false)
    expect(secondLink.isConnected).toBe(true)

    releasePairingFonts(first) // idempotent
    releasePairingFonts(null) // null-safe
    expect(secondLink.isConnected).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Prefetch (optional next-pairing warm-up).
// ---------------------------------------------------------------------------

describe('prefetchPairingFonts', () => {
  it('warms the next pairing; the handle is adoptable like any other', async () => {
    stubFontSet(() => [makeFace()])
    const prefetch = prefetchPairingFonts(spaceGroteskCrimsonPro)

    currentLink().dispatchEvent(new Event('load'))
    await vi.advanceTimersByTimeAsync(2 * 16 + 8)

    const handle = await prefetch
    expect(handle.link.isConnected).toBe(true)
    expect(handle.families).toEqual(['Space Grotesk', 'Crimson Pro'])
  })

  it('contains failures — an ignored rejection never surfaces, yet stays observable when awaited', async () => {
    stubFontSet(() => [])
    const prefetch = prefetchPairingFonts(frauncesNewsreader) // deliberately not awaited yet

    currentLink().dispatchEvent(new Event('load'))
    await vi.advanceTimersByTimeAsync(2 * 16 + 8)

    // No unhandled rejection up to this point: vitest fails the suite on one,
    // so reaching this assertion is the containment proof.
    await expect(prefetch).rejects.toMatchObject({ reason: 'no-face' })
    expect(injectedLinks()).toHaveLength(0)
  })
})
