import type { LinkEditOptions, LinkUnit } from '@meowdown/core'
import { Schema } from '@prosekit/pm/model'
import { EditorState } from '@prosekit/pm/state'
import { describe, expect, it } from 'vitest'

import {
  getLinkMenuView,
  LINK_MENU_IDLE,
  reduceLinkMenu,
  type LinkMenuState,
} from './link-menu-state.ts'

const schema = new Schema({ nodes: { doc: { content: 'text*' }, text: {} } })
const editorState = EditorState.create({ schema })

function buildLink(href: string): LinkUnit {
  return {
    state: editorState,
    form: 'bare',
    unit: { from: 0, to: href.length },
    text: { from: 0, to: href.length },
    href,
    title: '',
  }
}

const docs = buildLink('https://docs.test')
const blog = buildLink('https://blog.test')
const docsEdit: LinkEditOptions = { from: 0, to: 17, link: docs, text: 'https://docs.test' }
const blogEdit: LinkEditOptions = { from: 0, to: 17, link: blog, text: 'https://blog.test' }

const preview: LinkMenuState = { kind: 'preview', link: docs }
const edit: LinkMenuState = { kind: 'edit', edit: docsEdit }
const closingPreview: LinkMenuState = { kind: 'closing', view: { kind: 'preview', link: docs } }
const closingEdit: LinkMenuState = { kind: 'closing', view: { kind: 'edit', edit: docsEdit } }

describe('reduceLinkMenu from idle', () => {
  it('opens the preview on hover', () => {
    expect(reduceLinkMenu(LINK_MENU_IDLE, { type: 'hover', link: docs })).toEqual(preview)
  })

  it('ignores a hover leave', () => {
    expect(reduceLinkMenu(LINK_MENU_IDLE, { type: 'hover', link: undefined })).toBe(LINK_MENU_IDLE)
  })

  it('opens the editor on edit', () => {
    expect(reduceLinkMenu(LINK_MENU_IDLE, { type: 'edit', edit: docsEdit })).toEqual(edit)
  })

  it('ignores close and closed', () => {
    expect(reduceLinkMenu(LINK_MENU_IDLE, { type: 'close' })).toBe(LINK_MENU_IDLE)
    expect(reduceLinkMenu(LINK_MENU_IDLE, { type: 'closed' })).toBe(LINK_MENU_IDLE)
  })
})

describe('reduceLinkMenu from preview', () => {
  it('switches to the newly hovered link', () => {
    expect(reduceLinkMenu(preview, { type: 'hover', link: blog })).toEqual({
      kind: 'preview',
      link: blog,
    })
  })

  it('starts closing on a hover leave', () => {
    expect(reduceLinkMenu(preview, { type: 'hover', link: undefined })).toEqual(closingPreview)
  })

  it('turns into the editor on edit', () => {
    expect(reduceLinkMenu(preview, { type: 'edit', edit: docsEdit })).toEqual(edit)
  })

  it('starts closing on close', () => {
    expect(reduceLinkMenu(preview, { type: 'close' })).toEqual(closingPreview)
  })

  it('ignores a late closed', () => {
    expect(reduceLinkMenu(preview, { type: 'closed' })).toBe(preview)
  })
})

describe('reduceLinkMenu from edit', () => {
  it('ignores a hover enter', () => {
    expect(reduceLinkMenu(edit, { type: 'hover', link: blog })).toBe(edit)
  })

  it('ignores a hover leave', () => {
    expect(reduceLinkMenu(edit, { type: 'hover', link: undefined })).toBe(edit)
  })

  it('switches to a new edit', () => {
    expect(reduceLinkMenu(edit, { type: 'edit', edit: blogEdit })).toEqual({
      kind: 'edit',
      edit: blogEdit,
    })
  })

  it('starts closing on close', () => {
    expect(reduceLinkMenu(edit, { type: 'close' })).toEqual(closingEdit)
  })

  it('ignores a late closed', () => {
    expect(reduceLinkMenu(edit, { type: 'closed' })).toBe(edit)
  })
})

describe('reduceLinkMenu from closing', () => {
  it('reopens as a preview on hover', () => {
    expect(reduceLinkMenu(closingEdit, { type: 'hover', link: blog })).toEqual({
      kind: 'preview',
      link: blog,
    })
  })

  it('ignores a hover leave', () => {
    expect(reduceLinkMenu(closingPreview, { type: 'hover', link: undefined })).toBe(closingPreview)
  })

  it('reopens as the editor on edit', () => {
    expect(reduceLinkMenu(closingPreview, { type: 'edit', edit: docsEdit })).toEqual(edit)
  })

  it('ignores close', () => {
    expect(reduceLinkMenu(closingEdit, { type: 'close' })).toBe(closingEdit)
  })

  it('becomes idle once the exit animation finishes', () => {
    expect(reduceLinkMenu(closingEdit, { type: 'closed' })).toBe(LINK_MENU_IDLE)
  })
})

describe('getLinkMenuView', () => {
  it('renders nothing when idle', () => {
    expect(getLinkMenuView(LINK_MENU_IDLE)).toBeUndefined()
  })

  it('renders the open view', () => {
    expect(getLinkMenuView(preview)).toBe(preview)
  })

  it('keeps rendering the closing view', () => {
    expect(getLinkMenuView(closingEdit)).toEqual({ kind: 'edit', edit: docsEdit })
  })
})
