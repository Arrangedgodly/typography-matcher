/**
 * T08 — Input parity (design-brief §6, plan acceptance criterion 2).
 *
 * Three equal citizens, ONE funnel: the bar buttons, the ←/→ keys, and the
 * pointer-drag swipe (src/lib/gestures.ts, attached to the acuity lane)
 * all converge on the single internal `judge()` below, which applies the
 * shared gate (not loading, not exhausted) and then calls the one registered
 * handler — identical in effect by construction, not by coordination.
 *
 *   - **Buttons**   red Skip (←) / green Save (→) — ONE CORD, focusable,
 *                  aria-labelled, visible focus rings.
 *   - **Keyboard**  ArrowLeft/ArrowRight anywhere in the room except editable
 *                  surfaces (there are none in review today; the guard is for
 *                  whatever mounts later). The keyboard path never requires a
 *                  pointer: focus is managed across state changes (loading
 *                  disables the buttons — focus is stashed and restored, so a
 *                  keyboard user rides through the swap instead of being
 *                  dropped to <body>), and dismissing the first-run explainer
 *                  hands focus to the first judgment control. Until that
 *                  dismissal the explainer CLOSES judgment (T17's adjudication
 *                  of the T16 finding): a first-visit keyboard user meets the
 *                  protocol — judge the setting, not the name — before the
 *                  instrument answers, instead of saving pairings under a
 *                  notice they never read.
 *   - **Swipe**     pointer-drag on the card chrome/paper — left = skip,
 *                  right = save (spatially consistent with the bar's halves
 *                  and the key hints). Intent separation from inner scroll is
 *                  built into the gesture engine (touch-action: pan-y +
 *                  pointercancel; vertical wins the arbiter's ties).
 *
 * Exhaustion (D7) is a state here, never an auto-reshuffle: when the deck has
 * nothing unseen left, the judgment bar disables in place (STATES IN PLACE)
 * and the strip carries a "cycle complete" notice whose explicit Reshuffle
 * button is the user's act. Saves and the seen-set persist via T10's storage
 * layer (src/lib/storage.ts); the storage-degraded notice is its chrome
 * surface — non-blocking, criterion 7.
 *
 * T09 — the lens-swap moment (design-brief §3): this chrome owns the
 * choreography surface driven by `src/main.ts`'s gate sequencing (R2 order —
 * reveal only after the gate's double-rAF, the variable swap, a confirmed
 * paint, and the old stylesheet's release):
 *
 *   - `coverSwap()`   drops the occluder (a card-covering instrument-black
 *                     blind, `styles/motion.css`) over the paper in stepped
 *                     clicks + enters the loading state; resets the lane's
 *                     scroll under cover; clips the lane for the swap.
 *   - `revealSwap()`  lifts the blind (one whole card-height, stepped clicks,
 *                     top-first reveal) + plays the card's SNAP-STEP detent
 *                     (one step past the seat, settle) + returns to ready.
 *   - `failSwap()`    lifts the blind the same way — re-revealing the
 *                     UNCHANGED previous pairing — and renders the
 *                     recoverable error state (STATES IN PLACE strip notice
 *                     + the retry act) for the 4000 ms font-gate budget.
 *   - `onRetrySwap()` registers that retry act (draw the next pairing).
 *
 * `prefers-reduced-motion: reduce` collapses the choreography to an instant
 * swap: the blind is never mounted, no detent plays — the loading/error
 * STATES remain (they restyle in place; they are not motion).
 */

import type { DeckStats } from '../lib/deck'
import { attachSwipeController, type SwipeController } from '../lib/gestures'

/** Verdict vocabulary — the two halves of the duochrome bar. */
export type Verdict = 'save' | 'skip'

/** Chrome construction options (T10 — the storage layer's wiring seams). */
export interface ExaminationRoomOptions {
  /**
   * T10 — the persisted first-run dismissal: when true the explainer is not
   * rendered at all (a returning examiner starts straight at the deck), and
   * no focus is stolen at boot — the dismissal already happened in a
   * previous session.
   */
  explainerDismissed?: boolean
  /** T10 — fires when the user dismisses the explainer (main.ts persists it). */
  onExplainerDismissed?: () => void
}

/** Chrome surface returned to the app controller (`src/main.ts`). */
export interface ExaminationRoom {
  /** The chrome root — append to the app mount. */
  root: HTMLElement
  /** The lane interior — mount `renderDummyPage()`'s essay here. */
  lane: HTMLElement
  /** Toggle the in-place loading state on the judgment bar. */
  setLoading(loading: boolean): void
  /** T09 — drop the occluder over the paper + enter the loading state. */
  coverSwap(): void
  /** T09 — lift the occluder with the snap-step reveal + detent; back to ready. */
  revealSwap(): void
  /** T09 — lift the occluder; show the recoverable error state + retry act. */
  failSwap(): void
  /** T09 — register the error state's retry handler (draws the next pairing). */
  onRetrySwap(handler: () => void): void
  /** Toggle the deck-exhausted state (bar disabled + cycle-complete notice). */
  setExhausted(exhausted: boolean): void
  /**
   * T10 — toggle the storage-degraded notice (criterion 7): a non-blocking
   * strip row stating that saves/progress are session-only. No act, no focus
   * move, no disabled control — the examination itself is untouched.
   */
  setStorageDegraded(degraded: boolean): void
  /** Redraw the distance markers from deck stats (seen/total). */
  updateMarkers(stats: DeckStats): void
  /** Update the prescription ledger text on the route control (T11). */
  updatePrescription(saved: number): void
  /**
   * T11 — register the prescription-view open handler (the strip control's
   * act). main.ts opens the view and then calls `setPrescribing(true)`.
   */
  onOpenPrescription(handler: () => void): void
  /**
   * T11 — toggle the prescribing state: while the pad is open the room's
   * three regions (strip, lane, bar) go inert — not focusable, not
   * clickable — and the judgment inputs (buttons are disabled by inert,
   * ←/→ keys and swipes by the `inputOpen` gate) stand down entirely. The
   * view is a sibling overlay, unaffected by the inert regions.
   */
  setPrescribing(open: boolean): void
  /** T11 — return focus to the prescription route control (after close). */
  focusPrescription(): void
  /** Register the judgment handler — buttons, keys, and swipe all land here. */
  onJudge(handler: (verdict: Verdict) => void): void
  /** Register the reshuffle handler (the exhaustion notice's explicit act). */
  onReshuffle(handler: () => void): void
  /** Attach the pointer-drag swipe to the lane + the paper that follows. */
  attachSwipe(paper: HTMLElement): void
}

/**
 * Build the Examination Room chrome. Pure DOM construction + controller
 * wiring; no text is authored here that carries pairing identity (the strict
 * reveal, D6, is untouched — this chrome never knows a family name).
 */
export function renderExaminationRoom(options: ExaminationRoomOptions = {}): ExaminationRoom {
  const root = document.createElement('div')
  root.className = 'examination-room'
  root.dataset.state = 'ready'

  // --- Instrument strip -----------------------------------------------------
  const strip = document.createElement('header')
  strip.className = 'lane-strip'

  const stripMain = document.createElement('div')
  stripMain.className = 'lane-strip-main'

  const wordmark = document.createElement('p')
  wordmark.className = 'lane-wordmark'
  const wordmarkName = document.createElement('span')
  wordmarkName.textContent = 'Blind Test'
  const wordmarkSub = document.createElement('span')
  wordmarkSub.className = 'lane-wordmark-sub'
  wordmarkSub.textContent = ' — typography examination'
  wordmark.append(wordmarkName, wordmarkSub)

  // Distance markers: one tick per deck pairing, filled = examined, tall =
  // current; the count text carries the same facts for screen readers.
  const markers = document.createElement('div')
  markers.className = 'lane-markers'
  const rail = document.createElement('span')
  rail.className = 'marker-rail'
  rail.setAttribute('aria-hidden', 'true')
  const count = document.createElement('span')
  count.className = 'marker-count'
  count.setAttribute('role', 'status')
  count.setAttribute('aria-live', 'polite')
  markers.append(rail, count)

  // Prescription route (T11): the quiet ledger of saves doubles as the
  // control that opens the prescription view — the one place identities are
  // revealed (strict reveal, D6). A real button in the tab order, so the
  // route is keyboard-operable; it works at 0 saved too (the empty state is
  // a designed state, design-brief §5). While the view is open the room's
  // three regions stand down inert and the judgment keys are not claimed
  // (see setPrescribing); the view itself is a sibling overlay main.ts
  // mounts beside these rows.
  const prescription = document.createElement('button')
  prescription.type = 'button'
  prescription.className = 'lane-prescription'
  prescription.textContent = 'Prescription · 0 saved'

  stripMain.append(wordmark, markers, prescription)

  // One-line first-run protocol explainer. Dismissal persists via T10's flag
  // store (main.ts passes the flag + the persist hook); a previously
  // dismissed explainer is not rendered at all — a returning examiner starts
  // straight at the deck, and boot never steals focus for a notice they
  // already acted on. Fresh dismissal hands focus to the first judgment
  // control so the keyboard journey continues unbroken.
  const explainer = document.createElement('div')
  explainer.className = 'lane-explainer'
  const explainerText = document.createElement('p')
  explainerText.className = 'lane-explainer-text'
  explainerText.textContent =
    'Every page changes lenses — judge the setting, not the name. Identities arrive only on your prescription.'
  const dismiss = document.createElement('button')
  dismiss.type = 'button'
  dismiss.className = 'lane-explainer-dismiss'
  dismiss.textContent = 'Begin examination'
  explainer.append(explainerText, dismiss)
  strip.append(stripMain)
  if (!options.explainerDismissed) strip.append(explainer)

  // Cycle-complete notice (D7 exhaustion): reshuffle is an explicit user act,
  // never the deck's. Hidden until the deck reports exhaustion.
const exhaustion = document.createElement('div')
exhaustion.className = 'lane-exhausted'
exhaustion.id = 'lane-exhausted'
exhaustion.hidden = true
const exhaustedText = document.createElement('p')
exhaustedText.className = 'lane-exhausted-text'
// T17: exhaustion arrives mid-session as the direct answer to a verdict — a
// polite status so screen-reader examiners hear the cycle close without
// hunting for it (the same anatomy the swap-error and storage notices carry).
exhaustedText.setAttribute('role', 'status')
exhaustedText.setAttribute('aria-live', 'polite')
exhaustedText.textContent = 'Cycle complete — every pairing examined once.'
const reshuffle = document.createElement('button')
reshuffle.type = 'button'
reshuffle.className = 'lane-exhausted-reshuffle'
reshuffle.textContent = 'Reshuffle the deck'
reshuffle.setAttribute('aria-label', 'Reshuffle the deck and begin a new examination cycle')
exhaustion.append(exhaustedText, reshuffle)
strip.append(exhaustion)

// Swap-error notice (T09): a failed font gate (the 4000 ms budget, a dropped
// stylesheet, a missing face) degrades to a recoverable state, not a hang —
// the same strip-row anatomy as the explainer/exhaustion notices (STATES IN
// PLACE), with the retry act as the user's move. Copy is world-vocabulary
// and carries no pairing identity (D6); FontLoadError never does either.
const swapError = document.createElement('div')
swapError.className = 'lane-swap-error'
swapError.id = 'lane-swap-error'
swapError.hidden = true
const swapErrorText = document.createElement('p')
swapErrorText.className = 'lane-swap-error-text'
swapErrorText.setAttribute('role', 'status')
swapErrorText.setAttribute('aria-live', 'polite')
swapErrorText.textContent = 'Lens change failed — the new pairing did not arrive.'
const retry = document.createElement('button')
retry.type = 'button'
retry.className = 'lane-swap-error-retry'
retry.textContent = 'Try the next lens'
retry.setAttribute('aria-label', 'Draw the next pairing')
swapError.append(swapErrorText, retry)
strip.append(swapError)

// Storage-degraded notice (T10, criterion 7): when localStorage is
// unavailable — private mode, blocked, quota exhausted mid-session — the
// storage layer serves the same interface from memory and the examination
// keeps working; only survival past a reload is lost. This row states that
// consequence. NON-BLOCKING by contract: no act to perform, no focus move,
// no disabled control — the same strip-row anatomy as the explainer and
// exhaustion notices (STATES IN PLACE), hidden while storage is healthy.
const storageNotice = document.createElement('div')
storageNotice.className = 'lane-storage-notice'
storageNotice.id = 'lane-storage-notice'
storageNotice.hidden = true
const storageNoticeText = document.createElement('p')
storageNoticeText.className = 'lane-storage-notice-text'
storageNoticeText.setAttribute('role', 'status')
storageNoticeText.setAttribute('aria-live', 'polite')
storageNoticeText.textContent =
  'Records can’t be kept in this browser — saves and progress last this session only.'
storageNotice.appendChild(storageNoticeText)
strip.append(storageNotice)

  // --- The lane (essay mounts inside) ---------------------------------------
  const lane = document.createElement('div')
  lane.className = 'acuity-lane'

  // --- Judgment bar: ONE CORD ------------------------------------------------
  const bar = document.createElement('footer')
  bar.className = 'judgment-bar'

  const skipButton = document.createElement('button')
  skipButton.type = 'button'
  skipButton.className = 'judge judge-skip'
  skipButton.setAttribute('aria-label', 'Skip this pairing')
  skipButton.setAttribute('aria-keyshortcuts', 'ArrowLeft')
  const skipHint = document.createElement('span')
  skipHint.className = 'judge-hint'
  skipHint.setAttribute('aria-hidden', 'true')
  skipHint.textContent = '←'
  const skipLabel = document.createElement('span')
  skipLabel.className = 'judge-label'
  skipLabel.textContent = 'Skip'
  skipButton.append(skipHint, skipLabel)

  const saveButton = document.createElement('button')
  saveButton.type = 'button'
  saveButton.className = 'judge judge-save'
  saveButton.setAttribute('aria-label', 'Save this pairing')
  saveButton.setAttribute('aria-keyshortcuts', 'ArrowRight')
  const saveLabel = document.createElement('span')
  saveLabel.className = 'judge-label'
  saveLabel.textContent = 'Save'
  const saveHint = document.createElement('span')
  saveHint.setAttribute('aria-hidden', 'true')
  saveHint.className = 'judge-hint'
  saveHint.textContent = '→'
  saveButton.append(saveLabel, saveHint)

  bar.setAttribute('role', 'group')
  bar.setAttribute('aria-label', 'Judgment — save or skip the current pairing')
  bar.append(skipButton, saveButton)

  root.append(strip, lane, bar)

  // --- Controller surface ----------------------------------------------------

  let judgeHandler: ((verdict: Verdict) => void) | null = null
  let reshuffleHandler: (() => void) | null = null
  let retryHandler: (() => void) | null = null
  let prescriptionHandler: (() => void) | null = null
  let exhaustedNow = false
  let prescribingNow = false
  // T17 (adjudicating T16's finding): while the first-run explainer stands,
  // judgment is CLOSED — the dismissal act ("Begin examination") is the
  // consent that opens the instrument. One term here gates all three input
  // paths (buttons via the disabled bar, keys and swipes via inputOpen).
  let explainerUp = !options.explainerDismissed
  let swipe: SwipeController | null = null
  let focusDuringSwap: HTMLElement | null = null

  // --- T09 choreography state ------------------------------------------------

  /** The chart paper (`attachSwipe` delivers it); the blind anchors to it. */
  let paperEl: HTMLElement | null = null
  /** The occluder — created lazily on first cover, never under reduced motion. */
  let blind: HTMLElement | null = null
  let blindTimer: number | undefined
  let detentTimer: number | undefined
  let lockTimer: number | undefined

  /** Choreography durations (ms) — must track `styles/motion.css`. */
  const BLIND_LIFT_MS = 240
  const DETENT_TOTAL_MS = 280 // 90 delay + 190 animation
  const LANE_UNLOCK_DELAY_MS = 340

  /** Live reduced-motion probe (checked at each phase; OS setting changes
      mid-session are honored — any blind left down is hidden regardless). */
  function prefersReducedMotion(): boolean {
    return (
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
  }

  /** Create the occluder once, inside the paper (it travels with the card). */
  function ensureBlind(): HTMLElement {
    if (blind) return blind
    if (!paperEl) throw new Error('examinationRoom: coverSwap before attachSwipe')
    const el = document.createElement('div')
    el.className = 'lens-blind'
    el.hidden = true
    const label = document.createElement('p')
    label.className = 'lens-blind-label'
    label.setAttribute('role', 'status')
    label.setAttribute('aria-live', 'polite')
    label.textContent = 'Setting lenses…'
    el.appendChild(label)
    paperEl.appendChild(el)
    blind = el
    return el
  }

  /**
   * (Re)start a blind phase. `hideAfterMs` schedules the post-phase cleanup:
   * the panel hides only once its traverse has cleared into the wall — during
   * COVER it stays down however long the font gate takes (the previous
   * pairing must never be exposed mid-load).
   */
  function playBlind(phase: 'is-dropping' | 'is-lifting', hideAfterMs?: number): void {
    const el = ensureBlind()
    window.clearTimeout(blindTimer)
    el.classList.remove('is-dropping', 'is-lifting')
    el.hidden = false
    void getComputedStyle(el).transform // flush: adjacent same-phase swaps restart
    el.classList.add(phase)
    if (hideAfterMs !== undefined) {
      blindTimer = window.setTimeout(() => {
        el.hidden = true
        el.classList.remove('is-dropping', 'is-lifting')
      }, hideAfterMs)
    }
  }

  /** Hide the blind immediately (reduced motion taking over mid-swap). */
  function hideBlindNow(): void {
    window.clearTimeout(blindTimer)
    if (!blind) return
    blind.hidden = true
    blind.classList.remove('is-dropping', 'is-lifting')
  }

  /** The in-place loading state, shared by setLoading and the swap phases. */
  function applyLoading(loading: boolean): void {
    if (loading && bar.contains(document.activeElement)) {
      focusDuringSwap = document.activeElement as HTMLElement
    }
    root.dataset.state = loading ? 'loading' : 'ready'
    setBarDisabled(loading || exhaustedNow || explainerUp)
    saveLabel.textContent = loading ? 'Setting lenses…' : 'Save'
    if (!loading) {
      focusDuringSwap?.focus()
      focusDuringSwap = null
    }
  }

  /** End the lane's swap clip (scheduled — never while transforms play). */
  function unlockLaneSoon(): void {
    window.clearTimeout(lockTimer)
    lockTimer = window.setTimeout(() => lane.classList.remove('is-swapping'), LANE_UNLOCK_DELAY_MS)
  }

  /** The single gate every input path consults before judging. */
  function inputOpen(): boolean {
    return root.dataset.state === 'ready' && !exhaustedNow && !prescribingNow && !explainerUp
  }

  /** The single funnel: buttons, ←/→ keys, and committed swipes all call this. */
  function judge(verdict: Verdict): void {
    if (!inputOpen()) return
    judgeHandler?.(verdict)
  }

  function setBarDisabled(disabled: boolean): void {
    skipButton.disabled = disabled
    saveButton.disabled = disabled
  }

  // Buttons → funnel.
  skipButton.addEventListener('click', () => judge('skip'))
  saveButton.addEventListener('click', () => judge('save'))

  // T17 — the explainer gate's boot face: a fresh visit starts with the bar
  // stood down (the same STATES IN PLACE restyle loading/error/exhaustion
  // use, via [data-explainer]) so the one live act is the dismissal itself.
  // Returning examiners (dismissal persisted) never enter this state.
  if (explainerUp) {
    root.dataset.explainer = 'true'
    setBarDisabled(true)
  }

  // Keys → funnel. Arrows judge from anywhere in the room (buttons included —
  // a focused button does not natively bind arrows, so ← on Save judges skip,
  // exactly as the hint promises); only editable surfaces keep their native
  // arrow behavior. Repeat presses drop, matching the swipe (one gesture, one
  // verdict) and button semantics. The preventDefault is UNCONDITIONAL once a
  // key is claimed: ←/→ are the judgment controls, so their default action
  // (arrow-key scrolling of the lane — an overflow:hidden container is still
  // keyboard-scrollable when it contains focus) must never leak into the
  // examined page, gated input included.
  window.addEventListener('keydown', (event) => {
    if (event.repeat) return
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    if (
      event.target instanceof HTMLElement &&
      event.target.closest('input, textarea, select, [contenteditable]')
    ) {
      return
    }
    // T11: while the prescription pad is open the arrows belong to the pad
    // (its ledger scrolls; Escape is the route back) — the judgment keys are
    // not claimed at all, so their default behavior stays available there.
    if (prescribingNow) return
    event.preventDefault()
    if (!inputOpen()) return
    judge(event.key === 'ArrowRight' ? 'save' : 'skip')
  })

  // Prescription route → the registered handler (main.ts opens the view).
  prescription.addEventListener('click', () => prescriptionHandler?.())

  // Explainer dismissal → persist (T10 hook) → open the instrument → focus
  // continues at the first judgment control. The bar re-enables only if the
  // room is actually at rest (a dismissal during a load/error keeps it down —
  // those gates still own it).
  dismiss.addEventListener('click', () => {
    explainer.remove()
    explainerUp = false
    delete root.dataset.explainer
    setBarDisabled(root.dataset.state !== 'ready' || exhaustedNow)
    options.onExplainerDismissed?.()
    skipButton.focus()
  })

  // Reshuffle → the registered handler (main.ts: deck.reshuffle() + draw).
  reshuffle.addEventListener('click', () => reshuffleHandler?.())

  // Retry → the registered handler (main.ts: draw the next pairing). Only
  // live in the error state — the buttons and keys stay gated elsewhere.
  retry.addEventListener('click', () => {
    if (root.dataset.state !== 'error') return
    retryHandler?.()
  })

  return {
    root,
    lane,
    setLoading(loading: boolean): void {
      applyLoading(loading)
    },
    coverSwap(): void {
      swapError.hidden = true
      applyLoading(true) // STATES IN PLACE loading restyle + focus stash
      // Each new page is judged from its headline; reset the reading scroll
      // under cover so the arrival starts at the top.
      lane.scrollTop = 0
      if (prefersReducedMotion()) return // instant swap: no blind, no clip
      lane.classList.add('is-swapping')
      window.clearTimeout(lockTimer)
      playBlind('is-dropping') // stays down for the whole gate — no hide timer
    },
    revealSwap(): void {
      applyLoading(false) // state ready + focus restored — the moment is decoration, never a gate
      unlockLaneSoon()
      if (!blind) return // never covered (reduced motion): nothing to lift
      if (prefersReducedMotion()) {
        hideBlindNow() // setting changed mid-swap: un-cover instantly
        return
      }
      playBlind('is-lifting', BLIND_LIFT_MS + 80)
      // SNAP-STEP detent on the card: one step past the seat, settle.
      if (paperEl) {
        const paper = paperEl
        window.clearTimeout(detentTimer)
        paper.classList.remove('is-detenting')
        void getComputedStyle(paper).transform
        paper.classList.add('is-detenting')
        detentTimer = window.setTimeout(
          () => paper.classList.remove('is-detenting'),
          DETENT_TOTAL_MS + 120,
        )
      }
    },
    failSwap(): void {
      // Recoverable error state (STATES IN PLACE): the bar keeps its outlined
      // disabled restyle, the strip carries the notice, and the retry act is
      // the user's move. The previous pairing's variables were never touched.
      focusDuringSwap = null
      root.dataset.state = 'error'
      setBarDisabled(true)
      saveLabel.textContent = 'Save'
      swapError.hidden = false
      unlockLaneSoon()
      retry.focus()
      if (!blind) return
      if (prefersReducedMotion()) {
        hideBlindNow()
        return
      }
      playBlind('is-lifting', BLIND_LIFT_MS + 80) // same lift; no detent — nothing arrived
    },
    onRetrySwap(handler: () => void): void {
      retryHandler = handler
    },
    setExhausted(isExhausted: boolean): void {
      exhaustedNow = isExhausted
      exhaustion.hidden = !isExhausted
      if (isExhausted) swapError.hidden = true // exhaustion supersedes any swap error
      root.dataset.exhausted = String(isExhausted) // STATES IN PLACE restyle hook
      setBarDisabled(
        isExhausted || explainerUp || root.dataset.state === 'loading' || root.dataset.state === 'error',
      )
      if (isExhausted) reshuffle.focus()
    },
    setStorageDegraded(isDegraded: boolean): void {
      // Non-blocking by construction: the row only ever appears/disappears —
      // no act, no focus move, no control changes state for this notice.
      storageNotice.hidden = !isDegraded
    },
    updateMarkers(stats: DeckStats): void {
      rail.replaceChildren()
      for (let i = 0; i < stats.total; i += 1) {
        const tick = document.createElement('span')
        tick.className = 'marker-tick'
        if (i < stats.seen - 1) tick.classList.add('seen')
        if (i === stats.seen - 1) tick.classList.add('current')
        rail.appendChild(tick)
      }
      count.textContent = `${stats.seen} / ${stats.total} examined`
    },
    updatePrescription(saved: number): void {
      prescription.textContent = `Prescription · ${saved} saved`
    },
    onOpenPrescription(handler: () => void): void {
      prescriptionHandler = handler
    },
    setPrescribing(open: boolean): void {
      prescribingNow = open
      root.dataset.prescribing = String(open)
      // The covered regions stand down entirely (inert: not focusable, not
      // clickable) while the pad — a sibling overlay mounted by main.ts —
      // owns the interaction. Judgment is closed by the same flag through
      // inputOpen(), the one gate every input path consults.
      for (const region of [strip, lane, bar]) {
        if (open) region.setAttribute('inert', '')
        else region.removeAttribute('inert')
      }
    },
    focusPrescription(): void {
      prescription.focus()
    },
    onJudge(handler: (verdict: Verdict) => void): void {
      judgeHandler = handler
    },
    onReshuffle(handler: () => void): void {
      reshuffleHandler = handler
    },
    attachSwipe(paper: HTMLElement): void {
      paperEl = paper // the T09 blind + detent anchor to the same chart paper
      if (swipe) return
      swipe = attachSwipeController({
        surface: lane,
        paper,
        onSwipe: (direction) => judge(direction === 'left' ? 'skip' : 'save'),
        canBegin: inputOpen,
        // Mouse/pen drags that start on the essay's reading surface belong to
        // text selection, not judgment — swipe attaches to card chrome so it
        // never fights reading. Touch swipes anywhere on the paper.
        isProtectedTarget: (target, pointerType) =>
          pointerType !== 'touch' && target instanceof Element && !!target.closest('.dummy-sheet'),
      })
    },
  }
}
