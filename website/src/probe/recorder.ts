/**
 * The probe timeline. Every observation, DOM event, transaction and measurement
 * lands here as one entry, ordered by `seq`.
 *
 * Nothing is printed per entry: a synchronous `console.log` inside an event
 * handler perturbs the very batching and event ordering this probe exists to
 * measure. Entries stay in memory until a run is saved.
 */

export type ProbeKind = 'event' | 'tx' | 'mark' | 'measure' | 'config' | 'mutation' | 'note'

export interface SelectionSnapshot {
  dom?: {
    anchor: string
    anchorOffset: number
    focus: string
    focusOffset: number
    collapsed: boolean
    rangeCount: number
  }
  pm?: {
    anchor: number
    head: number
    empty: boolean
    type: string
    parent: string
    parentOffset: number
    marks: string[]
  }
}

export interface ProbeEntry {
  seq: number
  t: number
  kind: ProbeKind
  name: string
  detail?: Record<string, unknown>
  sel?: SelectionSnapshot
}

interface ProbeLog {
  session: string
  page: string
  startedAt: number
  env: Record<string, unknown>
  config: Record<string, unknown>
  entries: ProbeEntry[]
}

const MAX_ENTRIES = 40_000
const MIRROR_EVERY = 200
const MIRROR_KEY = 'meowdown-probe-pending'

let entries: ProbeEntry[] = []
let seq = 0
let page = '#/'
let config: Record<string, unknown> = {}
let env: Record<string, unknown> = {}
let startedAt = Date.now()
let sinceMirror = 0

const listeners = new Set<() => void>()

export const sessionId = `${new Date().toISOString().slice(0, 16).replaceAll(/[:T-]/g, '')}-${Math.random().toString(36).slice(2, 6)}`

/** Snapshot provider for the ProseMirror half of `sel`. Set by the editor probe. */
let selectionProvider: (() => SelectionSnapshot['pm']) | undefined

export function setSelectionProvider(provider: (() => SelectionSnapshot['pm']) | undefined): void {
  selectionProvider = provider
}

export function setPage(next: string): void {
  page = next
}

export function setEnv(next: Record<string, unknown>): void {
  env = next
}

export function setConfig(next: Record<string, unknown>): void {
  config = next
}

function notify(): void {
  for (const listener of listeners) listener()
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function record(
  kind: ProbeKind,
  name: string,
  detail?: Record<string, unknown>,
  sel?: SelectionSnapshot,
): void {
  if (entries.length >= MAX_ENTRIES) return
  entries.push({
    seq: seq++,
    t: Math.round(performance.now() * 10) / 10,
    kind,
    name,
    detail,
    sel,
  })
  sinceMirror += 1
  if (sinceMirror >= MIRROR_EVERY) {
    sinceMirror = 0
    mirror()
  }
  notify()
}

/** Describes a DOM node compactly enough to identify it in a log. */
export function describeNode(node: Node | null | undefined): string {
  if (node == null) return 'null'
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.nodeValue ?? ''
    const clipped = text.length > 24 ? `${text.slice(0, 24)}…` : text
    return `text(${JSON.stringify(clipped)})@${describeNode(node.parentElement)}`
  }
  if (node instanceof Element) {
    const classes = Array.from(node.classList).slice(0, 3).join('.')
    return classes ? `${node.nodeName.toLowerCase()}.${classes}` : node.nodeName.toLowerCase()
  }
  return node.nodeName
}

/**
 * Property-only selection read: no `getClientRects`, no `getBoundingClientRect`,
 * so recording one costs no forced layout. Geometry lives in `measure` entries.
 */
export function snapshotSelection(): SelectionSnapshot {
  const snapshot: SelectionSnapshot = {}
  const selection = document.getSelection()
  if (selection != null) {
    snapshot.dom = {
      anchor: describeNode(selection.anchorNode),
      anchorOffset: selection.anchorOffset,
      focus: describeNode(selection.focusNode),
      focusOffset: selection.focusOffset,
      collapsed: selection.isCollapsed,
      rangeCount: selection.rangeCount,
    }
  }
  snapshot.pm = selectionProvider?.()
  return snapshot
}

export function getEntries(): readonly ProbeEntry[] {
  return entries
}

export function getEntryCount(): number {
  return entries.length
}

function buildLog(): ProbeLog {
  return { session: sessionId, page, startedAt, env, config, entries }
}

function mirror(): void {
  try {
    sessionStorage.setItem(MIRROR_KEY, JSON.stringify(buildLog()))
  } catch {
    // Quota or private mode. The beacon and the manual save still cover us.
  }
}

export function clearEntries(): void {
  entries = []
  seq = 0
  sinceMirror = 0
  startedAt = Date.now()
  sessionStorage.removeItem(MIRROR_KEY)
  notify()
}

async function post(log: ProbeLog): Promise<string> {
  const response = await fetch('/__probe/log', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(log),
  })
  const result = (await response.json()) as { ok?: boolean; file?: string; error?: string }
  if (!result.ok) throw new Error(result.error ?? 'save failed')
  return result.file ?? 'unknown'
}

/** Saves the current run and starts a fresh one. Returns the written filename. */
export async function saveRun(): Promise<string> {
  const log = buildLog()
  const file = await post(log)
  clearEntries()
  return file
}

export function logAsText(): string {
  return JSON.stringify(buildLog(), null, 2)
}

/** Fire-and-forget save for `pagehide`, so an HMR reload never loses a run. */
export function beaconSave(): void {
  if (entries.length === 0) return
  const body = new Blob([JSON.stringify(buildLog())], { type: 'application/json' })
  navigator.sendBeacon('/__probe/log', body)
}

/**
 * A previous page instance died before saving (HMR reload, back gesture,
 * Safari tab eviction). Ship whatever it mirrored, then drop it.
 */
export function flushMirroredRun(): void {
  const pending = sessionStorage.getItem(MIRROR_KEY)
  if (pending == null) return
  sessionStorage.removeItem(MIRROR_KEY)
  navigator.sendBeacon('/__probe/log', new Blob([pending], { type: 'application/json' }))
}
