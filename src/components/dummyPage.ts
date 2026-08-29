/**
 * T05 — the dummy page: the essay (T03) rendered as a structural editorial
 * layout, plus the variable-only pairing switch the whole instrument swaps by.
 *
 * Division of labor (plan T05 + R2's caller sequence, docs/ultron/research/
 * R2-font-loading.md):
 *
 * - `renderDummyPage()` builds the semantic DOM once: <main> › header (the
 *   essay's UI-chrome microcopy — nav label + button) + <article> (display
 *   <h1>, standfirst, <section> of body paragraphs, <blockquote>) + caption.
 *   Copy comes verbatim from `essay`; this module authors no text.
 * - `applyPairing()` is the ONLY place a pairing touches the page: it writes
 *   the `:root` custom properties (`--font-heading` / `--font-body`, the
 *   weight variables, the quote style) and NOTHING else — no DOM reads or
 *   writes, no class toggles, no listeners. Callers sequence it inside T04's
 *   gate (`const next = await loadPairingFonts(pairingFonts(p))` →
 *   `applyPairing(p)` → confirm a frame → `releasePairingFonts(prev)`), which
 *   is what makes the swap FOUT-proof: faces are decoded before any text
 *   references them, and the old stylesheet is evicted only after the swap
 *   has painted.
 *
 * Weight policy (one place, consumed by dummy.css, reused by T07/T09):
 * - `--weight-heading`      heaviest heading weight → display headline
 * - `--weight-heading-soft` lightest heading weight → standfirst
 * - `--weight-body`         lightest body weight    → reading text, quote, caption
 * - `--weight-body-strong`  heaviest body weight    → UI chrome (nav label, button)
 * Both weights of both families get a habitat, so each pairing is judged on
 * more of itself than one weight per role would show.
 *
 * Blind-test notes (D6): neither function writes family names into the judged
 * content — names live only inside the `--font-*` variable values, which is
 * exactly the surface T12's export snippet reads back on the reveal side.
 */

import { essay } from '../data/essay'
import type { FontCategory, Pairing } from '../types'

/**
 * System stacks per Google category: before the first pairing's gate passes
 * (and on any load failure) the page shows kindred system faces rather than
 * a foreign-category default.
 */
const CATEGORY_FALLBACKS: Record<FontCategory, string> = {
  serif: "Georgia, 'Times New Roman', Times, serif",
  'sans-serif': "'Helvetica Neue', Helvetica, Arial, sans-serif",
  display: "Georgia, 'Times New Roman', Times, serif",
  handwriting: "'Snell Roundhand', 'Segoe Script', cursive",
  monospace: "'Courier New', Courier, monospace",
}

/** CSS font-family token — quoted and backslash-escaped (mirrors T04's spec strings). */
function cssFamilyToken(slug: string): string {
  return `"${slug.replace(/["\\]/g, '\\$&')}"`
}

/**
 * Full `font-family` value for one family slot: the face plus its category
 * fallback. Exported for T12 (`src/lib/export.ts`): the take-home snippet
 * reuses this exact builder so the exported stacks and the instrument's own
 * `--font-*` values can never drift apart.
 */
export function familyStack(slug: string, category: FontCategory): string {
  return `${cssFamilyToken(slug)}, ${CATEGORY_FALLBACKS[category]}`
}

/**
 * Build the dummy page. Pure DOM construction — safe to call before any
 * pairing has loaded; the layout renders on the `:root` fallback stacks and
 * flips faces the moment `applyPairing` runs inside the font gate.
 */
export function renderDummyPage(): HTMLElement {
  const main = document.createElement('main')
  main.className = 'dummy-page'

  const frame = document.createElement('div')
  frame.className = 'dummy-frame'

  // UI-chrome microcopy (essay.ui): small-type habitat, judged with the rest.
  const topbar = document.createElement('header')
  topbar.className = 'dummy-topbar'

  const navLabel = document.createElement('span')
  navLabel.className = 'dummy-nav-label'
  navLabel.textContent = essay.ui.navLabel

  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'dummy-button'
  button.textContent = essay.ui.buttonLabel
  // Structural stand-in only — no handler on purpose (real judgment input
  // arrives in T08); left enabled so its text renders at judged contrast.

  topbar.append(navLabel, button)

  // The editorial spread.
  const article = document.createElement('article')
  article.className = 'dummy-sheet'

  const rail = document.createElement('div')
  rail.className = 'dummy-rail'

  const headline = document.createElement('h1')
  headline.className = 'dummy-headline'
  headline.textContent = essay.headline

  const standfirst = document.createElement('p')
  standfirst.className = 'dummy-standfirst'
  standfirst.textContent = essay.standfirst

  const quote = document.createElement('blockquote')
  quote.className = 'dummy-quote'
  quote.textContent = essay.blockquote

  rail.append(headline, standfirst, quote)

  const body = document.createElement('section')
  body.className = 'dummy-body'
  body.setAttribute('aria-label', 'Essay body')
  for (const text of essay.paragraphs) {
    const p = document.createElement('p')
    p.textContent = text
    body.appendChild(p)
  }

  article.append(rail, body)

  const caption = document.createElement('p')
  caption.className = 'dummy-caption'
  caption.textContent = essay.ui.caption

  frame.append(topbar, article, caption)
  main.appendChild(frame)
  return main
}

/**
 * Apply a pairing by writing the `:root` custom properties — nothing else.
 *
 * Call only after T04's readiness gate has passed for this pairing, and
 * release the previous pairing's handle only after the variable change has
 * been confirmed on a painted frame (R2 ordering; see main.ts for the wired
 * sequence).
 */
export function applyPairing(pairing: Pairing): void {
  const rootStyle = document.documentElement.style
  const headingWeights = [...pairing.heading.weights].sort((a, b) => a - b)
  const bodyWeights = [...pairing.body.weights].sort((a, b) => a - b)

  rootStyle.setProperty('--font-heading', familyStack(pairing.heading.slug, pairing.heading.category))
  rootStyle.setProperty('--font-body', familyStack(pairing.body.slug, pairing.body.category))
  rootStyle.setProperty('--weight-heading', String(headingWeights[headingWeights.length - 1]))
  rootStyle.setProperty('--weight-heading-soft', String(headingWeights[0]))
  rootStyle.setProperty('--weight-body', String(bodyWeights[0]))
  rootStyle.setProperty('--weight-body-strong', String(bodyWeights[bodyWeights.length - 1]))
  // A body family with no italic flag must not be oblique-synthesized by the
  // blockquote — synthesized slant would misrepresent the pairing under
  // judgment, so the quote's style follows the family's real inventory.
  rootStyle.setProperty('--quote-font-style', pairing.body.italic ? 'italic' : 'normal')
}
