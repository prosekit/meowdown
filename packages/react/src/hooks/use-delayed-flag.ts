import { useEffect, useRef, useState } from 'react'

/** Delay before the flag opens, in ms. */
const OPEN_DELAY = 400

/** Grace before the flag closes, in ms. The window lets a pointer travel from
 *  the hovered link onto the popover it anchors. */
const CLOSE_DELAY = 300

/**
 * Mirrors `value` into a boolean that flips true `openDelay`ms after `value`
 * becomes true and false `closeDelay`ms after it becomes false, cancelling any
 * pending flip on each change.
 */
export function useDelayedFlag(
  value: boolean,
  openDelay = OPEN_DELAY,
  closeDelay = CLOSE_DELAY,
): boolean {
  const [flag, setFlag] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setFlag(value), value ? openDelay : closeDelay)
    return () => clearTimeout(timerRef.current)
  }, [value, openDelay, closeDelay])

  return flag
}
