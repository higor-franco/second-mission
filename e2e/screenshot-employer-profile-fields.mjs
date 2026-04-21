// Visual check for the enriched employer profile form. Confirms the new
// public-info block (website, LinkedIn, size, founded year) renders and
// that the public-view link is visible.

import { chromium } from 'playwright'

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await ctx.newPage()

await page.goto('http://localhost:5173/')
await page.evaluate(async () => {
  await fetch('/api/dev/employer-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email: 'hiring@nov.com' }),
  })
})

await page.goto('http://localhost:5173/employer/profile', { waitUntil: 'domcontentloaded' })
await page.waitForSelector('h1')
await page.waitForTimeout(800)
await page.screenshot({ path: '/tmp/employer-profile-enriched.png', fullPage: true })

await browser.close()
console.log('done')
