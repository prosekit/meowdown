import '../testing/index.ts'

import { expect, it } from 'vitest'
import { render } from 'vitest-browser-react'
import { page } from 'vitest/browser'

import { MarkdownInlineView } from './markdown-inline-view.tsx'
import { MarkdownView } from './markdown-view.tsx'

it('renders paragraph marks with external reference definitions', async () => {
  await render(
    <div data-testid="inline-view">
      <MarkdownInlineView
        markdown={'# **first\nsecond** [link][ref]'}
        referenceDefinitions={
          new Map([['REF', { key: 'REF', href: 'https://example.com', title: '' }]])
        }
      />
    </div>,
  )
  const view = page.getByTestId('inline-view')
  await expect.element(view.locate('p')).toHaveTextContent('# **first second** [link][ref]')
  await expect.element(view.locate('strong')).toHaveTextContent('**first second**')
  await expect.element(view.getByRole('link')).toHaveAttribute('href', 'https://example.com')
})

it('keeps definition-looking paragraph content visible', async () => {
  await render(<MarkdownInlineView markdown="[ref]: https://example.com" />)
  await expect.element(page.locate('p')).toHaveTextContent('[ref]: https://example.com')
})

it('keeps local definitions ahead of supplied context in a full document', async () => {
  await render(
    <MarkdownView
      markdown={'[ref]: https://example.com/local\n\n[label][ref]'}
      referenceDefinitions={
        new Map([['REF', { key: 'REF', href: 'https://example.com/external', title: '' }]])
      }
    />,
  )
  await expect.element(page.getByRole('link')).toHaveAttribute('href', 'https://example.com/local')
})

it('refreshes inline links when the containing note definitions change', async () => {
  const screen = await render(
    <MarkdownInlineView
      markdown="[label][ref]"
      referenceDefinitions={
        new Map([['REF', { key: 'REF', href: 'https://example.com/old', title: '' }]])
      }
    />,
  )
  await expect.element(page.getByRole('link')).toHaveAttribute('href', 'https://example.com/old')
  await screen.rerender(
    <MarkdownInlineView
      markdown="[label][ref]"
      referenceDefinitions={
        new Map([['REF', { key: 'REF', href: 'https://example.com/new', title: '' }]])
      }
    />,
  )
  await expect.element(page.getByRole('link')).toHaveAttribute('href', 'https://example.com/new')
})
