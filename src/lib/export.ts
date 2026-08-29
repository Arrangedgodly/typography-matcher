/**
 * T12 — Export: the prescription's take-home (town-hall D5, acceptance
 * criterion 4). One click on a saved pairing copies everything a real project
 * needs to wear it:
 *
 *   1. the exact css2 `<link>` T04's engine itself would inject —
 *      `buildCss2Url(pairingFonts(pairing))`, spaces `+`-encoded, explicit
 *      weights (and the `ital` axis when the record flags italics), always
 *      `display=block`;
 *   2. a `:root` custom-properties block whose names and values mirror the
 *      instrument's own variable surface (T05's `applyPairing`): the two
 *      family stacks — quoted family token + category-kindred system
 *      fallback, built by the SAME exported `familyStack()` — and the four
 *      weight variables under the same heaviest/lightest policy.
 *
 * The snippet is therefore paste-ready into any page's `<head>`: the link
 * fetches the faces, the variables hand them habitats (heading/body, both
 * judged weights of each) exactly as they had them on the examination wall.
 *
 * Strict reveal (D6): `buildExportSnippet` is PURE — it returns a string and
 * touches no DOM. The string contains family names, so the view mints it only
 * while the prescription pad is open (inside `.prescription-view`, the one
 * name-bearing subtree per T11's finding) and only on demand; nothing here
 * renders, stores, or logs it.
 *
 * Clipboard contract (criterion 4 + the D5 export decision): the Async
 * Clipboard API is the primary path — assumed available in the secure
 * contexts the app ships in (GH Pages), but never required. `copyToClipboard`
 * resolves `false` when the API is absent (insecure context, old engine,
 * hardened browser) or when the write is refused (permission denied,
 * document not focused); the view then degrades to the selectable-textarea
 * fallback rather than failing the export — the prescription must survive
 * the clipboard the same way the reveal survives the network.
 */

import { familyStack } from '../components/dummyPage'
import { buildCss2Url } from './fontLoader'
import { pairingFonts, type Pairing } from '../types'

/** HTML-comment-safe family display (schema slugs are tame; this stays total). */
function commentSafe(slug: string): string {
  return slug.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * Build the paste-ready export snippet for one pairing record.
 *
 * Shape (one string, `\n`-joined — no trailing newline, so the textarea and
 * the clipboard payload are byte-identical):
 *
 *     <!-- Typography pairing: A (heading) + B (body) -->
 *     <link rel="stylesheet" href="https://fonts.googleapis.com/css2?…&display=block">
 *     <style>
 *       :root {
 *         --font-heading: "A", <kindred fallback stack>;
 *         --font-body: "B", <kindred fallback stack>;
 *         --weight-heading: <heaviest heading weight>;
 *         --weight-heading-soft: <lightest heading weight>;
 *         --weight-body: <lightest body weight>;
 *         --weight-body-strong: <heaviest body weight>;
 *       }
 *     </style>
 *
 * The `href` is `buildCss2Url`'s output verbatim (raw `&` separators, exactly
 * Google's own embed form — every HTML parser resolves it to the intended
 * URL). Weight policy mirrors `applyPairing` (T05): heaviest heading →
 * display, lightest heading → standfirst, lightest body → reading, heaviest
 * body → chrome, so both weights of both families keep a habitat in the
 * exported project too. Italic faces need no variable — the css2 URL's
 * `ital` axis already ships them, and consumers opt in per-declaration.
 */
export function buildExportSnippet(pairing: Pairing): string {
  const headingWeights = [...pairing.heading.weights].sort((a, b) => a - b)
  const bodyWeights = [...pairing.body.weights].sort((a, b) => a - b)

  return [
    `<!-- Typography pairing: ${commentSafe(pairing.heading.slug)} (heading) + ${commentSafe(pairing.body.slug)} (body) -->`,
    `<link rel="stylesheet" href="${buildCss2Url(pairingFonts(pairing))}">`,
    `<style>`,
    `  :root {`,
    `    --font-heading: ${familyStack(pairing.heading.slug, pairing.heading.category)};`,
    `    --font-body: ${familyStack(pairing.body.slug, pairing.body.category)};`,
    `    --weight-heading: ${headingWeights[headingWeights.length - 1]};`,
    `    --weight-heading-soft: ${headingWeights[0]};`,
    `    --weight-body: ${bodyWeights[0]};`,
    `    --weight-body-strong: ${bodyWeights[bodyWeights.length - 1]};`,
    `  }`,
    `</style>`,
  ].join('\n')
}

/**
 * Copy text through the Async Clipboard API. Resolves `true` only on a
 * confirmed write; `false` covers every flavor of unavailability/refusal —
 * no API (insecure context, stripped engine), missing method, rejection
 * (permission denied, no focus), or a non-object `navigator` (defensive;
 * jsdom-adjacent environments). Never throws: the caller's fallback IS the
 * error path.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  const nav: Navigator | undefined =
    typeof navigator === 'undefined' ? undefined : (navigator as Navigator)
  const writeText = nav?.clipboard?.writeText
  if (typeof writeText !== 'function') return false
  try {
    await writeText.call(nav!.clipboard, text)
    return true
  } catch {
    return false // NotAllowedError & kin — degrade, never throw
  }
}
