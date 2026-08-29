/**
 * T15 — Google Fonts validation script (CI-runnable, no browser).
 *
 * For every pairing in the dataset, fetch the EXACT css2 URL the app would
 * inject (`buildCss2Url` from `src/lib/fontLoader.ts` — reused, not
 * reimplemented) with a browser-like UA, parse the served @font-face blocks,
 * and assert every requested family / weight / italic tuple is actually
 * served. Exit 1 on any failure, 0 clean.
 *
 * WHY THIS DIFFS SERVED DESCRIPTORS INSTEAD OF TRUSTING STATUS CODES
 * (live-verified 2026-08-28, Chrome UA — R2 E5/E8 + T02's live finding):
 *
 * - `css2?family=NoSuchFontHere123:wght@400` (single family)      → HTTP 400, HTML body (not 404).
 * - `family=NoSuchFontHere123:…&family=Crimson+Pro:…` (combined)  → HTTP 200 — the invalid family
 *   is SILENTLY DROPPED and the valid one is served. A 200 proves nothing on its own.
 * - `family=Space+Grotesk:ital,wght@0,500;0,700;1,500;1,700`     → HTTP 200 with only `normal`
 *   blocks — unsupported italic tuples are silently dropped (Space Grotesk has no italics).
 * - `family=Roboto:wght@9000`                                     → HTTP 400 (unavailable axis position).
 *
 * So the validator checks three layers per pairing: (1) the combined URL's
 * HTTP status (400 ⇒ rejected request — re-probe each family individually to
 * attribute the failure), (2) family presence in the served CSS, (3) every
 * requested (style, weight) tuple present in the served descriptors. It also
 * spot-checks one woff2 per unique family for the long-lived cache header
 * R2's prefetch recommendation depends on (`cache-control: max-age` —
 * observed `public, max-age=31536000`, E8).
 *
 * Node >= 23.6 (or >= 22.6 with `--experimental-strip-types`): the script
 * imports `fontLoader.ts` / `types.ts` directly via Node's type stripping, so
 * the URL builder and schema validator stay single-sourced.
 *
 * Usage:
 *   npm run validate:fonts
 *   node scripts/validate-fonts.mjs [--data path/to/pairings.json]
 *
 * Dataset resolution: explicit `--data` path, else `src/data/pairings.json`
 * (full T14 dataset), else `src/data/pairings.sample.json` (T02 sample —
 * the fallback until T14 lands, announced loudly in the output).
 */

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildCss2Url } from '../src/lib/fontLoader.ts'
import { validatePairings } from '../src/types.ts'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** Modern-Chrome UA so css2 serves the real browser CSS (woff2 + unicode-range subsets). */
const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'

/** Per-request budget (css2 and woff2 alike). Failures are reported, never hung. */
const REQUEST_TIMEOUT_MS = 15000
/** Pairing checks in flight at once — polite to the API, bounded wall time. */
const CONCURRENCY = 6
/** One retry absorbs CI transit blips; deterministic css2 rejections (400) are NOT retried. */
const RETRY_DELAYS_MS = [500]
/**
 * Minimum `cache-control: max-age` accepted for woff2 (R2 E8 observes
 * 31536000 = 1 year; 604800 = 7 days tolerates drift, still "long-cached").
 */
const WOFF2_MIN_MAX_AGE = 604800

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ---------------------------------------------------------------------------
// Dataset
// ---------------------------------------------------------------------------

function loadDataset(argv) {
  const dataFlag = argv.indexOf('--data')
  if (dataFlag !== -1) {
    const path = argv[dataFlag + 1]
    if (!path) {
      throw new Error('--data requires a path argument')
    }
    return { path: resolve(path), source: '--data override' }
  }
  for (const [path, source] of [
    [resolve(ROOT, 'src/data/pairings.json'), 'src/data/pairings.json (full dataset)'],
    [resolve(ROOT, 'src/data/pairings.sample.json'), 'src/data/pairings.sample.json (SAMPLE fallback — T14 full dataset not present yet)'],
  ]) {
    try {
      readFileSync(path)
      return { path, source }
    } catch {
      // try the next candidate
    }
  }
  throw new Error('no dataset found: expected src/data/pairings.json or src/data/pairings.sample.json (or pass --data <path>)')
}

// ---------------------------------------------------------------------------
// css2 fetching (with one retry for transit errors / 5xx only)
// ---------------------------------------------------------------------------

async function fetchOnce(url, extraHeaders = {}) {
  const res = await fetch(url, {
    headers: { 'user-agent': BROWSER_UA, ...extraHeaders },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    redirect: 'error',
  })
  return res
}

/**
 * Fetch a css2 URL. Returns { status, contentType, text }.
 * Retries (once) on network error or 5xx — never on 4xx (deterministic).
 */
async function fetchCss(url) {
  let lastError
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    if (attempt > 0) await sleep(RETRY_DELAYS_MS[attempt - 1])
    try {
      const res = await fetchOnce(url, { accept: 'text/css,*/*;q=0.1' })
      if (res.status >= 500 && attempt < RETRY_DELAYS_MS.length) {
        lastError = new Error(`HTTP ${res.status}`)
        continue
      }
      return { status: res.status, contentType: res.headers.get('content-type') ?? '', text: await res.text() }
    } catch (err) {
      lastError = err
    }
  }
  throw lastError
}

// ---------------------------------------------------------------------------
// @font-face parsing
// ---------------------------------------------------------------------------

/** Strip quoting/whitespace and case-fold a served `font-family` value. */
function normalizeFamily(value) {
  return value.trim().replace(/^(['"])(.*)\1$/, '$2').replace(/\s+/g, ' ').toLowerCase()
}

/**
 * Parse served css2 CSS into @font-face descriptors.
 * Returns [{ family, style, weights, woff2 }] — `style` ∈ normal|italic|oblique;
 * `weights` is the list of covered weight positions (a served range like
 * `200 700` is expanded to every integer position it covers); `woff2` is the
 * first woff2 URL of the block (cache-header spot check).
 */
function parseFontFaces(css) {
  const faces = []
  const blockRe = /@font-face\s*\{([^}]*)\}/g
  for (const [, body] of css.matchAll(blockRe)) {
    const prop = (name) => {
      const m = body.match(new RegExp(`^\\s*${name}:\\s*(.+?)\\s*;`, 'm'))
      return m ? m[1] : null
    }
    const family = prop('font-family')
    const style = prop('font-style')
    const weight = prop('font-weight')
    const src = prop('src')
    if (!family || !style || !weight || !src || !src.includes('url(')) continue
    const numbers = weight.trim().split(/\s+/).map(Number)
    let weights
    if (numbers.length >= 2 && numbers.every(Number.isFinite)) {
      weights = []
      for (let w = numbers[0]; w <= numbers[numbers.length - 1]; w++) weights.push(w)
    } else if (numbers.length === 1 && Number.isFinite(numbers[0])) {
      weights = [numbers[0]]
    } else {
      continue
    }
    const woff2 = /url\((https:[^)]+\.woff2)\)/.exec(src)?.[1] ?? null
    faces.push({ family: normalizeFamily(family), style: style.trim().toLowerCase(), weights, woff2 })
  }
  return faces
}

/** Requested tuples for one family: upright per weight, plus italic per weight when flagged. */
function requestedTuples(family) {
  const tuples = family.weights.map((weight) => ({ style: 'normal', weight }))
  if (family.italic) {
    tuples.push(...family.weights.map((weight) => ({ style: 'italic', weight })))
  }
  return tuples
}

/** Does a served face satisfy the requested style? (`oblique` matches an italic request, per CSS font matching.) */
function styleServed(servedStyle, wanted) {
  if (servedStyle === wanted) return true
  return wanted === 'italic' && servedStyle.startsWith('oblique')
}

/**
 * Diff one family against served @font-face descriptors.
 * Returns an array of problem strings (empty = clean).
 */
function diffFamily(pairingId, family, faces, httpStatus) {
  const problems = []
  const key = normalizeFamily(family.slug)
  const served = faces.filter((f) => f.family === key)
  if (served.length === 0) {
    return [
      `${pairingId} · ${family.slug}: family absent from served CSS (HTTP ${httpStatus}) — css2 silently dropped it: unknown slug, or a requested weight/italic tuple this family does not serve`,
    ]
  }
  const style = served.some((f) => f.style !== 'normal') ? ` (${[...new Set(served.map((f) => f.style))].join('/')})` : ''
  for (const { style: wantStyle, weight } of requestedTuples(family)) {
    const matched = served.some((f) => styleServed(f.style, wantStyle) && f.weights.includes(weight))
    if (!matched) {
      const servedTuples = [...new Set(served.flatMap((f) => f.weights.map((w) => `${f.style} ${w}`)))]
      problems.push(
        `${pairingId} · ${family.slug}: missing tuple ${wantStyle} ${weight} (HTTP ${httpStatus}, served styles${style}: ${servedTuples.join(', ')})`,
      )
    }
  }
  return problems
}

// ---------------------------------------------------------------------------
// Per-pairing check
// ---------------------------------------------------------------------------

/**
 * Split a combined css2 URL into single-family probe URLs, preserving the
 * exact component encoding `buildCss2Url` produced (no re-encoding).
 */
function singleFamilyUrls(cssUrl) {
  const queryStart = cssUrl.indexOf('?')
  const base = cssUrl.slice(0, queryStart)
  const params = cssUrl.slice(queryStart + 1).split('&')
  return params
    .filter((p) => p.startsWith('family='))
    .map((p) => `${base}?${p}&display=block`)
}

/** Fetch one family in isolation; returns a short status phrase for the failure report. */
async function probeFamily(probeUrl) {
  try {
    const res = await fetchCss(probeUrl)
    if (res.status === 200 && res.text.includes('@font-face')) {
      const faces = parseFontFaces(res.text)
      const served = faces.map((f) => `${f.family} ${[...new Set(f.weights)].join('/')}`).join(', ')
      return `HTTP 200, serves: ${served || '(no blocks)'}`
    }
    return `HTTP ${res.status} (${res.contentType.split(';')[0]}) — rejected: unknown family or unavailable axis value`
  } catch (err) {
    return `network error during probe: ${err.message}`
  }
}

/**
 * Validate one pairing against the live css2 API.
 * Returns { id, problems: string[], woff2Urls: string[] }.
 */
async function checkPairing(pairing) {
  const cssUrl = buildCss2Url({ heading: pairing.heading, body: pairing.body })
  const problems = []
  const woff2Urls = []

  let css
  try {
    css = await fetchCss(cssUrl)
  } catch (err) {
    return { id: pairing.id, problems: [`${pairing.id} · css2 fetch failed: ${err.message} (${cssUrl})`], woff2Urls }
  }

  // Layer 1 — HTTP status. css2 failures are 400 + HTML, never 404 (R2 E8).
  if (css.status !== 200) {
    const probes = await Promise.all(
      singleFamilyUrls(cssUrl).map(async (probeUrl, i) => {
        const family = [pairing.heading, pairing.body][i]
        return `  - ${family.slug} → ${await probeFamily(probeUrl)}`
      }),
    )
    problems.push(
      `${pairing.id} · css2 rejected the pairing URL: HTTP ${css.status} (${css.contentType.split(';')[0] || 'unknown content-type'})\n` +
        probes.join('\n'),
    )
    return { id: pairing.id, problems, woff2Urls }
  }

  if (!css.text.includes('@font-face')) {
    return { id: pairing.id, problems: [`${pairing.id} · HTTP 200 but no @font-face blocks in the css2 response`], woff2Urls }
  }

  // Layers 2 + 3 — family presence and per-tuple served descriptors.
  const faces = parseFontFaces(css.text)
  for (const family of [pairing.heading, pairing.body]) {
    problems.push(...diffFamily(pairing.id, family, faces, css.status))
    const woff2 = faces.find((f) => f.family === normalizeFamily(family.slug))?.woff2
    if (woff2) woff2Urls.push(woff2)
  }

  return { id: pairing.id, problems, woff2Urls }
}

// ---------------------------------------------------------------------------
// woff2 cache-header spot check (R2 prefetch assumption, E8)
// ---------------------------------------------------------------------------

async function checkWoff2Cache(url) {
  let res
  try {
    res = await fetchOnce(url)
    if (res.status === 405 || res.status === 403) {
      // HEAD refused → ranged GET (observed: gstatic answers both, 200/206)
      res = await fetch(url, {
        headers: { 'user-agent': BROWSER_UA, range: 'bytes=0-1' },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        redirect: 'error',
      })
    }
  } catch (err) {
    return { url, ok: false, note: `fetch failed: ${err.message}` }
  }
  if (!res.ok && res.status !== 206) {
    return { url, ok: false, note: `HTTP ${res.status}` }
  }
  const cacheControl = res.headers.get('cache-control') ?? ''
  const maxAge = Number(/max-age=(\d+)/.exec(cacheControl)?.[1])
  if (!Number.isFinite(maxAge) || maxAge < WOFF2_MIN_MAX_AGE) {
    return { url, ok: false, note: `cache-control "${cacheControl || '(none)'}" — max-age below ${WOFF2_MIN_MAX_AGE}s (R2 prefetch assumption, E8)` }
  }
  return { url, ok: true, note: `max-age ${maxAge}s`, maxAge }
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

async function runPool(items, worker) {
  const results = new Array(items.length)
  let next = 0
  const lanes = Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
    while (true) {
      const i = next++
      if (i >= items.length) return
      results[i] = await worker(items[i], i)
    }
  })
  await Promise.all(lanes)
  return results
}

async function main() {
  const argv = process.argv.slice(2)
  const { path: dataPath, source } = loadDataset(argv)

  let pairings
  try {
    pairings = validatePairings(JSON.parse(readFileSync(dataPath, 'utf8')))
  } catch (err) {
    console.error(`validate:fonts — dataset invalid: ${err instanceof Error ? err.message : String(err)}`)
    console.error(`  dataset: ${dataPath} (${source})`)
    process.exit(1)
  }

  console.log(`validate:fonts — checking ${pairings.length} pairing(s) against the live css2 API`)
  console.log(`  dataset: ${dataPath}`)
  console.log(`  source:  ${source}`)
  console.log('')

  const pairingResults = await runPool(pairings, (p) => checkPairing(p))

  // woff2 spot check — one per unique URL across the whole run
  const woff2Urls = [...new Set(pairingResults.flatMap((r) => r.woff2Urls))]
  const woff2Results = await runPool(woff2Urls, (url) => checkWoff2Cache(url))

  const failedPairings = pairingResults.filter((r) => r.problems.length > 0)
  const failedWoff2 = woff2Results.filter((r) => !r.ok)

  if (failedPairings.length > 0 || failedWoff2.length > 0) {
    console.log('FAILURES:')
    for (const r of failedPairings) {
      for (const problem of r.problems) console.log(`  ✖ ${problem}`)
    }
    for (const r of failedWoff2) console.log(`  ✖ woff2 cache: ${r.url}\n      ${r.note}`)
    console.log('')
  }

  const okPairings = pairings.length - failedPairings.length
  console.log(
    `validate:fonts — ${failedPairings.length === 0 && failedWoff2.length === 0 ? 'PASS' : 'FAIL'}: ` +
      `${okPairings}/${pairings.length} pairing(s) clean, ${woff2Results.length - failedWoff2.length}/${woff2Results.length} woff2 cache check(s) clean`,
  )
  process.exit(failedPairings.length > 0 || failedWoff2.length > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error(`validate:fonts — aborted: ${err instanceof Error ? err.message : String(err)}`)
  process.exit(1)
})
