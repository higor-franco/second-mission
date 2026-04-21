// Visual check for the new veteran-facing public company profile page.
// Logs in as a veteran via the dev endpoint so the protected
// /companies/:id route actually renders (the page 404s for logged-out
// visitors by design). Seeds the veteran with an MOS so the opportunity
// card links are live too.

import { chromium } from 'playwright'

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await ctx.newPage()

// Dev login (vite proxies /api/* to the Go backend on :8080).
await page.goto('http://localhost:5173/')
await page.evaluate(async () => {
  await fetch('/api/dev/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email: 'demo-vet@secondmission.demo' }),
  })
  // Seed MOS so opportunities populate.
  await fetch('/api/veteran/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      name: 'Alex Ramirez',
      mos_code: '88M',
      rank: 'E-5',
      years_of_service: 6,
      separation_date: '2026-06-30',
      location: 'Killeen, TX',
      preferred_sectors: ['Energy', 'Logistics'],
    }),
  })
})

// /companies/1 — seeded NOV profile (from migration 012's backfill).
await page.goto('http://localhost:5173/companies/1', { waitUntil: 'domcontentloaded' })
await page.waitForSelector('h1') // wait for the hero title to render
await page.waitForTimeout(1200) // animations + fetch for listings
await page.screenshot({ path: '/tmp/company-profile-nov.png', fullPage: true })

// Opportunities page — verify the company name now renders as a link
// that deep-links into /companies/:id.
await page.goto('http://localhost:5173/opportunities', { waitUntil: 'domcontentloaded' })
await page.waitForSelector('h1')
await page.waitForTimeout(1500)
await page.screenshot({ path: '/tmp/opportunities-with-company-links.png', fullPage: true })

// FAQ — confirm the new beta entry is the one open by default.
await page.goto('http://localhost:5173/')
await page.locator('#faq').scrollIntoViewIfNeeded()
await page.waitForTimeout(500)
await page.screenshot({ path: '/tmp/faq-beta-top.png', fullPage: false })

await browser.close()
console.log('done')
