import '../testing/index.ts'

import { sleep } from '@ocavue/utils'
import { createRef } from 'react'
import { describe, expect, it } from 'vitest'
import { keyboard, mouse } from 'vitest-browser-commands/playwright'
import { render } from 'vitest-browser-react'
import { commands, page } from 'vitest/browser'

import { hover, unhover } from '../testing/mouse.ts'

import { ProseKitEditor } from './prosekit-editor.tsx'
import type { EditorHandle } from './types.ts'

type Modifier = 'none' | 'Alt' | 'Control' | 'Meta' | 'Shift'

interface DragEventRecord {
  type: string
  target: string
  hasDataTransfer: boolean
  dropEffect: string | undefined
  effectAllowed: string | undefined
  altKey: boolean
  ctrlKey: boolean
  defaultPrevented: boolean
}

function recordDragEvents(): { events: DragEventRecord[]; stop: VoidFunction } {
  const events: DragEventRecord[] = []
  const types = ['dragstart', 'drop', 'dragend']
  const listener = (event: Event) => {
    const dragEvent = event as DragEvent
    const target = event.target as HTMLElement
    const record: DragEventRecord = {
      type: event.type,
      target: target.dataset?.testid ?? target.nodeName,
      hasDataTransfer: !!dragEvent.dataTransfer,
      dropEffect: dragEvent.dataTransfer?.dropEffect,
      effectAllowed: dragEvent.dataTransfer?.effectAllowed,
      altKey: dragEvent.altKey,
      ctrlKey: dragEvent.ctrlKey,
      defaultPrevented: false,
    }
    events.push(record)
    // Read after the other listeners ran.
    queueMicrotask(() => {
      record.defaultPrevented = event.defaultPrevented
    })
  }
  for (const type of types) document.addEventListener(type, listener, true)
  return {
    events,
    stop: () => {
      for (const type of types) document.removeEventListener(type, listener, true)
    },
  }
}

async function writeResult(name: string, result: unknown): Promise<void> {
  const browser = import.meta.env.VITE_PROBE_BROWSER ?? 'unknown'
  const platform = navigator.platform
  await commands.writeFile(
    `./drop-effect-out/${name}-${platform}-${browser}.json`,
    JSON.stringify({ name, platform, userAgent: navigator.userAgent, result }, null, 1),
  )
}

async function dragTo(
  source: ReturnType<typeof page.getByTestId>,
  target: ReturnType<typeof page.getByTestId>,
  modifier: Modifier,
  options: { escape?: boolean } = {},
): Promise<void> {
  const start = await hover(source)
  await mouse.down()
  await mouse.move(start.x + 5, start.y + 5)
  await mouse.move(start.x + 10, start.y + 10)
  if (modifier !== 'none') await keyboard.down(modifier)
  const end = await hover(target)
  await mouse.move(end.x + 1, end.y)
  await mouse.move(end.x + 2, end.y)
  await sleep(100)
  if (options.escape) await keyboard.press('Escape')
  await mouse.up()
  if (modifier !== 'none') await keyboard.up(modifier)
  await sleep(300)
  await unhover()
}

function PlainProbe() {
  const zoneStyle = { margin: 4, padding: 8, border: '1px dashed gray', height: 20 }
  return (
    <div>
      <div
        data-testid="source"
        draggable
        style={{ width: 200, padding: 8, background: '#dde' }}
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = 'copyMove'
          event.dataTransfer.setData('text/plain', 'payload')
        }}
      >
        source
      </div>
      <div data-testid="zone-default" style={zoneStyle} onDragOver={(event) => event.preventDefault()} onDrop={(event) => event.preventDefault()} />
      <div
        data-testid="zone-move"
        style={zoneStyle}
        onDragOver={(event) => {
          event.preventDefault()
          event.dataTransfer.dropEffect = 'move'
        }}
        onDrop={(event) => event.preventDefault()}
      />
      <div
        data-testid="zone-copy"
        style={zoneStyle}
        onDragOver={(event) => {
          event.preventDefault()
          event.dataTransfer.dropEffect = 'copy'
        }}
        onDrop={(event) => event.preventDefault()}
      />
      <div data-testid="zone-reject" style={zoneStyle} />
      <textarea data-testid="zone-textarea" style={zoneStyle} defaultValue="" />
      <input data-testid="zone-input" style={zoneStyle} defaultValue="" />
      <div data-testid="zone-contenteditable" contentEditable suppressContentEditableWarning style={zoneStyle} />
    </div>
  )
}

const ZONES = ['zone-default', 'zone-move', 'zone-copy', 'zone-reject', 'zone-textarea', 'zone-input', 'zone-contenteditable']
const MODIFIERS: Modifier[] = ['none', 'Alt', 'Control', 'Meta', 'Shift']

describe('dropEffect probe', () => {
  it('plain DOM', { timeout: 300_000, retry: 0 }, async () => {
    await unhover()
    await render(<PlainProbe />)
    const source = page.getByTestId('source')
    const result: unknown[] = []

    for (const zone of ZONES) {
      for (const modifier of MODIFIERS) {
        const recorder = recordDragEvents()
        await dragTo(source, page.getByTestId(zone), modifier)
        recorder.stop()
        const element = page.getByTestId(zone).element() as HTMLInputElement
        result.push({ zone, modifier, received: element.value ?? element.textContent, events: recorder.events })
        if ('value' in element) element.value = ''
        else element.textContent = ''
      }
    }

    const recorder = recordDragEvents()
    await dragTo(source, page.getByTestId('zone-default'), 'none', { escape: true })
    recorder.stop()
    result.push({ zone: 'zone-default', modifier: 'none', escape: true, events: recorder.events })

    await writeResult('plain', result)
    expect(result.length).toBeGreaterThan(0)
  })

  async function probeEditors(name: string, modifier: Modifier, readOnly: boolean, targetKind: 'editor' | 'swallow' = 'editor') {
    await unhover()
    const from = createRef<EditorHandle>()
    const to = createRef<EditorHandle>()
    await render(
      <>
        <div data-testid="editor-source">
          <ProseKitEditor ref={from} initialMarkdown={'Alpha\n\nBravo'} />
        </div>
        <div data-testid="editor-target">
          <ProseKitEditor ref={to} initialMarkdown="Charlie" readOnly={readOnly} />
        </div>
        <div
          data-testid="swallow"
          style={{ height: 40, border: '1px dashed gray' }}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => event.preventDefault()}
        >
          swallow
        </div>
      </>,
    )
    const sourceEditor = page.getByTestId('editor-source')
    const targetEditor = page.getByTestId('editor-target')

    await hover(sourceEditor.getByText('Alpha'))
    const recorder = recordDragEvents()
    await dragTo(
      sourceEditor.getByTestId('block-handle-drag'),
      targetKind === 'editor' ? targetEditor.getByText('Charlie') : page.getByTestId('swallow'),
      modifier,
    )
    recorder.stop()
    await writeResult(name, {
      modifier,
      readOnly,
      targetKind,
      source: from.current?.getMarkdown(),
      target: to.current?.getMarkdown(),
      events: recorder.events,
    })
  }

  it('editors: no modifier', { timeout: 60_000, retry: 0 }, async () => {
    await probeEditors('editors-none', 'none', false)
  })

  it('editors: Alt', { timeout: 60_000, retry: 0 }, async () => {
    await probeEditors('editors-alt', 'Alt', false)
  })

  it('editors: Control', { timeout: 60_000, retry: 0 }, async () => {
    await probeEditors('editors-control', 'Control', false)
  })

  it('editors: read-only target', { timeout: 60_000, retry: 0 }, async () => {
    await probeEditors('editors-readonly', 'none', true)
  })

  it('editors: element that accepts the drop and ignores it', { timeout: 60_000, retry: 0 }, async () => {
    await probeEditors('editors-swallow', 'none', false, 'swallow')
  })
})
