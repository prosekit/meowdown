import { webkit } from 'playwright'
import fs from 'node:fs'

const OUT = process.env.OUT_DIR
fs.mkdirSync(OUT, { recursive: true })

async function measureBlackCaretColumns(page, clip, label) {
  let maxCols = 0
  for (let i = 0; i < 8; i++) {
    const path = `${OUT}/${label}-${i}.png`
    await page.screenshot({ path, clip })
    const b64 = fs.readFileSync(path).toString('base64')
    const cols = await page.evaluate(async (dataURL) => {
      const img = new Image()
      await new Promise((resolve) => {
        img.onload = resolve
        img.src = dataURL
      })
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0)
      const { data } = ctx.getImageData(0, 0, img.width, img.height)
      let caretCols = 0
      for (let x = 0; x < img.width; x++) {
        let darkRun = 0
        for (let y = 0; y < img.height; y++) {
          const i = (y * img.width + x) * 4
          if (data[i] < 90 && data[i + 1] < 90 && data[i + 2] < 90) darkRun++
        }
        if (darkRun > img.height * 0.55) caretCols++
      }
      return caretCols
    }, `data:image/png;base64,${b64}`)
    maxCols = Math.max(maxCols, cols)
    await page.waitForTimeout(140)
  }
  return maxCols
}

async function probeMode(mode) {
  const browser = await webkit.launch()
  const page = await browser.newPage({ viewport: { width: 1100, height: 800 }, deviceScaleFactor: 4 })
  await page.goto(`http://localhost:4322/?mode=${mode}`)
  await page.waitForSelector('.ProseMirror')
  await page.waitForTimeout(500)
  await page.click('.ProseMirror')
  await page.keyboard.press('Meta+ArrowDown')
  await page.keyboard.press('Enter')
  await page.keyboard.type('www.x.com<!-- {"noLink":true} -->', { delay: 15 })
  await page.waitForTimeout(400)
  await page.addStyleTag({ content: '.md-virtual-caret { display: none !important; }' })

  const placed = await page.evaluate(() => {
    const pm = document.querySelector('.ProseMirror')
    const walker = document.createTreeWalker(pm, NodeFilter.SHOW_TEXT)
    let node
    while ((node = walker.nextNode())) {
      const idx = node.data.indexOf('www.x.')
      if (idx >= 0) {
        getSelection().collapse(node, idx + 6)
        const rect = getSelection().getRangeAt(0).getBoundingClientRect()
        if (rect.y > 600 || rect.y < 100) {
          document.querySelector('.overflow-y-auto')?.scrollBy(0, rect.y - 300)
        }
        const packDisplay = getComputedStyle(node.parentElement).display
        const commentSpan = node.parentElement.querySelector('.md-magic')
        return {
          packDisplay,
          commentFontSize: commentSpan ? getComputedStyle(commentSpan).fontSize : 'missing',
          commentOpacity: commentSpan ? getComputedStyle(commentSpan).opacity : 'missing',
        }
      }
    }
    return { error: 'not found' }
  })
  await page.waitForTimeout(400)
  const pos = await page.evaluate(() => {
    const rect = getSelection().getRangeAt(0).getBoundingClientRect()
    return { x: rect.x, y: rect.y, h: rect.height }
  })
  const clip = { x: pos.x - 12, y: pos.y - 6, width: 24, height: pos.h + 12 }
  const caretCols = await measureBlackCaretColumns(page, clip, mode)
  await browser.close()
  return { ...placed, caretCols }
}

for (const mode of ['show', 'focus', 'hide']) {
  const result = await probeMode(mode)
  console.log(
    `${mode.padEnd(6)} pack display=${result.packDisplay} comment font-size=${result.commentFontSize} opacity=${result.commentOpacity} native caret columns=${result.caretCols}`,
  )
}
console.log('done')
