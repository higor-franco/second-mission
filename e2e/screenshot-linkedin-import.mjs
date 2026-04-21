import { chromium } from 'playwright'

const BASE = 'http://localhost:5173'

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await context.newPage()

// Dev login as a seeded employer, then visit /employer/profile
const res = await page.request.post(`${BASE}/api/dev/employer-login`, {
  data: { email: 'hiring@nov.com' },
  headers: { 'Content-Type': 'application/json' },
})
if (!res.ok()) throw new Error(`dev login failed: ${res.status()}`)

// 1. Collapsed state — the import chip
await page.goto(`${BASE}/employer/profile`, { waitUntil: 'networkidle' })
await page.screenshot({ path: '/tmp/li-profile-collapsed.png', fullPage: true })

// 2. Expanded state — URL input + paste textarea
await page.getByText('Use →').click()
await page.waitForSelector('input[type="url"]')
await page.screenshot({ path: '/tmp/li-profile-expanded.png', fullPage: true })

// 3. After a successful paste import — fields filled, banner visible
await page.locator('textarea').first().fill(
  'About NOV. NOV Inc. (formerly National Oilwell Varco) is an American multinational corporation based in Houston, Texas. It is a leading provider of equipment and components used in oil and gas drilling and production operations. Industry: Oil and Gas',
)
await page.getByRole('button', { name: 'Extract from text' }).click()
// Wait for the imported banner to appear (serves as our "done" signal).
await page.waitForSelector('text=Imported from LinkedIn', { timeout: 30_000 })
await page.screenshot({ path: '/tmp/li-profile-imported.png', fullPage: true })

await browser.close()
console.log('done')
