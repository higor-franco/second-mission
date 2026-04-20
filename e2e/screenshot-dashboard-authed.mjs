import { chromium } from 'playwright'

const BASE = 'http://localhost:5173'
const OUT = '/tmp/dashboard-authed.png'

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await context.newPage()

const res = await page.request.post(`${BASE}/api/dev/login`, {
  data: { email: 'dash-test@example.com' },
  headers: { 'Content-Type': 'application/json' },
})
if (!res.ok()) throw new Error(`dev login failed: ${res.status()}`)

await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' })
await page.screenshot({ path: OUT, fullPage: true })

console.log(`wrote ${OUT}`)
await browser.close()
