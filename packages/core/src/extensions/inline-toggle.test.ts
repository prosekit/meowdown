import { describe, expect, it } from 'vitest'

import type { TextEdit, ToggleName } from './inline-toggle.ts'
import {
  caretPlan,
  isInlineActive,
  TOGGLE_SPECS,
  toggleInlineEdits,
  trimRange,
} from './inline-toggle.ts'

/**
 * Split a fixture like `**<a>hello<b>** world` into text plus selection
 * offsets, using the same `<a>` / `<b>` tokens as the prosekit test
 * builders. `<a>` alone marks a caret; `<a>` must come before `<b>`.
 */
function parseSelection(input: string): { text: string; from: number; to: number } {
  const from = input.indexOf('<a>')
  if (from < 0) throw new Error(`fixture needs <a>: ${input}`)
  const rest = input.replace('<a>', '')
  const head = rest.indexOf('<b>')
  return { text: rest.replace('<b>', ''), from, to: head < 0 ? from : head }
}

function applyEdits(text: string, edits: TextEdit[]): string {
  const sorted = [...edits].sort((left, right) => right.from - left.from || right.to - left.to)
  for (const edit of sorted) {
    text = text.slice(0, edit.from) + edit.insert + text.slice(edit.to)
  }
  return text
}

/** Toggle `name` over the `<a>`...`<b>` selection, mirroring the command's per-segment flow. */
function toggle(name: ToggleName, input: string): string {
  const spec = TOGGLE_SPECS[name]
  const sel = parseSelection(input)
  const [from, to] = trimRange(sel.text, sel.from, sel.to)
  if (from >= to) return sel.text
  const remove = isInlineActive(sel.text, from, to, spec)
  return applyEdits(sel.text, toggleInlineEdits(sel.text, from, to, spec, remove))
}

describe('toggle strong: add', () => {
  it.each([
    // plain wrapping
    ['<a>bold<b>', '**bold**'],
    ['a <a>b<b> c', 'a **b** c'],
    ['<a>hello world<b>', '**hello world**'],
    // whitespace at the selection edges moves outside the delimiters
    ['a<a> b <b>c', 'a **b** c'],
    // whitespace-only selection: no-op
    ['a<a>   <b>b', 'a   b'],
    // partial overlap swallows the existing span and merges
    ['pl<a>ain **bo<b>ld**', 'pl**ain bold**'],
    ['**bo<a>ld** plain<b>', '**bold plain**'],
    // engulfed spans dissolve into the new one
    ['<a>**a** b<b>', '**a b**'],
    ['<a>**a** x **b**<b>', '**a x b**'],
    // touching spans dissolve too (`**a****b**` would be ONE literal-infested strong)
    ['**bold**<a>more<b>', '**boldmore**'],
    ['<a>more<b>**bold**', '**morebold**'],
    // separated by a space: two independent spans
    ['**a** <a>b<b>', '**a** **b**'],
    // nesting inside em is legal and stays put
    ['*it<a>ali<b>c*', '*it**ali**c*'],
    ['*<a>hello<b> world*', '***hello** world*'],
    // straddling an em swallows it
    ['*ita<a>lic* mo<b>re', '***italic* mo**re'],
    // engulfing an em nests it
    ['<a>*em*<b> x', '***em*** x'],
    // code spans are atoms: any contact swallows them whole
    ['`co<a>d<b>e`', '**`code`**'],
    ['a <a>b `co<b>de`', 'a **b `code`**'],
    // link label is nestable, URL is not
    ['[li<a>nk<b> text](u)', '[li**nk** text](u)'],
    ['[t](u<a>r<b>l)', '**[t](url)**'],
    ['a<a>a [li<b>nk](u) b', 'a**a [link](u)** b'],
    // autolinks are atoms
    ['x <a><http://a.b><b> y', 'x **<http://a.b>** y'],
    ['<http://a<a>.b> c<b>', '**<http://a.b> c**'],
    // escapes are atoms
    [String.raw`a <a>\* b<b>`, String.raw`a **\* b**`],
    [String.raw`a \<a>* b<b>`, String.raw`a **\* b**`],
    // unpaired delimiters inside the selection are harmless literals
    ['<a>a ** b<b>', '**a ** b**'],
    // degenerate: content ends with the delimiter char; text stays intact
    ['<a>a*<b>', '**a***'],
  ])('%j -> %j', (input, expected) => {
    expect(toggle('strong', input)).toBe(expected)
  })
})

describe('toggle strong: remove', () => {
  it.each([
    ['<a>**bold**<b>', 'bold'],
    ['**<a>bold<b>**', 'bold'],
    // partial: the rest stays strong, delimiters snap past whitespace
    ['**<a>hello<b> world**', 'hello **world**'],
    ['**hello <a>world<b>**', '**hello** world'],
    ['**aaa <a>bbb<b> ccc**', '**aaa** bbb **ccc**'],
    // split points never cut nested elements
    ['**a <a>*b*<b> c**', '**a** *b* **c**'],
    ['**a *b<a>c<b>d* e**', '**a** *bcd* **e**'],
    // whitespace and delimiters do not break "fully strong"
    ['<a>**a** **b**<b>', 'a b'],
    // a tail selection over two spans: first unwraps, second splits
    ['<a>**aa** **b<b>b**', 'aa b**b**'],
    // selecting only delimiters unwraps the whole span
    ['<a>**<b>bold**', 'bold'],
    // selection ending inside the closing delimiter
    ['**bo<a>ld**<b> x', '**bo**ld x'],
    // nested wrappers: removing strong keeps em
    ['<a>***foo***<b>', '*foo*'],
    // strong around a code span
    ['**<a>`code`<b>**', '`code`'],
  ])('%j -> %j', (input, expected) => {
    expect(toggle('strong', input)).toBe(expected)
  })
})

describe('toggle em', () => {
  it.each([
    ['<a>word<b>', '*word*'],
    ['*a*<a>b<b>', '*ab*'],
    // em over strong nests
    ['<a>**bold**<b>', '***bold***'],
    ['**bo<a>ld** x<b>', '***bold** x*'],
    // em right before a strong: the *** run still parses as em + strong
    ['<a>text<b>**bold**', '*text***bold**'],
    // removing em from nested wrappers keeps strong
    ['<a>***foo***<b>', '**foo**'],
    ['<a>*a **b** c*<b>', 'a **b** c'],
    // splitting an em clones its single-char delimiter
    ['*it<a>al<b>ic*', '*it*al*ic*'],
  ])('%j -> %j', (input, expected) => {
    expect(toggle('em', input)).toBe(expected)
  })
})

describe('toggle code', () => {
  it.each([
    ['a <a>b<b> c', 'a `b` c'],
    ['<a>`code`<b>', 'code'],
    // splitting a code span clones its fence
    ['`co<a>de<b>`', '`co`de'],
    ['`co<a>d<b>e`', '`co`d`e`'],
    // inner code spans dissolve; fence sized after dissolution
    ['<a>a `b` c<b>', '`a b c`'],
    // unpaired backtick in content forces a longer fence
    ['<a>a ` b<b>', '``a ` b``'],
    // content starting with a backtick needs space padding
    ['<a>`x<b>', '`` `x ``'],
  ])('%j -> %j', (input, expected) => {
    expect(toggle('code', input)).toBe(expected)
  })
})

describe('toggle del', () => {
  it.each([
    ['<a>x<b>', '~~x~~'],
    ['<a>~~del~~<b>', 'del'],
    ['~~a <a>b<b> c~~', '~~a~~ b ~~c~~'],
    // other constructs inside survive; same-type spans dissolve
    ['<a>**a** ~~b~~<b>', '~~**a** b~~'],
  ])('%j -> %j', (input, expected) => {
    expect(toggle('del', input)).toBe(expected)
  })
})

describe('isInlineActive', () => {
  it.each([
    ['**<a>bold<b>**', 'strong', true],
    ['<a>**bold**<b>', 'strong', true],
    ['**<a>bo<b>ld**', 'strong', true],
    ['**bold** <a>x<b>', 'strong', false],
    ['<a>**a** **b**<b>', 'strong', true],
    ['<a>**a** x **b**<b>', 'strong', false],
    ['<a>***foo***<b>', 'em', true],
    ['<a>***foo***<b>', 'strong', true],
    ['<a>**bold**<b>', 'em', false],
    ['*<a>em<b>*', 'strong', false],
    ['`<a>code<b>`', 'code', true],
    ['<a>`a` x<b>', 'code', false],
  ] as const)('%j active for %s = %j', (input, name, expected) => {
    const sel = parseSelection(input)
    const [from, to] = trimRange(sel.text, sel.from, sel.to)
    expect(isInlineActive(sel.text, from, to, TOGGLE_SPECS[name])).toBe(expected)
  })
})

describe('caretPlan', () => {
  function plan(name: ToggleName, input: string) {
    const sel = parseSelection(input)
    expect(sel.from).toBe(sel.to)
    return caretPlan(sel.text, sel.from, TOGGLE_SPECS[name])
  }

  it.each([
    // plant a pair in plain text / empty block
    ['a<a> b', 'strong', { kind: 'insert', pos: 1 }],
    ['<a>', 'strong', { kind: 'insert', pos: 0 }],
    // inside a span: hop out past the closing delimiter
    ['**bo<a>ld**', 'strong', { kind: 'move', pos: 8 }],
    ['*<a>*bold**', 'strong', { kind: 'move', pos: 8 }],
    // at the outer edges: hop in
    ['<a>**bold**', 'strong', { kind: 'move', pos: 2 }],
    ['**bold**<a>', 'strong', { kind: 'move', pos: 6 }],
    // toggling right back deletes the planted pair
    ['**<a>**', 'strong', { kind: 'unwrap', from: 0, to: 4 }],
    // but a pair of a different construct is not "ours" (and would fuse)
    ['**<a>**', 'em', null],
    // atoms refuse
    ['`co<a>de`', 'strong', null],
    ['[a](u<a>rl)', 'strong', null],
    // code toggles hop within their own spans like any other construct
    ['`co<a>de`', 'code', { kind: 'move', pos: 6 }],
    // inserting beside a delimiter char would fuse runs: refuse
    ['*em*<a>x', 'strong', null],
  ] as const)('%j %s -> %j', (input, name, expected) => {
    expect(plan(name, input)).toEqual(expected)
  })
})
