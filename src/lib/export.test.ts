// @vitest-environment jsdom
/**
 * T12 — export snippet unit tests (plan T12; acceptance criterion 4).
 *
 * Pins:
 *   1. LINK TAG      the snippet carries exactly one `<link rel="stylesheet">`
 *                    whose href is `buildCss2Url`'s output VERBATIM (the same
 *                    URL T04's engine injects — spaces `+`-encoded, explicit
 *                    weights, `ital` axis when flagged, `display=block`).
 *   2. VARIABLES     the `:root` block carries `--font-heading`/`--font-body`
 *                    stacks and the four weight variables under T05's exact
 *                    heaviest/lightest policy, computed from the T02 record.
 *   3. QUOTING       multi-word family names are quoted (and backslash-
 *                    escaped when hostile); single-word names quote too —
 *                    consistent, valid CSS in both forms.
 *   4. SCHEMA FIELDS every field of the record lands: slug → stacks +
 *                    comment, category → kindred fallback stack, weights →
 *                    css2 axis + weight variables, italic → `ital` axis.
 *   5. PASTE-READY   the snippet parses as the `<head>` content of a real
 *                    document (DOMParser): one stylesheet link, one style
 *                    element, resolved href byte-equal to the css2 URL.
 *   6. CLIPBOARD     `copyToClipboard` is total: absent API / resolving
 *                    write / rejecting write → false / true / false, never a
 *                    throw.
 */
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildCss2Url } from './fontLoader'
import { buildExportSnippet, copyToClipboard } from './export'
import { pairingFonts } from '../types'
import { samplePairings } from '../data/pairings.sample'
import type { Pairing } from '../types'

const frauncesNewsreader = samplePairings[0]
const groteskCrimson = samplePairings[1]

describe('buildExportSnippet (T12)', () => {
  describe('carries the exact css2 link tag (T04 reuse)', () => {
    for (const pairing of samplePairings) {
      it(`link href is buildCss2Url verbatim for ${pairing.id}`, () => {
        const snippet = buildExportSnippet(pairing)
        const expectedUrl = buildCss2Url(pairingFonts(pairing))
        expect(snippet).toContain(`<link rel="stylesheet" href="${expectedUrl}">`)
        expect(expectedUrl).toContain('display=block') // the engine always pins it
        expect(snippet.match(/<link /g)).toHaveLength(1) // exactly one stylesheet tag
      })
    }

    it('italic flag reaches the css2 axis (schema field → URL)', () => {
      const snippet = buildExportSnippet(groteskCrimson)
      expect(snippet).toContain('family=Crimson+Pro:ital,wght@0,400;0,600;1,400;1,600')
      // upright-only family stays on the bare wght axis
      expect(snippet).toContain('family=Space+Grotesk:wght@500;700')
    })
  })

  describe('carries the CSS variables (T05 surface, T02 values)', () => {
    it('stacks + weight variables mirror the record exactly', () => {
      const snippet = buildExportSnippet(frauncesNewsreader)
      expect(snippet).toContain('--font-heading: "Fraunces", Georgia, \'Times New Roman\', Times, serif;')
      expect(snippet).toContain('--font-body: "Newsreader", Georgia, \'Times New Roman\', Times, serif;')
      // weights: heading [600,700] → 700 heaviest / 600 lightest; body [400,500]
      expect(snippet).toContain('--weight-heading: 700;')
      expect(snippet).toContain('--weight-heading-soft: 600;')
      expect(snippet).toContain('--weight-body: 400;')
      expect(snippet).toContain('--weight-body-strong: 500;')
    })

    it('category picks the kindred fallback stack (sans-serif vs serif)', () => {
      const snippet = buildExportSnippet(groteskCrimson)
      expect(snippet).toContain("--font-heading: \"Space Grotesk\", 'Helvetica Neue', Helvetica, Arial, sans-serif;")
      expect(snippet).toContain("--font-body: \"Crimson Pro\", Georgia, 'Times New Roman', Times, serif;")
    })

    it('multi-word family names are quoted; single-word names quote too', () => {
      const snippet = buildExportSnippet(groteskCrimson)
      expect(snippet).toContain('--font-heading: "Space Grotesk"') // multi-word → quoted
      expect(snippet).toContain('"Crimson Pro"')
      const fraunces = buildExportSnippet(frauncesNewsreader)
      expect(fraunces).toContain('--font-heading: "Fraunces"') // consistent quoting
    })

    it('the pairing is named in the header comment with its roles', () => {
      const snippet = buildExportSnippet(groteskCrimson)
      expect(snippet).toContain('<!-- Typography pairing: Space Grotesk (heading) + Crimson Pro (body) -->')
    })

    it('hostile names are CSS-escaped in stacks and HTML-escaped in the comment', () => {
      const hostile: Pairing = {
        id: 'hostile-probe',
        heading: {
          slug: 'Evil"Face\\Name',
          role: 'heading',
          category: 'serif',
          tags: ['probe'],
          weights: [400, 700],
          italic: false,
        },
        body: {
          slug: 'Amp&ers<on>',
          role: 'body',
          category: 'sans-serif',
          tags: ['probe'],
          weights: [400],
          italic: false,
        },
      }
      const snippet = buildExportSnippet(hostile)
      // stacks: quotes and backslashes escaped — the declaration stays one declaration
      expect(snippet).toContain('--font-heading: "Evil\\"Face\\\\Name",')
      // comment: HTML-special characters neutralized
      expect(snippet).toContain('Amp&amp;ers&lt;on&gt; (body)')
    })
  })

  describe('is paste-ready (parses as head content)', () => {
    for (const pairing of samplePairings) {
      it(`parses for ${pairing.id}: one stylesheet link + one style element`, () => {
        const snippet = buildExportSnippet(pairing)
        const doc = new DOMParser().parseFromString(
          `<!doctype html><html><head>${snippet}</head><body></body></html>`,
          'text/html',
        )
        const links = doc.head.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')
        expect(links).toHaveLength(1)
        expect(links[0].href).toBe(buildCss2Url(pairingFonts(pairing))) // resolves exactly
        const styles = doc.head.querySelectorAll('style')
        expect(styles).toHaveLength(1)
        const css = styles[0].textContent ?? ''
        for (const name of [
          '--font-heading',
          '--font-body',
          '--weight-heading',
          '--weight-heading-soft',
          '--weight-body',
          '--weight-body-strong',
        ]) {
          expect(css).toContain(name)
        }
        expect(doc.querySelector('parsererror')).toBeNull()
      })
    }
  })
})

describe('copyToClipboard (T12)', () => {
  const originalDescriptor = Object.getOwnPropertyDescriptor(Navigator.prototype, 'clipboard')

  beforeEach(() => {
    Object.defineProperty(Navigator.prototype, 'clipboard', {
      value: undefined,
      configurable: true,
      writable: true,
    })
  })

  afterAll(() => {
    if (originalDescriptor) Object.defineProperty(Navigator.prototype, 'clipboard', originalDescriptor)
    else delete (Navigator.prototype as unknown as Record<string, unknown>).clipboard
  })

  it('false when the API is absent (insecure context / stripped engine)', async () => {
    expect((navigator as Navigator & { clipboard?: unknown }).clipboard).toBeUndefined()
    await expect(copyToClipboard('x')).resolves.toBe(false)
  })

  it('false when writeText is not a function', async () => {
    Object.defineProperty(Navigator.prototype, 'clipboard', {
      value: {},
      configurable: true,
    })
    await expect(copyToClipboard('x')).resolves.toBe(false)
  })

  it('true on a confirmed write; payload preserved byte-exact', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(Navigator.prototype, 'clipboard', { value: { writeText }, configurable: true })
    const snippet = buildExportSnippet(frauncesNewsreader)
    await expect(copyToClipboard(snippet)).resolves.toBe(true)
    expect(writeText).toHaveBeenCalledTimes(1)
    expect(writeText).toHaveBeenCalledWith(snippet)
  })

  it('false when the write is refused (permission denied) — never a throw', async () => {
    const writeText = vi.fn().mockRejectedValue(new DOMException('denied', 'NotAllowedError'))
    Object.defineProperty(Navigator.prototype, 'clipboard', { value: { writeText }, configurable: true })
    await expect(copyToClipboard('x')).resolves.toBe(false)
  })
})
