import { Menu } from '@base-ui/react/menu'
import {
  convertEmbedToLink,
  defineEmbedMenuHandler,
  deleteEmbed,
  type EditorExtension,
  type TypedEditor,
} from '@meowdown/core'
import { useEditor } from '@prosekit/react'
import { queueExtension } from '@prosekit/web'
import { CopyIcon, Link2Icon, Trash2Icon } from 'lucide-react'
import { use, useCallback, useEffect, useReducer, type ReactElement } from 'react'

import { writeClipboardText } from '../utils/write-clipboard-text.ts'

import { CollisionBoundaryContext } from './collision-boundary.ts'
import { EMBED_MENU_IDLE, reduceEmbedMenu } from './embed-menu-state.ts'

export interface EmbedMenuProps {
  readOnly?: boolean
}

/**
 * The menu of images, X post cards, and YouTube cards, opened from their menu
 * button or with `Mod-/` while one is selected. One instance serves them all.
 */
export function EmbedMenu({ readOnly = false }: EmbedMenuProps): ReactElement {
  const editor: TypedEditor = useEditor<EditorExtension>()
  const [state, dispatch] = useReducer(reduceEmbedMenu, EMBED_MENU_IDLE)
  const collisionBoundary = use(CollisionBoundaryContext)

  useEffect(() => {
    const extension = defineEmbedMenuHandler((embed, button) => {
      dispatch({ type: 'open', embed, button })
    })
    return queueExtension(editor, extension)
  }, [editor])

  const open = state.phase === 'open'
  const button = state.phase === 'idle' ? undefined : state.button
  const embed = state.phase === 'idle' ? undefined : state.embed

  // The button lives in the card's DOM, outside React.
  useEffect(() => {
    if (!button) return
    button.setAttribute('aria-expanded', String(open))
    return () => button.removeAttribute('aria-expanded')
  }, [button, open])

  const changeOpen = useCallback((next: boolean) => {
    if (!next) dispatch({ type: 'close' })
  }, [])

  const completeOpenChange = useCallback((next: boolean) => {
    if (!next) dispatch({ type: 'closed' })
  }, [])

  const getFinalFocus = useCallback((): boolean => {
    editor.focus()
    return false
  }, [editor])

  const convertToLink = useCallback(() => {
    if (embed) editor.exec(convertEmbedToLink(embed.from))
  }, [editor, embed])

  const copyLink = useCallback(() => {
    if (embed) void writeClipboardText(embed.src)
  }, [embed])

  const remove = useCallback(() => {
    if (embed) editor.exec(deleteEmbed(embed.from))
  }, [editor, embed])

  // Only X post and YouTube cards written as `![](url)` convert.
  const canConvert = !readOnly && embed != null && convertEmbedToLink(embed.from)(editor.state)

  return (
    <Menu.Root open={open} onOpenChange={changeOpen} onOpenChangeComplete={completeOpenChange}>
      <Menu.Portal>
        <Menu.Positioner
          anchor={button}
          className="meowdown-menu-positioner"
          sideOffset={4}
          align="start"
          collisionBoundary={collisionBoundary}
        >
          <Menu.Popup
            className="meowdown-menu-popup"
            finalFocus={getFinalFocus}
            data-testid="embed-menu-popup"
          >
            {canConvert && (
              <Menu.Item
                className="meowdown-menu-item"
                onClick={convertToLink}
                data-testid="embed-menu-convert"
              >
                <Link2Icon />
                <span>Convert to link</span>
              </Menu.Item>
            )}
            <Menu.Item
              className="meowdown-menu-item"
              onClick={copyLink}
              data-testid="embed-menu-copy"
            >
              <CopyIcon />
              <span>{embed?.kind === 'image' ? 'Copy image link' : 'Copy link'}</span>
            </Menu.Item>
            {!readOnly && (
              <Menu.Item
                className="meowdown-menu-item"
                onClick={remove}
                data-testid="embed-menu-delete"
              >
                <Trash2Icon />
                <span>Delete</span>
              </Menu.Item>
            )}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}
