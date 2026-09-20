import '../style.css'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { page, userEvent } from 'vitest/browser'

import {
  useLightbox,
  type LightboxCloseOptions,
  type LightboxController,
  type LightboxItem,
} from '../hooks/use-lightbox.ts'

import { Lightbox } from './lightbox.tsx'

// Stubbed so the tests can exercise both motion settings.
function installMatchMedia(reducedMotion: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn((query: string): MediaQueryList => ({
      matches: reducedMotion && query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

const ITEM: LightboxItem = {
  type: 'image',
  src: "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'/%3E",
  alt: 'Cat',
}

type CloseSpy = ReturnType<typeof vi.fn<(options?: LightboxCloseOptions) => void>>

interface RenderedLightbox {
  onClose: CloseSpy
  preview: HTMLElement
  image: HTMLImageElement
  backdrop: HTMLElement | null
  closeChrome: HTMLElement
}

async function renderMobileLightbox(): Promise<RenderedLightbox> {
  const onClose: CloseSpy = vi.fn()
  await render(<Lightbox lightbox={{ item: ITEM, open: vi.fn(), close: onClose }} touch />)

  const dialog = page.getByRole('dialog', { name: 'Image preview' })
  await expect.element(dialog).toBeInTheDocument()
  const preview = page.getByRole('button', { name: 'Close image preview' }).element()
  if (!(preview instanceof HTMLElement)) {
    throw new TypeError('lightbox preview missing')
  }
  const image = preview.querySelector('img')
  if (!(image instanceof HTMLImageElement)) {
    throw new TypeError('lightbox image missing')
  }
  const closeChrome = page
    .getByRole('button', { name: 'Close', exact: true })
    .element().parentElement
  if (!(closeChrome instanceof HTMLElement)) {
    throw new TypeError('close chrome missing')
  }
  await vi.waitFor(() => {
    expect(preview.getBoundingClientRect().height).toBe(window.innerHeight)
  })
  const backdrop = dialog.element().querySelector('div[aria-hidden]')
  return {
    onClose,
    preview,
    image,
    backdrop: backdrop instanceof HTMLElement ? backdrop : null,
    closeChrome,
  }
}

function firePointer(element: Element, type: string, init: PointerEventInit): void {
  element.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, ...init }))
}

function fireClick(element: Element): void {
  element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
}

function touchDown(element: Element, clientX: number, clientY: number): void {
  firePointer(element, 'pointerdown', {
    pointerId: 1,
    isPrimary: true,
    pointerType: 'touch',
    clientX,
    clientY,
  })
}

// Swallowing the real transitionend lets the hook's fallback timer complete
// each settle at its scripted duration, so the settling styles stay observable.
function swallowTransitionEnd(event: Event): void {
  event.stopPropagation()
}

beforeEach(() => {
  installMatchMedia(false)
  document.addEventListener('transitionend', swallowTransitionEnd, { capture: true })
})

afterEach(() => {
  document.removeEventListener('transitionend', swallowTransitionEnd, { capture: true })
  vi.restoreAllMocks()
})

describe('Lightbox touch drag-to-dismiss', () => {
  it('rebases at activation and follows the finger on both axes', async () => {
    const { preview, image } = await renderMobileLightbox()

    touchDown(preview, 180, 120)
    firePointer(preview, 'pointermove', { pointerId: 1, clientX: 182, clientY: 180 })
    await vi.waitFor(() => {
      expect(image.style.transform).toContain('translate3d(0px, 0px, 0px)')
    })

    firePointer(preview, 'pointermove', { pointerId: 1, clientX: 190, clientY: 260 })
    await vi.waitFor(() => {
      expect(image.style.transform).toContain('translate3d(8px, 80px, 0px)')
    })
  })

  it('fades the backdrop and chrome with drag progress', async () => {
    const { preview, backdrop, closeChrome } = await renderMobileLightbox()
    expect(backdrop).not.toBeNull()

    touchDown(preview, 180, 120)
    firePointer(preview, 'pointermove', { pointerId: 1, clientX: 182, clientY: 180 })
    firePointer(preview, 'pointermove', { pointerId: 1, clientX: 190, clientY: 260 })

    const progress = Math.hypot(8, 80) / (window.innerHeight * 0.5)
    await vi.waitFor(() => {
      expect(Number.parseFloat(backdrop!.style.opacity)).toBeCloseTo(1 - progress * 0.85, 5)
    })
    expect(Number.parseFloat(closeChrome.style.opacity)).toBeCloseTo(1 - progress * 2, 5)
    expect(closeChrome.style.pointerEvents).toBe('none')
  })

  it('dismisses past the distance threshold, sliding out along the drag vector', async () => {
    const { preview, image, backdrop, onClose } = await renderMobileLightbox()

    touchDown(preview, 180, 120)
    firePointer(preview, 'pointermove', { pointerId: 1, clientX: 182, clientY: 180 })
    firePointer(preview, 'pointermove', { pointerId: 1, clientX: 190, clientY: 260 })
    firePointer(preview, 'pointerup', { pointerId: 1, clientX: 190, clientY: 320 })

    await vi.waitFor(() => {
      expect(image.style.transform).toContain(`, ${window.innerHeight}px, 0px) scale(0.9)`)
    })
    expect(backdrop!.style.opacity).toBe('0')
    expect(onClose).not.toHaveBeenCalled()
    onClose.mockImplementation(() => {
      expect(image.style.transform).toBe('')
    })

    await vi.waitFor(() => expect(onClose).toHaveBeenCalledTimes(1), { timeout: 5_000 })
    expect(onClose).toHaveBeenCalledWith({ instant: true })
  })

  it('dismisses horizontally past the distance threshold', async () => {
    const { preview, image, onClose } = await renderMobileLightbox()

    touchDown(preview, 100, 100)
    firePointer(preview, 'pointermove', { pointerId: 1, clientX: 120, clientY: 100 })
    firePointer(preview, 'pointermove', { pointerId: 1, clientX: 340, clientY: 104 })
    firePointer(preview, 'pointerup', { pointerId: 1, clientX: 340, clientY: 104 })

    await vi.waitFor(() => {
      expect(image.style.transform).toContain(`translate3d(${window.innerWidth}px, `)
    })
    expect(onClose).not.toHaveBeenCalled()

    await vi.waitFor(() => expect(onClose).toHaveBeenCalledTimes(1), { timeout: 5_000 })
  })

  it('dismisses a fast flick before the distance threshold', async () => {
    const { preview, image, onClose } = await renderMobileLightbox()
    const nowSpy = vi.spyOn(performance, 'now')

    nowSpy.mockReturnValue(1_000)
    touchDown(preview, 100, 100)
    firePointer(preview, 'pointermove', { pointerId: 1, clientX: 100, clientY: 120 })

    nowSpy.mockReturnValue(1_040)
    firePointer(preview, 'pointermove', { pointerId: 1, clientX: 100, clientY: 170 })

    nowSpy.mockReturnValue(1_060)
    firePointer(preview, 'pointerup', { pointerId: 1, clientX: 100, clientY: 180 })
    nowSpy.mockRestore()

    await vi.waitFor(() => {
      expect(image.style.transform).toContain(`, ${window.innerHeight}px, 0px)`)
    })
    await vi.waitFor(() => expect(onClose).toHaveBeenCalledTimes(1), { timeout: 5_000 })
  })

  it('springs back after a short drag and suppresses the trailing tap', async () => {
    const { preview, image, backdrop, onClose } = await renderMobileLightbox()

    touchDown(preview, 100, 100)
    firePointer(preview, 'pointermove', { pointerId: 1, clientX: 102, clientY: 130 })
    firePointer(preview, 'pointermove', { pointerId: 1, clientX: 102, clientY: 160 })
    firePointer(preview, 'pointerup', { pointerId: 1, clientX: 102, clientY: 160 })

    await vi.waitFor(() => {
      expect(image.style.transform).toBe('translate3d(0px, 0px, 0px) scale(1)')
    })
    expect(backdrop!.style.opacity).toBe('1')

    fireClick(preview)
    fireClick(preview)
    expect(onClose).not.toHaveBeenCalled()

    await vi.waitFor(() => {
      expect(image.style.transform).toBe('')
    })
    fireClick(preview)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('dismisses upward past the distance threshold', async () => {
    const { preview, image, onClose } = await renderMobileLightbox()

    touchDown(preview, 100, 100)
    firePointer(preview, 'pointermove', { pointerId: 1, clientX: 100, clientY: 80 })
    firePointer(preview, 'pointermove', { pointerId: 1, clientX: 100, clientY: -120 })

    await vi.waitFor(() => {
      expect(image.style.transform).toContain('translate3d(0px, -200px, 0px)')
    })

    firePointer(preview, 'pointerup', { pointerId: 1, clientX: 100, clientY: -120 })
    await vi.waitFor(() => {
      expect(image.style.transform).toContain(`, -${window.innerHeight}px, 0px)`)
    })
    await vi.waitFor(() => expect(onClose).toHaveBeenCalledTimes(1), { timeout: 5_000 })
  })

  it('snaps back without closing when the drag is interrupted', async () => {
    const { preview, image, onClose } = await renderMobileLightbox()

    touchDown(preview, 180, 120)
    firePointer(preview, 'pointermove', { pointerId: 1, clientX: 182, clientY: 180 })
    firePointer(preview, 'pointermove', { pointerId: 1, clientX: 182, clientY: 380 })
    firePointer(preview, 'pointercancel', { pointerId: 1, clientX: 182, clientY: 380 })

    await vi.waitFor(() => {
      expect(image.style.transform).toBe('translate3d(0px, 0px, 0px) scale(1)')
    })
    await vi.waitFor(() => {
      expect(image.style.transform).toBe('')
    })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('springs back after a short horizontal drag and suppresses the trailing tap', async () => {
    const { preview, image, onClose } = await renderMobileLightbox()

    touchDown(preview, 100, 100)
    firePointer(preview, 'pointermove', { pointerId: 1, clientX: 140, clientY: 102 })
    firePointer(preview, 'pointerup', { pointerId: 1, clientX: 140, clientY: 102 })

    await vi.waitFor(() => {
      expect(image.style.transform).toBe('translate3d(0px, 0px, 0px) scale(1)')
    })

    fireClick(preview)
    expect(onClose).not.toHaveBeenCalled()

    fireClick(preview)
    expect(onClose).not.toHaveBeenCalled()

    await vi.waitFor(() => {
      expect(image.style.transform).toBe('')
    })
    fireClick(preview)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('skips the settle animation under reduced motion and clears suppression', async () => {
    installMatchMedia(true)
    const { preview, image, onClose } = await renderMobileLightbox()

    touchDown(preview, 100, 100)
    firePointer(preview, 'pointermove', { pointerId: 1, clientX: 102, clientY: 130 })
    firePointer(preview, 'pointerup', { pointerId: 1, clientX: 102, clientY: 130 })

    expect(image.style.transform).toBe('')

    fireClick(preview)
    expect(onClose).not.toHaveBeenCalled()
    fireClick(preview)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('still closes on a plain tap', async () => {
    const { preview, onClose } = await renderMobileLightbox()

    touchDown(preview, 100, 100)
    firePointer(preview, 'pointerup', { pointerId: 1, clientX: 100, clientY: 100 })
    fireClick(preview)
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledWith({ instant: false })
  })
})

describe('Lightbox without touch', () => {
  it('ignores touch drags and closes on click without a drag backdrop', async () => {
    const onClose: CloseSpy = vi.fn()
    await render(<Lightbox lightbox={{ item: ITEM, open: vi.fn(), close: onClose }} />)

    const dialogLocator = page.getByRole('dialog', { name: 'Image preview' })
    await expect.element(dialogLocator).toBeInTheDocument()
    const dialog = dialogLocator.element()
    expect(dialog.querySelector('div[aria-hidden]')).toBeNull()

    const preview = page.getByRole('button', { name: 'Close image preview' }).element()
    const image = preview.querySelector('img')

    touchDown(preview, 100, 100)
    firePointer(preview, 'pointermove', { pointerId: 1, clientX: 100, clientY: 200 })
    expect(image?.style.transform).toBe('')

    firePointer(preview, 'pointerup', { pointerId: 1, clientX: 100, clientY: 200 })
    fireClick(preview)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('Lightbox with useLightbox', () => {
  let controller: LightboxController

  function Host() {
    const lightbox = useLightbox()
    controller = lightbox
    return (
      <Lightbox
        lightbox={lightbox}
        renderActions={(item) => <button type="button">Open {item.alt}</button>}
      />
    )
  }

  function appendThumbnail(): HTMLImageElement {
    const thumbnail = document.createElement('img')
    thumbnail.src = ITEM.src
    thumbnail.width = 50
    thumbnail.height = 50
    document.body.append(thumbnail)
    return thumbnail
  }

  // Whether the browser is animating a zoom between the thumbnail and the
  // lightbox image right now.
  function isZooming(): boolean {
    return document.getAnimations().some((animation) => {
      const effect = animation.effect
      return (
        effect instanceof KeyframeEffect &&
        effect.pseudoElement === '::view-transition-group(meowdown-lightbox)'
      )
    })
  }

  const dialog = page.getByRole('dialog', { name: 'Image preview' })

  it.skipIf(!('startViewTransition' in document))(
    'zooms from the thumbnail on open and back to it on Escape',
    async () => {
      const thumbnail = appendThumbnail()
      await render(<Host />)

      controller.open(ITEM, thumbnail)
      await vi.waitFor(() => expect(isZooming()).toBe(true))
      await expect.element(dialog).toBeInTheDocument()
      await vi.waitFor(() => expect(isZooming()).toBe(false))
      expect(thumbnail.style.viewTransitionName).toBe('')

      await userEvent.keyboard('{Escape}')
      await vi.waitFor(() => expect(isZooming()).toBe(true))
      await expect.element(dialog).not.toBeInTheDocument()
      await vi.waitFor(() => expect(thumbnail.style.viewTransitionName).toBe(''))
      thumbnail.remove()
    },
  )

  it('opens and closes without a zoom under reduced motion', async () => {
    installMatchMedia(true)
    const thumbnail = appendThumbnail()
    await render(<Host />)

    controller.open(ITEM, thumbnail)
    await expect.element(dialog).toBeInTheDocument()
    expect(isZooming()).toBe(false)
    expect(thumbnail.style.viewTransitionName).toBe('')

    await userEvent.keyboard('{Escape}')
    await expect.element(dialog).not.toBeInTheDocument()
    expect(isZooming()).toBe(false)
    thumbnail.remove()
  })

  it('renders host actions for the open item', async () => {
    await render(<Host />)
    controller.open(ITEM)
    await expect.element(page.getByRole('button', { name: 'Open Cat' })).toBeInTheDocument()
  })
})
