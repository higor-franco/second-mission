// Navigate to /translate, switch to the "Upload my DD-214" tab, and capture
// the upload panel. Used for the visual check in this session.
import { chromium } from 'playwright'

const url = process.argv[2] || 'http://localhost:5173/translate'
const outPath = process.argv[3] || '/tmp/translate-dd214-tab.png'

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } })
const page = await context.newPage()

await page.goto(url, { waitUntil: 'networkidle' })
await page.getByRole('tab', { name: /upload my dd-214/i }).click()
// Give the tab content a beat to render the dashed upload box.
await page.waitForTimeout(400)
await page.screenshot({ path: outPath, fullPage: true })

await browser.close()
console.log(`saved screenshot → ${outPath}`)
