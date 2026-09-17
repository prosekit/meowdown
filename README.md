# Meowdown

A hybrid (live-preview) Markdown editor: the document stays Markdown text,
rendered in place as rich content.

[**Live demo**](https://meowdown.vercel.app/)

## Packages

- [**@meowdown/core**](https://www.npmjs.com/package/@meowdown/core): the framework-free editor engine (parsing, serializing, shortcuts, styling)
- [**@meowdown/react**](https://www.npmjs.com/package/@meowdown/react): React components (`MeowdownEditor`, `MarkdownView`, `WikilinkHoverCard`)
- [**@meowdown/markdown**](https://www.npmjs.com/package/@meowdown/markdown): the Lezer grammar for meowdown's Markdown dialect

## Releasing

Releases are driven by [Changesets](https://github.com/changesets/changesets). A pull request that should publish a package must include a changeset file, created with `pnpm change`. Pick the affected packages and the bump level; while the project is at 0.x, use `minor` for breaking changes. Changes that should not publish (refactors, tests, CI, docs, routine dependency bumps) need no changeset. Merged changesets accumulate in a `chore: version packages` pull request; merging that pull request publishes the bumped packages to npm.

## License

MIT
