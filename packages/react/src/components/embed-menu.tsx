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
import { useCallback, useEffect, useReducer, type ReactElement } from 'react'

import { writeClipboardText } from '../utils/write-clipboard-text.ts'

import { ActionMenuItem, ActionMenuPopup } from './action-menu.tsx'
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

  useEffect(() => {
    const extension = defineEmbedMenuHandler((embed, button) => {
      dispatch({ type: 'toggle', embed, button })
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

  const changeOpen = useCallback(
    (next: boolean, details: Menu.Root.ChangeEventDetails) => {
      if (next) return
      // Base UI does not know the button opens this menu, so a press on it
      // reads as a press outside. Keep the menu open: the click that follows
      // toggles it.
      const target = details.event.target
      if (
        details.reason === 'outside-press' &&
        target instanceof Node &&
        button?.contains(target)
      ) {
        details.cancel()
        return
      }
      dispatch({ type: 'close' })
    },
    [button],
  )

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
      <ActionMenuPopup anchor={button} finalFocus={getFinalFocus} testId="embed-menu-popup">
        {canConvert && (
          <ActionMenuItem
            icon="link-2"
            label="Convert to link"
            onClick={convertToLink}
            testId="embed-menu-convert"
          />
        )}
        <ActionMenuItem
          icon="copy"
          label={embed?.kind === 'image' ? 'Copy image link' : 'Copy link'}
          onClick={copyLink}
          testId="embed-menu-copy"
        />
        {!readOnly && (
          <ActionMenuItem
            icon="trash-2"
            label="Delete"
            onClick={remove}
            testId="embed-menu-delete"
          />
        )}
      </ActionMenuPopup>
    </Menu.Root>
  )
}
