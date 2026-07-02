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

  it('renders a configured custom scheme URL as a link', async () => {
    using fixture = setupFixture({ extensionOptions: { autolinkSchemes: ['reflect'] } })
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('open reflect://today now')))
    const link = pmRoot.getByRole('link', { name: 'reflect://today' })
    await expect.element(link).toBeInTheDocument()
    await expect.element(link).toHaveAttribute('href', 'reflect://today')
  })

  it('leaves a custom scheme URL plain text without the option', async () => {
    using fixture = setupFixture()
    const { n } = fixture
    fixture.set(n.doc(n.paragraph('open reflect://today or google.com now')))
    // The bare domain linking proves the inline-mark pass has run.
    await expect.element(pmRoot.getByRole('link', { name: 'google.com' })).toBeInTheDocument()
    await expect
      .element(pmRoot.getByRole('link', { name: 'reflect://today' }))
      .not.toBeInTheDocument()
  })
})
