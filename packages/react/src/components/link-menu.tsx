import { Popover } from '@base-ui/react/popover'
import {
  defineLinkEditKeymap,
  defineLinkHoverHandler,
  defineLinkTapHandler,
  getLinkText,
  getVirtualElementFromRange,
  isLinkTextForHref,
  isModEvent,
  type EditorExtension,
  type LinkClickHandler,
  type LinkCopyHandler,
  type LinkEditOptions,
  type LinkPreview,
  type LinkPreviewResolver,
  type LinkUnit,
  type TypedEditor,
  type VirtualElement,
} from '@meowdown/core'
import { useEditor, useExtension } from '@prosekit/react'
import { Globe2Icon, PencilIcon, SparklesIcon, UnlinkIcon } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { useDelayedFlag } from '../hooks/use-delayed-flag.ts'

import { CopyButton } from './copy-button.tsx'
import styles from './link-menu.module.css'

export interface LinkMenuProps {
  onLinkClick?: LinkClickHandler
  onLinkCopy?: LinkCopyHandler
  resolveLinkPreview?: LinkPreviewResolver
}

type PreviewResult =
  | { readonly status: 'failed' }
  | { readonly status: 'resolved'; readonly preview: LinkPreview }

type PreviewState = { readonly status: 'idle' | 'loading' } | PreviewResult

function useLinkPreview(
  href: string | undefined,
  resolveLinkPreview: LinkPreviewResolver | undefined,
): PreviewState {
  const [settled, setSettled] = useState<{
    readonly href: string
    readonly result: PreviewResult
  }>()

  useEffect(() => {
    if (!href || !resolveLinkPreview) return

    let stale = false
    void Promise.resolve()
      .then(() => resolveLinkPreview(href))
      .then((preview) => {
        if (!stale) {
          setSettled({
            href,
            result: preview ? { status: 'resolved', preview } : { status: 'failed' },
          })
        }
      })
      .catch(() => {
        if (!stale) setSettled({ href, result: { status: 'failed' } })
      })

    return () => {
      stale = true
    }
  }, [href, resolveLinkPreview])

  if (!href || !resolveLinkPreview) return { status: 'idle' }
  return settled?.href === href ? settled.result : { status: 'loading' }
}

function selectLinkUnit(editor: TypedEditor, link: LinkUnit): void {
  editor.commands.selectText(link.unit.from, link.unit.to)
  editor.focus()
}

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

function LinkAnchor({
  href,
  className,
  onLinkClick,
  children,
}: {
  href: string
  className: string
  onLinkClick?: LinkClickHandler
  children: ReactNode
}) {
  return (
    <a
      className={className}
      href={href}
      title={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(event) => {
        if (!onLinkClick) return
        event.preventDefault()
        onLinkClick({ href, event: event.nativeEvent, mod: isModEvent(event) })
      }}
    >
      {children}
    </a>
  )
}

function LinkActions({
  href,
  onLinkCopy,
  onEdit,
  onRemove,
}: {
  href: string
  onLinkCopy?: LinkCopyHandler
  onEdit?: () => void
  onRemove?: () => void
}) {
  return (
    <div className={styles.Actions}>
      <CopyButton
        getText={() => href}
        label="Copy link"
        className={styles.Button}
        onCopy={() => onLinkCopy?.({ href })}
      />
      {onEdit && (
        <button
          type="button"
          className={styles.Button}
          title="Edit link"
          aria-label="Edit link"
          onClick={onEdit}
        >
          <PencilIcon />
        </button>
      )}
      {onRemove && (
        <button
          type="button"
          className={styles.Button}
          title="Remove link"
          aria-label="Remove link"
          onClick={onRemove}
        >
          <UnlinkIcon />
        </button>
      )}
    </div>
  )
}

function PreviewIcon({ preview }: { preview: LinkPreview }) {
  const [failed, setFailed] = useState(false)
  if (!preview.iconSrc || failed) return <Globe2Icon aria-hidden="true" />
  return <img src={preview.iconSrc} alt="" onError={() => setFailed(true)} />
}

function getHostname(href: string): string {
  try {
    return new URL(href).hostname
  } catch {
    return href
  }
}

function LinkInfoContent({
  href,
  previewState,
  onLinkClick,
  onLinkCopy,
  onEdit,
  onRemove,
  onUseTitle,
}: {
  href: string
  previewState: PreviewState
  onLinkClick?: LinkClickHandler
  onLinkCopy?: LinkCopyHandler
  onEdit?: () => void
  onRemove?: () => void
  onUseTitle?: (title: string) => void
}) {
  if (previewState.status === 'loading') {
    return (
      <div
        className={styles.Skeleton}
        data-testid="link-popover-loading"
        aria-label="Loading link preview"
      >
        <div className={styles.SkeletonHeader} />
        <div className={styles.SkeletonLine} />
        <div className={styles.SkeletonLineShort} />
      </div>
    )
  }

  if (previewState.status === 'resolved') {
    const { preview } = previewState
    return (
      <div data-testid="link-popover-read">
        <div className={styles.Preview}>
          <div className={styles.Icon}>
            <PreviewIcon key={preview.iconSrc} preview={preview} />
          </div>
          <div className={styles.PreviewBody}>
            <LinkAnchor href={href} className={styles.Title} onLinkClick={onLinkClick}>
              {preview.title}
            </LinkAnchor>
            <div className={styles.Host}>{getHostname(href)}</div>
          </div>
          <LinkActions href={href} onLinkCopy={onLinkCopy} onEdit={onEdit} onRemove={onRemove} />
        </div>
        {preview.description && <p className={styles.Description}>{preview.description}</p>}
        {onUseTitle && (
          <div className={styles.ReplaceRow}>
            <SparklesIcon aria-hidden="true" />
            <span>Replace URL with its title?</span>
            <button
              type="button"
              className={styles.ReplaceButton}
              onClick={() => onUseTitle(preview.title)}
            >
              Yes
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={styles.Row} data-testid="link-popover-read">
      <LinkAnchor href={href} className={styles.Url} onLinkClick={onLinkClick}>
        {href}
      </LinkAnchor>
      <LinkActions href={href} onLinkCopy={onLinkCopy} onEdit={onEdit} onRemove={onRemove} />
    </div>
  )
}

function LinkEditContent({
  edit,
  resolveLinkPreview,
  onSubmit,
  onRemove,
}: {
  edit: LinkEditOptions
  resolveLinkPreview?: LinkPreviewResolver
  onSubmit: (text: string, href: string) => void
  onRemove?: () => void
}) {
  const [text, setText] = useState(edit.text)
  const [href, setHref] = useState(edit.link?.href ?? '')
  const textInputRef = useRef<HTMLInputElement>(null)
  const previewState = useLinkPreview(href.trim() || undefined, resolveLinkPreview)
  const canUseTitle = !!edit.link && isLinkTextForHref(text, href)

  useEffect(() => {
    textInputRef.current?.focus()
  }, [])

  return (
    <form
      className={styles.Form}
      data-testid="link-popover-edit"
      onSubmit={(event) => {
        event.preventDefault()
        if (text.trim() && href.trim()) onSubmit(text, href)
      }}
    >
      <label className={styles.Field}>
        <span>Text</span>
        <input
          ref={textInputRef}
          className={styles.Input}
          value={text}
          required
          data-testid="link-popover-text-input"
          onChange={(event) => setText(event.target.value)}
        />
      </label>
      <label className={styles.Field}>
        <span>Link</span>
        <input
          className={styles.Input}
          value={href}
          required
          placeholder="Paste link..."
          data-testid="link-popover-input"
          onChange={(event) => setHref(event.target.value)}
        />
      </label>
      <div className={styles.FormActions}>
        {onRemove && (
          <button type="button" className={styles.RemoveButton} onClick={onRemove}>
            Remove link
          </button>
        )}
        {canUseTitle && previewState.status === 'resolved' && (
          <button
            type="button"
            className={styles.UseTitleButton}
            onClick={() => setText(previewState.preview.title)}
          >
            Use page title
          </button>
        )}
        <button type="submit" className={styles.SaveButton} data-testid="link-popover-submit">
          Save
        </button>
      </div>
    </form>
  )
}

export function LinkMenu({
  onLinkClick,
  onLinkCopy,
  resolveLinkPreview,
}: LinkMenuProps): ReactNode {
  const editor: TypedEditor = useEditor<EditorExtension>()
  const [hover, setHover] = useState<LinkUnit>()
  const [tap, setTap] = useState<LinkUnit>()
  const [onLink, setOnLink] = useState(false)
  const [overPopup, setOverPopup] = useState(false)
  const [edit, setEdit] = useState<LinkEditOptions>()
  const hoverOpen = useDelayedFlag(onLink || overPopup)

  const linkHoverExtension = useMemo(
    () =>
      defineLinkHoverHandler((hit) => {
        setOnLink(!!hit)
        if (hit) setHover(hit.payload)
      }),
    [],
  )
  useExtension(linkHoverExtension)

  const linkTapExtension = useMemo(
    () =>
      defineLinkTapHandler(({ link }) => {
        setTap(link)
        setOnLink(false)
        setHover(undefined)
      }),
    [],
  )
  useExtension(linkTapExtension)

  const linkEditExtension = useMemo(
    () =>
      defineLinkEditKeymap((options) => {
        setEdit(options)
        setTap(undefined)
      }),
    [],
  )
  useExtension(linkEditExtension)

  const closeRead = useCallback(() => {
    setOnLink(false)
    setOverPopup(false)
    setHover(undefined)
    setTap(undefined)
  }, [])

  const closeEdit = useCallback(() => {
    setEdit(undefined)
    closeRead()
    editor.focus()
  }, [editor, closeRead])

  const readLink = tap ?? (hoverOpen ? hover : undefined)
  const previewState = useLinkPreview(readLink?.href, resolveLinkPreview)
  const range = edit ? (edit.link?.text ?? edit) : readLink?.text
  const anchor: VirtualElement | undefined = useMemo(() => {
    if (!range) return
    return getVirtualElementFromRange(editor.view, range)
  }, [range, editor])

  if (edit) {
    return (
      <LinkPopover anchor={anchor} onClose={closeEdit}>
        <LinkEditContent
          edit={edit}
          resolveLinkPreview={resolveLinkPreview}
          onRemove={
            edit.link
              ? () => {
                  editor.commands.removeLink()
                  closeEdit()
                }
              : undefined
          }
          onSubmit={(text, href) => {
            if (edit.link) {
              editor.commands.updateLink({ text, href, title: edit.link.title })
            } else {
              editor.commands.insertLink({ text, href })
            }
            closeEdit()
          }}
        />
      </LinkPopover>
    )
  }

  if (readLink) {
    const mutable = readLink.form !== 'reference'
    const text = getLinkText(editor.view.state, readLink)
    const canUseTitle = mutable && isLinkTextForHref(text, readLink.href)
    const editLink = () => {
      selectLinkUnit(editor, readLink)
      setEdit({ from: readLink.unit.from, to: readLink.unit.to, link: readLink, text })
      closeRead()
    }
    const removeLink = () => {
      selectLinkUnit(editor, readLink)
      editor.commands.removeLink()
      closeRead()
    }

    return (
      <LinkPopover anchor={anchor} onClose={closeRead} onPopupHover={setOverPopup}>
        <LinkInfoContent
          href={readLink.href}
          previewState={previewState}
          onLinkClick={onLinkClick}
          onLinkCopy={onLinkCopy}
          onEdit={mutable ? editLink : undefined}
          onRemove={mutable ? removeLink : undefined}
          onUseTitle={
            canUseTitle
              ? (title) => {
                  selectLinkUnit(editor, readLink)
                  editor.commands.updateLink({ text: title })
                  closeRead()
                }
              : undefined
          }
        />
      </LinkPopover>
    )
  }

  return null
}
