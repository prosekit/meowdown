import { CHAR_TILDE, CHAR_BACKTICK, CHAR_SPACE, CHAR_TAB } from '../unicode.ts'

/**
 * The narrowest fence that can hold `code`: wider than every line of it that
 * would close the fence early, and never under CommonMark's minimum of three. A
 * closing fence is a run of the fence character alone on its line; a run with
 * anything else on the line (`` a ``` ``, `` ``` x ``) or four columns in closes
 * nothing, so the fence holds it as it is.
 */
export function minFenceLength(code: string, tilde: boolean): number {
  const fenceChar = tilde ? CHAR_TILDE : CHAR_BACKTICK
  let longest = 2
  let lineStart = 0
  while (lineStart <= code.length) {
    let lineEnd = code.indexOf('\n', lineStart)
    if (lineEnd < 0) lineEnd = code.length
    // Up to three columns of indentation, and a tab is four of them.
    let index = lineStart
    while (index < lineEnd && code.charCodeAt(index) === CHAR_SPACE) index++
    if (index - lineStart < 4) {
      const runStart = index
      while (index < lineEnd && code.charCodeAt(index) === fenceChar) index++
      const run = index - runStart
      while (index < lineEnd && isSpaceOrTab(code.charCodeAt(index))) index++
      if (index === lineEnd && run > longest) longest = run
    }
    lineStart = lineEnd + 1
  }
  return longest + 1
}

function isSpaceOrTab(char: number): boolean {
  return char === CHAR_SPACE || char === CHAR_TAB
}

/**
 * Whether indentation can spell `code` as an indented code block. There is no
 * line to carry the four columns of a block with no content at all, and none to
 * carry a blank line at either end.
 */
export function canIndentCode(code: string): boolean {
  return code !== '' && !code.startsWith('\n') && !code.endsWith('\n')
}
