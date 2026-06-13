import { Select } from '@base-ui/react/select'
import { type CodeBlockAttrs, codeBlockLanguages } from '@meowdown/core'
import type { ReactNodeViewProps } from '@prosekit/react'
import {  useRef, useState } from 'react'

import styles from './code-block-view.module.css'
import { CheckIcon } from './icons/check-icon.tsx'
import { ChevronsUpDownIcon } from './icons/chevrons-up-down-icon.tsx'
import { CopyIcon } from './icons/copy-icon.tsx'

const PLAIN_TEXT = ''
const PLAIN_TEXT_LABEL = 'Plain Text'
const COPIED_RESET_MS = 1500

const languageItems = codeBlockLanguages.map((name) => ({
  value: name.toLowerCase(),
  label: name
}))

export function CodeBlockView(props: ReactNodeViewProps) {
  const attrs = props.node.attrs as CodeBlockAttrs
  const language = attrs.language || PLAIN_TEXT

  const setLanguage = (value: string | null) => {
    props.setAttrs({ language: value || '' } satisfies CodeBlockAttrs)
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
      console.warn("[meowdown] Failed to copy code block:", error)
    }
  }

  return (
    <div className={styles.Root}>
      <div className={styles.Toolbar} contentEditable={false}>
        <Select.Root
          items={languageItems}
          value={language}
          onValueChange={setLanguage}
          modal={false}
        >
          <Select.Trigger className={styles.Trigger} data-testid="code-block-language">
            <Select.Value />
            <Select.Icon className={styles.TriggerIcon}>
              <ChevronsUpDownIcon />
            </Select.Icon>
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner
              className={styles.Positioner}
              sideOffset={4}
              alignItemWithTrigger={false}
            >
              <Select.Popup className={styles.Popup}>
                <Select.List className={styles.List}>
                  {codeBlockLanguages.map(({ value, label }) => (
                    <Select.Item
                      key={value || PLAIN_TEXT_LABEL}
                      value={value}
                      className={styles.Item}
                    >
                      <Select.ItemIndicator className={styles.ItemIndicator}>
                        <CheckIcon />
                      </Select.ItemIndicator>
                      <Select.ItemText className={styles.ItemText}>{label}</Select.ItemText>
                    </Select.Item>
                  ))}
                </Select.List>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
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
      <pre ref={props.contentRef} data-language={language || ""}></pre>
    </div>
  )
}
