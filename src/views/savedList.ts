/**
 * T11 — the prescription view: where the blind test ends and the identities
 * are written (design-brief §3, town-hall D6, acceptance criteria 3 + 11).
 *
 * The strict reveal is a DOM property here, not a promise: `open()` is the
 * only code path in the app that mints a family name into text content, and
 * `close()` empties the pad — a closed (or never-opened) prescription view
 * leaves zero family names anywhere in the document, grep-level clean in
 * every review state. The saved ids themselves (T10, ids-only per D2) are
 * resolved into records by the caller's in-memory ledger before `open()`;
 * nothing name-bearing persists anywhere but this view's live DOM.
 *
 * Aesthetic (LEADER-LINE REVEAL, design-brief raise): the saved list is an
 * optician's prescription pad placed over the examination room — a chart-
 * paper sheet carrying one engineering annotation per save: the ROLE label,
 * a leader line (origin dot → arrowhead terminal), and the family name at
 * its terminal, with category + archetype tags in the metadata register
 * under each name. Names are set in the chrome's own hand (IBM Plex Sans):
 * the examiner writes the prescription; the faces were already judged on the
 * wall. A reveal that specimen-rendered names in their own faces would need
 * the network at the exact moment it exists to deliver names — offline, a
 * failed css2 fetch must never hide what was saved.
 *
 * The pad arrives in one stepped rise (nothing glides — the world's motion
 * rule, styles/prescription.css) and leaves instantly;
 * `prefers-reduced-motion` collapses the rise to an instant mount.
 *
 * Interaction contract:
 * - Route IN: the strip's "Prescription · N saved" control (T07 chrome,
 *   wired by main.ts) — a real button, keyboard-reachable, works at 0 saved
 *   (the empty state is a designed state, design-brief §5).
 * - Route OUT: the back act, the scrim, or Escape — one `onBack` funnel;
 *   main.ts un-inerts the room and returns focus to the route control.
 * - REMOVE: whole-list persistence is the caller's job (`onRemove(id)` —
 *   T10's whole-list-write contract); the view owns its ledger copy,
 *   re-renders (entries renumber — a pad has no holes), announces the count
 *   through a polite live region, and keeps focus in context (the next
 *   entry's remove act, or the title when the pad empties).
 * - EXPORT (T12): one "Copy CSS" act per entry copies the pairing's take-home
 *   (css2 `<link>` + `:root` variables, `src/lib/export.ts`) through the
 *   Async Clipboard API, with an in-place "Copied" label swap (STATES IN
 *   PLACE); when the clipboard is unavailable or refuses, the entry reveals
 *   a read-only textarea with the snippet PRESELECTED — no modal, and no
 *   clipboard is required to leave with the prescription. Both surfaces live
 *   inside the entries ledger, so the strict reveal holds: names (which the
 *   snippet contains) exist only while the pad is open.
 * - FOCUS: starts on the pad title (announced via aria-labelledby); Tab
 *   wraps inside the pad while main.ts holds the room inert.
 */

import { buildExportSnippet, copyToClipboard } from '../lib/export'
import type { Pairing, PairingFamily } from '../types'

/** The caller's seams: persistence and the route back to the deck. */
export interface SavedListCallbacks {
  /** The user put the pad down (back act, scrim, or Escape). */
  onBack(): void
  /** A pairing was removed — persist the whole remaining list (T10 write). */
  onRemove(id: string): void
}

/** The prescription view surface returned to the app controller. */
export interface SavedListView {
  /** The overlay root — mount inside the examination room (it overlays it). */
  root: HTMLElement
  /** Reveal: render the pad from resolved saves and open it. Names mint here. */
  open(pairings: readonly Pairing[]): void
  /** Close and STRIP the names from the DOM (strict reveal, D6). */
  close(): void
  /** true while the pad is open. */
  isOpen(): boolean
}

/** One engineering-annotation row: role label — leader line — family name. */
function renderRoleRow(family: PairingFamily): HTMLElement {
  const row = document.createElement('div')
  row.className = 'rx-role'
  row.dataset.role = family.role

  const label = document.createElement('span')
  label.className = 'rx-role-label'
  label.textContent = family.role

  const leader = document.createElement('span')
  leader.className = 'rx-leader'
  leader.setAttribute('aria-hidden', 'true') // decoration: the label and name carry the facts

  const name = document.createElement('span')
  name.className = 'rx-name'
  name.textContent = family.slug

  row.append(label, leader, name)
  return row
}

/** The metadata register under a name: category + archetype tags. */
function renderMetaLine(family: PairingFamily): HTMLElement {
  const meta = document.createElement('p')
  meta.className = 'rx-meta'
  meta.textContent = `${family.category} · ${family.tags.join(', ')}`
  return meta
}

export function createSavedListView(callbacks: SavedListCallbacks): SavedListView {
  // --- Static shell (built once; entries render per open) ---------------------
  const root = document.createElement('div')
  root.className = 'prescription-view'
  root.hidden = true
  root.setAttribute('role', 'dialog')
  root.setAttribute('aria-modal', 'true')
  root.setAttribute('aria-labelledby', 'prescription-title')

  const scrim = document.createElement('div')
  scrim.className = 'prescription-scrim'

  const pad = document.createElement('section')
  pad.className = 'prescription-pad'

  const head = document.createElement('header')
  head.className = 'rx-head'
  const title = document.createElement('h2')
  title.id = 'prescription-title'
  title.className = 'rx-title'
  title.tabIndex = -1 // focus target for the open, not a tab stop
  title.textContent = 'Prescription'
  const back = document.createElement('button')
  back.type = 'button'
  back.className = 'rx-back'
  back.textContent = 'Back to the deck'
  back.setAttribute('aria-label', 'Close the prescription and return to the deck')
  head.append(title, back)

  const count = document.createElement('p')
  count.className = 'rx-count'
  count.setAttribute('role', 'status')
  count.setAttribute('aria-live', 'polite')

  const note = document.createElement('p')
  note.className = 'rx-note'
  note.textContent = 'Names are written here and only here.'

  const entries = document.createElement('div')
  entries.className = 'rx-entries'

  const empty = document.createElement('div')
  empty.className = 'rx-empty'
  empty.hidden = true
  const emptyTitle = document.createElement('p')
  emptyTitle.className = 'rx-empty-title'
  emptyTitle.textContent = 'Nothing prescribed yet.'
  const emptyText = document.createElement('p')
  emptyText.className = 'rx-empty-text'
  emptyText.textContent =
    'Save a pairing on the judgment bar — its identity is written here, and nowhere else.'
  empty.append(emptyTitle, emptyText)

  pad.append(head, count, note, entries, empty)
  root.append(scrim, pad)

  // --- Controller state -------------------------------------------------------
  let current: readonly Pairing[] = []
  let openNow = false

  const removeButtons = (): HTMLButtonElement[] =>
    Array.from(entries.querySelectorAll<HTMLButtonElement>('.rx-remove'))

  /** Tab-wrapping focusables inside the pad, in DOM order. */
  function focusables(): HTMLElement[] {
    return Array.from(
      pad.querySelectorAll<HTMLElement>('button, [href], textarea, [tabindex]:not([tabindex="-1"])'),
    ).filter((el) => !el.hidden && !el.closest('[hidden]'))
  }

  /**
   * One entry's export act (T12). Copy attempt through the Async Clipboard
   * API; on success the button's label swaps IN PLACE ("Copy CSS" →
   * "Copied", geometry held by a min-width) and restores itself after a
   * beat; on any clipboard failure the entry reveals the fallback — a
   * read-only textarea carrying the whole snippet, PRESELECTED and focused,
   * so the manual keystroke (⌘C / Ctrl+C) is the only thing left to do.
   * No modal: the block appears inside the entry it belongs to, beneath the
   * annotation, and leaves with it on close/remove (strict reveal — the
   * snippet is name-bearing, and `closeView()`'s entries wipe covers it).
   */
  function wireExportAct(entry: HTMLElement, copy: HTMLButtonElement, pairing: Pairing): void {
    const fallback = entry.querySelector<HTMLElement>('.rx-export')
    const area = entry.querySelector<HTMLTextAreaElement>('.rx-export-text')
    if (!fallback || !area) return

    let restoreTimer: number | undefined

    copy.addEventListener('click', () => {
      const snippet = buildExportSnippet(pairing) // minted on demand, inside the open pad
      void copyToClipboard(snippet).then((copied) => {
        window.clearTimeout(restoreTimer)
        if (copied) {
          fallback.hidden = true // a later failure never lingers
          copy.dataset.state = 'copied'
          copy.textContent = 'Copied'
          restoreTimer = window.setTimeout(() => {
            delete copy.dataset.state
            copy.textContent = 'Copy CSS'
          }, 2400)
        } else {
          area.value = snippet
          fallback.hidden = false
          area.focus()
          area.select() // preselected: the manual copy is one keystroke
        }
      })
    })
  }

  /** (Re)render the entries ledger from `current`; entries renumber — a pad
      keeps no holes when a line is struck. */
  function renderEntries(): void {
    entries.replaceChildren()
    current.forEach((pairing, index) => {
      const entry = document.createElement('article')
      entry.className = 'rx-entry'
      entry.dataset.id = pairing.id

      const entryHead = document.createElement('div')
      entryHead.className = 'rx-entry-head'
      const rx = document.createElement('p')
      rx.className = 'rx-entry-rx'
      rx.textContent = `Rx ${String(index + 1).padStart(2, '0')}`

      // The entry's acts: export (T12) + remove, one row.
      const actions = document.createElement('div')
      actions.className = 'rx-entry-actions'
      const copy = document.createElement('button')
      copy.type = 'button'
      copy.className = 'rx-copy'
      copy.textContent = 'Copy CSS'
      // aria-live on the act itself: the in-place "Copied" label swap is the
      // announcement (an aria-label here would mask the text change).
      copy.setAttribute('aria-live', 'polite')
      const remove = document.createElement('button')
      remove.type = 'button'
      remove.className = 'rx-remove'
      remove.textContent = 'Remove'
      remove.setAttribute('aria-label', 'Remove this pairing from the prescription')
      remove.addEventListener('click', () => removeEntry(pairing.id))
      actions.append(copy, remove)
      entryHead.append(rx, actions)

      const spec = document.createElement('div')
      spec.className = 'rx-spec'
      spec.append(
        renderRoleRow(pairing.heading),
        renderMetaLine(pairing.heading),
        renderRoleRow(pairing.body),
        renderMetaLine(pairing.body),
      )

      // Clipboard-failure fallback (modal-free reveal): hidden until a copy
      // fails; the snippet lands in it only at that moment.
      const fallback = document.createElement('div')
      fallback.className = 'rx-export'
      fallback.hidden = true
      const fallbackLabel = document.createElement('p')
      fallbackLabel.className = 'rx-export-label'
      fallbackLabel.textContent = 'Clipboard unavailable — the snippet is selected below; copy it manually.'
      const area = document.createElement('textarea')
      area.className = 'rx-export-text'
      area.readOnly = true
      area.spellcheck = false
      area.setAttribute('aria-label', 'Pairing CSS snippet, read only')
      area.wrap = 'soft'
      fallback.append(fallbackLabel, area)

      entry.append(entryHead, spec, fallback)
      wireExportAct(entry, copy, pairing)
      entries.appendChild(entry)
    })
    empty.hidden = current.length > 0
    count.textContent = `${current.length} saved`
  }

  /**
   * Strike one line: update the ledger copy, re-render (renumbering), hand
   * persistence to the caller, and keep focus in context — the entry that
   * took the removed one's place, or the title when the pad emptied.
   */
  function removeEntry(id: string): void {
    const index = current.findIndex((p) => p.id === id)
    if (index === -1) return
    current = current.filter((p) => p.id !== id)
    renderEntries()
    callbacks.onRemove(id)
    const buttons = removeButtons()
    if (buttons.length > 0) buttons[Math.min(index, buttons.length - 1)].focus()
    else title.focus() // the pad just emptied — announce it from the top
  }

  /**
   * Close and STRIP the names from the DOM (strict reveal, D6): the closed
   * view leaves zero family names anywhere in the document — review states
   * stay grep-level clean even after heavy use of the reveal.
   *
   * Named `closeView`, deliberately: a bare `close()` here would resolve to
   * the global `window.close` (the object-literal method name is not a
   * binding) — which jsdom honors by tearing down the whole window, and a
   * browser may honor by trying to close the tab.
   */
  function closeView(): void {
    entries.replaceChildren()
    empty.hidden = true
    root.hidden = true
    openNow = false
  }

  /** The one route out: close, strip names, hand focus coordination back. */
  function requestBack(): void {
    closeView()
    callbacks.onBack()
  }

  // Escape closes; Tab wraps inside the pad (the room is inert underneath,
  // so the wrap is what keeps keyboard users from tabbing into the browser
  // chrome). Listeners live on the view root — elements, not windows, so
  // re-boots in tests never stack them.
  root.addEventListener('keydown', (event) => {
    if (!openNow) return
    if (event.key === 'Escape') {
      event.preventDefault()
      requestBack()
      return
    }
    if (event.key === 'Tab') {
      const items = focusables()
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      if (event.shiftKey && (active === first || !pad.contains(active))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }
  })

  back.addEventListener('click', requestBack)
  scrim.addEventListener('click', requestBack)

  return {
    root,
    open(pairings: readonly Pairing[]): void {
      current = pairings.slice()
      renderEntries()
      root.hidden = false
      openNow = true
      title.focus()
    },
    close: closeView,
    isOpen(): boolean {
      return openNow
    },
  }
}
