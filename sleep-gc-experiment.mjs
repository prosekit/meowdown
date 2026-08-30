// Controlled experiment: does inserting short event-loop idles between
// allocation bursts reduce RSS in WebKit (JSC) vs Chromium (V8)?
// Usage: node sleep-gc-experiment.mjs [browser] [interval] [rep]
//   with no args: runs the full matrix sequentially.
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { appendFileSync } from 'node:fs'
import { webkit, chromium } from 'playwright'

const pexec = promisify(execFile)

const N_BURSTS = 30
const ITERS = 200000
const SAMPLE_MS = 200
const POST_MS = 4000

const OUT = process.env.OUT_FILE || '/tmp/sleep-gc-results/results.jsonl'

const matchers = {
  webkit: (cmd) => cmd.includes('ms-playwright') && cmd.includes('WebContent'),
  chromium: (cmd) => cmd.includes('ms-playwright') && cmd.includes('--type=renderer'),
}

async function sampleRSS(matchFn) {
  const { stdout } = await pexec('ps', ['-axo', 'pid=,rss=,command='], {
    maxBuffer: 64 * 1024 * 1024,
  })
  const rows = []
  for (const line of stdout.split('\n')) {
    const m = line.match(/^\s*(\d+)\s+(\d+)\s+(.*)$/)
    if (!m) continue
    if (matchFn(m[3])) rows.push({ pid: +m[1], rssKB: +m[2] })
  }
  return rows
}

async function footprintKB(pid) {
  try {
    const { stdout } = await pexec('footprint', [String(pid)], { maxBuffer: 8 * 1024 * 1024 })
    const m = stdout.match(/Footprint:\s+([\d.]+)\s+(KB|MB|GB)/)
    if (!m) return null
    const v = parseFloat(m[1])
    return m[2] === 'GB' ? v * 1024 * 1024 : m[2] === 'MB' ? v * 1024 : v
  } catch {
    return null
  }
}

async function topSnapshot(pid) {
  try {
    const { stdout } = await pexec('top', ['-l', '1', '-pid', String(pid), '-stats', 'pid,mem,cmprs'], {
      maxBuffer: 8 * 1024 * 1024,
    })
    const lines = stdout.trim().split('\n')
    return lines[lines.length - 1].trim()
  } catch (e) {
    return 'top-failed: ' + e.message
  }
}

// Runs inside the page. Bursts of short-lived, hard-to-compress allocations.
const pageMain = async ({ nBursts, iters, interval }) => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const burst = () => {
    const t0 = performance.now()
    let sink = 0
    for (let i = 0; i < iters; i++) {
      const s =
        'x' +
        Math.random().toString(36).slice(2) +
        (i * 1.7).toString() +
        '.' +
        Math.random().toString(16).slice(2)
      const parts = s.split('.')
      const obj = { a: s, b: parts, c: i, d: [i, s.length, parts.length] }
      const arr = [obj, s.slice(0, 8), parts.join('-')]
      sink += arr.length + (obj.c % 7) + s.charCodeAt(0)
    }
    return { ms: performance.now() - t0, sink }
  }
  const burstMs = []
  let sink = 0
  const t0 = performance.now()
  if (interval === 'none') {
    for (let i = 0; i < nBursts; i++) {
      const r = burst()
      burstMs.push(r.ms)
      sink += r.sink
    }
  } else {
    const ms = Number(interval)
    for (let i = 0; i < nBursts; i++) {
      const r = burst()
      burstMs.push(r.ms)
      sink += r.sink
      await sleep(ms)
    }
  }
  const totalMs = performance.now() - t0
  return {
    totalMs,
    computeMs: burstMs.reduce((a, b) => a + b, 0),
    burstMs: burstMs.map((x) => Math.round(x)),
    sink,
  }
}

function maxRow(rows) {
  if (rows.length === 0) return null
  return rows.reduce((a, b) => (b.rssKB > a.rssKB ? b : a))
}

async function runOnce(browserName, interval, rep) {
  const launcher = browserName === 'webkit' ? webkit : chromium
  const browser = await launcher.launch({ headless: true })
  const page = await browser.newPage()
  await page.goto('about:blank')
  // small settle so baseline sample exists
  await new Promise((r) => setTimeout(r, 600))

  const samples = []
  let stop = false
  const t0 = Date.now()
  const samplerLoop = (async () => {
    while (!stop) {
      try {
        const rows = await sampleRSS(matchers[browserName])
        const m = maxRow(rows)
        if (m) {
          const fp = await footprintKB(m.pid)
          samples.push({ t: Date.now() - t0, rssKB: m.rssKB, fpKB: fp, pid: m.pid, n: rows.length })
        }
      } catch {}
      await new Promise((r) => setTimeout(r, SAMPLE_MS))
    }
  })()

  const hostT0 = Date.now()
  const result = await page.evaluate(pageMain, {
    nBursts: N_BURSTS,
    iters: ITERS,
    interval,
  })
  const endT = Date.now() - t0
  const hostWallMs = Date.now() - hostT0

  // capture compressed-memory snapshot at end of bursts
  const lastSample = samples[samples.length - 1]
  const topAtEnd = lastSample ? await topSnapshot(lastSample.pid) : 'no-sample'

  await new Promise((r) => setTimeout(r, POST_MS))
  const topAfterIdle = lastSample ? await topSnapshot(lastSample.pid) : 'no-sample'
  stop = true
  await samplerLoop
  await browser.close()

  const during = samples.filter((s) => s.t <= endT)
  const post = samples.filter((s) => s.t > endT)
  const peak = during.length ? Math.max(...during.map((s) => s.rssKB)) : 0
  const nearEnd = during.length ? during[during.length - 1].rssKB : 0
  const postMin = post.length ? Math.min(...post.map((s) => s.rssKB)) : 0
  const postLast = post.length ? post[post.length - 1].rssKB : 0
  const baseline = samples.length ? samples[0].rssKB : 0
  const fpOf = (arr, fn) => {
    const v = arr.map((s) => s.fpKB).filter((x) => x != null)
    return v.length ? fn(v) : 0
  }
  const fpPeak = fpOf(during, (v) => Math.max(...v))
  const fpEnd = during.length && during[during.length - 1].fpKB != null ? during[during.length - 1].fpKB : 0
  const fpPostLast = post.length && post[post.length - 1].fpKB != null ? post[post.length - 1].fpKB : 0

  const rec = {
    browser: browserName,
    interval,
    rep,
    baselineMB: +(baseline / 1024).toFixed(1),
    peakMB: +(peak / 1024).toFixed(1),
    endMB: +(nearEnd / 1024).toFixed(1),
    postMinMB: +(postMin / 1024).toFixed(1),
    postLastMB: +(postLast / 1024).toFixed(1),
    fpPeakMB: +(fpPeak / 1024).toFixed(1),
    fpEndMB: +(fpEnd / 1024).toFixed(1),
    fpPostLastMB: +(fpPostLast / 1024).toFixed(1),
    computeMs: Math.round(result.computeMs),
    totalMs: Math.round(result.totalMs),
    hostWallMs,
    burstMs: result.burstMs,
    topAtEnd,
    topAfterIdle,
    series: samples.map((s) => [s.t, +(s.rssKB / 1024).toFixed(1), s.fpKB != null ? +(s.fpKB / 1024).toFixed(1) : null]),
    endT,
  }
  appendFileSync(OUT, JSON.stringify(rec) + '\n')
  const summary = `${browserName} interval=${interval} rep=${rep}: rssPeak=${rec.peakMB} rssEnd=${rec.endMB} fpPeak=${rec.fpPeakMB} fpEnd=${rec.fpEndMB} fpPostIdle=${rec.fpPostLastMB} compute=${rec.computeMs}ms total=${rec.totalMs}ms`
  console.log(summary)
  return rec
}

const intervals = ['none', '0', '1', '16', '100']

async function main() {
  const [, , argBrowser, argInterval, argRep] = process.argv
  if (argBrowser) {
    await runOnce(argBrowser, argInterval, Number(argRep || 1))
    return
  }
  for (let rep = 1; rep <= 2; rep++) {
    for (const b of ['webkit', 'chromium']) {
      for (const iv of intervals) {
        await runOnce(b, iv, rep)
      }
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
