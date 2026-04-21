// Visual check for the new bulk-job-import panel on the employer
// dashboard + the updated landing-page copy (women-veteran stat,
// E-4/E-6 explainer, support band).

import { chromium } from 'playwright'

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await ctx.newPage()

// --- Landing page (updated copy) ---
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(800)
await page.screenshot({ path: '/tmp/landing-updated.png', fullPage: true })

// Focus on the stats bar + the new "For Veterans" E-4/E-6 copy.
await page.locator('#how-it-works').scrollIntoViewIfNeeded()
await page.waitForTimeout(500)
await page.screenshot({ path: '/tmp/landing-e4e6-stats.png', fullPage: false })

// Focus on the new support band.
await page.locator('#support').scrollIntoViewIfNeeded()
await page.waitForTimeout(500)
await page.screenshot({ path: '/tmp/landing-support-band.png', fullPage: false })

// --- Employer dashboard with the new bulk import chip ---
await page.goto('http://localhost:5173/')
await page.evaluate(async () => {
  await fetch('/api/dev/employer-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email: 'hiring@nov.com' }),
  })
})
await page.goto('http://localhost:5173/employer/dashboard', { waitUntil: 'domcontentloaded' })
await page.waitForSelector('h1')
await page.waitForTimeout(1200)
await page.screenshot({ path: '/tmp/employer-dashboard-with-import.png', fullPage: true })

// Open the panel + paste a sample so the expanded state + draft cards
// are visible (running the actual extract would take ~10s; we skip).
await page.getByRole('button', { name: /BULK IMPORT JOBS FROM YOUR CAREERS PAGE/i }).click()
await page.waitForTimeout(800)
await page.screenshot({ path: '/tmp/employer-bulk-import-open.png', fullPage: false })

await browser.close()
console.log('done')
