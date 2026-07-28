const COMPOSITION_TAIL_MS = 50

let compositionEndedAt = -1
let isComposing = false

if (typeof window !== 'undefined') {
  window.addEventListener(
    'compositionstart',
    () => {
      isComposing = true
    },
    { capture: true, passive: true },
  )
  window.addEventListener(
    'compositionend',
    () => {
      isComposing = false
      compositionEndedAt = Date.now()
    },
    { capture: true, passive: true },
  )
}

// Workaround for WebKit firing compositionend before the keydown that commits an
// IME composition, which makes that keydown report `isComposing` as false.
// https://bugs.webkit.org/show_bug.cgi?id=165004
// https://bugs.webkit.org/show_bug.cgi?id=311717
export function getIsComposing(): boolean {
  return (
    isComposing ||
    (compositionEndedAt > 0 && Date.now() - compositionEndedAt <= COMPOSITION_TAIL_MS)
  )
}
