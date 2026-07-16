import '../testing/index.ts'

import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { page } from 'vitest/browser'

import type { BeautifulMermaidRender } from '../hooks/use-beautiful-mermaid.ts'

import { MermaidRender } from './mermaid-render.tsx'

describe('MermaidRender', () => {
  it('isolates its live theme from generic host variables without rendering again', async () => {
    const renderer = vi.fn<BeautifulMermaidRender>((_source, options) => {
      return `<svg xmlns="http://www.w3.org/2000/svg" style="color:${options?.muted}"><text>Diagram</text></svg>`
    })
    await render(
      <div data-testid="mermaid-theme-host">
        <MermaidRender renderer={renderer} source={'flowchart LR\n  A --> B'} />
      </div>,
    )
    const host = page.getByTestId('mermaid-theme-host')
    const svg = host.locate('svg')
    host.element().style.setProperty('--muted', 'rgb(255, 255, 255)')
    host.element().style.setProperty('--meowdown-mermaid-muted', 'rgb(1, 2, 3)')
    await expect.element(svg).toHaveStyle({ color: 'rgb(1, 2, 3)' })

    host.element().style.setProperty('--muted', 'rgb(0, 0, 0)')
    host.element().style.setProperty('--meowdown-mermaid-muted', 'rgb(4, 5, 6)')

    await expect.element(svg).toHaveStyle({ color: 'rgb(4, 5, 6)' })
    expect(renderer).toHaveBeenCalledOnce()
    expect(renderer).toHaveBeenCalledWith('flowchart LR\n  A --> B', {
      bg: 'var(--meowdown-mermaid-bg)',
      fg: 'var(--meowdown-mermaid-fg)',
      line: 'var(--meowdown-mermaid-line)',
      accent: 'var(--meowdown-mermaid-accent)',
      muted: 'var(--meowdown-mermaid-muted)',
      surface: 'var(--meowdown-mermaid-surface)',
      border: 'var(--meowdown-mermaid-border)',
      interactive: false,
      transparent: true,
    })
  })
})
