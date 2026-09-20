import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { setTimeout } from 'node:timers/promises'

import { chromium, webkit } from 'playwright'

const bytes = await readFile(new URL('../public/embed/media/motion.mp4', import.meta.url))
const requests = []
const mediaServer = createServer((request, response) => {
  if (request.url === '/control') {
    response.writeHead(200, { 'Content-Type': 'text/html', 'Referrer-Policy': 'origin' })
    response.end('<video controls src="/motion.mp4?control"></video>')
    return
  }
  requests.push(request.headers.referer)
  if (request.headers.referer) {
    response.writeHead(403).end()
    return
  }
  const match = /bytes=(\d+)-(\d*)/.exec(request.headers.range ?? '')
  const start = match ? Number(match[1]) : 0
  const end = match?.[2] ? Math.min(Number(match[2]), bytes.length - 1) : bytes.length - 1
  response.writeHead(match ? 206 : 200, {
    'Content-Type': 'video/mp4',
    'Accept-Ranges': 'bytes',
    'Access-Control-Allow-Origin': '*',
    'Content-Length': end - start + 1,
    ...(match ? { 'Content-Range': `bytes ${start}-${end}/${bytes.length}` } : {}),
  })
  response.end(bytes.subarray(start, end + 1))
})
await new Promise((resolve) => mediaServer.listen(0, '127.0.0.1', resolve))
const mediaUrl = `http://127.0.0.1:${mediaServer.address().port}/motion.mp4`
const portServer = createServer()
await new Promise((resolve) => portServer.listen(0, '127.0.0.1', resolve))
const port = portServer.address().port
await new Promise((resolve) => portServer.close(resolve))
const origin = `http://127.0.0.1:${port}`
const server = spawn('pnpm', ['exec', 'wrangler', 'dev', '--port', String(port)], {
  cwd: new URL('..', import.meta.url),
  stdio: 'inherit',
  shell: process.platform === 'win32',
})
try {
  let ready = false
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      if ((await fetch(origin)).ok) {
        ready = true
        break
      }
    } catch {}
    await setTimeout(1000)
  }
  assert.ok(ready, 'Wrangler did not start')
  for (const browserType of [chromium, webkit]) {
    const browser = await browserType.launch()
    try {
      const page = await browser.newPage()
      await page.route('https://react-tweet.vercel.app/api/tweet/*', (route) => {
        const id = route.request().url().split('/').at(-1)
        return route.fulfill({
          json: {
            data: {
              id_str: id,
              text: 'Playback fixture',
              display_text_range: [0, 16],
              created_at: '2026-09-21T00:00:00.000Z',
              user: { name: 'Fixture', screen_name: 'fixture' },
              edit_control: {},
              video: {
                aspectRatio: [16, 9],
                mediaAvailability: { status: 'Available' },
                videoId: { type: 'tweet', id },
                variants: [{ type: 'video/mp4', src: mediaUrl }],
              },
            },
          },
        })
      })
      for (const path of ['dashboard', 'preview']) {
        const response = await page.goto(
          `${origin}/playground/${path}/meowdown/main-editor/?doc=008-x-post`,
        )
        assert.equal(response.headers()['referrer-policy'], 'no-referrer')
        requests.length = 0
        await page.getByRole('button', { name: 'Play video', exact: true }).first().click()
        const player = page.locator('video').first()
        await page.waitForFunction(() => document.querySelector('video')?.currentTime > 0.1)
        assert.ok(requests.length > 0, 'No media request observed')
        assert.ok(
          requests.every((referer) => referer === undefined),
          'Media leaked Referer',
        )
        const before = await player.evaluate((video) => video.currentTime)
        await player.press('ArrowRight')
        await page.waitForFunction(
          (time) => document.querySelector('video')?.currentTime > time,
          before,
        )
      }
      requests.length = 0
      await page.goto(new URL('/control', mediaUrl).href)
      await page.waitForFunction(() => document.querySelector('video')?.error != null)
      assert.ok(requests.some(Boolean), 'Negative control did not send Referer')
    } finally {
      await browser.close()
    }
  }
} finally {
  server.kill()
  mediaServer.closeAllConnections()
  await new Promise((resolve) => mediaServer.close(resolve))
}
