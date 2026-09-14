import { createEditor, definePlugin } from '@prosekit/core'
import { Plugin } from '@prosekit/pm/state'
import { describe, expect, it, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'

import { docToMarkdown } from '../converters/pm-to-md.ts'
import { setupFixture } from '../testing/index.ts'

import { getEditorConfig, replaceEditorConfig, type EditorConfig } from './editor-config.ts'
import { defineEditorExtension } from './extension.ts'
import { defineFileView, type FileInfo } from './file-view.ts'
import { defineImage } from './image.ts'
import { getMarkMode } from './mark-mode.ts'

const pmRoot = page.locate('.ProseMirror')
const claimFiles = () => true

describe('editor configuration', () => {
  it('does no work for equal snapshots and normalized defaults', () => {
    using fixture = setupFixture({ extensionOptions: { markMode: 'hide', readOnly: true } })
    const { editor } = fixture
    const state = editor.state
    const config = getEditorConfig(state)
    const dispatch = vi.spyOn(editor.view, 'dispatch')
    const updateState = vi.spyOn(editor.view, 'updateState')
    replaceEditorConfig(editor, { markMode: 'hide', readOnly: true })
    replaceEditorConfig(editor, { ...config, onFileClick: undefined })
    expect(getEditorConfig(editor.state)).toBe(config)
    expect(editor.state).toBe(state)
    expect(dispatch).not.toHaveBeenCalled()
    expect(updateState).not.toHaveBeenCalled()
  })

  it('initializes a separate controller for editors sharing an extension', () => {
    const extension = defineEditorExtension({ markMode: 'hide' })
    const first = createEditor({ extension })
    const second = createEditor({ extension })
    const onFileClick = vi.fn()
    replaceEditorConfig(first, { markMode: 'hide', onFileClick })
    expect(getEditorConfig(first.state).onFileClick).toBe(onFileClick)
    expect(getEditorConfig(second.state).onFileClick).toBeUndefined()
  })

  it('reinitializes configuration when setContent creates a new state', () => {
    const editor = createEditor({ extension: defineEditorExtension({ markMode: 'hide' }) })
    replaceEditorConfig(editor, { markMode: 'show', onFileClick: vi.fn() })
    editor.setContent(editor.nodes.doc(editor.nodes.paragraph('replacement')))
    expect(getEditorConfig(editor.state).markMode).toBe('hide')
    expect(getEditorConfig(editor.state).onFileClick).toBeUndefined()
    expect(getMarkMode(editor.state)).toBe('hide')
  })

  it('applies configuration before mount and keeps it across a view remount', () => {
    using fixture = setupFixture({ mount: false })
    const { editor } = fixture
    replaceEditorConfig(editor, { markMode: 'hide', readOnly: true })
    const container = document.createElement('div')
    document.body.appendChild(container)
    try {
      editor.mount(container)
      expect(editor.view.editable).toBe(false)
      expect(getMarkMode(editor.state)).toBe('hide')
      editor.unmount()
      editor.mount(container)
      expect(editor.view.editable).toBe(false)
      expect(getMarkMode(editor.state)).toBe('hide')
    } finally {
      editor.unmount()
      container.remove()
    }
  })

  it('updates and clears file callbacks without dispatching or refreshing the view', async () => {
    const first = vi.fn()
    const second = vi.fn()
    const config: EditorConfig = { resolveFileLink: claimFiles, onFileClick: first }
    using fixture = setupFixture({ extensionOptions: config })
    const { editor, n } = fixture
    editor.use(defineFileView())
    fixture.set(
      n.doc(n.paragraph('[report.pdf](assets/report.pdf)'), n.paragraph('Other paragraph')),
    )
    await userEvent.click(pmRoot.getByTestId('file-pill'))
    expect(first).toHaveBeenCalledOnce()
    await userEvent.click(pmRoot.getByText('Other paragraph'))
    const state = editor.state
    const dispatch = vi.spyOn(editor.view, 'dispatch')
    const updateState = vi.spyOn(editor.view, 'updateState')
    replaceEditorConfig(editor, { ...config, onFileClick: second })
    expect(editor.state).toBe(state)
    expect(dispatch).not.toHaveBeenCalled()
    expect(updateState).not.toHaveBeenCalled()
    await userEvent.click(pmRoot.getByTestId('file-pill'))
    expect(second).toHaveBeenCalledOnce()
    expect(first).toHaveBeenCalledOnce()
    await userEvent.click(pmRoot.getByText('Other paragraph'))
    replaceEditorConfig(editor, { resolveFileLink: claimFiles })
    await userEvent.click(pmRoot.getByTestId('file-pill'))
    expect(second).toHaveBeenCalledOnce()
  })

  it('uses the latest file callback for keyboard activation', async () => {
    const first = vi.fn()
    const second = vi.fn()
    using fixture = setupFixture({
      extensionOptions: { resolveFileLink: claimFiles, onFileClick: first },
    })
    const { editor, n } = fixture
    fixture.set(n.doc(n.paragraph('see [report.pdf](assets/report.pdf)<a> here')))
    replaceEditorConfig(editor, { resolveFileLink: claimFiles, onFileClick: second })
    editor.view.focus()
    await userEvent.keyboard('{ArrowLeft}{ControlOrMeta>}{Enter}{/ControlOrMeta}')
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledWith(expect.objectContaining({ href: 'assets/report.pdf' }))
  })

  it('reparses existing links and clears their claims without changing Markdown or selection', async () => {
    const onDocChange = vi.fn()
    using fixture = setupFixture({ extensionOptions: { onDocChange } })
    const { editor, n } = fixture
    editor.use(defineFileView())
    fixture.set(n.doc(n.paragraph('see [report.pdf](assets/report.pdf)<a> here')))
    const markdown = docToMarkdown(editor.state.doc)
    const selection = editor.state.selection
    onDocChange.mockClear()
    replaceEditorConfig(editor, { resolveFileLink: claimFiles, onDocChange })
    await expect.element(pmRoot.getByTestId('file-pill')).toBeInTheDocument()
    expect(docToMarkdown(editor.state.doc)).toBe(markdown)
    expect(editor.state.selection.eq(selection)).toBe(true)
    expect(onDocChange).not.toHaveBeenCalled()
    replaceEditorConfig(editor, { onDocChange })
    await expect.element(pmRoot.getByRole('link')).toBeInTheDocument()
    expect(docToMarkdown(editor.state.doc)).toBe(markdown)
    expect(onDocChange).not.toHaveBeenCalled()
  })

  it('batches display settings into one dispatch and clears omitted settings', async () => {
    using fixture = setupFixture()
    const { editor } = fixture
    const dispatch = vi.spyOn(editor.view, 'dispatch')
    const plugins = editor.state.plugins
    replaceEditorConfig(editor, {
      markMode: 'hide',
      readOnly: true,
      spellCheck: false,
      editorClassName: 'host-editor',
      placeholder: 'Write here',
    })
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(editor.state.plugins).toEqual(plugins)
    expect(editor.view.editable).toBe(false)
    await expect.element(pmRoot).toHaveAttribute('spellcheck', 'false')
    await expect.element(pmRoot).toHaveAttribute('data-mark-mode', 'hide')
    replaceEditorConfig(editor, {})
    expect(editor.view.editable).toBe(true)
    await expect.element(pmRoot).not.toHaveAttribute('spellcheck')
    await expect.element(pmRoot).toHaveAttribute('data-mark-mode', 'focus')
  })

  it('keeps the mode command and the configuration snapshot consistent', () => {
    using fixture = setupFixture()
    const { editor } = fixture
    editor.commands.setMarkMode('hide')
    expect(getEditorConfig(editor.state).markMode).toBe('hide')
    const state = editor.state
    replaceEditorConfig(editor, { ...getEditorConfig(state), onFileClick: vi.fn() })
    expect(editor.state).toBe(state)
    expect(getMarkMode(editor.state)).toBe('hide')
    replaceEditorConfig(editor, {})
    expect(getMarkMode(editor.state)).toBe('focus')
  })

  it('keeps config changes out of undo history', async () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.paragraph('hello<a>')))
    editor.view.focus()
    await userEvent.keyboard(' world')
    replaceEditorConfig(editor, { markMode: 'hide', resolveFileLink: claimFiles })
    editor.commands.undo()
    expect(editor.state.doc.textContent).toBe('hello')
    expect(getEditorConfig(editor.state).resolveFileLink).toBe(claimFiles)
    expect(getMarkMode(editor.state)).toBe('hide')
  })

  it('does not publish a configuration transaction rejected by a plugin', () => {
    using fixture = setupFixture()
    const { editor } = fixture
    editor.use(definePlugin(new Plugin({ filterTransaction: () => false })))
    const state = editor.state
    const config = getEditorConfig(state)
    replaceEditorConfig(editor, { markMode: 'hide', onFileClick: vi.fn() })
    expect(editor.state).toBe(state)
    expect(getEditorConfig(editor.state)).toBe(config)
    expect(getMarkMode(editor.state)).toBe('focus')
  })

  it('refreshes an existing image only when its resolver changes', async () => {
    const firstUrl =
      'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>'
    const nextUrl =
      'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"/>'
    const resolveImageUrl = () => firstUrl
    using fixture = setupFixture({ extensionOptions: { resolveImageUrl } })
    const { editor, n } = fixture
    editor.use(defineImage())
    fixture.set(n.doc(n.paragraph('![cat](photo)')))
    const image = pmRoot.getByAltText('cat')
    await expect.element(image).toHaveAttribute('src', firstUrl)
    const element = image.element()
    replaceEditorConfig(editor, { resolveImageUrl, placeholder: 'Write here' })
    expect(image.element()).toBe(element)
    replaceEditorConfig(editor, { resolveImageUrl: () => nextUrl })
    await expect.element(image).toHaveAttribute('src', nextUrl)
    expect(docToMarkdown(editor.state.doc)).toBe('![cat](photo)\n')
  })

  it('reparses existing wikilinks and wiki embeds', async () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    editor.use(defineFileView())
    fixture.set(n.doc(n.paragraph('[[Note]] and ![[report.pdf]]')))
    const markdown = docToMarkdown(editor.state.doc)
    replaceEditorConfig(editor, {
      resolveWikilink: () => ({ target: 'note-id', display: 'Renamed note' }),
      resolveWikiEmbed: () => ({ kind: 'file', href: 'assets/report.pdf', name: 'Report' }),
    })
    await expect.element(pmRoot.getByTestId('wikilink')).toHaveTextContent('Renamed note')
    await expect.element(pmRoot.getByTestId('file-pill')).toHaveTextContent('Report')
    expect(docToMarkdown(editor.state.doc)).toBe(markdown)
  })

  it('gates optional typing behavior without a configuration transaction', async () => {
    using fixture = setupFixture()
    const { editor, n } = fixture
    fixture.set(n.doc(n.paragraph('<a>')))
    editor.view.focus()
    const state = editor.state
    replaceEditorConfig(editor, { substitution: true })
    expect(editor.state).toBe(state)
    await userEvent.keyboard('(c) ')
    expect(editor.state.doc.textContent).toBe('© ')
    replaceEditorConfig(editor, {})
    await userEvent.keyboard('(c) ')
    expect(editor.state.doc.textContent).toBe('© (c) ')
  })

  it('ignores stale file metadata after replacing its resolver', async () => {
    const pending = Promise.withResolvers<FileInfo>()
    using fixture = setupFixture({
      extensionOptions: { resolveFileLink: claimFiles, resolveFileInfo: () => pending.promise },
    })
    const { editor, n } = fixture
    editor.use(defineFileView())
    fixture.set(n.doc(n.paragraph('[report.pdf](assets/report.pdf)')))
    replaceEditorConfig(editor, {
      resolveFileLink: claimFiles,
      resolveFileInfo: () => ({ size: 2048 }),
    })
    const size = pmRoot.getByTestId('file-pill-size')
    await expect.element(size).toHaveTextContent('2 KB')
    pending.resolve({ size: 1024 })
    await pending.promise
    await expect.element(size).toHaveTextContent('2 KB')
    replaceEditorConfig(editor, { resolveFileLink: claimFiles })
    await expect.element(size).toHaveTextContent('')
  })
})
