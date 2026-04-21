// Post-deploy smoke check — pulls the public landing page from the live
// domain and captures the FAQ section so we can visually confirm the new
// beta disclosure is live.

import { chromium } from 'playwright'

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await ctx.newPage()

await page.goto('https://second-mission.com/', { waitUntil: 'domcontentloaded' })
await page.locator('#faq').scrollIntoViewIfNeeded()
await page.waitForTimeout(1500)
await page.screenshot({ path: '/tmp/prod-faq-beta.png', fullPage: false })

await browser.close()
console.log('done')
