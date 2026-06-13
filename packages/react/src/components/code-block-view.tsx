import { Combobox } from '@base-ui/react/combobox'
import { type CodeBlockAttrs, codeBlockLanguages } from '@meowdown/core'
import type { ReactNodeViewProps } from '@prosekit/react'
import { useMemo, useRef, useState } from 'react'

import styles from './code-block-view.module.css'
import { CheckIcon } from './icons/check-icon.tsx'
import { ChevronsUpDownIcon } from './icons/chevrons-up-down-icon.tsx'
import { CopyIcon } from './icons/copy-icon.tsx'

type LanguageItem = (typeof codeBlockLanguages)[number]

const PLAIN_TEXT: LanguageItem = { value: '', label: 'Plain Text' }
const COPIED_RESET_MS = 1500

export function CodeBlockView(props: ReactNodeViewProps) {
  const attrs = props.node.attrs as CodeBlockAttrs
  const language = attrs.language || ''

  const items = useMemo<LanguageItem[]>(() => [PLAIN_TEXT, ...codeBlockLanguages], [])

  // Fall back to the raw value so an alias or unknown language still shows in
  // the trigger instead of looking empty.
  const selected = useMemo<LanguageItem>(
    () => items.find((item) => item.value === language) ?? { value: language, label: language },
    [items, language],
  )

  const setLanguage = (item: LanguageItem | null) => {
    props.setAttrs({ language: item?.value ?? '' } satisfies CodeBlockAttrs)
  }

  const [copied, setCopied] = useState(false)
  const resetTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(props.node.textContent)
      setCopied(true)
      clearTimeout(resetTimerRef.current)
      resetTimerRef.current = setTimeout(() => setCopied(false), COPIED_RESET_MS)
    } catch (error) {
      console.warn('[meowdown] Failed to copy code block:', error)
    }
  }

  return (
    <div className={styles.Root}>
      <div className={styles.Toolbar} contentEditable={false}>
        <Combobox.Root items={items} value={selected} onValueChange={setLanguage}>
          <Combobox.Trigger className={styles.Trigger} data-testid="code-block-language">
            <Combobox.Value placeholder="Plain Text" />
            <Combobox.Icon className={styles.TriggerIcon}>
              <ChevronsUpDownIcon />
            </Combobox.Icon>
          </Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner className={styles.Positioner} sideOffset={4}>
              <Combobox.Popup className={styles.Popup}>
                <div className={styles.SearchRow}>
                  <Combobox.Input
                    className={styles.Search}
                    placeholder="Search language"
                    data-testid="code-block-language-search"
                  />
                </div>
                <Combobox.Empty className={styles.Empty}>No languages found.</Combobox.Empty>
                <Combobox.List className={styles.List}>
                  {(item: LanguageItem) => (
                    <Combobox.Item key={item.value} value={item} className={styles.Item}>
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
        <button
          type="button"
          className={styles.CopyButton}
          data-testid="code-block-copy"
          data-copied={copied ? '' : undefined}
          aria-label={copied ? 'Copied' : 'Copy code'}
          title={copied ? 'Copied' : 'Copy code'}
          onMouseDown={(event) => event.preventDefault()}
          onClick={copy}
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
        </button>
      </div>
      <pre ref={props.contentRef} data-language={language || ''}></pre>
    </div>
  )
}
