import { readFileSync } from 'node:fs'

const file = process.argv[2] || '/tmp/sleep-gc-results/results.jsonl'
const recs = readFileSync(file, 'utf8')
  .trim()
  .split('\n')
  .map((l) => JSON.parse(l))

const order = ['none', '0', '1', '16', '100']
const pad = (s, n) => String(s).padEnd(n)

for (const browser of ['webkit', 'chromium']) {
  console.log('\n=== ' + browser + ' ===')
  console.log(
    pad('interval', 10) +
      pad('rep', 4) +
      pad('rssPeak', 9) +
      pad('rssEnd', 9) +
      pad('fpPeak', 9) +
      pad('fpEnd', 9) +
      pad('fpIdle', 9) +
      pad('compute', 9) +
      pad('total', 9) +
      'wall'
  )
  for (const iv of order) {
    for (const r of recs.filter((r) => r.browser === browser && r.interval === iv)) {
      console.log(
        pad(iv, 10) +
          pad(r.rep, 4) +
          pad(r.peakMB, 9) +
          pad(r.endMB, 9) +
          pad(r.fpPeakMB, 9) +
          pad(r.fpEndMB, 9) +
          pad(r.fpPostLastMB, 9) +
          pad(r.computeMs, 9) +
          pad(r.totalMs, 9) +
          r.hostWallMs
      )
    }
  }
}

// curve shapes: print compact fp series for webkit rep 1
console.log('\n=== webkit rep1 footprint curves (t_s:fpMB every ~1s) ===')
for (const iv of order) {
  const r = recs.find((r) => r.browser === 'webkit' && r.interval === iv && r.rep === 1)
  if (!r) continue
  const pts = r.series
    .filter((_, i) => i % 4 === 0)
    .map(([t, rss, fp]) => (t / 1000).toFixed(1) + ':' + (fp ?? '?'))
  console.log(pad(iv, 6) + ' endT=' + (r.endT / 1000).toFixed(1) + 's  ' + pts.join(' '))
}
console.log('\n=== webkit rep1 RSS curves (t_s:rssMB every ~1s) ===')
for (const iv of order) {
  const r = recs.find((r) => r.browser === 'webkit' && r.interval === iv && r.rep === 1)
  if (!r) continue
  const pts = r.series
    .filter((_, i) => i % 4 === 0)
    .map(([t, rss]) => (t / 1000).toFixed(1) + ':' + rss)
  console.log(pad(iv, 6) + ' endT=' + (r.endT / 1000).toFixed(1) + 's  ' + pts.join(' '))
}
