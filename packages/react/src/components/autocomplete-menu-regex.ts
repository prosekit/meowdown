interface MenuRegexSources {
  readonly withLookbehind: string
  readonly fallback: string
  readonly flags: string
}

const slashMenuSources: MenuRegexSources = {
  withLookbehind: String.raw`(?<!\S)\/(?!\/)(\S.*)?$`,
  fallback: String.raw`\/(?!\/)(\S.*)?$`,
  flags: 'u',
}

const tagMenuSources: MenuRegexSources = {
  withLookbehind: String.raw`(?<!\S)#[\da-z]+$`,
  fallback: String.raw`#[\da-z]+$`,
  flags: 'iu',
}

const wikilinkMenuSources: MenuRegexSources = {
  withLookbehind: String.raw`(?:\[\[[^[\]]*|(?<!\S)@(?:[^[\]\s][^[\]]*)?)$`,
  fallback: String.raw`(?:\[\[[^[\]]*|@(?:[^[\]\s][^[\]]*)?)$`,
  flags: 'u',
}

function createMenuRegex(supportsLookbehind: boolean, sources: MenuRegexSources): RegExp {
  const source = supportsLookbehind ? sources.withLookbehind : sources.fallback
  return new RegExp(source, sources.flags)
}

/**
 * Builds the slash-menu trigger regex without statically parsing lookbehind syntax.
 * The fallback rejects spaced double-slash text, but can briefly match the
 * second slash in `//` or `//text` until a space is typed.
 */
export function createSlashMenuRegex(supportsLookbehind: boolean): RegExp {
  return createMenuRegex(supportsLookbehind, slashMenuSources)
}

/** Builds the tag-menu trigger regex without statically parsing lookbehind syntax. */
export function createTagMenuRegex(supportsLookbehind: boolean): RegExp {
  return createMenuRegex(supportsLookbehind, tagMenuSources)
}

/** Builds the wikilink-menu trigger regex without statically parsing lookbehind syntax. */
export function createWikilinkMenuRegex(supportsLookbehind: boolean): RegExp {
  return createMenuRegex(supportsLookbehind, wikilinkMenuSources)
}
