import { expect, test } from '@playwright/test'

for (const mobile of [false, true]) {
  test(`buffered selection stays immediate on ${mobile ? 'mobile' : 'desktop'}`, async ({ browser }, testInfo) => {
    const context = await browser.newContext({
      viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 },
      isMobile: mobile,
      hasTouch: mobile,
    })
    const page = await context.newPage()
    try {
      await page.goto('http://localhost:4317/')
      await page.locator('.lane-explainer-dismiss').click()
      await expect(page.locator('.examination-room')).toHaveAttribute('data-state', 'ready')
      // Wait for speculative font requests to decode, including the paint gate.
      await page.waitForFunction(async () => {
        if (document.querySelectorAll('link[href*="display=block"]').length !== 4) return false
        await document.fonts.ready
        return [...document.fonts].every((face) => face.status !== 'loading')
      })
      await page.waitForTimeout(600)
      const timings = await page.evaluate(async () => {
        const results: number[] = []
        for (let index = 0; index < 3; index++) {
          const marker = document.querySelector('.marker-count')!
          const before = marker.textContent
          const started = performance.now()
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
          while (marker.textContent === before) {
            if (performance.now() - started > 1500) throw new Error('Buffered selection stalled')
            await new Promise(requestAnimationFrame)
          }
          results.push(performance.now() - started)
          const blind = document.querySelector<HTMLElement>('.lens-blind')
          if (blind && !blind.hidden) throw new Error('Buffered selection played the loading reveal')
        }
        return results
      })
      console.log(`${mobile ? 'mobile' : 'desktop'} buffered selection (ms): ${timings.map(Math.round).join(', ')}`)
      expect(Math.max(...timings)).toBeLessThan(200)
      await expect(page.locator('.lane-prescription')).toHaveText('Prescription · 3 saved')
      if (mobile) {
        await page.waitForTimeout(1000)
        const client = await context.newCDPSession(page)
        const before = await page.locator('.marker-count').textContent()
        await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 100, y: 340 }] })
        await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 220, y: 345 }] })
        await expect(page.locator('.acuity-lane')).toHaveAttribute('data-swipe', 'save')
        await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
        await expect(page.locator('.marker-count')).not.toHaveText(before!)
        await expect(page.locator('.lane-prescription')).toHaveText('Prescription · 4 saved')
        await expect.poll(() => page.locator('.dummy-frame').evaluate((paper) => getComputedStyle(paper).transform)).toBe('none')
        const beforeScroll = await page.locator('.marker-count').textContent()
        await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 190, y: 600 }] })
        await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 195, y: 420 }] })
        await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
        await expect(page.locator('.marker-count')).toHaveText(beforeScroll!)
        await page.locator('.acuity-lane').evaluate((lane) => { lane.scrollTop = 0 })
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
      await page.screenshot({ path: testInfo.outputPath('selection.png') })
    } finally {
      await context.close()
    }
  })
}
