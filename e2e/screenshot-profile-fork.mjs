// Dev-login as a brand-new veteran (empty profile) and screenshot the
// /profile page — which should render the setup fork, not the form.
//
// Requires DEV_MODE=1 on the backend (so /api/dev/login exists).
import { chromium } from 'playwright'

const viteURL = process.argv[2] || 'http://localhost:5173'
const outPath = process.argv[3] || '/tmp/profile-fork.png'
const email = `fork-demo-${Date.now()}@example.com`

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await context.newPage()

// Hit dev login, which creates the veteran on-the-fly with empty fields
// and drops a session cookie.
const resp = await context.request.post(`${viteURL}/api/dev/login`, {
  data: { email },
  headers: { 'Content-Type': 'application/json' },
})
if (!resp.ok()) {
  throw new Error(`dev login failed: ${resp.status()} ${await resp.text()}`)
}

await page.goto(`${viteURL}/profile`, { waitUntil: 'networkidle' })
// Give the /api/auth/me call + state transitions a beat.
await page.waitForSelector('text=LET\u2019S GET YOU SET UP', { timeout: 5000 }).catch(() => {
  // The apostrophe rendering differs between fonts; fall back to a looser match.
  return page.waitForSelector('text=/GET YOU SET UP/i', { timeout: 5000 })
})
await page.screenshot({ path: outPath, fullPage: true })

await browser.close()
console.log(`saved screenshot → ${outPath}`)
