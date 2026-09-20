import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { setTimeout } from 'node:timers/promises'

import { chromium, webkit } from 'playwright'

const bytes = await readFile(new URL('../public/embed/media/motion.mp4', import.meta.url))
const requests = []
const mediaServer = createServer((request, response) => {
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
const server = spawn('pnpm', ['exec', 'wrangler', 'dev', '--port', '4399'], {
  cwd: new URL('..', import.meta.url),
  stdio: 'inherit',
  shell: process.platform === 'win32',
})
try {
  let ready = false
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      if ((await fetch('http://127.0.0.1:4399/')).ok) {
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
          `http://127.0.0.1:4399/playground/${path}/meowdown/main-editor/?doc=008-x-post`,
        )
        assert.equal(response.headers()['referrer-policy'], 'no-referrer')
        requests.length = 0
        await page.getByRole('button', { name: 'Play video', exact: true }).first().click()
        const player = page.getByRole('video').or(page.locator('video')).first()
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
      // The same origin rejects a document that sends its referrer.
      await page.route('http://127.0.0.1:4399/referrer-control', (route) => {
        return route.fulfill({
          contentType: 'text/html',
          body: `<video controls src="${mediaUrl}"></video>`,
        })
      })
      requests.length = 0
      await page.goto('http://127.0.0.1:4399/referrer-control')
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
