/**
 * T16 — E2E happy path against the PRODUCTION build.
 *
 * Pragmatics recorded for the verifier (the dispatch offered "Playwright if it
 * installs cleanly, else a raw-CDP node script"):
 *
 * - `@playwright/test` 1.62.1 installs with ZERO browser downloads when driven
 *   through `channel: 'chrome'` — it launches the machine's real system Chrome
 *   (152 at authoring time) over CDP, the same engine every prior verifier
 *   drove by hand. The prior verifiers' raw-CDP harness technique notes all
 *   carry over (fresh profile per run = Playwright's default incognito-style
 *   context; `localhost` not `127.0.0.1` — vite preview binds IPv6 localhost
 *   on this machine; Enter activation is a plain click/press here, no
 *   `text:'\r'` quirk to work around).
 * - The suite runs the REAL network (Google Fonts css2 + woff2) through the
 *   app's own R2 gate — no font stubbing; the whole point is the production
 *   happy path.
 * - `reuseExistingServer: false` + `--strictPort`: never attach to a stale or
 *   foreign server on the port (the T10/T12 port-honesty rule). A foreign
 *   holder makes the run fail loudly instead of poisoning assertions.
 * - The webServer rebuilds `dist/` before preview, so the journey always runs
 *   against the current production bundle.
 * - Tests live in `tests/e2e/*.e2e.ts` (NOT `*.spec.ts`): vitest's default
 *   include glob would swallow `*.spec.ts` and try to run Playwright specs as
 *   unit tests; the `.e2e.ts` suffix + explicit `testMatch` keeps the two
 *   runners disjoint with zero cross-tool config.
 * - `workers: 1`, `fullyParallel: false`: one browser, one journey — the deck
 *   is random per run, so the spec asserts against live-captured state (never
 *   a fixed draw order); determinism is proven by running the suite twice.
 */

import { defineConfig } from '@playwright/test'

const PORT = 4317
const BASE = `http://localhost:${PORT}/`

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '**/*.e2e.ts',
  timeout: 420_000, // the exhaustion walk judges all 61 pairings over real network
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  outputDir: 'test-results',
  use: {
    channel: 'chrome', // system Chrome — no playwright browser download
    headless: true,
    viewport: { width: 1280, height: 800 }, // design-brief target viewport
    baseURL: BASE,
    actionTimeout: 20_000,
    navigationTimeout: 30_000,
  },
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: BASE,
    reuseExistingServer: false,
    timeout: 240_000,
  },
})
