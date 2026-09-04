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
 * 71d05a3. Values are mean milliseconds per sample:
 *
 *   ordinary edit
 *     1000 blocks /   20 definitions: 0.0696 ms
 *     1000 blocks /  100 definitions: 0.0731 ms
 *     1000 blocks /  400 definitions: 0.0906 ms
 *     1000 blocks / 1000 definitions: 0.1266 ms
 *     4000 blocks /   20 definitions: 0.2372 ms
 *    16000 blocks / 1000 definitions: 0.9839 ms
 *
 *   definition keystroke
 *     1000 blocks /  100 dependents: 0.1499 ms
 *     4000 blocks /  400 dependents: 0.5453 ms
 *     1000 blocks / 1000 dependents: 0.1988 ms
 *
 *   definition edit and flush
 *     1000 blocks /  100 dependents: 0.8460 ms
 *     4000 blocks /  400 dependents: 3.7955 ms
 *     1000 blocks / 1000 dependents: 11.0587 ms
 *
 *   warm reference index scan
 *     1000 blocks /   20 definitions: 0.0265 ms
 *     1000 blocks / 1000 definitions: 0.0985 ms
 *     4000 blocks /   20 definitions: 0.1024 ms
 *
 * Benchmark timings depend on hardware and system load. Compare repeated runs
 * on the same machine rather than treating these values as universal limits.
 */
import { createTestEditor, type TestEditor } from '@prosekit/core/test'
import type { EditorNode } from '@prosekit/pm/model'
import type { Transaction } from '@prosekit/pm/state'
import { test, type Bench, type BenchRegistration } from 'vitest'

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
  const paragraphs = Array.from({ length: blockCount }, (_, index) => {
    return n.paragraph(index === 0 ? 'plain target x' : `plain paragraph ${index}`)
  })
  const definitions = Array.from({ length: definitionCount }, (_, index) => {
    return n.paragraph(`[definition-${index}]: /destination/${index}`)
  })
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
  const dependents = Array.from({ length: dependentCount }, (_, index) => {
    return n.paragraph(`dependent ${index} [target][definition-0]`)
  })
  const ordinary = Array.from({ length: blockCount - dependentCount }, (_, index) => {
    return n.paragraph(`ordinary paragraph ${index}`)
  })
  const definitions = Array.from({ length: definitionCount }, (_, index) => {
    return n.paragraph(`[definition-${index}]: /destination/${index}/x`)
  })
  editor.set(n.doc(...dependents, ...ordinary, ...definitions))
  wakeEditor(editor)
  return { editor, position: findText(editor.state.doc, '/destination/0/x') + 15, next: 'y' }
}

function registerScenario(
  bench: Bench,
  name: string,
  createScenario: () => Scenario,
  flushRestyle = false,
): BenchRegistration<string> {
  const scenario = createScenario()
  return bench(name, () => {
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

test('ordinary edit', async ({ bench }) => {
  await bench.compare(
    registerScenario(bench, '1000 blocks, 20 definitions', () => {
      return createOrdinaryEditScenario(1_000, 20)
    }),
    registerScenario(bench, '1000 blocks, 100 definitions', () => {
      return createOrdinaryEditScenario(1_000, 100)
    }),
    registerScenario(bench, '1000 blocks, 400 definitions', () => {
      return createOrdinaryEditScenario(1_000, 400)
    }),
    registerScenario(bench, '1000 blocks, 1000 definitions', () => {
      return createOrdinaryEditScenario(1_000, 1_000)
    }),
    registerScenario(bench, '4000 blocks, 20 definitions', () => {
      return createOrdinaryEditScenario(4_000, 20)
    }),
    registerScenario(bench, '16000 blocks, 1000 definitions', () => {
      return createOrdinaryEditScenario(16_000, 1_000)
    }),
  )
})

test('definition keystroke', async ({ bench }) => {
  await bench.compare(
    registerScenario(bench, '1000 blocks, 100 dependents, 20 definitions', () => {
      return createDefinitionEditScenario(1_000, 100, 20)
    }),
    registerScenario(bench, '4000 blocks, 400 dependents, 20 definitions', () => {
      return createDefinitionEditScenario(4_000, 400, 20)
    }),
    registerScenario(bench, '1000 blocks, 1000 dependents, 20 definitions', () => {
      return createDefinitionEditScenario(1_000, 1_000, 20)
    }),
  )
})

test('definition edit and flush', async ({ bench }) => {
  await bench.compare(
    registerScenario(
      bench,
      '1000 blocks, 100 dependents, 20 definitions',
      () => createDefinitionEditScenario(1_000, 100, 20),
      true,
    ),
    registerScenario(
      bench,
      '4000 blocks, 400 dependents, 20 definitions',
      () => createDefinitionEditScenario(4_000, 400, 20),
      true,
    ),
    registerScenario(
      bench,
      '1000 blocks, 1000 dependents, 20 definitions',
      () => createDefinitionEditScenario(1_000, 1_000, 20),
      true,
    ),
  )
})

function createIndexDocument(blockCount: number, definitionCount: number): EditorNode {
  const editor = createTestEditor({ extension: defineEditorExtension() })
  const n = editor.nodes
  const paragraphs = Array.from({ length: blockCount }, (_, index) => {
    return n.paragraph(`plain paragraph ${index}`)
  })
  const definitions = Array.from({ length: definitionCount }, (_, index) => {
    return n.paragraph(`[definition-${index}]: /destination/${index}`)
  })
  return n.doc(...paragraphs, ...definitions)
}

test('reference index scan', async ({ bench }) => {
  const docWithTwentyDefinitions = createIndexDocument(1_000, 20)
  const docWithThousandDefinitions = createIndexDocument(1_000, 1_000)
  const largeDoc = createIndexDocument(4_000, 20)
  collectReferenceDefinitions(docWithTwentyDefinitions)
  collectReferenceDefinitions(docWithThousandDefinitions)
  collectReferenceDefinitions(largeDoc)

  await bench.compare(
    bench('1000 blocks, 20 definitions', () => {
      collectReferenceDefinitions(docWithTwentyDefinitions)
    }),
    bench('1000 blocks, 1000 definitions', () => {
      collectReferenceDefinitions(docWithThousandDefinitions)
    }),
    bench('4000 blocks, 20 definitions', () => {
      collectReferenceDefinitions(largeDoc)
    }),
  )
})
