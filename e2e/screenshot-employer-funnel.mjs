import { chromium } from 'playwright'

const BASE = 'http://localhost:5173'

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1400, height: 900 } })
const page = await context.newPage()

// Log in as a real seeded employer that actually owns listings.
const res = await page.request.post(`${BASE}/api/dev/employer-login`, {
  data: { email: 'hiring@nov.com' },
  headers: { 'Content-Type': 'application/json' },
})
if (!res.ok()) throw new Error(`dev login failed: ${res.status()}`)

// 1. Dashboard screenshot with the new clickable listing rows
await page.goto(`${BASE}/employer/dashboard`, { waitUntil: 'networkidle' })
await page.screenshot({ path: '/tmp/emp-dashboard.png', fullPage: true })

// 2. Pick the first listing and visit its detail page. The dashboard has
// multiple links under /employer/listings/ — skip "/new" and pick one
// whose path ends in a number.
const links = await page.locator('a[href^="/employer/listings/"]').all()
let href = null
for (const l of links) {
  const h = await l.getAttribute('href')
  if (h && /\/employer\/listings\/\d+$/.test(h)) { href = h; break }
}
if (!href) throw new Error('no listing detail link found on dashboard')
console.log(`navigating to ${href}`)
await page.goto(`${BASE}${href}`, { waitUntil: 'networkidle' })
await page.screenshot({ path: '/tmp/emp-detail.png', fullPage: true })

// 3. Hit the edit page.
await page.goto(`${BASE}${href}/edit`, { waitUntil: 'networkidle' })
await page.screenshot({ path: '/tmp/emp-edit.png', fullPage: true })

await browser.close()
console.log('done')
