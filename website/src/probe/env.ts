import { record, setEnv } from './recorder.ts'

/**
 * The pointer/hover queries decide every "is this a touch device" heuristic we
 * are considering, so the probe watches them for changes too: an iPad gaining a
 * trackpad mid-session is exactly the case a static probe gets wrong.
 */
const MEDIA_QUERIES = [
  '(pointer: coarse)',
  '(pointer: fine)',
  '(pointer: none)',
  '(any-pointer: coarse)',
  '(any-pointer: fine)',
  '(hover: hover)',
  '(any-hover: hover)',
  '(prefers-reduced-motion: reduce)',
] as const

function readMediaQueries(): Record<string, boolean> {
  const result: Record<string, boolean> = {}
  for (const query of MEDIA_QUERIES) result[query] = window.matchMedia(query).matches
  return result
}

function readViewport(): Record<string, unknown> {
  const visual = window.visualViewport
  return {
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    visualWidth: visual?.width,
    visualHeight: visual?.height,
    visualScale: visual?.scale,
    visualOffsetTop: visual?.offsetTop,
  }
}

export function snapshotEnv(): Record<string, unknown> {
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    vendor: navigator.vendor,
    maxTouchPoints: navigator.maxTouchPoints,
    language: navigator.language,
    standalone: 'standalone' in navigator ? navigator.standalone : undefined,
    media: readMediaQueries(),
    viewport: readViewport(),
    href: location.href,
    recordedAt: new Date().toISOString(),
  }
}

/**
 * Installs the environment snapshot and keeps watching the pointer/hover media
 * queries and the visual viewport. Returns a cleanup function.
 */
export function watchEnv(): () => void {
  setEnv(snapshotEnv())
  const cleanups: (() => void)[] = []

  for (const query of MEDIA_QUERIES) {
    const list = window.matchMedia(query)
    const onChange = (event: MediaQueryListEvent) => {
      record('config', 'media-change', { query, matches: event.matches })
      setEnv(snapshotEnv())
    }
    list.addEventListener('change', onChange)
    cleanups.push(() => list.removeEventListener('change', onChange))
  }

  const visual = window.visualViewport
  if (visual != null) {
    const onVisual = (event: Event) => {
      record('event', `visualViewport:${event.type}`, readViewport())
    }
    visual.addEventListener('resize', onVisual)
    visual.addEventListener('scroll', onVisual)
    cleanups.push(() => {
      visual.removeEventListener('resize', onVisual)
      visual.removeEventListener('scroll', onVisual)
    })
  }

  const onResize = () => record('event', 'window:resize', readViewport())
  window.addEventListener('resize', onResize)
  cleanups.push(() => window.removeEventListener('resize', onResize))

  return () => {
    for (const cleanup of cleanups) cleanup()
  }
}
