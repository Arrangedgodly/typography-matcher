/**
 * T08 — Input parity: the gesture engine behind the card swipe.
 *
 * Design-brief §6: "Swipe attaches to card chrome so it never fights reading;
 * pointer-drag (touch + mouse), visible buttons, and ←/→ keys are equal
 * citizens." This module owns the pointer half of that parity — bar buttons
 * and arrow keys route through the same judgment funnel in
 * `src/components/examinationRoom.ts`, so all three inputs are identical in
 * effect by construction.
 *
 * Two layers, deliberately split:
 *
 * 1. **Pure core** (no DOM): intent arbitration, threshold/velocity commit,
 *    rubber-band resistance, velocity estimation. Every tunable constant is
 *    exported and every decision function is total — this is the layer the
 *    unit tests pin (plan T08: "threshold, intent arbitration, velocity
 *    snap").
 * 2. **DOM wiring** (`attachSwipeController`): Pointer Events API — mouse,
 *    touch, and pen arrive as one pointer stream, so drag behavior is unified
 *    by construction. Intent separation from inner scroll (mobile's reading
 *    mode) is likewise by construction:
 *
 *    - `touch-action: pan-y` on the swipe surface (chrome.css) hands vertical
 *      touch panning to the browser; when it takes over, the surface receives
 *      `pointercancel` and the drag aborts silently — scroll intent wins
 *      without a fight (acceptance: "swipe never fires while content scroll
 *      is active").
 *    - The pure arbiter provides the same separation for pointer types with
 *      no native scroll (mouse): movement below the slop is undecided noise;
 *      vertical wins ties.
 *    - Mouse/pen drags that START on the reading surface (the article text,
 *      where dragging means selection) are excluded by the caller's
 *      `isProtectedTarget` — swipe attaches to card chrome, never to text
 *      selection.
 *
 * Drag feedback: while horizontal intent is locked, the paper follows the
 * pointer with rubber-band resistance (inline `transform`, never
 * transitioned — direct manipulation is 1:1). On release it settles in
 * discrete steps (`.is-settling` in chrome.css — SNAP-STEP, nothing glides;
 * `prefers-reduced-motion` collapses the settle to an instant). The full
 * lens-swap choreography is T09's; this is the input's own feedback only.
 */

// ---------------------------------------------------------------------------
// Pure core
// ---------------------------------------------------------------------------

/** A committed swipe, in judgment vocabulary's spatial direction. */
export type SwipeDirection = 'left' | 'right'

/** Which axis owns this drag once it leaves the dead zone. */
export type DragIntent = 'undecided' | 'horizontal' | 'vertical'

/** Movement below this radius (px) is undecided noise, not intent. */
export const DEFAULT_SLOP_PX = 10

/** Horizontal travel (px) that commits a swipe on distance alone. */
export const DEFAULT_SWIPE_THRESHOLD_PX = 80

/** Flick velocity (px/ms) that commits a short, fast swipe. */
export const DEFAULT_FLICK_VELOCITY_PX_PER_MS = 0.55

/** Minimum travel (px) a flick must still show to commit (anti-jitter). */
export const DEFAULT_FLICK_MIN_TRAVEL_PX = 24

/** 1:1 follow zone (px) before rubber-band resistance begins. */
export const DEFAULT_RESISTANCE_FREE_PX = 56

/** Half-life-style damping scale (px) for displacement beyond the free zone. */
export const DEFAULT_RESISTANCE_SCALE_PX = 160

/** Timestamp window (ms) over which release velocity is estimated. */
export const DEFAULT_VELOCITY_WINDOW_MS = 100

/**
 * Decide which axis owns the drag. Total: any (dx, dy) maps to an intent.
 * Vertical (reading/scroll) intent wins ties — a diagonal gesture in a text
 * reader should scroll, not judge.
 */
export function arbitrateIntent(
  dx: number,
  dy: number,
  slopPx: number = DEFAULT_SLOP_PX,
): DragIntent {
  const absDx = Math.abs(dx)
  const absDy = Math.abs(dy)
  if (Math.max(absDx, absDy) < slopPx) return 'undecided'
  return absDy >= absDx ? 'vertical' : 'horizontal'
}

/** Thresholds that turn a released drag into a committed swipe. */
export interface SwipeThresholds {
  /** Travel (px) committing a swipe on distance alone. */
  thresholdPx: number
  /** Velocity (px/ms) committing a short fast swipe. */
  flickVelocityPxPerMs: number
  /** Minimum travel (px) a flick must still show. */
  flickMinTravelPx: number
}

export const DEFAULT_SWIPE_THRESHOLDS: SwipeThresholds = {
  thresholdPx: DEFAULT_SWIPE_THRESHOLD_PX,
  flickVelocityPxPerMs: DEFAULT_FLICK_VELOCITY_PX_PER_MS,
  flickMinTravelPx: DEFAULT_FLICK_MIN_TRAVEL_PX,
}

/**
 * Resolve a released drag to a swipe direction, or `null` when it should
 * settle back without judging. Commits on EITHER sufficient travel OR a
 * same-direction flick that still shows minimum travel; a flick whose velocity
 * points opposite the net travel never commits (the user changed their mind
 * mid-drag).
 */
export function resolveSwipe(
  dx: number,
  velocityPxPerMs: number,
  thresholds: SwipeThresholds = DEFAULT_SWIPE_THRESHOLDS,
): SwipeDirection | null {
  const travel = Math.abs(dx)
  const sameDirection = dx === 0 || velocityPxPerMs === 0 || Math.sign(velocityPxPerMs) === Math.sign(dx)
  const flick = sameDirection && Math.abs(velocityPxPerMs) >= thresholds.flickVelocityPxPerMs && travel >= thresholds.flickMinTravelPx
  if (travel >= thresholds.thresholdPx || flick) {
    return dx < 0 ? 'left' : 'right'
  }
  return null
}

/**
 * Rubber-band displacement: 1:1 inside the free zone, sublinear beyond it
 * (asymptotically approaching free + scale·px of excess — the paper follows
 * the finger with increasing resistance, never escaping it). Total, sign-
 * preserving, and always |result| <= |dx|.
 */
export function resistedDisplacement(
  dx: number,
  freePx: number = DEFAULT_RESISTANCE_FREE_PX,
  scalePx: number = DEFAULT_RESISTANCE_SCALE_PX,
): number {
  const abs = Math.abs(dx)
  if (abs <= freePx) return dx
  const excess = abs - freePx
  const damped = freePx + (excess / (1 + excess / scalePx)) * 1
  return dx < 0 ? -damped : damped
}

/** One timestamped horizontal position sample. */
export interface MotionSample {
  /** Event timestamp (the pointer event's `timeStamp`, ms origin). */
  time: number
  /** Client-x position (px). */
  x: number
}

/**
 * Estimate release velocity (px/ms) over the trailing window. Deterministic:
 * fewer than two in-window samples, or a non-positive dt, yield 0 — never
 * NaN, never Infinity.
 */
export function velocityFromSamples(
  samples: readonly MotionSample[],
  now: number,
  windowMs: number = DEFAULT_VELOCITY_WINDOW_MS,
): number {
  const recent = samples.filter((sample) => now - sample.time <= windowMs)
  if (recent.length < 2) return 0
  const first = recent[0]
  const last = recent[recent.length - 1]
  const dt = last.time - first.time
  if (dt <= 0) return 0
  return (last.x - first.x) / dt
}

// ---------------------------------------------------------------------------
// DOM wiring
// ---------------------------------------------------------------------------

/** Elements whose activation must not be hijacked by a drag. */
const INTERACTIVE_SELECTOR = 'button, a, input, textarea, select, summary, [contenteditable]'

/** How long the settle class stays on after release (ms; cosmetic cleanup). */
const SETTLE_CLASS_MS = 320

export interface SwipeControllerOptions {
  /** The swipe surface — pointer events are listened for here (the acuity lane). */
  surface: HTMLElement
  /** The element that follows the pointer and settles back (the chart paper). */
  paper: HTMLElement
  /** The committed-swipe callback — route it through the same funnel as buttons/keys. */
  onSwipe(direction: SwipeDirection): void
  /** Gate evaluated at pointerdown; closed ⇒ no drag begins (loading/exhausted). */
  canBegin?(): boolean
  /**
   * Extra pointerdown exclusion by target and pointer type — the reading
   * surface for mouse/pen (dragging text means selection, not judgment).
   */
  isProtectedTarget?(target: EventTarget | null, pointerType: string): boolean
}

export interface SwipeController {
  /** Remove all listeners and reset the paper. Idempotent. */
  detach(): void
}

interface DragSession {
  readonly pointerId: number
  readonly startX: number
  readonly startY: number
  intent: DragIntent
  samples: MotionSample[]
}

/**
 * Wire a pointer-drag swipe. One active pointer at a time; multi-touch
 * second fingers are ignored. The surface's `touch-action: pan-y` (chrome.css)
 * keeps vertical touch scrolling native — the browser cancels our pointer
 * stream (`pointercancel`) the moment it starts panning, which is the
 * production-grade intent separation; the arbiter covers mouse, where no
 * native scroll exists.
 */
export function attachSwipeController(options: SwipeControllerOptions): SwipeController {
  const { surface, paper, onSwipe } = options

  let session: DragSession | null = null
  let settleTimer: ReturnType<typeof setTimeout> | null = null
  let detached = false

  function clearSettleTimer(): void {
    if (settleTimer !== null) {
      clearTimeout(settleTimer)
      settleTimer = null
    }
  }

  /** Release the paper back to rest with the snap-step settle. */
  function settlePaper(): void {
    clearSettleTimer()
    surface.classList.remove('is-swiping')
    paper.classList.remove('is-swiping')
    if (paper.classList.contains('is-settling')) {
      paper.classList.remove('is-settling')
      // Force a style flush so the settle transition restarts cleanly when
      // two swipes land close together.
      void getComputedStyle(paper).transform
    }
    paper.classList.add('is-settling')
    paper.style.transform = ''
    settleTimer = setTimeout(() => paper.classList.remove('is-settling'), SETTLE_CLASS_MS)
  }

  function endSession(): void {
    session = null
    surface.classList.remove('is-swiping')
  }

  function onPointerDown(event: PointerEvent): void {
    if (detached || session !== null) return // one pointer at a time
    if (event.pointerType === 'mouse' && event.button !== 0) return
    if (event.target instanceof Element && event.target.closest(INTERACTIVE_SELECTOR)) return
    if (options.isProtectedTarget?.(event.target, event.pointerType)) return
    if (options.canBegin && !options.canBegin()) return

    session = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      intent: 'undecided',
      samples: [{ time: event.timeStamp, x: event.clientX }],
    }
  }

  function onPointerMove(event: PointerEvent): void {
    if (detached || session === null || event.pointerId !== session.pointerId) return

    const dx = event.clientX - session.startX
    const dy = event.clientY - session.startY

    if (session.intent === 'undecided') {
      const intent = arbitrateIntent(dx, dy)
      if (intent === 'undecided') return
      if (intent === 'vertical') {
        // Reading/scroll intent won — abandon without touching the page.
        endSession()
        return
      }
      session.intent = 'horizontal'
      // Own the rest of the gesture (best effort: engines without capture
      // still work while the pointer stays on the surface).
      try {
        surface.setPointerCapture(session.pointerId)
      } catch {
        /* not fatal */
      }
      surface.classList.add('is-swiping')
      paper.classList.add('is-swiping')
      // A mouse drag that locked horizontal may have begun a text selection
      // on the way to the slop — judgment owns the gesture now, selection
      // does not.
      try {
        window.getSelection()?.removeAllRanges()
      } catch {
        /* selection unavailable */
      }
    }

    paper.style.transform = `translate3d(${resistedDisplacement(dx)}px, 0, 0)`

    // Velocity samples: trailing window only, so a long slow drag followed by
    // a flick still reads as a flick.
    session.samples.push({ time: event.timeStamp, x: event.clientX })
    const cutoff = event.timeStamp - DEFAULT_VELOCITY_WINDOW_MS * 2
    while (session.samples.length > 2 && session.samples[0].time < cutoff) {
      session.samples.shift()
    }
  }

  function onPointerUp(event: PointerEvent): void {
    if (detached || session === null || event.pointerId !== session.pointerId) return
    if (session.intent === 'horizontal') {
      const dx = event.clientX - session.startX
      const velocity = velocityFromSamples(session.samples, event.timeStamp)
      settlePaper()
      const direction = resolveSwipe(dx, velocity)
      if (direction) onSwipe(direction)
    }
    endSession()
  }

  function onPointerCancel(event: PointerEvent): void {
    if (session === null || event.pointerId !== session.pointerId) return
    // The browser took the gesture (inner scroll, system gesture) — scroll
    // intent won; restore the paper, judge nothing.
    if (session.intent === 'horizontal') settlePaper()
    endSession()
  }

  surface.addEventListener('pointerdown', onPointerDown)
  surface.addEventListener('pointermove', onPointerMove)
  surface.addEventListener('pointerup', onPointerUp)
  surface.addEventListener('pointercancel', onPointerCancel)

  return {
    detach(): void {
      if (detached) return
      detached = true
      endSession()
      clearSettleTimer()
      paper.classList.remove('is-swiping', 'is-settling')
      paper.style.transform = ''
      surface.removeEventListener('pointerdown', onPointerDown)
      surface.removeEventListener('pointermove', onPointerMove)
      surface.removeEventListener('pointerup', onPointerUp)
      surface.removeEventListener('pointercancel', onPointerCancel)
    },
  }
}
