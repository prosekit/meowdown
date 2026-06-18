import { describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'

import { setupFixture } from '../testing/index.ts'

const pmRoot = page.locate('.ProseMirror')

describe('autolink rendering', () => {
  it('renders a scheme autolink as a link', async () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('see https://example.com here')))
    await expect
      .element(pmRoot.getByRole('link', { name: 'https://example.com' }))
      .toBeInTheDocument()
  })

  it('renders a bare domain as a link', async () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('go to google.com now')))
    await expect.element(pmRoot.getByRole('link', { name: 'google.com' })).toBeInTheDocument()
  })

  // Locks the product decision: a link is never un-linked by moving the caret
  // into it. The link keeps its blue `<a>` and stays editable.
  it('keeps a scheme autolink a link when the caret is inside it', async () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('see https://exa<a>mple.com here')))
    await expect
      .element(pmRoot.getByRole('link', { name: 'https://example.com' }))
      .toBeInTheDocument()
  })

  it('keeps a bare domain a link when the caret is inside it', async () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('go to goo<a>gle.com now')))
    await expect.element(pmRoot.getByRole('link', { name: 'google.com' })).toBeInTheDocument()
  })
})
