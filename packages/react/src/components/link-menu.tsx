import { Popover } from '@base-ui/react/popover'
import {
  defineLinkEditKeymap,
  defineLinkHoverHandler,
  getLinkText,
  getVirtualElementFromRange,
  isLinkTextForHref,
  isModEvent,
  normalizeHref,
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

import { CopyButton } from './copy-button.tsx'
import styles from './link-menu.module.css'

export interface LinkMenuProps {
  onLinkClick?: LinkClickHandler
  onLinkCopy?: LinkCopyHandler
  resolveLinkPreview?: LinkPreviewResolver
  readOnly?: boolean
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
    if (!href || !resolveLinkPreview || !isWebHref(href)) return

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

  if (!href || !resolveLinkPreview || !isWebHref(href)) return { status: 'idle' }
  return settled?.href === href ? settled.result : { status: 'loading' }
}

function isWebHref(href: string): boolean {
  try {
    const protocol = new URL(href).protocol
    return protocol === 'https:' || protocol === 'http:'
  } catch {
    return false
  }
}

function selectLinkUnit(editor: TypedEditor, link: LinkUnit): void {
  editor.commands.selectText(link.unit.from, link.unit.to)
  editor.focus()
}

function LinkPopover({
  anchor,
  open,
  onClose,
  onCloseComplete,
  onPopupHover,
  children,
}: {
  anchor?: VirtualElement
  open: boolean
  onClose: () => void
  onCloseComplete?: () => void
  onPopupHover?: (over: boolean) => void
  children: ReactNode
}) {
  return (
    <Popover.Root
      open={open}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      onOpenChangeComplete={(open) => {
        if (!open) onCloseComplete?.()
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
              aria-label="Replace URL with its title"
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
    <div data-testid="link-popover-read">
      <div className={styles.Row}>
        <LinkAnchor href={href} className={styles.Url} onLinkClick={onLinkClick}>
          {href}
        </LinkAnchor>
        <LinkActions href={href} onLinkCopy={onLinkCopy} onEdit={onEdit} onRemove={onRemove} />
      </div>
      {previewState.status === 'loading' && (
        <div
          className={styles.Skeleton}
          data-testid="link-popover-loading"
          role="status"
          aria-label="Loading link preview"
        >
          <div className={styles.SkeletonLine} />
          <div className={styles.SkeletonLineShort} />
        </div>
      )}
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
  const [debouncedHref, setDebouncedHref] = useState(href.trim())
  const textInputRef = useRef<HTMLInputElement>(null)
  // Preview the URL saving would produce, so a bare `example.com` resolves.
  const previewHref = normalizeHref(debouncedHref)
  const previewState = useLinkPreview(previewHref || undefined, resolveLinkPreview)
  // The debounce must settle first: until then `previewState` still belongs
  // to the previous URL, and "Use page title" would apply the old page's
  // title.
  const canUseTitle =
    !!edit.link && debouncedHref === href.trim() && isLinkTextForHref(text, previewHref)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedHref(href.trim()), 400)
    return () => window.clearTimeout(timer)
  }, [href])

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
  readOnly = false,
}: LinkMenuProps): ReactNode {
  const editor: TypedEditor = useEditor<EditorExtension>()
  // REVIEW: rename "hit" to "hoveredLink"
  const [hit, setHit] = useState<LinkUnit | undefined >()
  const [edit, setEdit] = useState<LinkEditOptions | undefined>()
  const [editOpen, setEditOpen] = useState(false)
  // The link whose info the read popup shows. It outlives `hit` until the
  // close animation finishes, so the popup keeps its content while fading
  // out.
  // REVIEW: rename "displayedRead" to "displayedLink". Also move this useState right after const [hit, setHit] = useState<LinkUnit | undefined >() so that these two LinkUnit states are next to each other.
  const [displayedRead, setDisplayedRead] = useState<LinkUnit | undefined>()
  const overPopupRef = useRef(false)

  const linkHoverExtension = useMemo(
    () =>
      // REVIEW: use {} and add "return"
      defineLinkHoverHandler(
        (nextHit) => {
          setHit(nextHit?.payload)
          if (nextHit) setDisplayedRead(nextHit.payload)
        },
        { canLeave: () => !overPopupRef.current },
      ),
    [],
  )
  useExtension(linkHoverExtension)

  const linkEditExtension = useMemo(
    () =>
      readOnly
        ? null
        : defineLinkEditKeymap((options) => {
            setEdit(options)
            setEditOpen(true)
            setHit(undefined)
          }),
    [readOnly],
  )
  useExtension(linkEditExtension)

  const closeRead = useCallback(() => {
    overPopupRef.current = false
    setHit(undefined)
  }, [])

  const closeEdit = useCallback(() => {
    setEditOpen(false)
    closeRead()
  }, [closeRead])

  // The link currently requesting the read popup: the one under the pointer,
  // or tapped on touch. `undefined` asks an open popup to close.
  const requestedRead = hit
  const previewState = useLinkPreview(displayedRead?.href, resolveLinkPreview)
  const range = edit ? (edit.link?.text ?? edit) : displayedRead?.text
  const anchor: VirtualElement | undefined = useMemo(() => {
    if (!range) return
    return getVirtualElementFromRange(editor.view, range)
  }, [range, editor])

  const editing = edit != null && !readOnly

  let content: ReactNode
  if (editing) {
    content = (
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
            // An unchanged label passes no `text`: passing it rebuilds the
            // whole unit and strips authored Markdown like `[**Docs**](...)`.
            editor.commands.updateLink({
              text: text === edit.text ? undefined : text,
              href,
              title: edit.link.title,
            })
          } else {
            editor.commands.insertLink({ text, href })
          }
          closeEdit()
        }}
      />
    )
  } else if (displayedRead) {
    const mutable = !readOnly && displayedRead.form !== 'reference'
    const text = getLinkText(editor.view.state, displayedRead)
    const canUseTitle = mutable && isLinkTextForHref(text, displayedRead.href)
    const editLink = () => {
      selectLinkUnit(editor, displayedRead)
      setEdit({
        from: displayedRead.unit.from,
        to: displayedRead.unit.to,
        link: displayedRead,
        text,
      })
      setEditOpen(true)
      closeRead()
    }
    const removeLink = () => {
      selectLinkUnit(editor, displayedRead)
      editor.commands.removeLink()
      closeRead()
    }

    content = (
      <LinkInfoContent
        href={displayedRead.href}
        previewState={previewState}
        onLinkClick={onLinkClick}
        onLinkCopy={onLinkCopy}
        onEdit={mutable ? editLink : undefined}
        onRemove={mutable ? removeLink : undefined}
        onUseTitle={
          canUseTitle
            ? (title) => {
                selectLinkUnit(editor, displayedRead)
                editor.commands.updateLink({ text: title })
                closeRead()
              }
            : undefined
        }
      />
    )
  }

  // While closed the popover renders nothing, but its root must stay mounted:
  // Base UI plays the open transition only when `open` flips on a mounted
  // root, and a root that mounts with `open` already true skips
  // `[data-starting-style]`, so the popup would appear without animation.
  return (
    <LinkPopover
      anchor={anchor}
      open={editing ? editOpen : requestedRead !== undefined}
      onClose={editing ? closeEdit : closeRead}
      onCloseComplete={() => {
        if (editing) {
          setEdit(undefined)
          editor.focus()
        } else if (!requestedRead) {
          setDisplayedRead(undefined)
        }
      }}
      onPopupHover={
        editing
          ? undefined
          : (over) => {
              overPopupRef.current = over
            }
      }
    >
      {content}
    </LinkPopover>
  )
}
