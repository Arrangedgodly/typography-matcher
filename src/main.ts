import './style.css'
import './styles/dummy.css'
import './styles/chrome.css'
import './styles/motion.css'
import './styles/prescription.css'

import { renderExaminationRoom, type Verdict } from './components/examinationRoom'
import { renderDummyPage, applyPairing } from './components/dummyPage'
import { pairings } from './data/pairings'
import { createDeck } from './lib/deck'
import { loadPairingFonts, releasePairingFonts, type FontLoadHandle } from './lib/fontLoader'
import { createAppStorage, EXPLAINER_DISMISSED_FLAG, CURRENT_PAIRING_KEY } from './lib/storage'
import { createSavedListView } from './views/savedList'
import type { Pairing } from './types'
import { pairingFonts } from './types'

/**
 * T08/T09 wiring: the Examination Room chrome (T07) around the T05 essay,
 * driven by the T06 deck through T04's gate in R2's caller order —
 *
 *   chrome.coverSwap()                                      // occluder down
 *   const next = await loadPairingFonts(pairingFonts(p))    // gate passes
 *   applyPairing(p)                                         // variables only
 *   await frame                                             // swap has painted
 *   releasePairingFonts(prev)                               // evict old faces
 *   chrome.revealSwap()                                     // occluder lifts
 *
 * The T09 choreography sequences with the gate (plan R2 note): the occluder
 * covers the paper for the WHOLE load — the previous pairing stays rendered
 * beneath it and the CSS font variables swap only when the gate has passed
 * (fonts decoded + double-rAF), so there is never a blank or fallback-glyph
 * window to judge (criterion 1). The reveal — the blind's whole-card-height
 * departure plus the card's one-step-overshoot-and-settle detent — runs only
 * AFTER the variable swap has painted and the old stylesheet is released.
 * `prefers-reduced-motion` collapses the moment to an instant swap (the
 * room's cover/reveal phases become no-ops; the loading STATE remains).
 * A failed gate (4000 ms budget) never hangs: the blind lifts, the previous
 * pairing stands unchanged, and the strip offers the retry act.
 *
 * Input parity (acceptance criterion 2): the judgment bar buttons, the
 * ←/→ keys, and the pointer-drag swipe on the card chrome all arrive through
 * the chrome's single judgment funnel — one handler here, identical state
 * transitions by construction. The swipe is attached to the lane/paper via
 * `chrome.attachSwipe()`.
 *
 * Judgment semantics (persisted by T10's storage layer, D2 = localStorage):
 * - **save** records the on-wall pairing in the save list (deduped by id — a
 *   re-judged cycle cannot double-count a save) and advances.
 * - **skip** advances.
 * - Exhaustion is a state, not an event (D7): when the deck has nothing
 *   unseen left, judgment disables and the strip offers an explicit
 *   Reshuffle — never an automatic wrap-around. The seen-set, the save list,
 *   and the first-run explainer dismissal all survive reload while storage
 *   is available; when it is not (private mode, blocked, quota), the same
 *   interface serves from memory for the session and the strip carries the
 *   non-blocking storage notice (criterion 7). T11 wires the prescription
 *   list's reveal.
 *
 * T11 — the prescription view (src/views/savedList.ts): the strip's
 * "Prescription · N saved" ledger is the route to the reveal. Opening it
 * resolves the saved ids against the same ledger boot-resolve built (D2
 * ids-only records) and hands the PAIRING RECORDS to the view — family
 * names enter the DOM only inside the pad, and closing strips them, so the
 * strict reveal (D6) holds at grep level in every review state. While the
 * pad is open the room stands down (regions inert, judgment keys unclaimed,
 * swipes gated); the back act, the scrim, or Escape return focus to the
 * route control. Removal is a whole-list write through storage.saves
 * (T10's contract), so the ledger survives reload.
 */

const app = document.querySelector<HTMLElement>('#app')
if (!app) throw new Error('main: #app mount not found')

// T10 — the storage layer, probed once here. Healthy localStorage ⇒ saves,
// seen-set, and the explainer dismissal persist; anything else ⇒ the same
// interface from memory + the strip notice. Either way the session works.
const storage = createAppStorage()

const chrome = renderExaminationRoom({
  explainerDismissed: storage.flags.get(EXPLAINER_DISMISSED_FLAG),
  onExplainerDismissed: () => storage.flags.set(EXPLAINER_DISMISSED_FLAG, true),
})
const page = renderDummyPage()
chrome.lane.appendChild(page)
app.appendChild(chrome.root)

// The swipe's drag feedback rides the chart paper itself (design-brief §6).
const paper = page.querySelector<HTMLElement>('.dummy-frame')
if (paper) chrome.attachSwipe(paper)

const deck = createDeck(pairings, { seenStore: storage.seen })

// Persisted saves (T10): ids only (D2 minimal records) resolved against the
// bundled dataset — ids the dataset no longer contains are pruned, the same
// stale-id rule the deck applies to the seen-set. Judgment order preserved.
const savedIds = new Set<string>()
const savedPairings: Pairing[] = []
for (const id of storage.saves.load()) {
  const pairing = pairings.find((p) => p.id === id)
  if (!pairing || savedIds.has(id)) continue
  savedIds.add(id)
  savedPairings.push(pairing)
}
chrome.updatePrescription(savedPairings.length)

// One registration covers both timings: boot-time unavailability fires the
// handler immediately on registration, a mid-session quota loss fires it
// then. The notice is non-blocking — the examination never stops for it.
storage.onDegraded(() => chrome.setStorageDegraded(true))

// T11 — the prescription view. The pad overlays the room in place (it is an
// absolutely-positioned child of the room, so it inherits the palette and
// the chrome face while the room's own rows stand down inert beneath it).
const prescriptionView = createSavedListView({
  onBack: () => {
    chrome.setPrescribing(false) // room takes the interaction back (un-inert)
    chrome.focusPrescription() // the keyboard journey continues from the route
  },
  onRemove: (id) => {
    savedIds.delete(id)
    const index = savedPairings.findIndex((p) => p.id === id)
    if (index !== -1) savedPairings.splice(index, 1)
    storage.saves.save([...savedIds]) // remove = whole-list write (T10 contract)
    chrome.updatePrescription(savedPairings.length) // the strip ledger follows live
  },
})
chrome.root.appendChild(prescriptionView.root)
chrome.onOpenPrescription(() => {
  // The reveal, and the ONLY place records become names: the pad renders
  // from the resolved ledger above (boot-resolved + this session's saves,
  // deduped by id, judgment order preserved).
  prescriptionView.open(savedPairings.slice())
  chrome.setPrescribing(true)
})

let currentHandle: FontLoadHandle | null = null
let current: Pairing | null = null
let swapping = false

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()))
}

function recordSave(): void {
  if (!current || savedIds.has(current.id)) return
  savedIds.add(current.id)
  savedPairings.push(current)
  storage.saves.save([...savedIds]) // whole-list write — survives reload when storage can
  chrome.updatePrescription(savedPairings.length)
}

/**
 * The one R2 swap sequence every mount of a pairing runs through — a fresh
 * draw and the reload-restore both: cover, gate, variables, confirmed paint,
 * release, reveal. Persists the on-wall pairing id (T10) so a reload can
 * restore the SAME pairing instead of consuming a new one.
 */
async function swapTo(pairing: Pairing): Promise<void> {
  swapping = true
  chrome.coverSwap() // T09: occluder down for the whole load (previous pairing stays rendered beneath)
  try {
    const next = await loadPairingFonts(pairingFonts(pairing))
    applyPairing(pairing) // variables only — faces already decoded
    await nextFrame() // the swap has painted before the old faces are evicted
    releasePairingFonts(currentHandle)
    currentHandle = next
    current = pairing
    storage.strings.set(CURRENT_PAIRING_KEY, pairing.id)
    chrome.updateMarkers(deck.stats())
    chrome.revealSwap() // T09: reveal AFTER gate + double-rAF + confirmed paint + release
  } catch (err) {
    // Gate failure (4000 ms budget): the previous pairing stays on the wall —
    // its variables were never touched — and the strip carries the
    // recoverable error state with the retry act (T09). FontLoadError
    // carries reason codes and slot/weight facts only (D6) — no family
    // names — so this is safe to log where no name can leak.
    console.warn('main: pairing failed to load — kept current', err)
    chrome.updateMarkers(deck.stats()) // the failed draw consumed a pairing
    chrome.failSwap()
  } finally {
    swapping = false
  }
}

/**
 * Apply a judgment (or 'first' for the initial/reshuffle draw) and advance.
 *
 * ORDER IS LOAD-BEARING: the verdict is recorded on the on-wall pairing
 * BEFORE the deck is consulted — exhaustion changes what happens NEXT (stop
 * advancing + the D7 state), never whether the judgment counts. The verdict
 * that exhausts the deck is still a verdict: a save on the cycle's LAST
 * pairing must reach the prescription (skip needs no equivalent — it has no
 * side effect).
 */
async function advance(verdict: Verdict | 'first'): Promise<void> {
  if (swapping) return // in-flight judgments drop, not queue
  if (verdict === 'save') recordSave() // the save targets the on-wall pairing
  const rootWasError = chrome.root.dataset.state === 'error'
  const draw = deck.draw()
  if (draw.status === 'exhausted') {
    // A retry that finds the deck exhausted must not stay stuck in the error
    // state: return the room to rest, then let D7 take the stage.
    if (rootWasError) chrome.setLoading(false)
    chrome.setExhausted(true) // D7: the user reshuffles — never the deck
    return
  }
  await swapTo(draw.pairing)
}

chrome.onJudge((verdict) => void advance(verdict))

// Retry (T09 error state): draw the next pairing — the same advance path
// with no verdict (the on-wall pairing was already judged before its draw).
chrome.onRetrySwap(() => {
  if (swapping) return
  void advance('first')
})

chrome.onReshuffle(() => {
  if (swapping) return
  deck.reshuffle() // clears the seen-set (in memory + the store seam)
  chrome.setExhausted(false)
  void advance('first') // the fresh draw persists its own id as the on-wall pairing
})

// Boot: restore the on-wall pairing a previous session persisted, so a
// reload returns to the SAME examination — a refresh must never consume a
// fresh unseen pairing (that would be an implicit skip the user never
// made). The id resolves against the bundled dataset (deck.recall is
// read-only); a stale id, or no record at all, falls back to a fresh draw.
// The page renders on the system fallback stacks beneath the occluder (born
// covered — no fallback-glyph window is ever judgeable), then flips faces
// the moment the gate passes and the blind lifts on the reveal (css2
// display=block only affects text that already targets the family, and no
// text does until applyPairing runs).
async function boot(): Promise<void> {
  const lastId = storage.strings.get(CURRENT_PAIRING_KEY)
  const restore = lastId ? deck.recall(lastId) : null
  if (restore) {
    await swapTo(restore)
    // A reload after the cycle closed re-parks in the D7 state: the last
    // pairing stands, judgment is closed, Reshuffle is the user's act.
    if (deck.stats().exhausted) chrome.setExhausted(true)
    return
  }
  await advance('first')
}
void boot()
