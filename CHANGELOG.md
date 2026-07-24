# Changelog

## [0.58.1](https://github.com/prosekit/meowdown/compare/v0.58.0...v0.58.1) (2026-07-24)


### Bug Fixes

* keep the typed text over the full code text in a code block ([#369](https://github.com/prosekit/meowdown/issues/369)) ([431bddf](https://github.com/prosekit/meowdown/commit/431bddf4fbf207e7596030bb4ffe1a226fefd600))
* place virtual caret after code-block newline ([#365](https://github.com/prosekit/meowdown/issues/365)) ([f325b78](https://github.com/prosekit/meowdown/commit/f325b78896bb8c443f16447e40699d6acaa41dff))

## [0.58.0](https://github.com/prosekit/meowdown/compare/v0.57.2...v0.58.0) (2026-07-23)


### Features

* support Markdown reference links ([#361](https://github.com/prosekit/meowdown/issues/361)) ([7608fac](https://github.com/prosekit/meowdown/commit/7608facc62ca583d5959757ab337b46fa970323f))

## [0.57.2](https://github.com/prosekit/meowdown/compare/v0.57.1...v0.57.2) (2026-07-23)


### Bug Fixes

* **core:** omit block markers from partial clipboard selections ([#357](https://github.com/prosekit/meowdown/issues/357)) ([e173246](https://github.com/prosekit/meowdown/commit/e1732461f04727fa2186cc39d2aab25097a76a51))

## [0.57.1](https://github.com/prosekit/meowdown/compare/v0.57.0...v0.57.1) (2026-07-23)


### Bug Fixes

* **core:** preserve Markdown when pasting styled HTML ([#345](https://github.com/prosekit/meowdown/issues/345)) ([ff15f62](https://github.com/prosekit/meowdown/commit/ff15f62dc3053f73cd1668e439335e31141036e8))
* **core:** preserve parent list item type when parsing HTML ([#355](https://github.com/prosekit/meowdown/issues/355)) ([3bc5c59](https://github.com/prosekit/meowdown/commit/3bc5c59ad81be50f8e1a12dd82b0039420a6d884))
* show iOS text selection grab points ([#356](https://github.com/prosekit/meowdown/issues/356)) ([4ef8a32](https://github.com/prosekit/meowdown/commit/4ef8a32c6df727862a2988f6df1afeefc2ec8547))

## [0.57.0](https://github.com/prosekit/meowdown/compare/v0.56.0...v0.57.0) (2026-07-22)


### Features

* **core:** add `--meowdown-hr` and `--meowdown-table-border` theme variables ([#339](https://github.com/prosekit/meowdown/issues/339)) ([12c2414](https://github.com/prosekit/meowdown/commit/12c24142fb5f58c85df8393899ecb4b1a9ce9b02))


### Bug Fixes

* **core:** convert tiptap and remirror task items ([#346](https://github.com/prosekit/meowdown/issues/346)) ([65c5a5d](https://github.com/prosekit/meowdown/commit/65c5a5df5ec77a8d10a7fd47030639c66e5ee8eb))
* **core:** narrow markdown escaping ([#350](https://github.com/prosekit/meowdown/issues/350)) ([fb41f71](https://github.com/prosekit/meowdown/commit/fb41f7158f485b300d5abca79779ccd5faed7d13))
* **react:** preserve edge blocks on markdown echo ([#351](https://github.com/prosekit/meowdown/issues/351)) ([9b24bdb](https://github.com/prosekit/meowdown/commit/9b24bdb311687b31cc19bd79a7bdea3feb0859d4))

## [0.56.0](https://github.com/prosekit/meowdown/compare/v0.55.1...v0.56.0) (2026-07-21)


### Features

* **react:** add `expandCollapsed` prop to `MarkdownView` ([#347](https://github.com/prosekit/meowdown/issues/347)) ([4ca8991](https://github.com/prosekit/meowdown/commit/4ca89915967529810d48fd2a255be4210424a4bd))


### Bug Fixes

* **core:** render `[text]` and `[text][label]` as plain text ([#344](https://github.com/prosekit/meowdown/issues/344)) ([fd23c6e](https://github.com/prosekit/meowdown/commit/fd23c6e261ac47e9f77800a0821d5492b4b17613))

## [0.55.1](https://github.com/prosekit/meowdown/compare/v0.55.0...v0.55.1) (2026-07-19)


### Bug Fixes

* **react:** stop wikilink hover card side flip loop near the viewport bottom ([#340](https://github.com/prosekit/meowdown/issues/340)) ([ecde6d0](https://github.com/prosekit/meowdown/commit/ecde6d0e9bf51df3cc6ae2d7504568c54112142b))

## [0.55.0](https://github.com/prosekit/meowdown/compare/v0.54.0...v0.55.0) (2026-07-16)


### Features

* **markdown:** export the `LezerNodeName` type ([#335](https://github.com/prosekit/meowdown/issues/335)) ([58fa927](https://github.com/prosekit/meowdown/commit/58fa927962d9d7be77b0c0a8e6c2d0523280c128))
