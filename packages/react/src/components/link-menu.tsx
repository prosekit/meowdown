import { Popover } from '@base-ui/react/popover'
import {
  defineLinkEditKeymap,
  defineLinkHoverHandler,
  getVirtualElementFromRange,
  type EditorExtension,
  type LinkClickHandler,
  type LinkCopyHandler,
  type LinkEditOptions,
  type LinkUnit,
  type TypedEditor,
  type VirtualElement,
} from '@meowdown/core'
import { useEditor, useExtension } from '@prosekit/react'
import { PencilIcon, UnlinkIcon } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { useDelayedFlag } from '../hooks/use-delayed-flag.ts'

import { CopyButton } from './copy-button.tsx'
import styles from './link-menu.module.css'

export interface LinkMenuProps {
  onLinkClick?: LinkClickHandler
  onLinkCopy?: LinkCopyHandler
}

/** Select the link unit so the text-backed commands target it, and keep the
 *  editor focused so its virtual selection stays visible behind the popover. */
function selectLinkUnit(editor: TypedEditor, link: LinkUnit): void {
  editor.commands.selectText(link.unit.from, link.unit.to)
  editor.focus()
}

/** A Base UI popover anchored at `anchor`. Base UI dismisses it on an outside
 *  press or Escape, both routed through `onClose`. */
function LinkPopover({
  anchor,
  onClose,
  onPopupHover,
  children,
}: {
  anchor?: VirtualElement
  onClose: () => void
  onPopupHover?: (over: boolean) => void
  children: ReactNode
}) {
  return (
    <Popover.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <Popover.Portal>
        <Popover.Positioner
          anchor={anchor}
          side="bottom"
          sideOffset={8}
          className={styles.Positioner}
        >
          <Popover.Popup
            className={styles.Popup}
            data-testid="link-popover"
            initialFocus={false}
            finalFocus={false}
            onMouseEnter={() => onPopupHover?.(true)}
            onMouseLeave={() => onPopupHover?.(false)}
          >
            {children}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}

/** The hover preview: the url plus copy, edit, and remove actions. */
function LinkInfoContent({
  href,
  onLinkClick,
  onLinkCopy,
  onEdit,
  onRemove,
}: {
  href: string
  onLinkClick?: LinkClickHandler
  onLinkCopy?: LinkCopyHandler
  onEdit: () => void
  onRemove: () => void
}) {
  return (
    <div className={styles.Row} data-testid="link-popover-read">
      <a
        className={styles.Url}
        href={href}
        title={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(event) => {
          if (!onLinkClick) return
          event.preventDefault()
          onLinkClick({ href, event: event.nativeEvent })
        }}
      >
        {href}
      </a>
      <CopyButton
        getText={() => href}
        label="Copy link"
        className={styles.Button}
        onCopy={() => onLinkCopy?.({ href })}
      />
      <button
        type="button"
        className={styles.Button}
        title="Edit link"
        aria-label="Edit link"
        onClick={onEdit}
      >
        <PencilIcon />
      </button>
      <button
        type="button"
        className={styles.Button}
        title="Remove link"
        aria-label="Remove link"
        onClick={onRemove}
      >
        <UnlinkIcon />
      </button>
    </div>
  )
}

/** The url and title form, opened by `Mod-k` or the preview's edit button. */
function LinkEditContent({
  link,
  onSubmit,
}: {
  link: LinkUnit | undefined
  onSubmit: (href: string, title: string) => void
}) {
  const hrefInputRef = useRef<HTMLInputElement>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)

  const href = link ? link.href : ''
  const title = link ? link.title : ''

  useEffect(() => {
    hrefInputRef.current?.focus()
  }, [])

  return (
    <form
      className={styles.Form}
      data-testid="link-popover-edit"
      onSubmit={(event) => {
        event.preventDefault()
        const nextHref = hrefInputRef.current?.value || ''
        const nextTitle = titleInputRef.current?.value || ''
        onSubmit(nextHref, nextTitle)
      }}
    >
      <input
        ref={hrefInputRef}
        className={styles.Input}
        defaultValue={href}
        placeholder="Paste link..."
        data-testid="link-popover-input"
      />
      <input
        ref={titleInputRef}
        className={styles.Input}
        defaultValue={title}
        placeholder="Title (optional)"
      />
      <button type="submit" className={styles.SrOnly} data-testid="link-popover-submit">
        Save
      </button>
    </form>
  )
}

/**
 * Owns both link triggers and shows one popover at a time:
 *
 * - hovering a link opens a read-only preview that follows the pointer;
 * - `Mod-k` (or the preview's edit button) opens an edit form that stays until
 *   it is submitted, dismissed with Escape, or pressed outside.
 */
export function LinkMenu({ onLinkClick, onLinkCopy }: LinkMenuProps) {
  const editor: TypedEditor = useEditor<EditorExtension>()

  // `hover` is the sticky preview content; `onLink`/`overPopup` drive whether it
  // stays open so the pointer can cross from the link onto the popup.
  const [hover, setHover] = useState<LinkUnit>()
  const [onLink, setOnLink] = useState(false)
  const [overPopup, setOverPopup] = useState(false)
  const [edit, setEdit] = useState<LinkEditOptions>()

  const hoverOpen = useDelayedFlag(onLink || overPopup)

  const linkHoverExtension = useMemo(() => {
    return defineLinkHoverHandler((hit) => {
      setOnLink(!!hit)
      if (hit) setHover(hit.payload)
    })
  }, [])
  useExtension(linkHoverExtension)

  const linkEditExtension = useMemo(() => {
    return defineLinkEditKeymap((options) => {
      setEdit(options)
    })
  }, [])
  useExtension(linkEditExtension)

  const closeHover = useCallback(() => {
    setOnLink(false)
    setOverPopup(false)
    setHover(undefined)
  }, [])

  const closeEdit = useCallback(() => {
    setEdit(undefined)
    closeHover()
    editor.focus()
  }, [editor, closeHover])

  let rangeFrom: number | undefined
  let rangeTo: number | undefined

  if (edit) {
    rangeFrom = edit.from
    rangeTo = edit.to
  } else if (hover) {
    rangeFrom = hover.unit.from
    rangeTo = hover.unit.to
  }

  const anchor: VirtualElement | undefined = useMemo(() => {
    if (rangeFrom == null || rangeTo == null) return
    return getVirtualElementFromRange(editor.view, { from: rangeFrom, to: rangeTo })
  }, [rangeFrom, rangeTo, editor])

  if (edit) {
    return (
      <LinkPopover anchor={anchor} onClose={closeEdit}>
        <LinkEditContent
          link={edit.link}
          onSubmit={(href, title) => {
            if (edit.link) {
              if (href.trim()) {
                // Update an existing link to a new href and title
                editor.commands.updateLink({ href, title })
              } else {
                // Remove the existing link
                editor.commands.removeLink()
              }
            } else {
              if (href.trim()) {
                // Adding a new link to the selected text
                editor.commands.insertLink({ href, title })
              }
            }

            closeEdit()
          }}
        />
      </LinkPopover>
    )
  }

  if (hoverOpen && hover) {
    const link = hover
    return (
      <LinkPopover anchor={anchor} onClose={closeHover} onPopupHover={setOverPopup}>
        <LinkInfoContent
          href={link.href}
          onLinkClick={onLinkClick}
          onLinkCopy={onLinkCopy}
          onEdit={() => {
            selectLinkUnit(editor, link)
            setEdit({ from: link.unit.from, to: link.unit.to, link })
            closeHover()
          }}
          onRemove={() => {
            selectLinkUnit(editor, link)
            editor.commands.removeLink()
            closeHover()
          }}
        />
      </LinkPopover>
    )
  }

  return null
}
