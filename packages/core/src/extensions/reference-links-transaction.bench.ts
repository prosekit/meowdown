/**
 * Run from the repository root:
 *
 *   pnpm exec vitest bench \
 *     packages/core/src/extensions/reference-links-transaction.bench.ts \
 *     --run
 *
 * The scenarios reuse a warmed editor and toggle one character per sample.
 * "definition keystroke" measures the immediate source transaction without the
 * deferred dependent restyle. "definition edit and flush" also dispatches the
 * restyle meta transaction, without waiting for the 200 ms UI debounce.
 *
 * Baseline recorded 2026-07-23 with Vitest 4.1.10, Chromium, and commit
 * de927682. Values are mean milliseconds per sample:
 *
 *   ordinary edit
 *     1000 blocks /   20 definitions: 0.0634 ms
 *     1000 blocks /  100 definitions: 0.0651 ms
 *     1000 blocks /  400 definitions: 0.0797 ms
 *     1000 blocks / 1000 definitions: 0.1088 ms
 *     4000 blocks /   20 definitions: 0.2102 ms
 *    16000 blocks / 1000 definitions: 0.8616 ms
 *
 *   definition keystroke
 *     1000 blocks /  100 dependents: 0.1258 ms
 *     4000 blocks /  400 dependents: 0.4755 ms
 *     1000 blocks / 1000 dependents: 0.1646 ms
 *
 *   definition edit and flush
 *     1000 blocks /  100 dependents: 0.8089 ms
 *     4000 blocks /  400 dependents: 4.1303 ms
 *     1000 blocks / 1000 dependents: 9.6923 ms
 *
 *   warm reference index scan
 *     1000 blocks /   20 definitions: 0.0240 ms
 *     1000 blocks / 1000 definitions: 0.0933 ms
 *     4000 blocks /   20 definitions: 0.0914 ms
 *
 * Benchmark timings depend on hardware and system load. Compare repeated runs
 * on the same machine rather than treating these values as universal limits.
 */
import { createTestEditor, type TestEditor } from '@prosekit/core/test'
import type { EditorNode } from '@prosekit/pm/model'
import type { Transaction } from '@prosekit/pm/state'
import { bench, describe } from 'vitest'

import { defineEditorExtension, type EditorExtension } from './extension.ts'
import { collectReferenceDefinitions } from './reference-links.ts'

interface Scenario {
  editor: TestEditor<EditorExtension>
  position: number
  next: string
}

function dispatch(editor: TestEditor<EditorExtension>, transaction: Transaction): void {
  editor.updateState(editor.state.apply(transaction))
}

function findText(doc: EditorNode, search: string): number {
  let found = -1
  doc.descendants((node, position) => {
    if (found >= 0 || !node.isText) return
    const index = node.text?.indexOf(search) ?? -1
    if (index >= 0) found = position + index
  })
  if (found < 0) throw new Error(`Text not found: ${search}`)
  return found
}

function wakeEditor(editor: TestEditor<EditorExtension>): void {
  dispatch(editor, editor.state.tr.setMeta('inline-marks-trigger', true))
}

function createOrdinaryEditScenario(blockCount: number, definitionCount: number): Scenario {
  const editor = createTestEditor({ extension: defineEditorExtension() })
  const n = editor.nodes
  const paragraphs = Array.from({ length: blockCount }, (_, index) =>
    n.paragraph(index === 0 ? 'plain target x' : `plain paragraph ${index}`),
  )
  const definitions = Array.from({ length: definitionCount }, (_, index) =>
    n.paragraph(`[definition-${index}]: /destination/${index}`),
  )
  editor.set(n.doc(...paragraphs, ...definitions))
  wakeEditor(editor)
  return { editor, position: findText(editor.state.doc, 'x'), next: 'y' }
}

function createDefinitionEditScenario(
  blockCount: number,
  dependentCount: number,
  definitionCount: number,
): Scenario {
  const editor = createTestEditor({ extension: defineEditorExtension() })
  const n = editor.nodes
  const dependents = Array.from({ length: dependentCount }, (_, index) =>
    n.paragraph(`dependent ${index} [target][definition-0]`),
  )
  const ordinary = Array.from({ length: blockCount - dependentCount }, (_, index) =>
    n.paragraph(`ordinary paragraph ${index}`),
  )
  const definitions = Array.from({ length: definitionCount }, (_, index) =>
    n.paragraph(`[definition-${index}]: /destination/${index}/x`),
  )
  editor.set(n.doc(...dependents, ...ordinary, ...definitions))
  wakeEditor(editor)
  return { editor, position: findText(editor.state.doc, '/destination/0/x') + 15, next: 'y' }
}

function registerScenario(
  name: string,
  createScenario: () => Scenario,
  flushRestyle = false,
): void {
  const scenario = createScenario()
  bench(name, () => {
    const transaction = scenario.editor.state.tr.insertText(
      scenario.next,
      scenario.position,
      scenario.position + 1,
    )
    dispatch(scenario.editor, transaction)
    if (flushRestyle) {
      dispatch(scenario.editor, scenario.editor.state.tr.setMeta('inline-marks-restyle', true))
    }
    scenario.next = scenario.next === 'x' ? 'y' : 'x'
  })
}

describe('ordinary edit', () => {
  registerScenario('1000 blocks, 20 definitions', () => createOrdinaryEditScenario(1_000, 20))
  registerScenario('1000 blocks, 100 definitions', () => createOrdinaryEditScenario(1_000, 100))
  registerScenario('1000 blocks, 400 definitions', () => createOrdinaryEditScenario(1_000, 400))
  registerScenario('1000 blocks, 1000 definitions', () => createOrdinaryEditScenario(1_000, 1_000))
  registerScenario('4000 blocks, 20 definitions', () => createOrdinaryEditScenario(4_000, 20))
  registerScenario('16000 blocks, 1000 definitions', () =>
    createOrdinaryEditScenario(16_000, 1_000),
  )
})

describe('definition keystroke', () => {
  registerScenario('1000 blocks, 100 dependents, 20 definitions', () =>
    createDefinitionEditScenario(1_000, 100, 20),
  )
  registerScenario('4000 blocks, 400 dependents, 20 definitions', () =>
    createDefinitionEditScenario(4_000, 400, 20),
  )
  registerScenario('1000 blocks, 1000 dependents, 20 definitions', () =>
    createDefinitionEditScenario(1_000, 1_000, 20),
  )
})

describe('definition edit and flush', () => {
  registerScenario(
    '1000 blocks, 100 dependents, 20 definitions',
    () => createDefinitionEditScenario(1_000, 100, 20),
    true,
  )
  registerScenario(
    '4000 blocks, 400 dependents, 20 definitions',
    () => createDefinitionEditScenario(4_000, 400, 20),
    true,
  )
  registerScenario(
    '1000 blocks, 1000 dependents, 20 definitions',
    () => createDefinitionEditScenario(1_000, 1_000, 20),
    true,
  )
})

function createIndexDocument(blockCount: number, definitionCount: number): EditorNode {
  const editor = createTestEditor({ extension: defineEditorExtension() })
  const n = editor.nodes
  const paragraphs = Array.from({ length: blockCount }, (_, index) =>
    n.paragraph(`plain paragraph ${index}`),
  )
  const definitions = Array.from({ length: definitionCount }, (_, index) =>
    n.paragraph(`[definition-${index}]: /destination/${index}`),
  )
  return n.doc(...paragraphs, ...definitions)
}

describe('reference index scan', () => {
  const docWithTwentyDefinitions = createIndexDocument(1_000, 20)
  const docWithThousandDefinitions = createIndexDocument(1_000, 1_000)
  const largeDoc = createIndexDocument(4_000, 20)
  collectReferenceDefinitions(docWithTwentyDefinitions)
  collectReferenceDefinitions(docWithThousandDefinitions)
  collectReferenceDefinitions(largeDoc)

  bench('1000 blocks, 20 definitions', () => {
    collectReferenceDefinitions(docWithTwentyDefinitions)
  })
  bench('1000 blocks, 1000 definitions', () => {
    collectReferenceDefinitions(docWithThousandDefinitions)
  })
  bench('4000 blocks, 20 definitions', () => {
    collectReferenceDefinitions(largeDoc)
  })
})
