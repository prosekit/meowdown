import { CheckIcon, CopyIcon } from 'lucide-react'
import { useRef, useState } from 'react'

const COPIED_RESET_MS = 1500

interface CopyButtonProps {
  /** Returns the text written to the clipboard, evaluated at copy time. */
  getText: () => string
  /** aria-label / title in the idle state (e.g. "Copy code", "Copy link"). */
  label: string
  /** Fired after a successful copy (e.g. to show a toast). */
  onCopy?: () => void
  className?: string
  'data-testid'?: string
}

/**
 * A copy-to-clipboard button with "copied" feedback. Shared by the code block
 * toolbar and the link popover.
 */
export function CopyButton({ getText, label, onCopy, className, ...rest }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)
  const resetTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(getText())
      setCopied(true)
      clearTimeout(resetTimerRef.current)
      resetTimerRef.current = setTimeout(() => setCopied(false), COPIED_RESET_MS)
      onCopy?.()
    } catch (error) {
      console.warn('[meowdown] Failed to copy:', error)
    }
  }

  return (
    <button
      type="button"
      className={className}
      data-copied={copied ? '' : undefined}
      aria-label={copied ? 'Copied' : label}
      title={copied ? 'Copied' : label}
      onMouseDown={(event) => event.preventDefault()}
      onClick={copy}
      {...rest}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
    </button>
  )
}
