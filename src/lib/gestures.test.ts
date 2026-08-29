// @vitest-environment jsdom
/**
 * T08 unit tests — the gesture engine's two layers (src/lib/gestures.ts):
 *
 * - Pure core: intent arbitration (vertical/scroll wins ties), threshold +
 *   flick commit (velocity snap), rubber-band resistance, velocity estimation.
 *   Every function total — no NaN/Infinity paths.
 * - DOM wiring: pointer events drive the paper's inline transform, commit on
 *   release, and refuse to start on interactive targets, protected reading
 *   surfaces, closed gates, and non-primary mouse buttons; pointercancel
 *   (the browser taking over for inner scroll) aborts without judging.
 *
 * jsdom 29 constructs real PointerEvents; `timeStamp` is not in PointerEventInit,
 * so flick timing is injected by shadowing the instance property.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_SWIPE_THRESHOLD_PX,
  arbitrateIntent,
  attachSwipeController,
  resistedDisplacement,
  resolveSwipe,
  velocityFromSamples,
  type SwipeControllerOptions,
  type SwipeDirection,
} from './gestures'

// ---------------------------------------------------------------------------
// Pure core — intent arbitration
// ---------------------------------------------------------------------------

describe('arbitrateIntent', () => {
  it('stays undecided inside the slop dead zone', () => {
    expect(arbitrateIntent(9, 9)).toBe('undecided')
    expect(arbitrateIntent(0, 9)).toBe('undecided')
    expect(arbitrateIntent(-9, 4)).toBe('undecided')
  })

  it('locks horizontal on dominant horizontal travel', () => {
    expect(arbitrateIntent(40, 5)).toBe('horizontal')
    expect(arbitrateIntent(-40, -5)).toBe('horizontal')
    expect(arbitrateIntent(40, 0)).toBe('horizontal')
  })

  it('locks vertical on dominant vertical travel (scroll intent)', () => {
    expect(arbitrateIntent(5, 40)).toBe('vertical')
    expect(arbitrateIntent(-5, 40)).toBe('vertical')
    expect(arbitrateIntent(0, 40)).toBe('vertical')
  })

  it('vertical wins ties — diagonal gestures in a reader scroll, not judge', () => {
    expect(arbitrateIntent(30, 30)).toBe('vertical')
    expect(arbitrateIntent(-30, 30)).toBe('vertical')
  })

  it('horizontal wins only when strictly dominant past the slop', () => {
    expect(arbitrateIntent(31, 30)).toBe('horizontal')
    expect(arbitrateIntent(30, 31)).toBe('vertical')
  })

  it('honors an injected slop radius', () => {
    expect(arbitrateIntent(40, 0, 50)).toBe('undecided')
    expect(arbitrateIntent(40, 0, 40)).toBe('horizontal')
  })
})

// ---------------------------------------------------------------------------
// Pure core — commit (threshold + velocity snap)
// ---------------------------------------------------------------------------

describe('resolveSwipe', () => {
  it('commits on distance past the threshold, either direction', () => {
    expect(resolveSwipe(DEFAULT_SWIPE_THRESHOLD_PX, 0)).toBe('right')
    expect(resolveSwipe(-DEFAULT_SWIPE_THRESHOLD_PX, 0)).toBe('left')
    expect(resolveSwipe(200, 0)).toBe('right')
    expect(resolveSwipe(-200, 0)).toBe('left')
  })

  it('refuses a short, slow drag', () => {
    expect(resolveSwipe(60, 0.1)).toBeNull()
    expect(resolveSwipe(-60, -0.1)).toBeNull()
    expect(resolveSwipe(0, 0)).toBeNull()
  })

  it('velocity snap: a same-direction flick commits short of the distance threshold', () => {
    expect(resolveSwipe(50, 1.2)).toBe('right')
    expect(resolveSwipe(-50, -1.2)).toBe('left')
  })

  it('a flick below the velocity threshold does not commit', () => {
    expect(resolveSwipe(50, 0.5)).toBeNull()
  })

  it('a flick pointing opposite the net travel never commits', () => {
    expect(resolveSwipe(50, -1.5)).toBeNull()
    expect(resolveSwipe(-50, 1.5)).toBeNull()
  })

  it('a very fast jitter below minimum travel does not commit', () => {
    expect(resolveSwipe(10, 5)).toBeNull()
    expect(resolveSwipe(-10, -5)).toBeNull()
  })

  it('honors injected thresholds', () => {
    const thresholds = { thresholdPx: 30, flickVelocityPxPerMs: 0.8, flickMinTravelPx: 10 }
    expect(resolveSwipe(31, 0, thresholds)).toBe('right')
    expect(resolveSwipe(20, 0.9, thresholds)).toBe('right')
    expect(resolveSwipe(20, 0.79, thresholds)).toBeNull()
    expect(resolveSwipe(29, 0, thresholds)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Pure core — rubber-band resistance
// ---------------------------------------------------------------------------

describe('resistedDisplacement', () => {
  it('is 1:1 inside the free travel zone', () => {
    expect(resistedDisplacement(0)).toBe(0)
    expect(resistedDisplacement(55)).toBe(55)
    expect(resistedDisplacement(-55)).toBe(-55)
    expect(resistedDisplacement(56)).toBe(56)
  })

  it('damps beyond the free zone and never exceeds the raw drag', () => {
    const raw = 156 // free 56 + 100 excess
    const damped = resistedDisplacement(raw)
    expect(damped).toBeGreaterThan(56)
    expect(damped).toBeLessThan(raw)
    expect(damped).toBeCloseTo(117.54, 1)
  })

  it('preserves sign symmetrically', () => {
    expect(resistedDisplacement(-156)).toBeCloseTo(-resistedDisplacement(156), 10)
  })

  it('grows monotonically — no snap-back inside the resistance curve', () => {
    let prev = -Infinity
    for (let drag = 0; drag <= 600; drag += 25) {
      const value = resistedDisplacement(drag)
      expect(value).toBeGreaterThanOrEqual(prev)
      prev = value
    }
  })
})

// ---------------------------------------------------------------------------
// Pure core — velocity estimation
// ---------------------------------------------------------------------------

describe('velocityFromSamples', () => {
  it('computes px/ms over the trailing samples', () => {
    const samples = [
      { time: 0, x: 100 },
      { time: 50, x: 150 },
      { time: 100, x: 200 },
    ]
    expect(velocityFromSamples(samples, 100)).toBe(1)
  })

  it('is negative for leftward motion', () => {
    const samples = [
      { time: 0, x: 200 },
      { time: 40, x: 120 },
    ]
    expect(velocityFromSamples(samples, 40)).toBe(-2)
  })

  it('ignores samples outside the window (a long slow drag then flick reads as a flick)', () => {
    const samples = [
      { time: 0, x: 0 },
      { time: 500, x: 40 }, // slow phase, outside the 100ms window
      { time: 560, x: 130 }, // flick phase
    ]
    expect(velocityFromSamples(samples, 560)).toBeCloseTo(1.5, 5)
  })

  it('returns 0 for fewer than two samples, never NaN', () => {
    expect(velocityFromSamples([], 100)).toBe(0)
    expect(velocityFromSamples([{ time: 100, x: 50 }], 100)).toBe(0)
  })

  it('returns 0 when timestamps collapse (dt <= 0)', () => {
    const samples = [
      { time: 100, x: 50 },
      { time: 100, x: 80 },
    ]
    expect(velocityFromSamples(samples, 100)).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// DOM wiring
// ---------------------------------------------------------------------------

/** Build a real PointerEvent with the fields jsdom's init dict cannot set. */
function pointerEvent(
  type: string,
  opts: { x: number; y: number; pointerType?: string; pointerId?: number; time?: number; button?: number },
): PointerEvent {
  const event = new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    composed: true,
    clientX: opts.x,
    clientY: opts.y,
    button: opts.button ?? 0,
    pointerType: opts.pointerType ?? 'mouse',
    pointerId: opts.pointerId ?? 1,
  })
  if (opts.time !== undefined) {
    Object.defineProperty(event, 'timeStamp', { value: opts.time })
  }
  return event
}

function setup(overrides: Partial<SwipeControllerOptions> = {}) {
  const surface = document.createElement('div')
  const paper = document.createElement('div')
  const button = document.createElement('button')
  const reading = document.createElement('div')
  reading.className = 'dummy-sheet'
  paper.append(button, reading)
  surface.appendChild(paper)
  document.body.append(surface)

  const onSwipe = vi.fn<(direction: SwipeDirection) => void>()
  const options: SwipeControllerOptions = {
    surface,
    paper,
    onSwipe,
    // The Examination Room policy: mouse/pen drags starting on the reading
    // surface belong to text selection, not judgment; touch swipes anywhere.
    isProtectedTarget: (target, pointerType) =>
      pointerType !== 'touch' && target instanceof Element && !!target.closest('.dummy-sheet'),
    ...overrides,
  }
  const controller = attachSwipeController(options)
  return { surface, paper, button, reading, onSwipe, controller }
}

/**
 * Drag with explicit timestamps. jsdom does no hit-testing, so events are
 * dispatched where the real browser would send them: pointerdown on the
 * pressed target (bubbling to the surface's listener), move/up on the paper
 * (a surface child — with real pointer capture the browser retargets moves
 * to the surface itself; bubbling is the capture-free equivalent).
 */
function drag(opts: {
  surface: HTMLElement
  paper: HTMLElement
  beginTarget: Element
  from: [number, number]
  to: [number, number]
  steps?: number
  pointerType?: string
  pointerId?: number
  t0?: number
  durationMs?: number
}): string[] {
  const {
    paper, beginTarget, from, to, steps = 6, pointerType = 'mouse', pointerId = 1,
    t0 = 1000, durationMs = 0,
  } = opts
  const [x0, y0] = from
  const [x1, y1] = to
  const transforms: string[] = []

  beginTarget.dispatchEvent(
    pointerEvent('pointerdown', { x: x0, y: y0, pointerType, pointerId, time: t0 }),
  )
  for (let i = 1; i <= steps; i += 1) {
    const x = x0 + ((x1 - x0) * i) / steps
    const y = y0 + ((y1 - y0) * i) / steps
    paper.dispatchEvent(
      pointerEvent('pointermove', {
        x, y, pointerType, pointerId, time: t0 + (durationMs * i) / steps,
      }),
    )
    transforms.push(paper.style.transform)
  }
  paper.dispatchEvent(
    pointerEvent('pointerup', { x: x1, y: y1, pointerType, pointerId, time: t0 + durationMs }),
  )
  return transforms
}

describe('attachSwipeController wiring', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('follows the paper with resistance, then commits a right swipe past the threshold', () => {
    const { surface, paper, onSwipe } = setup()
    const transforms = drag({ surface, paper, beginTarget: surface, from: [200, 300], to: [400, 300] })
    // Paper followed the drag (first meaningful move beyond slop engages).
    expect(transforms.some((t) => t.includes('translate3d('))).toBe(true)
    // Long drag is resisted: |transform| < |raw dx| well past the free zone.
    const lastMove = transforms[transforms.length - 1]
    const applied = Math.abs(Number(/translate3d\(([-\d.]+)px/.exec(lastMove)?.[1] ?? 0))
    expect(applied).toBeGreaterThan(0)
    expect(applied).toBeLessThan(200)
    expect(onSwipe).toHaveBeenCalledWith('right')
    expect(onSwipe).toHaveBeenCalledTimes(1)
    // Settled back to rest.
    expect(paper.style.transform).toBe('')
  })

  it('commits a left swipe for leftward travel', () => {
    const { surface, paper, onSwipe } = setup()
    drag({ surface, paper, beginTarget: surface, from: [400, 300], to: [180, 300] })
    expect(onSwipe).toHaveBeenCalledWith('left')
  })

  it('a short slow drag settles back without judging', () => {
    const { surface, paper, onSwipe } = setup()
    drag({ surface, paper, beginTarget: surface, from: [200, 300], to: [245, 302], steps: 5, durationMs: 600 })
    expect(onSwipe).not.toHaveBeenCalled()
    expect(paper.style.transform).toBe('')
  })

  it('velocity snap: a short fast flick commits under the distance threshold', () => {
    const { surface, paper, onSwipe } = setup()
    // 50px of travel in 60ms ⇒ ~0.83 px/ms ≥ 0.55 flick threshold.
    drag({ surface, paper, beginTarget: surface, from: [200, 300], to: [250, 300], steps: 5, durationMs: 60 })
    expect(onSwipe).toHaveBeenCalledWith('right')
  })

  it('vertical drag never engages the paper (scroll intent wins)', () => {
    const { surface, paper, onSwipe } = setup()
    drag({ surface, paper, beginTarget: surface, from: [200, 300], to: [210, 500] })
    expect(paper.style.transform).toBe('')
    expect(onSwipe).not.toHaveBeenCalled()
  })

  it('pointercancel mid-drag aborts without judging (browser took over inner scroll)', () => {
    const { surface, paper, onSwipe } = setup()
    surface.dispatchEvent(pointerEvent('pointerdown', { x: 200, y: 300, time: 1000 }))
    paper.dispatchEvent(pointerEvent('pointermove', { x: 280, y: 304, time: 1010 }))
    expect(paper.style.transform).toContain('translate3d(')
    paper.dispatchEvent(pointerEvent('pointercancel', { x: 280, y: 304, time: 1020 }))
    expect(paper.style.transform).toBe('')
    expect(onSwipe).not.toHaveBeenCalled()
  })

  it('never starts on interactive targets (the judgment bar buttons, essay controls)', () => {
    const { surface, paper, button, onSwipe } = setup()
    drag({ surface, paper, beginTarget: button, from: [10, 5], to: [210, 5] })
    expect(onSwipe).not.toHaveBeenCalled()
    expect(paper.style.transform).toBe('')
  })

  it('never starts on the protected reading surface for mouse — but touch swipes there', () => {
    const { surface, paper, reading, onSwipe } = setup()
    drag({ surface, paper, beginTarget: reading, from: [10, 10], to: [210, 10] })
    expect(onSwipe).not.toHaveBeenCalled()
    drag({ surface, paper, beginTarget: reading, from: [10, 10], to: [210, 10], pointerType: 'touch' })
    expect(onSwipe).toHaveBeenCalledWith('right')
    expect(paper.style.transform).toBe('')
  })
  it('respects a closed gate (loading / exhausted)', () => {
    const { surface, paper, onSwipe } = setup({ canBegin: () => false })
    drag({ surface, paper, beginTarget: surface, from: [200, 300], to: [400, 300] })
    expect(onSwipe).not.toHaveBeenCalled()
  })

  it('ignores non-primary mouse buttons', () => {
    const { surface, paper } = setup()
    surface.dispatchEvent(pointerEvent('pointerdown', { x: 200, y: 300, button: 2 }))
    paper.dispatchEvent(pointerEvent('pointermove', { x: 400, y: 300 }))
    paper.dispatchEvent(pointerEvent('pointerup', { x: 400, y: 300 }))
    expect(paper.style.transform).toBe('')
  })

  it('ignores a second pointer while a drag is active', () => {
    const { surface, paper, onSwipe } = setup()
    surface.dispatchEvent(pointerEvent('pointerdown', { x: 200, y: 300, pointerId: 1, time: 1000 }))
    paper.dispatchEvent(pointerEvent('pointerdown', { x: 300, y: 300, pointerId: 2, time: 1005 }))
    paper.dispatchEvent(pointerEvent('pointermove', { x: 400, y: 300, pointerId: 1, time: 1010 }))
    paper.dispatchEvent(pointerEvent('pointerup', { x: 400, y: 300, pointerId: 1, time: 1020 }))
    expect(onSwipe).toHaveBeenCalledTimes(1)
    expect(paper.style.transform).toBe('')
  })

  it('detach removes listeners and resets the paper', () => {
    const { surface, paper, onSwipe, controller } = setup()
    controller.detach()
    drag({ surface, paper, beginTarget: surface, from: [200, 300], to: [400, 300] })
    expect(onSwipe).not.toHaveBeenCalled()
    expect(paper.style.transform).toBe('')
    expect(paper.classList.contains('is-settling')).toBe(false)
  })
})
