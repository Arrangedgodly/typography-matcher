/**
 * T03 — the acuity-lane essay: the copy every pairing is judged against.
 *
 * The essay IS the interface (design-brief §1/§3: the dummy page owns the
 * visual center, chrome recedes). Each field below renders inside the acuity
 * lane in the pairing's faces, so the copy gives every role natural habitat:
 *
 *   - `headline`   exercises display scale (the heading face at full size);
 *   - `standfirst` bridges display and text sizes;
 *   - `paragraphs` exercise reading texture (the body face at reading size);
 *   - `blockquote` exercises the italic / display-quote treatment;
 *   - `ui`         exercises small-type chrome (nav, button, caption slots).
 *
 * Neutrality contract (plan T03 risk note — binding on future edits):
 * no numerals anywhere (numeral shapes vary wildly between families and would
 * privilege distinctive ones); no passage that depends on all-caps rendering
 * (case and scale are styling decisions owned by T05/T07); no typeface,
 * category, or era is named or flattered; no citable design-history claims —
 * craft observation only, phrased to stay true without a footnote.
 *
 * The blockquote is an original aphorism authored for this repo, deliberately
 * unattributed (T03: no invented voices, no quotation licensing).
 *
 * Consumers: T05 renders this module in the dummy page; T07 checks
 * one-viewport fit on desktop (~1280px) against the lengths below —
 * headline 6 words, standfirst 36, paragraphs 60–70 each, quote 14.
 */
export interface EssayCopy {
  /** Display headline, 4–8 words; exercises the heading face at display scale. */
  headline: string
  /** Standfirst/deck: one breath between headline and body. */
  standfirst: string
  /** Body paragraphs in reading order; each 60–90 words. */
  paragraphs: readonly string[]
  /** Display-quote treatment (italic); original and unattributed by design. */
  blockquote: string
  /** Small-type chrome strings rendered alongside the essay. */
  ui: {
    /** Saved-list view label (design-brief vocabulary: the prescription). */
    navLabel: string
    /** Primary judgment action — the green side of the red–green bar. */
    buttonLabel: string
    /** Small-type caption slot on the dummy page. */
    caption: string
  }
}

export const essay: EssayCopy = {
  headline: 'Type Is a Decision About Attention',

  standfirst:
    'A page makes its argument before the first sentence is read. Every letterform takes a position — on pace, on formality, on how close to hold the reader — and the setting declares all of it at once.',

  paragraphs: [
    "Reading is quieter work than it looks. The eye moves in leaps and pauses, and the typographer’s craft lives in those pauses — in the space a word keeps, the weight a line carries, the degree to which one paragraph agrees to resemble the next. None of this is noticed while it succeeds. The page simply feels as though it can be trusted, and that trust arrives before any argument does.",

    'Pairing is where the craft becomes social. A headline and its body text are two voices sharing one conversation, and the relationship is the design: close enough to feel like a single intention, distinct enough that each can do its own work. Contrast of proportion does more here than contrast of ornament. Two families that argue politely — one stepping forward, one receding — will outlast two that shout in unison.',

    'Which is why the honest test of any typeface is a page that wants reading, not a specimen sheet that wants admiration. Character is easy to perform at display size and much harder to sustain across an ordinary paragraph. Judge a letterform the way you would judge a dinner companion: not by the portrait, but by the conversation that follows.',
  ],

  blockquote: 'Good type never raises its voice; it adjusts the room until listening feels effortless.',

  ui: {
    navLabel: 'Prescription',
    buttonLabel: 'Save this pairing',
    caption: 'Unsigned on purpose — a setting must survive on behavior alone.',
  },
}
