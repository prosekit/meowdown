import { chromium, webkit } from 'playwright'
const name = process.argv[2] === 'webkit' ? 'webkit' : 'chromium'
const browser = await (name === 'webkit' ? webkit : chromium).launch()
const page = await browser.newPage({ viewport: { width: 1100, height: 800 } })
const logs = []
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.text().slice(0, 140)) })
await page.goto('http://localhost:4397/playground/dashboard/meowdown/main-editor/?doc=008-x-post', { waitUntil: 'networkidle' })
await page.waitForTimeout(5000)
await page.addStyleTag({ content: ':root{--meowdown-lightbox-duration:1500ms}' })
const poster = page.locator('meowdown-embed-x [data-poster]').first()
await poster.scrollIntoViewIfNeeded()
const before = await poster.boundingBox()
await poster.click()
await page.waitForTimeout(500)
const anims = await page.evaluate(() => document.getAnimations().flatMap((a) => {
  const e = a.effect; const p = e?.pseudoElement ?? ''
  if (!p.startsWith('::view-transition-group(meowdown')) return []
  const k = e.getKeyframes(); return [`${k[0]?.width}x${k[0]?.height} -> ${k.at(-1)?.width}x${k.at(-1)?.height}`]
}))
await page.screenshot({ path: `${name}-video-1-opening.png` })
await page.waitForTimeout(2500)
await page.screenshot({ path: `${name}-video-2-open.png` })
const open = await page.evaluate(() => {
  const v = document.querySelector('dialog video')
  return v ? { paused: v.paused, muted: v.muted, time: v.currentTime, size: [v.clientWidth, v.clientHeight], natural: [v.videoWidth, v.videoHeight], cardVideos: document.querySelectorAll('meowdown-embed-x video').length, focused: document.activeElement?.tagName } : null
})
// click on the player must not close; click on the dimmed area must
await page.mouse.click(550, 400)
await page.waitForTimeout(300)
const afterPlayerClick = await page.evaluate(() => !!document.querySelector('dialog video'))
await page.mouse.click(20, 400)
await page.waitForTimeout(600)
await page.screenshot({ path: `${name}-video-3-closing.png` })
await page.waitForTimeout(1800)
const closed = await page.evaluate(() => ({ dialog: !!document.querySelector('dialog[open]'), anyVideo: document.querySelectorAll('video').length }))
console.log(JSON.stringify({ before, anims, open, afterPlayerClick, closed, logs }, null, 1))
await browser.close()
