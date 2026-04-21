import { chromium } from 'playwright'

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await ctx.newPage()

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' })
// Full landing with FAQ included.
await page.screenshot({ path: '/tmp/faq-landing-full.png', fullPage: true })

// Scroll to the FAQ section and grab the viewport.
await page.locator('#faq').scrollIntoViewIfNeeded()
await page.waitForTimeout(500) // let animations settle
await page.screenshot({ path: '/tmp/faq-viewport.png', fullPage: false })

// Open a different question and grab another screenshot so we can
// verify the accordion behavior in the visual pass.
await page.getByRole('button', { name: /regular job board/i }).click()
await page.waitForTimeout(300)
await page.locator('#faq').scrollIntoViewIfNeeded()
await page.screenshot({ path: '/tmp/faq-viewport-2.png', fullPage: false })

await browser.close()
console.log('done')
