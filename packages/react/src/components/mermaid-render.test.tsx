import '../testing/index.ts'

import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { page } from 'vitest/browser'

import type { PeleRender } from '../hooks/use-pele.ts'

import styles from './code-block-view.module.css'
import { MermaidRender } from './mermaid-render.tsx'

function mockRenderer(svg: string) {
  return vi.fn<PeleRender>(() => ({
    svg,
    width: 0,
    height: 0,
    type: 'flowchart',
    mermaidType: 'flowchart-v2',
    links: [],
  }))
}

describe('MermaidRender', () => {
  it('isolates its live theme from host Pele variables without rendering again', async () => {
    const renderer = mockRenderer(
      '<svg xmlns="http://www.w3.org/2000/svg" style="color:var(--pele-muted)"><text>Diagram</text></svg>',
    )
    await render(
      <div data-testid="mermaid-theme-host">
        <MermaidRender
          renderer={renderer}
          source={'flowchart LR\n  A --> B'}
          className={styles.MermaidPreview}
        />
      </div>,
    )
    const host = page.getByTestId('mermaid-theme-host')
    const svg = host.locate('svg')
    host.element().style.setProperty('--pele-muted', 'rgb(255, 255, 255)')
    host.element().style.setProperty('--meowdown-mermaid-muted', 'rgb(1, 2, 3)')
    await expect.element(svg).toHaveStyle({ color: 'rgb(1, 2, 3)' })

    host.element().style.setProperty('--pele-muted', 'rgb(0, 0, 0)')
    host.element().style.setProperty('--meowdown-mermaid-muted', 'rgb(4, 5, 6)')

    await expect.element(svg).toHaveStyle({ color: 'rgb(4, 5, 6)' })
    expect(renderer).toHaveBeenCalledOnce()
  })

  it('gives each diagram its own ID prefix', async () => {
    const renderer = mockRenderer('<svg xmlns="http://www.w3.org/2000/svg"></svg>')
    await render(
      <div>
        <MermaidRender renderer={renderer} source="flowchart LR" />
        <MermaidRender renderer={renderer} source="flowchart LR" />
      </div>,
    )

    const prefixes = renderer.mock.calls.map(([, options]) => options?.idPrefix)
    expect(prefixes).toHaveLength(2)
    expect(prefixes[0]).toMatch(/^[\w-]+$/)
    expect(prefixes[1]).toMatch(/^[\w-]+$/)
    expect(prefixes[0]).not.toBe(prefixes[1])
  })

  it('rejects SVG with an event handler', async () => {
    const renderer = mockRenderer(
      '<svg xmlns="http://www.w3.org/2000/svg"><rect onclick="alert(1)"/></svg>',
    )
    await render(
      <MermaidRender renderer={renderer} source="flowchart LR" data-testid="mermaid-output" />,
    )

    const output = page.getByTestId('mermaid-output')
    await expect.element(output).toHaveAttribute('data-error')
    await expect.element(output).toHaveTextContent('Invalid SVG output.')
    await expect.element(output.locate('rect')).not.toBeInTheDocument()
  })

  it('rejects SVG with an external reference', async () => {
    const renderer = mockRenderer(
      '<svg xmlns="http://www.w3.org/2000/svg"><use href="https://example.com/a.svg#b"/></svg>',
    )
    await render(
      <MermaidRender renderer={renderer} source="flowchart LR" data-testid="mermaid-output" />,
    )

    const output = page.getByTestId('mermaid-output')
    await expect.element(output).toHaveTextContent('Invalid SVG output.')
  })

  it('rejects SVG with a foreign object', async () => {
    const renderer = mockRenderer(
      '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><div xmlns="http://www.w3.org/1999/xhtml">x</div></foreignObject></svg>',
    )
    await render(
      <MermaidRender renderer={renderer} source="flowchart LR" data-testid="mermaid-output" />,
    )

    const output = page.getByTestId('mermaid-output')
    await expect.element(output).toHaveTextContent('Invalid SVG output.')
  })
})
