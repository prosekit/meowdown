import { Combobox } from '@base-ui/react/combobox'
import { Menu } from '@base-ui/react/menu'
import {
  codeBlockLanguages,
  isCodeBlockPreviewHiddenDecoration,
  type CodeBlockAttrs,
  type LanguageItem,
} from '@meowdown/core'
import { isApple } from '@prosekit/core'
import { TextSelection } from '@prosekit/pm/state'
import type { EditorView } from '@prosekit/pm/view'
import type { ReactNodeViewProps } from '@prosekit/react'
import { BracesIcon, CheckIcon, ChevronsUpDownIcon, CopyIcon, EllipsisIcon } from 'lucide-react'
import {
  memo,
  use,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type MouseEvent,
  type ReactElement,
} from 'react'

import { setCaretCodeBlockMenu } from '../extensions/block-menu.ts'
import { useKaTeX } from '../hooks/use-katex.ts'
import { usePele } from '../hooks/use-pele.ts'
import { NON_PROSE_PROPS } from '../utils/non-prose-props.ts'
import { writeClipboardText } from '../utils/write-clipboard-text.ts'

import {
  CODE_BLOCK_TOOLBAR_IDLE,
  getCodeBlockToolbarFinalFocus,
  isCodeBlockToolbarActive,
  reduceCodeBlockToolbar,
} from './code-block-toolbar-state.ts'
import styles from './code-block-view.module.css'
import { CollisionBoundaryContext } from './collision-boundary.ts'
import { CopyButton } from './copy-button.tsx'
import { MathRender } from './math-render.tsx'
import { MermaidRender } from './mermaid-render.tsx'

export function CodeBlockView(props: ReactNodeViewProps): ReactElement {
  const { node, view, getPos, decorations, selected, setAttrs, contentRef } = props

  const attrs = node.attrs as CodeBlockAttrs
  const language = attrs.language || ''
  const isMath = language === 'math'
  const isMermaid = language === 'mermaid'
  const code = node.textContent

  const caretInside = decorations.some(isCodeBlockPreviewHiddenDecoration)

  const katex = useKaTeX(isMath)
  const mermaid = usePele(isMermaid)
  const showMathPreview = isMath && katex != null
  const showMermaidPreview = isMermaid && mermaid != null
  const showPreview = showMathPreview || showMermaidPreview
  const previewCode = useDeferredValue(showPreview ? code : '')

  // The preview replaces the source only when the caret is elsewhere; with the
  // caret inside, the source stays on top and the preview updates live below.
  // An empty or not-yet-rendered block keeps its source, so it never turns
  // invisible and unclickable.
  const previewOnly = showPreview && !caretInside && code.trim() !== ''

  const focusSource = useCallback(
    (event: MouseEvent) => {
      event.preventDefault()
      const pos = getPos()
      if (pos == null) return
      const selection = TextSelection.near(view.state.doc.resolve(pos + 1), 1)
      view.dispatch(view.state.tr.setSelection(selection))
      view.focus()
    },
    [view, getPos],
  )

  const setLanguage = useCallback(
    (language: string) => {
      setAttrs({ language } satisfies CodeBlockAttrs)
    },
    [setAttrs],
  )

  return (
    <div
      className={styles.Root}
      data-preview={previewOnly || undefined}
      data-selected={selected || undefined}
      data-testid="code-block"
    >
      <pre ref={contentRef} data-language={language} data-scroll-x {...NON_PROSE_PROPS}></pre>
      {
        /* Skip rendering the toolbar during dragging to improve the performance of rendering the drag preview image in Safari */
        selected ? null : (
          <CodeBlockToolbar
            code={code}
            language={language}
            setLanguage={setLanguage}
            view={view}
            caretInside={caretInside}
          />
        )
      }
      {showMathPreview && (
        <MathRender
          katex={katex}
          formula={previewCode}
          displayMode
          className={styles.Preview}
          data-testid="code-block-math-preview"
          data-scroll-x
          onMouseDown={focusSource}
        />
      )}
      {showMermaidPreview && (
        <MermaidRender
          renderer={mermaid}
          source={previewCode}
          className={`${styles.Preview} ${styles.MermaidPreview}`}
          data-testid="code-block-mermaid-preview"
          data-scroll-x
          onMouseDown={focusSource}
        />
      )}
    </div>
  )
}

const MENU_SHORTCUT = isApple ? '⌘/' : 'Ctrl+/'

interface CodeBlockToolbarProps {
  code: string
  language: string
  setLanguage: (language: string) => void
  view: EditorView
  caretInside: boolean
}

function CodeBlockToolbar({
  code,
  language,
  setLanguage,
  view,
  caretInside,
}: CodeBlockToolbarProps) {
  const [state, dispatch] = useReducer(reduceCodeBlockToolbar, CODE_BLOCK_TOOLBAR_IDLE)

  const changeMenuOpen = useCallback((open: boolean) => {
    dispatch(
      open
        ? { type: 'open', popup: 'menu', focusReturn: 'trigger' }
        : { type: 'close', popup: 'menu' },
    )
  }, [])

  const completeMenuOpenChange = useCallback((open: boolean) => {
    if (!open) dispatch({ type: 'closed', popup: 'menu' })
  }, [])

  const changeLanguageOpen = useCallback((open: boolean) => {
    dispatch(
      open
        ? { type: 'open', popup: 'language', focusReturn: 'trigger' }
        : { type: 'close', popup: 'language' },
    )
  }, [])

  const completeLanguageOpenChange = useCallback((open: boolean) => {
    if (!open) dispatch({ type: 'closed', popup: 'language' })
  }, [])

  useEffect(() => {
    if (!caretInside) return
    return setCaretCodeBlockMenu(view, () => {
      dispatch({ type: 'open', popup: 'menu', focusReturn: 'editor' })
    })
  }, [caretInside, view])

  const finalFocus = getCodeBlockToolbarFinalFocus(state)
  const getFinalFocus = useCallback((): boolean => {
    if (finalFocus !== 'editor') return finalFocus === 'trigger'
    view.focus()
    return false
  }, [finalFocus, view])

  const handOverToLanguagePicker = useCallback(() => {
    dispatch({ type: 'handOver' })
  }, [])

  const copyCode = useCallback(() => {
    void writeClipboardText(code)
  }, [code])

  return (
    <div
      className={styles.Toolbar}
      contentEditable={false}
      data-open={isCodeBlockToolbarActive(state) || undefined}
    >
      <CodeBlockLanguagePickerMemo
        language={language}
        setLanguage={setLanguage}
        open={state.open === 'language'}
        onOpenChange={changeLanguageOpen}
        onOpenChangeComplete={completeLanguageOpenChange}
        getFinalFocus={getFinalFocus}
      />
      <CopyButton
        getText={() => code}
        label="Copy code"
        className={styles.IconButton}
        data-testid="code-block-copy"
      />
      <Menu.Root
        open={state.open === 'menu'}
        onOpenChange={changeMenuOpen}
        onOpenChangeComplete={completeMenuOpenChange}
      >
        <Menu.Trigger
          className={styles.IconButton}
          aria-label="More"
          title={`More (${MENU_SHORTCUT})`}
          data-testid="code-block-menu"
        >
          <EllipsisIcon />
        </Menu.Trigger>
        <CodeBlockMenuPopup
          getFinalFocus={getFinalFocus}
          onChangeLanguage={handOverToLanguagePicker}
          onCopyCode={copyCode}
        />
      </Menu.Root>
    </div>
  )
}

interface CodeBlockMenuPopupProps {
  getFinalFocus: () => boolean
  onChangeLanguage: VoidFunction
  onCopyCode: VoidFunction
}

function CodeBlockMenuPopup({
  getFinalFocus,
  onChangeLanguage,
  onCopyCode,
}: CodeBlockMenuPopupProps): ReactElement {
  const collisionBoundary = use(CollisionBoundaryContext)

  return (
    <Menu.Portal>
      <Menu.Positioner
        className={styles.Positioner}
        sideOffset={4}
        align="end"
        collisionBoundary={collisionBoundary}
      >
        <Menu.Popup className={`${styles.Popup} ${styles.Menu}`} finalFocus={getFinalFocus}>
          <Menu.Item
            className={styles.MenuItem}
            onClick={onChangeLanguage}
            data-testid="code-block-menu-language"
          >
            <BracesIcon />
            Change language
          </Menu.Item>
          <Menu.Item
            className={styles.MenuItem}
            onClick={onCopyCode}
            data-testid="code-block-menu-copy"
          >
            <CopyIcon />
            Copy code
          </Menu.Item>
        </Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  )
}

interface CodeBlockLanguagePickerProps {
  language: string
  setLanguage: (language: string) => void
  open: boolean
  onOpenChange: (open: boolean) => void
  onOpenChangeComplete: (open: boolean) => void
  getFinalFocus: () => boolean
}

function CodeBlockLanguagePicker({
  language,
  setLanguage,
  open,
  onOpenChange,
  onOpenChangeComplete,
  getFinalFocus,
}: CodeBlockLanguagePickerProps): ReactElement {
  const collisionBoundary = use(CollisionBoundaryContext)
  // Fall back to the raw value so an alias or unknown language still shows in
  // the trigger instead of looking empty.
  const selected = useMemo<LanguageItem>(() => {
    return (
      codeBlockLanguages.find((item) => item.value === language) ?? {
        value: language,
        label: language,
      }
    )
  }, [language])

  const [query, setQuery] = useState('')

  // Offer the typed value as an option when it doesn't match a known one.
  const itemsForView = useMemo<readonly LanguageItem[]>(() => {
    const value = query.trim()
    if (!value) return codeBlockLanguages
    const lowercased = value.toLowerCase()
    const known = codeBlockLanguages.some(
      (item) => item.value.toLowerCase() === lowercased || item.label.toLowerCase() === lowercased,
    )
    return known ? codeBlockLanguages : [...codeBlockLanguages, { value, label: `Use "${value}"` }]
  }, [query])

  return (
    <Combobox.Root
      items={itemsForView}
      autoHighlight
      value={selected}
      onValueChange={(item) => setLanguage(item?.value ?? '')}
      inputValue={query}
      onInputValueChange={setQuery}
      open={open}
      onOpenChange={onOpenChange}
      onOpenChangeComplete={(open) => {
        onOpenChangeComplete(open)
        if (!open) setQuery('')
      }}
    >
      <Combobox.Trigger className={styles.Trigger} data-testid="code-block-language">
        <Combobox.Value placeholder="Plain Text" />
        <Combobox.Icon className={styles.TriggerIcon}>
          <ChevronsUpDownIcon />
        </Combobox.Icon>
      </Combobox.Trigger>
      <Combobox.Portal>
        <Combobox.Positioner
          className={styles.Positioner}
          sideOffset={4}
          collisionBoundary={collisionBoundary}
        >
          <Combobox.Popup className={styles.Popup} finalFocus={getFinalFocus}>
            <div className={styles.SearchRow}>
              <Combobox.Input
                className={styles.Search}
                placeholder="Search or type a language"
                data-testid="code-block-language-search"
              />
            </div>
            <Combobox.Empty className={styles.Empty}>No languages found.</Combobox.Empty>
            <Combobox.List className={styles.List}>
              {(item: LanguageItem) => (
                <Combobox.Item key={item.label} value={item} className={styles.Item}>
                  <Combobox.ItemIndicator className={styles.ItemIndicator}>
                    <CheckIcon />
                  </Combobox.ItemIndicator>
                  <span className={styles.ItemText}>{item.label}</span>
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  )
}

const CodeBlockLanguagePickerMemo = /* @__PURE__ */ memo(CodeBlockLanguagePicker)
