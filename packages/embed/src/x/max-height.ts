import el from 'crelt'

/**
 * Clip a card taller than `--meowdown-embed-max-height` behind a "Show more"
 * button, and keep that decision current while the card resizes. Returns the
 * cleanup.
 */
export function setupMaxHeight(container: HTMLElement): (() => void) | undefined {
  container.removeAttribute('data-overflowing')
  container.removeAttribute('data-expanded')
  const article = container.querySelector<HTMLElement>(':scope > article:not([data-fallback])')
  if (!article) return

  let button: HTMLButtonElement | undefined

  const setExpanded = (expanded: boolean) => {
    container.toggleAttribute('data-expanded', expanded)
    button?.setAttribute('aria-expanded', String(expanded))
    if (button) button.textContent = expanded ? 'Show less' : 'Show more'
  }

  const update = () => {
    if (container.hasAttribute('data-expanded')) return
    const limit = Number.parseFloat(getComputedStyle(article).getPropertyValue('--_body-limit'))
    // The clipped article keeps its full content height in `scrollHeight`.
    const overflowing = article.scrollHeight > limit
    container.toggleAttribute('data-overflowing', overflowing)
    if (overflowing && !button) {
      button = el(
        'button',
        { type: 'button', 'data-show-more': '', 'aria-expanded': 'false' },
        'Show more',
      )
      button.addEventListener('click', onClick)
      article.after(button)
    } else if (!overflowing && button) {
      button.remove()
      button = undefined
    }
  }

  function onClick() {
    const expanded = !container.hasAttribute('data-expanded')
    setExpanded(expanded)
    if (expanded) return
    update()
    // "Show less" can sit far below the card's top; keep it on screen once
    // the card shrinks back.
    if (button?.isConnected) button.scrollIntoView({ block: 'nearest' })
  }

  // Keyboard focus on a link hidden by the clip reveals the whole card.
  const onFocusIn = (event: FocusEvent) => {
    if (!container.hasAttribute('data-overflowing') || container.hasAttribute('data-expanded')) {
      return
    }
    const target = event.target
    if (!(target instanceof Element) || !article.contains(target)) return
    if (!target.matches(':focus-visible')) return
    if (target.getBoundingClientRect().bottom > article.getBoundingClientRect().bottom) {
      setExpanded(true)
    }
  }

  // Clipping resizes what the observer watches; measuring in the next frame
  // keeps that out of the observer callback, which would otherwise report a
  // "ResizeObserver loop" error.
  let frame = 0
  const scheduleUpdate = () => {
    frame ||= requestAnimationFrame(() => {
      frame = 0
      update()
    })
  }

  // A clipped article keeps its own size while its content grows (a video
  // playing in place), so watch its children too.
  const observer = new ResizeObserver(scheduleUpdate)
  observer.observe(article)
  for (const child of article.children) observer.observe(child)
  container.addEventListener('focusin', onFocusIn)

  return () => {
    observer.disconnect()
    cancelAnimationFrame(frame)
    container.removeEventListener('focusin', onFocusIn)
  }
}
