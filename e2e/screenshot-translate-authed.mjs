import { chromium } from 'playwright'

const BASE = 'http://localhost:5173'
const OUT = '/tmp/translate-authed.png'

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await context.newPage()

// Dev login — creates the session cookie via the backend.
const res = await page.request.post(`${BASE}/api/dev/login`, {
  data: { email: 'translate-test@example.com' },
  headers: { 'Content-Type': 'application/json' },
})
if (!res.ok()) {
  throw new Error(`dev login failed: ${res.status()} ${await res.text()}`)
}

await page.goto(`${BASE}/translate`, { waitUntil: 'networkidle' })
await page.screenshot({ path: OUT, fullPage: true })

console.log(`wrote ${OUT}`)
await browser.close()
