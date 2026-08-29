/**
 * T16 — E2E happy path, PRODUCTION build, real network, one continuous journey
 * (plan T16: "automated browser flow: fresh visit → explainer → judge 3
 * pairings → save 2 → saved list reveals → export copies → reload →
 * persistence; deck exhaustion + reshuffle exercised").
 *
 * Shape of the journey (one test, one browser context — localStorage persists
 * across the reload by design, everything else is fresh):
 *
 *   1. fresh visit        — first-run explainer up, judgment lands on the
 *                           boot draw; dismissal hands focus to Skip.
 *   2. three judgments    — mixed input paths (parity, criterion 2): one
 *                           BUTTON save, one KEYBOARD skip (←), one SWIPE save
 *                           (real pointer drag on the card chrome).
 *   3. prescription       — names/roles/categories revealed in the pad
 *                           (strict reveal: absent from review DOM before).
 *   4. export             — Copy CSS puts the byte-exact snippet (oracle: the
 *                           app's own `buildExportSnippet` over the same
 *                           dataset) on the clipboard.
 *   5. reload             — saves + seen-set resume, explainer stays
 *                           dismissed, the resumed boot draw repeats nothing.
 *   6. walk to exhaustion — skip the remaining deck; every draw unique; the
 *                           D7 terminal state arrives with the bar disabled
 *                           and Reshuffle focused.
 *   7. reshuffle          — deck redraws from a cleared seen-set.
 *
 * The deck's draw order is random per run, so every assertion is made against
 * LIVE-CAPTURED state: the on-wall pairing is identified from the single
 * dynamic css2 `display=block` link (the IBM-Plex chrome link is
 * `display=swap`) and resolved against `src/data/pairings.json`. Determinism
 * = the suite passes twice in a row with different draw orders, not a fixed
 * sequence.
 *
 * Carried harness notes honored here: wait for `state=ready` AND the lens
 * blind's `hidden` attribute before reading on-wall state (T14 — the blind
 * hides only after the lift animation); the judgment bar is inert during swap
 * gates and at exhaustion (D7), so every verdict waits for the marker count
 * to advance (or exhaustion) rather than trusting `ready` alone.
 */

import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { buildExportSnippet } from '../../src/lib/export'

// Read via fs (not a JSON import) — loader-independent across ESM/CJS.
const pairingsJson = JSON.parse(readFileSync(new URL('../../src/data/pairings.json', import.meta.url), 'utf8'))

// --- Dataset oracle -----------------------------------------------------------

interface FamilyRecord {
  slug: string
  role: string
  category: string
  tags: string[]
  weights: number[]
  italic: boolean
}
interface PairingRecord {
  id: string
  heading: FamilyRecord
  body: FamilyRecord
}

const DECK = pairingsJson as unknown as PairingRecord[]
const DECK_SIZE = DECK.length
if (DECK_SIZE < 60) throw new Error(`e2e: expected the full ~60-pairing dataset, found ${DECK_SIZE}`)

/** (heading slug, body slug) in css2-href order → pairing record. Verified
 * unique across the 61-pairing dataset, so the href identifies the pairing. */
const bySlugPair = new Map<string, PairingRecord>()
for (const p of DECK) bySlugPair.set(`${p.heading.slug}|${p.body.slug}`, p)

/** All family names, for the strict-reveal word-boundary scans. */
const ALL_NAMES: string[] = Array.from(new Set(DECK.flatMap((p) => [p.heading.slug, p.body.slug])))

// --- Page-state helpers (run in the browser) -----------------------------------

/** True when the room is ready, not exhausted, and the lens blind has fully
 * lifted (hidden attribute set) — the only moment on-wall state is stable. */
function roomSettled(): boolean {
  const root = document.querySelector<HTMLElement>('.examination-room')
  if (!root) return false
  const blind = document.querySelector<HTMLElement>('.lens-blind')
  const blindClear = !blind || blind.hidden
  return root.dataset.state === 'ready' && root.dataset.exhausted !== 'true' && blindClear
}

async function awaitSettled(page: Page, timeout = 45_000): Promise<void> {
  // Error state resolves the wait too — then fails loudly with the notice.
  await page.waitForFunction(
    () => {
      const root = document.querySelector<HTMLElement>('.examination-room')
      if (!root) return false
      if (root.dataset.state === 'error') return true
      const blind = document.querySelector<HTMLElement>('.lens-blind')
      const blindClear = !blind || blind.hidden
      return root.dataset.state === 'ready' && blindClear
    },
    null,
    { timeout },
  )
  const state = await page.evaluate(() => document.querySelector<HTMLElement>('.examination-room')?.dataset.state)
  if (state === 'error') {
    const notice = await page.textContent('.lane-swap-error-text').catch(() => '')
    throw new Error(`e2e: font gate entered the error state ("${notice ?? ''}") — the happy path must not trip the 4000ms budget`)
  }
}

/** Markers count "N / M examined" → N (post-draw: the on-wall pairing counts). */
async function seenCount(page: Page): Promise<number> {
  const text = await page.textContent('.marker-count')
  const n = /^(\d+) \/ \d+ examined$/.exec((text ?? '').trim())
  if (!n) throw new Error(`e2e: unreadable marker count "${text}"`)
  return Number(n[1])
}

/** Identify the on-wall pairing from the single dynamic display=block css2
 * link. At `ready` exactly one must exist (the old handle is released after
 * the new pairing paints — R2 ordering). */
async function currentPairing(page: Page): Promise<PairingRecord> {
  const key = await page.evaluate(() => {
    const hrefs = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'))
      .map((l) => l.getAttribute('href') ?? '')
      .filter((h) => h.includes('display=block'))
    if (hrefs.length !== 1) return `__LINKS_${hrefs.length}`
    const families = new URL(hrefs[0]).searchParams
      .getAll('family')
      .map((f) => decodeURIComponent(f.split(':')[0]).replace(/\+/g, ' '))
    return families.join('|')
  })
  if (key.startsWith('__LINKS_')) throw new Error(`e2e: expected exactly 1 dynamic css2 link at ready, got ${key.slice(9)}`)
  const record = bySlugPair.get(key)
  if (!record) throw new Error(`e2e: on-wall pairing "${key}" not present in the bundled dataset`)
  return record
}

/** True when the D7 exhaustion state is up (the deck refused the next draw). */
async function isExhausted(page: Page): Promise<boolean> {
  return page.evaluate(() => document.querySelector<HTMLElement>('.examination-room')?.dataset.exhausted === 'true')
}

/** Issue one verdict through a keyboard ←/→ and wait until the deck answers:
 * the marker count advances, or the D7 exhaustion state lands. */
async function judgeByKeyAndWait(page: Page, key: 'ArrowLeft' | 'ArrowRight', prevSeen: number): Promise<number> {
  await page.keyboard.press(key)
  await page.waitForFunction(
    (prev: number) => {
      const root = document.querySelector<HTMLElement>('.examination-room')
      if (!root) return false
      if (root.dataset.state === 'error') return true
      if (root.dataset.exhausted === 'true') return true
      const m = /^(\d+) \/ \d+ examined$/.exec(
        (document.querySelector('.marker-count')?.textContent ?? '').trim(),
      )
      return m !== null && Number(m[1]) > prev
    },
    prevSeen,
    { timeout: 45_000 },
  )
  await expect
    .poll(async () => page.evaluate(() => document.querySelector<HTMLElement>('.examination-room')?.dataset.state))
    .not.toBe('error')
  return seenCount(page)
}

/** Word-boundary scan of the review DOM's visible text — the strict reveal
 * (D6): no family name renders outside the open prescription pad. (Names do
 * live in the html[style] custom properties and css2 hrefs — the committed
 * T04/T05 render mechanism, not visible text.) */
async function visibleTextHasName(page: Page, names: string[]): Promise<string[]> {
  const text = await page.evaluate(() => document.body.innerText)
  return names.filter((name) => new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRe(name)}([^\\p{L}\\p{N}]|$)`, 'u').test(text))
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// --- The journey ----------------------------------------------------------------

test('full happy path: explainer → mixed-input judgments → reveal → export → reload persistence → exhaustion → reshuffle', async ({
  page,
  context,
}) => {
  // Clipboard permissions up front: the export step must take the REAL
  // Async-Clipboard path (the fallback textarea is T12's degrade path).
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])

  // Zero uncaught page errors across the whole journey (the honesty rule every
  // prior verifier applied — a happy path that only looks happy doesn't count).
  const pageErrors: string[] = []
  page.on('pageerror', (err) => pageErrors.push(String(err)))

  test.setTimeout(420_000)

  // -- 1. Fresh visit: explainer up, boot draw on the wall --------------------
  await page.goto('/')
  await awaitSettled(page)

  await expect(page.locator('.lane-explainer')).toBeVisible()
  await expect(page.locator('.lane-explainer-dismiss')).toHaveText('Begin examination')
  await expect(page.locator('.marker-count')).toHaveText(`1 / ${DECK_SIZE} examined`)
  await expect(page.locator('.lane-prescription')).toHaveText('Prescription · 0 saved')

  const firstPairing = await currentPairing(page)
  const judgedIds: string[] = [firstPairing.id]

  // Strict reveal before anything: no family name in the review DOM's text.
  expect(await visibleTextHasName(page, ALL_NAMES), 'no family names visible on fresh visit').toEqual([])

  // Dismiss the explainer — the keyboard journey continues at Skip.
  await page.click('.lane-explainer-dismiss')
  await expect(page.locator('.lane-explainer')).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => document.activeElement?.className)).toContain('judge-skip')

  // -- 2. Three judgments, three input paths (parity, criterion 2) ------------

  // (a) BUTTON save on the boot draw.
  await page.click('.judge-save')
  await awaitSettled(page)
  await expect(page.locator('.marker-count')).toHaveText(`2 / ${DECK_SIZE} examined`)
  await expect(page.locator('.lane-prescription')).toHaveText('Prescription · 1 saved')
  const saved1 = firstPairing

  // (b) KEYBOARD skip (ArrowLeft) — keys work with nothing focused on a button.
  const secondPairing = await currentPairing(page)
  await expect(secondPairing.id).not.toBe(saved1.id)
  let seen = await judgeByKeyAndWait(page, 'ArrowLeft', 2)
  expect(seen).toBe(3)
  await awaitSettled(page)
  await expect(page.locator('.lane-prescription')).toHaveText('Prescription · 1 saved')

  // (c) SWIPE save — a real rightward pointer drag on the card chrome (lane
  // wall left of the sheet: mouse drags on the reading surface are selection,
  // not judgment). Distance 300px clears the 80px commit threshold; the
  // pointer stays inside the viewport (T08 harness note).
  const thirdPairing = await currentPairing(page)
  const laneBox = (await page.locator('.acuity-lane').boundingBox())!
  const sheetBox = (await page.locator('.dummy-sheet').boundingBox())!
  const startX = Math.max(laneBox.x + 12, sheetBox.x - 24)
  const y = sheetBox.y + Math.min(sheetBox.height / 2, laneBox.y + laneBox.height - sheetBox.y - 8)
  await page.mouse.move(startX, y)
  await page.mouse.down()
  for (let i = 1; i <= 12; i += 1) {
    await page.mouse.move(startX + (300 * i) / 12, y, { steps: 1 })
    await page.waitForTimeout(25)
  }
  await page.mouse.up()
  await awaitSettled(page)
  seen = await seenCount(page)
  expect(seen).toBe(4)
  await expect(page.locator('.lane-prescription')).toHaveText('Prescription · 2 saved')
  const saved2 = thirdPairing
  const fourthPairing = await currentPairing(page)
  judgedIds.push(secondPairing.id, thirdPairing.id, fourthPairing.id)
  expect(new Set(judgedIds).size).toBe(4) // no repeat in the unseen-first cycle

  // Persistence wrote exactly the D2 minimal records.
  const savesRaw = await page.evaluate(() => localStorage.getItem('blind-test.saves.v1'))
  expect(JSON.parse(savesRaw ?? '[]')).toEqual([saved1.id, saved2.id])
  const seenRaw = JSON.parse((await page.evaluate(() => localStorage.getItem('blind-test.seen.v1'))) ?? '[]') as string[]
  expect([...seenRaw].sort()).toEqual([...judgedIds].sort())
  expect(JSON.parse((await page.evaluate(() => localStorage.getItem('blind-test.flags.v1'))) ?? '{}')).toEqual({
    'explainer-dismissed': true,
  })

  // Strict reveal with 2 saves on the ledger: saved names still invisible.
  const savedNames = [saved1.heading.slug, saved1.body.slug, saved2.heading.slug, saved2.body.slug]
  expect(await visibleTextHasName(page, savedNames), 'saved names stay unrevealed in review').toEqual([])

  // -- 3. Prescription: names/roles/categories revealed ------------------------
  await page.click('.lane-prescription')
  const pad = page.locator('.prescription-view')
  await expect(pad).toBeVisible()
  await expect(pad).toHaveAttribute('role', 'dialog')
  await expect(pad).toHaveAttribute('aria-modal', 'true')
  await expect(page.locator('.examination-room')).toHaveAttribute('data-prescribing', 'true')
  for (const region of ['.lane-strip', '.acuity-lane', '.judgment-bar']) {
    await expect(page.locator(region)).toHaveAttribute('inert', '')
  }
  await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe('prescription-title')

  const entries = pad.locator('.rx-entry')
  await expect(entries).toHaveCount(2)
  for (const [i, pairing] of [saved1, saved2].entries()) {
    const entry = entries.nth(i)
    await expect(entry.locator('.rx-entry-rx')).toHaveText(`Rx ${String(i + 1).padStart(2, '0')}`)
    for (const [slot, family] of [
      ['heading', pairing.heading],
      ['body', pairing.body],
    ] as const) {
      const row = entry.locator('.rx-role').nth(slot === 'heading' ? 0 : 1)
      await expect(row).toHaveAttribute('data-role', slot)
      await expect(row.locator('.rx-role-label')).toHaveText(slot)
      await expect(row.locator('.rx-name')).toHaveText(family.slug)
      const meta = entry.locator('.rx-meta').nth(slot === 'heading' ? 0 : 1)
      await expect(meta).toHaveText(`${family.category} · ${family.tags.join(', ')}`)
    }
  }

  // -- 4. Export: clipboard carries the byte-exact snippet ---------------------
  await pad.locator('.rx-copy').first().click()
  const copyButton = pad.locator('.rx-copy').first()
  await expect(copyButton).toHaveText('Copied')
  await expect(copyButton).toHaveAttribute('data-state', 'copied')
  const clipboard = await page.evaluate(() => navigator.clipboard.readText())
  expect(clipboard).toBe(buildExportSnippet(saved1)) // the app's own oracle, byte-for-byte
  // Structural sanity (readable failure if the oracle drifts): the css2 link
  // for exactly this pairing + the full variable surface.
  expect(clipboard).toContain('<link rel="stylesheet" href="https://fonts.googleapis.com/css2?')
  expect(clipboard).toContain('display=block">')
  expect(clipboard).toContain(`--font-heading: "${saved1.heading.slug}"`)
  expect(clipboard).toContain(`--font-body: "${saved1.body.slug}"`)
  for (const v of ['--weight-heading:', '--weight-heading-soft:', '--weight-body:', '--weight-body-strong:']) {
    expect(clipboard).toContain(v)
  }
  // No fallback revealed on the successful copy (one per entry, both hidden).
  const fallbackHidden = await pad
    .locator('.rx-export')
    .evaluateAll((els) => els.map((el) => (el as HTMLElement).hidden))
  expect(fallbackHidden).toEqual([true, true])

  // Close (Escape): names stripped, room reactivated, focus returns to the route.
  await page.keyboard.press('Escape')
  await expect(pad).toBeHidden()
  await expect(pad.locator('.rx-entry')).toHaveCount(0)
  await expect(page.locator('.examination-room')).not.toHaveAttribute('data-prescribing', 'true')
  await expect(page.locator('.lane-strip')).not.toHaveAttribute('inert', '')
  await expect.poll(() => page.evaluate(() => document.activeElement?.className)).toContain('lane-prescription')
  expect(await visibleTextHasName(page, savedNames), 'names stripped on close').toEqual([])

  // -- 5. Reload: persistence, no repeats --------------------------------------
  await page.reload()
  await awaitSettled(page)
  await expect(page.locator('.lane-explainer')).toHaveCount(0) // dismissal persisted
  await expect(page.locator('.lane-prescription')).toHaveText('Prescription · 2 saved')
  expect(await seenCount(page)).toBe(5) // 4 persisted + the resumed boot draw
  const resumedPairing = await currentPairing(page)
  judgedIds.push(resumedPairing.id)
  expect(new Set(judgedIds).size).toBe(5) // the resumed draw repeated nothing

  // -- 6. Walk the deck to exhaustion (skip everything remaining) -------------
  const collected = new Set(judgedIds)
  let seenNow = 5
  for (let guard = 0; guard < DECK_SIZE + 5; guard += 1) {
    if (await isExhausted(page)) break
    seenNow = await judgeByKeyAndWait(page, 'ArrowLeft', seenNow)
    if (await isExhausted(page)) break // this verdict exhausted the deck — D7 state, no new draw
    await awaitSettled(page)
    const pairing = await currentPairing(page)
    expect(collected.has(pairing.id), `pairing ${pairing.id} repeated before exhaustion`).toBe(false)
    collected.add(pairing.id)
  }
  expect(collected.size).toBe(DECK_SIZE) // every pairing judged exactly once
  expect(await seenCount(page)).toBe(DECK_SIZE)

  // The D7 terminal state: notice up, bar disabled in place, Reshuffle focused.
  const exhaustedNotice = page.locator('.lane-exhausted')
  await expect(exhaustedNotice).toBeVisible()
  await expect(exhaustedNotice.locator('.lane-exhausted-text')).toHaveText('Cycle complete — every pairing examined once.')
  await expect(page.locator('.judge-skip')).toBeDisabled()
  await expect(page.locator('.judge-save')).toBeDisabled()
  await expect(page.locator('.examination-room')).toHaveAttribute('data-exhausted', 'true')
  await expect.poll(() => page.evaluate(() => document.activeElement?.className)).toContain('lane-exhausted-reshuffle')
  // Gated input judges nothing at exhaustion (markers + ledger frozen).
  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(600)
  expect(await seenCount(page)).toBe(DECK_SIZE)
  await expect(page.locator('.lane-prescription')).toHaveText('Prescription · 2 saved')
  expect(await visibleTextHasName(page, savedNames), 'exhaustion state reveals nothing').toEqual([])
  // Whole seen-set persisted at the cycle's end.
  const seenAtExhaustion = JSON.parse(
    (await page.evaluate(() => localStorage.getItem('blind-test.seen.v1'))) ?? '[]',
  ) as string[]
  expect([...seenAtExhaustion].sort()).toEqual([...collected].sort())

  // -- 7. Reshuffle: the deck redraws from a cleared seen-set ------------------
  await page.click('.lane-exhausted-reshuffle')
  await awaitSettled(page)
  await expect(page.locator('.marker-count')).toHaveText(`1 / ${DECK_SIZE} examined`)
  await expect(exhaustedNotice).toBeHidden()
  await expect(page.locator('.judge-skip')).toBeEnabled()
  await expect(page.locator('.judge-save')).toBeEnabled()
  await expect(page.locator('.examination-room')).not.toHaveAttribute('data-exhausted', 'true')
  await expect(page.locator('.lane-prescription')).toHaveText('Prescription · 2 saved') // ledger survives
  const freshDraw = await currentPairing(page) // any pairing, drawn anew
  expect(freshDraw.id).toBeTruthy()
  const seenAfterReshuffle = JSON.parse(
    (await page.evaluate(() => localStorage.getItem('blind-test.seen.v1'))) ?? '[]',
  ) as string[]
  expect(seenAfterReshuffle).toEqual([freshDraw.id]) // cleared + the one new draw

  // No uncaught exception surfaced anywhere in the journey.
  expect(pageErrors, 'zero uncaught page errors across the journey').toEqual([])
})

/**
 * T17 — reduced-motion walkthrough (criterion 6) in a REAL browser with the
 * media feature emulated: the swap choreography collapses by construction.
 * The unit suite (main.swap.reduced.test.ts) pins the JS side — the blind is
 * never MOUNTED, the detent class never lands — via MutationObserver; this
 * run adds the rendered/CSS side against the production bundle: no `.lens-blind`
 * element ever exists in the DOM, the lane is never clip-locked, and the two
 * always-present animation surfaces (the pad's stepped rise, the paper's
 * detent) compute to `animation-name: none` under `reduce`.
 */
test('reduced motion: no occluder, no lane clip, the pad mounts without its rise', async ({
  browser,
}) => {
  const context = await browser.newContext({ reducedMotion: 'reduce' })
  const page = await context.newPage()
  const pageErrors: string[] = []
  page.on('pageerror', (err) => pageErrors.push(String(err)))

  try {
    await page.goto('/')
    await awaitSettled(page)

    // T17's explainer gate: judgment opens only after dismissal.
    await page.click('.lane-explainer-dismiss')
    await expect(page.locator('.lane-explainer')).toHaveCount(0)

    // Born-uncovered and never covered: no blind element exists at ready.
    expect(await page.locator('.lens-blind').count()).toBe(0)

    // One keyboard judgment: the swap completes with zero choreography.
    const seen = await judgeByKeyAndWait(page, 'ArrowRight', 1)
    expect(seen).toBe(2)
    await awaitSettled(page)
    expect(await page.locator('.lens-blind').count()).toBe(0) // never mounted
    await expect(page.locator('.acuity-lane')).not.toHaveClass(/is-swapping/) // never clip-locked

    // The paper's detent surface computes to no animation under reduce.
    expect(await page.locator('.dummy-frame').evaluate((el) => getComputedStyle(el).animationName)).toBe(
      'none',
    )

    // The prescription pad's stepped rise collapses to an instant mount.
    await page.click('.lane-prescription')
    await expect(page.locator('.prescription-view')).toBeVisible()
    expect(
      await page.locator('.prescription-pad').evaluate((el) => getComputedStyle(el).animationName),
    ).toBe('none')

    expect(pageErrors, 'zero uncaught page errors under reduced motion').toEqual([])
  } finally {
    await context.close()
  }
})
