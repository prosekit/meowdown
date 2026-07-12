import '../testing/index.ts'

import { createRef, type ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { page } from 'vitest/browser'

import { hover, unhover } from '../testing/mouse.ts'

import { MeowdownEditor } from './editor.tsx'
import type { EditorHandle } from './types.ts'
import { WikilinkHoverCard } from './wikilink-hover-card.tsx'

const pmRoot = page.locate('.ProseMirror')
const card = page.getByTestId('wikilink-hover-card')

function HostPreviewCard() {
  return (
    <WikilinkHoverCard>
      {(hit) => <div data-testid="hover-body">Preview: {hit.target}</div>}
    </WikilinkHoverCard>
  )
}

describe('WikilinkHoverCard', () => {
  it('opens after a 300ms dwell and closes on leave', async () => {
    await unhover()
    await render(
      <MeowdownEditor initialMarkdown="see [[Note]] here" blockHandle={false}>
        <HostPreviewCard />
      </MeowdownEditor>,
    )

    await hover(pmRoot.getByTestId('wikilink'))
    await expect.element(card).not.toBeInTheDocument()
    await expect.element(card, { timeout: 1000 }).toHaveTextContent('Preview: Note')

    await unhover()
    await expect.element(card).not.toBeInTheDocument()
  })

  it('restarts the dwell when the pointer moves to an adjacent target', async () => {
    await unhover()
    await render(
      <MeowdownEditor
        initialMarkdown="[[Alpha|A wide alias]][[Beta|Another wide alias]]"
        blockHandle={false}
      >
        <HostPreviewCard />
      </MeowdownEditor>,
    )
    const links = pmRoot.getByTestId('wikilink')

    await hover(links.nth(0))
    await new Promise((resolve) => setTimeout(resolve, 200))
    await hover(links.nth(1))
    await new Promise((resolve) => setTimeout(resolve, 150))
    await expect.element(card).not.toBeInTheDocument()
    await expect.element(card, { timeout: 1000 }).toHaveTextContent('Preview: Beta')
  })

  it('moves the open card to the next hovered link', async () => {
    await unhover()
    await render(
      <MeowdownEditor initialMarkdown="[[Alpha]] and [[Beta]]" blockHandle={false}>
        <HostPreviewCard />
      </MeowdownEditor>,
    )
    const links = pmRoot.getByTestId('wikilink')

    await hover(links.nth(0))
    await expect.element(card, { timeout: 1000 }).toHaveTextContent('Preview: Alpha')

    await hover(links.nth(1))
    await expect.element(card, { timeout: 1000 }).toHaveTextContent('Preview: Beta')
  })

  it('renders no card when the render prop returns null for the target', async () => {
    await unhover()
    await render(
      <MeowdownEditor initialMarkdown="[[Missing]] then [[Known]]" blockHandle={false}>
        <WikilinkHoverCard>
          {(hit) => (hit.target === 'Known' ? <div>Preview: {hit.target}</div> : null)}
        </WikilinkHoverCard>
      </MeowdownEditor>,
    )
    const links = pmRoot.getByTestId('wikilink')

    await hover(links.nth(0))
    await new Promise((resolve) => setTimeout(resolve, 500))
    await expect.element(card).not.toBeInTheDocument()

    await hover(links.nth(1))
    await expect.element(card, { timeout: 1000 }).toHaveTextContent('Preview: Known')
  })

  it('opens with the resolved body of an async render function', async () => {
    await unhover()
    await render(
      <MeowdownEditor initialMarkdown="see [[Note]] here" blockHandle={false}>
        <WikilinkHoverCard>
          {async (hit) => {
            await new Promise((resolve) => setTimeout(resolve, 50))
            return <div>Async preview: {hit.target}</div>
          }}
        </WikilinkHoverCard>
      </MeowdownEditor>,
    )

    await hover(pmRoot.getByTestId('wikilink'))
    await expect.element(card).not.toBeInTheDocument()
    await expect.element(card, { timeout: 2000 }).toHaveTextContent('Async preview: Note')
  })

  it('renders no card when the promise resolves to null', async () => {
    await unhover()
    await render(
      <MeowdownEditor initialMarkdown="see [[Missing]] here" blockHandle={false}>
        <WikilinkHoverCard>
          {async () => {
            await new Promise((resolve) => setTimeout(resolve, 50))
            return null
          }}
        </WikilinkHoverCard>
      </MeowdownEditor>,
    )

    await hover(pmRoot.getByTestId('wikilink'))
    await new Promise((resolve) => setTimeout(resolve, 600))
    await expect.element(card).not.toBeInTheDocument()
  })

  it('renders no card when the render promise rejects', async () => {
    await unhover()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    await render(
      <MeowdownEditor initialMarkdown="see [[Broken]] here" blockHandle={false}>
        <WikilinkHoverCard>
          {async () => {
            await new Promise((resolve) => setTimeout(resolve, 50))
            throw new Error('load failed')
          }}
        </WikilinkHoverCard>
      </MeowdownEditor>,
    )

    await hover(pmRoot.getByTestId('wikilink'))
    await new Promise((resolve) => setTimeout(resolve, 600))
    await expect.element(card).not.toBeInTheDocument()
    expect(consoleError).toHaveBeenCalledWith(
      '[meowdown] wikilink hover card body rejected:',
      expect.any(Error),
    )
    consoleError.mockRestore()
  })

  it('discards a result that resolves after the pointer left', async () => {
    await unhover()
    let resolveBody: ((node: ReactNode) => void) | undefined
    await render(
      <MeowdownEditor initialMarkdown="see [[Note]] here" blockHandle={false}>
        <WikilinkHoverCard>
          {() =>
            new Promise<ReactNode>((resolve) => {
              resolveBody = resolve
            })
          }
        </WikilinkHoverCard>
      </MeowdownEditor>,
    )

    await hover(pmRoot.getByTestId('wikilink'))
    await vi.waitFor(() => expect(resolveBody).toBeDefined())
    await unhover()
    resolveBody?.(<div>Late preview</div>)
    await new Promise((resolve) => setTimeout(resolve, 200))
    await expect.element(card).not.toBeInTheDocument()
  })

  it('shows only the newest target when an older promise resolves late', async () => {
    await unhover()
    const resolvers = new Map<string, (node: ReactNode) => void>()
    await render(
      <MeowdownEditor initialMarkdown="[[Alpha]] and [[Beta]]" blockHandle={false}>
        <WikilinkHoverCard>
          {(hit) =>
            new Promise<ReactNode>((resolve) => {
              resolvers.set(hit.target, resolve)
            })
          }
        </WikilinkHoverCard>
      </MeowdownEditor>,
    )
    const links = pmRoot.getByTestId('wikilink')

    await hover(links.nth(0))
    await vi.waitFor(() => expect(resolvers.has('Alpha')).toBe(true))
    await hover(links.nth(1))
    await vi.waitFor(() => expect(resolvers.has('Beta')).toBe(true))

    resolvers.get('Alpha')?.(<div>Preview: Alpha</div>)
    await new Promise((resolve) => setTimeout(resolve, 100))
    await expect.element(card).not.toBeInTheDocument()

    resolvers.get('Beta')?.(<div>Preview: Beta</div>)
    await expect.element(card, { timeout: 1000 }).toHaveTextContent('Preview: Beta')
  })

  it('removes the card when the hovered link is deleted', async () => {
    await unhover()
    const handleRef = createRef<EditorHandle>()
    await render(
      <MeowdownEditor
        handleRef={handleRef}
        initialMarkdown="before [[Note]] after"
        blockHandle={false}
      >
        <HostPreviewCard />
      </MeowdownEditor>,
    )

    await hover(pmRoot.getByTestId('wikilink'))
    await expect.element(card, { timeout: 1000 }).toBeInTheDocument()

    handleRef.current?.setMarkdown('before after')
    await expect.element(card).not.toBeInTheDocument()
  })

  it('preserves editor focus and selection and makes the popup inert', async () => {
    await unhover()
    const handleRef = createRef<EditorHandle>()
    await render(
      <MeowdownEditor
        handleRef={handleRef}
        initialMarkdown="before [[Note]] after"
        blockHandle={false}
      >
        <HostPreviewCard />
      </MeowdownEditor>,
    )
    handleRef.current?.setSelection({ type: 'text', anchor: 2, head: 2 })
    handleRef.current?.focus()
    const activeElement = document.activeElement
    const selection = handleRef.current?.getSelection()

    await hover(pmRoot.getByTestId('wikilink'))
    await expect.element(card, { timeout: 1000 }).toBeInTheDocument()

    expect(document.activeElement).toBe(activeElement)
    expect(handleRef.current?.getSelection()).toEqual(selection)
    await expect.element(card).toHaveAttribute('inert')
  })

  it('keeps the popup inside an 8px viewport margin near the bottom-right edge', async () => {
    await unhover()
    await render(
      <div style={{ position: 'fixed', right: 0, bottom: 0, width: 180 }}>
        <MeowdownEditor initialMarkdown="[[Edge]]" blockHandle={false}>
          <HostPreviewCard />
        </MeowdownEditor>
      </div>,
    )

    await hover(pmRoot.getByTestId('wikilink'))
    await expect.element(card, { timeout: 1000 }).toBeInTheDocument()
    const rect = card.element().getBoundingClientRect()
    expect(rect.left).toBeGreaterThanOrEqual(7)
    expect(rect.top).toBeGreaterThanOrEqual(7)
    expect(rect.right).toBeLessThanOrEqual(window.innerWidth - 7)
    expect(rect.bottom).toBeLessThanOrEqual(window.innerHeight - 7)
  })
})
