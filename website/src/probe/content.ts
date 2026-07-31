/** Documents the probe pages edit. Kept apart so every page's content is easy to compare. */

/** No markdown syntax at all: the baseline where the native caret cannot be blamed on a hidden run. */
export const PLAIN_TEXT = `The kestrel hovered above the meadow for a long moment, then dropped.

Rain had softened the path, and the hedgerow smelled of wet hawthorn and iron.

Somewhere past the second gate a dog was barking at nothing in particular.`

/** One of each hidden-run shape: emphasis markers, a link tail, an ATX prefix. */
export const HIDDEN_RUNS = `## A heading with a hidden prefix

Some **bold text** and some *emphasis* in one line.

A link to [the docs](https://example.com/some/long/path) sits here.

Adjacent units **alpha**_beta_ share one run.`

/** Scenario 1: a list item whose entire content is a single wikilink. */
export const WIKILINK_BULLET = `Drag the caret down through this list.

- an ordinary first item
- [[Cat care basics]]
- an ordinary third item
- leading text [[Daily journal]] trailing text
- another ordinary item

Text after the list, to give the drag somewhere to land.`

/** Long enough that a spacebar drag has room to travel. */
export const LONG_PARAGRAPH = `Press and hold the spacebar on the software keyboard, then slide your finger left and right without lifting it. The caret should travel through this sentence and the next ones. Keep sliding until you have crossed at least two lines, then lift your finger. The point of this page is that your finger never touches the page itself, only the keyboard, so the page may see no touch events at all.

A second paragraph, so the drag can cross a block boundary as well.`

/** Mixed content for the geometry walk: hidden runs, an atom, and a code block. */
export const GEOMETRY = `## Heading

foo **bold** bar

A [link](https://example.com) and a [[Cat care basics]] wikilink.

\`\`\`ts
const value = 1
\`\`\`

Trailing plain paragraph.`

export const IME = `Type 你好世界 here with the Chinese keyboard.

Then scroll down and tap the last paragraph so the keyboard pushes the content up.

Filler line one.
Filler line two.
Filler line three.
Filler line four.
Filler line five.
Filler line six.
Filler line seven.
Filler line eight.

The last paragraph. Tap here.`
