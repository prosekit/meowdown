import './theme.css'

import { sleep } from '@ocavue/utils'
import type { XPost } from '@post-embed/types'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { page, server, userEvent } from 'vitest/browser'

import { createPhoto, createPost } from './testing/fixtures.ts'

import { registerXPost, type XPostElement } from './index.ts'

beforeAll(() => {
  registerXPost()
})

function mount(text = 'Hello 😀\nA saved post.') {
  const element = document.createElement('meowdown-embed-x')
  element.dataset.testid = 'post'
  element.data = createPost(text)
  document.body.append(element)
  return element
}

const post = page.getByTestId('post')

afterEach(() => {
  document.body.replaceChildren()
  vi.restoreAllMocks()
})

describe('X post', () => {
  it.each(['https://example.com/unrelated', 'https://x.com/other/status/456'])(
    'renders explicit data without resolving the unrelated URL %s',
    async (url) => {
      const element = mount('Explicit snapshot')
      const resolver = vi.fn()
      element.resolver = resolver
      element.url = url
      await expect.element(post.getByText('Explicit snapshot')).toBeVisible()
      expect(resolver).not.toHaveBeenCalled()
    },
  )

  it('renders selectable light DOM text and native attribution links', async () => {
    const element = mount()
    await expect.element(post.getByText(/Hello 😀/)).toBeVisible()
    await expect
      .element(post.getByRole('link', { name: /Sep 10/ }))
      .toHaveAttribute('href', 'https://x.com/example/status/1234567890123456789')
    expect(element.shadowRoot).toBeNull()
    expect(element.hasAttribute('data')).toBe(false)
    if (server.browser === 'webkit' && navigator.platform.includes('Mac')) {
      await userEvent.keyboard('{Alt>}{Tab}{/Alt}')
    } else {
      await userEvent.tab()
    }
    await expect.element(post.getByRole('link', { name: '@example' })).toHaveFocus()
  })

  it('renders markup and character references as literal text', async () => {
    mount('A &amp; B <img src=x onerror=alert(1)>')
    await expect.element(post.getByText('A &amp; B <img src=x onerror=alert(1)>')).toBeVisible()
    await expect.element(post.getByRole('img')).not.toBeInTheDocument()
  })

  it('updates the same ID and clears the current view immediately', async () => {
    const element = mount('First')
    await expect.element(post.getByText('First')).toBeVisible()
    element.data = createPost('Second')
    expect(element.textContent).not.toContain('First')
    await expect.element(post.getByText('Second')).toBeVisible()
    element.data = createPost('Late')
    element.data = null
    await expect.element(post.getByText('This post is unavailable.')).toBeVisible()
    expect(element.textContent).not.toContain('Late')
  })

  it('shows invalid input and recovers with a valid snapshot', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const element = mount('Before')
    await expect.element(post.getByText('Before')).toBeVisible()
    Reflect.set(element, 'data', {})
    await expect.element(post.getByText('This post is unavailable.')).toBeVisible()
    expect(error).toHaveBeenCalledWith('[meowdown] Invalid X post data:', expect.any(Array))
    element.data = createPost('Recovered')
    await expect.element(post.getByText('Recovered')).toBeVisible()
  })

  it('handles schema defaults without inventing attribution', async () => {
    const element = mount()
    Reflect.set(element, 'data', { id: '123', author: {} })
    await expect.element(post).toHaveTextContent('')
    await expect.element(post.getByRole('link')).not.toBeInTheDocument()
  })

  it('reconnects with the latest data and preserves host children', async () => {
    const element = mount('First')
    const annotation = document.createElement('span')
    annotation.textContent = 'Host annotation'
    element.append(annotation)
    await expect.element(post.getByText('First')).toBeVisible()
    element.data = createPost('Stale')
    element.remove()
    element.data = createPost('Reconnected')
    document.body.append(element)
    await expect.element(post.getByText('Reconnected')).toBeVisible()
    await expect.element(post.getByText('Host annotation')).toBeVisible()
    element.data = null
    await expect.element(post.getByText('Host annotation')).toBeVisible()
    await expect.element(post.getByText('This post is unavailable.')).toBeVisible()
    expect(element.children.length).toBe(2)
  })

  it('reuses only the direct marked container and replaces server content', async () => {
    const element = document.createElement('meowdown-embed-x')
    element.dataset.testid = 'post'
    const annotation = document.createElement('div')
    annotation.innerHTML = '<div data-root>Host annotation</div>'
    const container = document.createElement('div')
    container.dataset.root = ''
    container.textContent = 'Server fallback'
    element.append(annotation, container)
    element.data = createPost('Saved snapshot')
    document.body.append(element)
    await expect.element(post.getByText('Saved snapshot')).toBeVisible()
    expect(element.querySelector(':scope > [data-root]')).toBe(container)
    expect(element.children.length).toBe(2)
    expect(container.textContent).not.toContain('Server fallback')
    expect(annotation.textContent).toBe('Host annotation')
    element.data = createPost('Updated snapshot')
    await expect.element(post.getByText('Updated snapshot')).toBeVisible()
    expect(element.querySelector(':scope > [data-root]')).toBe(container)
  })

  it('shows a themed fallback for missing data without logging an error', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const element = document.createElement('meowdown-embed-x')
    element.dataset.testid = 'post'
    document.body.append(element)
    await expect.element(post.getByText('This post is unavailable.')).toBeVisible()
    expect(element.querySelector('[data-fallback]')).not.toBeNull()
    expect(error).not.toHaveBeenCalled()
  })

  it('preserves whitespace through the theme and inherits custom properties', async () => {
    const wrapper = document.createElement('div')
    wrapper.style.setProperty('--meowdown-embed-padding', '24px')
    wrapper.style.setProperty('--meowdown-embed-color', 'rgb(12, 34, 56)')
    document.body.append(wrapper)
    const element = mount('First  second')
    wrapper.append(element)
    await expect.element(post.getByText('First second')).toBeVisible()
    const content = element.querySelector('[data-text]')
    const root = element.querySelector('[data-root]')
    if (!content || !root) throw new Error('Missing rendered post parts')
    expect(getComputedStyle(content).whiteSpace).toBe('pre-wrap')
    expect(getComputedStyle(root).padding).toBe('24px')
    expect(getComputedStyle(content).color).toBe('rgb(12, 34, 56)')
    expect(element.querySelector('[style]')).toBeNull()
  })

  it('keeps instances independent and registration idempotent', async () => {
    const constructor = customElements.get('meowdown-embed-x')
    registerXPost()
    expect(customElements.get('meowdown-embed-x')).toBe(constructor)
    const first = mount('First')
    const second = mount('Second')
    second.dataset.testid = 'second'
    await expect.element(page.getByTestId('second').getByText('Second')).toBeVisible()
    first.data = null
    await expect.element(page.getByTestId('second').getByText('Second')).toBeVisible()
  })

  it('registers independent custom names alongside the default element', async () => {
    registerXPost('custom-x-post')
    registerXPost('another-x-post')
    registerXPost('custom-x-post')
    const element = document.createElement('custom-x-post') as XPostElement
    element.dataset.testid = 'custom-post'
    element.data = createPost('Custom name')
    document.body.append(element)
    await expect.element(page.getByTestId('custom-post').getByText('Custom name')).toBeVisible()
    await expect
      .element(page.getByTestId('custom-post'))
      .toHaveAttribute('data-meowdown-embed', 'x')
    const another = document.createElement('another-x-post') as XPostElement
    another.dataset.testid = 'another-post'
    another.data = createPost('Another name')
    document.body.append(another)
    await expect.element(page.getByTestId('another-post').getByText('Another name')).toBeVisible()
  })

  it('keeps attribution when the body is empty', async () => {
    mount('')
    await expect.element(post.getByRole('link', { name: /Sep 10/ })).toBeVisible()
    await expect.element(post.getByRole('paragraph')).toHaveTextContent('')
  })

  it('does not mutate a frozen snapshot, including its quote', async () => {
    const element = mount()
    const snapshot: XPost = {
      ...createPost('Saved text'),
      media: [createPhoto()],
      quote: { ...createPost('Quoted text'), id: '2', media: [createPhoto()] },
    }
    const original = structuredClone(snapshot)
    const freeze = (value: unknown) => {
      if (value && typeof value === 'object') {
        Object.freeze(value)
        for (const item of Object.values(value)) freeze(item)
      }
    }
    freeze(snapshot)
    element.data = snapshot
    await expect.element(post.getByText('Saved text', { exact: true })).toBeVisible()
    await expect.element(post.getByText('Quoted text', { exact: true })).toBeVisible()
    expect(snapshot).toEqual(original)
  })

  it('renders unsafe destinations as text', async () => {
    const element = mount()
    const snapshot = createPost()
    snapshot.body = [{ type: 'link', text: 'A link', url: 'javascript:alert(1)' }]
    element.data = snapshot
    await expect.element(post.getByText('A link')).toBeVisible()
    await expect.element(post.getByRole('link', { name: 'A link' })).not.toBeInTheDocument()
  })
})

describe('X post fetch', () => {
  const url = 'https://x.com/example/status/1234567890123456789'

  function mountRemote(resolver: XPostElement['resolver'], remote = url) {
    const element = document.createElement('meowdown-embed-x')
    element.dataset.testid = 'post'
    element.url = remote
    element.resolver = resolver
    document.body.append(element)
    return element
  }

  it('calls `resolver` with `url` and renders the resolved snapshot', async () => {
    let resolve!: (post: XPost) => void
    const resolver = vi.fn(() => {
      return new Promise<XPost>((r) => {
        resolve = r
      })
    })
    const element = mountRemote(resolver)
    await expect.element(post.getByText('Loading this post…')).toBeVisible()
    expect(element.querySelector('[data-fallback][data-pending]')).not.toBeNull()
    resolve(createPost('Fetched'))
    await expect.element(post.getByText('Fetched')).toBeVisible()
    expect(resolver).toHaveBeenCalledTimes(1)
    expect(resolver).toHaveBeenCalledWith(url)
    expect(element.data).toBeNull()
  })

  it('renders a synchronous result without a pending state', async () => {
    const element = mountRemote(() => createPost('Sync'))
    expect(element.textContent).toContain('Sync')
    expect(element.textContent).not.toContain('Loading')
    await expect.element(post.getByText('Sync')).toBeVisible()
  })

  it('shows the fallback when `resolver` finds nothing', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    mountRemote(() => Promise.resolve(undefined))
    await expect.element(post.getByText('This post is unavailable.')).toBeVisible()
    expect(error).not.toHaveBeenCalled()
  })

  it('logs a rejected fetch and shows the fallback', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const element = mountRemote(() => Promise.reject(new Error('offline')))
    await expect.element(post.getByText('This post is unavailable.')).toBeVisible()
    expect(error).toHaveBeenCalledWith('[meowdown] Failed to fetch X post:', expect.any(Error))
    expect(element.querySelector('[data-pending]')).toBeNull()
  })

  it('rejects a resolver result belonging to another post', async () => {
    mountRemote(() => ({ ...createPost('Wrong post'), id: '2' }))
    await expect.element(post.getByText('This post is unavailable.')).toBeVisible()
  })

  it('refetches when `url` changes and ignores the stale result', async () => {
    const resolvers = new Map<string, (post: XPost) => void>()
    const element = mountRemote((value) => {
      return new Promise<XPost>((resolve) => {
        resolvers.set(value, resolve)
      })
    })
    await expect.element(post.getByText('Loading this post…')).toBeVisible()
    element.url = 'https://x.com/example/status/2'
    resolvers.get(url)?.(createPost('Stale'))
    await sleep(20)
    expect(element.textContent).not.toContain('Stale')
    await expect.element(post.getByText('Loading this post…')).toBeVisible()
    resolvers.get('https://x.com/example/status/2')?.({
      ...createPost('Fresh'),
      id: '2',
    })
    await expect.element(post.getByText('Fresh')).toBeVisible()
  })

  it('prefers `data` and fetches only once `data` is cleared', async () => {
    const resolver = vi.fn(() => Promise.resolve(createPost('Fetched')))
    const element = document.createElement('meowdown-embed-x')
    element.dataset.testid = 'post'
    element.data = createPost('Saved')
    element.url = url
    element.resolver = resolver
    document.body.append(element)
    await expect.element(post.getByText('Saved')).toBeVisible()
    expect(resolver).not.toHaveBeenCalled()
    element.data = null
    await expect.element(post.getByText('Fetched')).toBeVisible()
    expect(resolver).toHaveBeenCalledTimes(1)
  })

  it('does not fetch without both `url` and `resolver`', async () => {
    const resolver = vi.fn(() => Promise.resolve(createPost('Fetched')))
    const element = mountRemote(null)
    await expect.element(post.getByText('This post is unavailable.')).toBeVisible()
    element.url = null
    element.resolver = resolver
    await expect.element(post.getByText('This post is unavailable.')).toBeVisible()
    expect(resolver).not.toHaveBeenCalled()
    element.url = url
    await expect.element(post.getByText('Fetched')).toBeVisible()
  })
})
