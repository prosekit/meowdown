/**
 * Builds the slash-menu trigger regex for runtimes with and without regex
 * lookbehind support.
 *
 * The fallback keeps the existing loose boundary behavior because including a
 * leading space in the match would make ProseKit delete that space on submit.
 * It rejects the supported spaced alias form (`// Alias`), but an older runtime
 * can still treat the second slash in bare `//` or compact `//Alias` as a
 * trigger until a space is typed.
 */
export function createSlashMenuRegex(supportsLookbehind: boolean): RegExp {
  return supportsLookbehind ? /(?<!\S)\/(?!\/)(\S.*)?$/u : /\/(?!\/)(\S.*)?$/u
}
