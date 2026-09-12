import '../testing/index.ts'

import { markdownToDoc } from '@meowdown/core'
import { Profiler, type ProfilerOnRenderCallback } from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'
import { commands } from 'vitest/browser'

import { MarkdownView } from './markdown-view.tsx'

// A streaming cost harness, not a behavior test. Run it on demand with
//
//   VITE_MEOWDOWN_PERF=1 pnpm exec vitest run --retry=0 src/components/markdown-view.perf.test.tsx
//
// It feeds a document to `MarkdownView` in 40-character steps, times every
// step, and writes the samples and a summary to `perf-out/`.

const OUT_DIR = './perf-out'
const DELTA = 40

const SECTION_COUNT = 40

function longDocument(): string {
  const sections: string[] = ['# The long document\n', 'Many blocks, many inline marks.\n']
  for (let index = 1; index <= SECTION_COUNT; index++) {
    sections.push(`## Section ${index}: field notes\n`)
    sections.push(
      `Entry ${index} starts with **bold intent**, drifts into *italic asides*, and ends with ` +
        `\`inline code\` plus a [link](https://example.com/section-${index}) and a #note-${index} tag.\n`,
    )
    if (index % 3 === 0) {
      sections.push(
        `+ [ ] Follow up on section ${index}\n+ [x] Archive section ${index - 1}\n- [ ] Cross-check with [[Daily journal]]\n`,
      )
    } else {
      sections.push(
        `- First observation of section ${index}\n  - A nested detail\n  - Another nested detail\n- Second observation\n- Third observation with ~~struck~~ text\n`,
      )
    }
    if (index % 5 === 0) {
      sections.push(
        `| Column | Value |\n| --- | --- |\n| alpha ${index} | **one** |\n| beta ${index} | *two* |\n`,
      )
    }
    if (index % 4 === 0) {
      sections.push(
        `\`\`\`ts\nexport function section${index}(value: number): string {\n  return \`section \${value}\`\n}\n\`\`\`\n`,
      )
    }
    sections.push(
      `Closing paragraph ${index}: the inline math $x_{${index}} = ${index}^2$ keeps the math pipeline warm.\n`,
    )
  }
  return sections.join('\n')
}

function codeDocument(): string {
  const lines = Array.from({ length: 300 }, (_, index) => {
    return `export function helper${index}(value: number, label: string): string {\n  return \`\${label}: \${value * ${index}}\`\n}`
  }).join('\n\n')
  return `# Reply\n\nSome intro text with **bold**.\n\n\`\`\`ts\n${lines}\n\`\`\`\n\nDone.\n`
}

interface Sample {
  step: number
  length: number
  blocks: number
  parseMs: number
  renderMs: number
  totalMs: number
}

interface Stats {
  n: number
  median: number
  p90: number
  max: number
  mean: number
}

function stats(values: number[]): Stats {
  const sorted = [...values].sort((left, right) => left - right)
  const pick = (quantile: number) => {
    return sorted[Math.min(sorted.length - 1, Math.floor(quantile * sorted.length))] ?? 0
  }
  const sum = sorted.reduce((total, value) => total + value, 0)
  return {
    n: sorted.length,
    median: pick(0.5),
    p90: pick(0.9),
    max: sorted[sorted.length - 1] ?? 0,
    mean: sum / (sorted.length || 1),
  }
}

function summarize(samples: Sample[]) {
  return {
    parse: stats(samples.map((sample) => sample.parseMs)),
    render: stats(samples.map((sample) => sample.renderMs)),
    total: stats(samples.map((sample) => sample.totalMs)),
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function streamDocument(name: string, source: string) {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  let renderMs = 0
  const onRender: ProfilerOnRenderCallback = (_id, _phase, actualDuration) => {
    renderMs += actualDuration
  }
  const mount = (markdown: string) => {
    // Synchronous so the wall-clock time below covers render and commit.
    // eslint-disable-next-line @eslint-react/dom-no-flush-sync
    flushSync(() => {
      root.render(
        <Profiler id="view" onRender={onRender}>
          <MarkdownView markdown={markdown} />
        </Profiler>,
      )
    })
  }

  // Warm up: the full document once, so KaTeX and code grammars are loaded.
  mount(source)
  await sleep(2500)
  mount('')
  await sleep(100)

  const samples: Sample[] = []
  for (let step = 1, length = DELTA; length < source.length + DELTA; step++, length += DELTA) {
    const markdown = source.slice(0, length)
    const parseStart = performance.now()
    const doc = markdownToDoc(markdown)
    const parseMs = performance.now() - parseStart

    renderMs = 0
    const start = performance.now()
    mount(markdown)
    samples.push({
      step,
      length,
      blocks: doc.childCount,
      parseMs,
      renderMs,
      totalMs: performance.now() - start,
    })
  }
  root.unmount()
  container.remove()

  const summary = {
    name,
    sourceLength: source.length,
    steps: samples.length,
    all: summarize(samples),
    lastQuarter: summarize(samples.filter((sample) => sample.length > source.length * 0.75)),
  }
  await commands.writeFile(`${OUT_DIR}/${name}.json`, JSON.stringify({ summary, samples }, null, 2))
  return summary
}

describe.skipIf(!import.meta.env.VITE_MEOWDOWN_PERF)('MarkdownView streaming cost', () => {
  it('measures the per-step cost of a growing markdown prop', async () => {
    const results = [
      await streamDocument('long-doc', longDocument()),
      await streamDocument('code-doc', codeDocument()),
    ]
    await commands.writeFile(`${OUT_DIR}/summary.json`, JSON.stringify(results, null, 2))
    expect(results).toHaveLength(2)
  }, 600_000)
})
