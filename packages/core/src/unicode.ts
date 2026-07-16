// Alphabet chars.
export const CHAR_LOWERCASE_X = 120 /* x */
export const CHAR_UPPERCASE_X = 88 /* X */

// Non-alphabetic chars.
export const CHAR_DOT = 46 /* . */
export const CHAR_LINE_FEED = 10 /* \n */
const CHAR_CARRIAGE_RETURN = 13 /* \r */
export const CHAR_TAB = 9 /* \t */
export const CHAR_HASH = 35 /* # */
export const CHAR_SPACE = 32 /*   */
export const CHAR_HYPHEN_MINUS = 45 /* - */
export const CHAR_PLUS = 43 /* + */
export const CHAR_ASTERISK = 42 /* * */
export const CHAR_RIGHT_PARENTHESIS = 41 /* ) */
export const CHAR_BACKTICK = 96 /* ` */
export const CHAR_TILDE = 126 /* ~ */
export const CHAR_EQUAL = 61 /* = */

/**
 * Check if a char code is a space character.
 *
 * Ported from https://github.com/lezer-parser/markdown/blob/1.6.3/src/markdown.ts#L233
 */
export function isSpaceChar(char: number): boolean {
  return (
    char === CHAR_SPACE ||
    char === CHAR_TAB ||
    char === CHAR_LINE_FEED ||
    char === CHAR_CARRIAGE_RETURN
  )
}
