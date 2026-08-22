# Changelog

## [0.67.0](https://github.com/prosekit/meowdown/compare/v0.66.0...v0.67.0) (2026-08-22)


### Features

* add rich link previews and editing ([#502](https://github.com/prosekit/meowdown/issues/502)) ([fdec0f9](https://github.com/prosekit/meowdown/commit/fdec0f97c7c730a06c130b210658c961a652818e))


### Reverts

* rich link preview changes ([#505](https://github.com/prosekit/meowdown/issues/505)) ([d5c6f89](https://github.com/prosekit/meowdown/commit/d5c6f8984ef866c867cc3d2b641a060a331a12c2))

## [0.66.0](https://github.com/prosekit/meowdown/compare/v0.65.6...v0.66.0) (2026-08-21)


### Features

* **core:** insert a soft line break on Shift-Enter ([#498](https://github.com/prosekit/meowdown/issues/498)) ([a9d0aa1](https://github.com/prosekit/meowdown/commit/a9d0aa1393683fd7b445662cdf39eaf2b252e2b8))
* **core:** remove the deprecated `defineSpellCheckPlugin` ([#499](https://github.com/prosekit/meowdown/issues/499)) ([aecd080](https://github.com/prosekit/meowdown/commit/aecd080360926c65ee454fc566585334361ab64f))


### Bug Fixes

* draw the virtual caret at the start of the line after a line break ([#495](https://github.com/prosekit/meowdown/issues/495)) ([dae8220](https://github.com/prosekit/meowdown/commit/dae8220765de1ac8659e116ffc08ea1cd0deb4a1))

## [0.65.6](https://github.com/prosekit/meowdown/compare/v0.65.5...v0.65.6) (2026-08-17)


### Bug Fixes

* disable native spellcheck in code, math, and URL source text ([#490](https://github.com/prosekit/meowdown/issues/490)) ([f0b1506](https://github.com/prosekit/meowdown/commit/f0b15060e160dc89aa19a4fa6f47cad5df232b5e))

## [0.65.5](https://github.com/prosekit/meowdown/compare/v0.65.4...v0.65.5) (2026-08-16)


### Bug Fixes

* open no HTML block behind a task checkbox ([#488](https://github.com/prosekit/meowdown/issues/488)) ([c2c8031](https://github.com/prosekit/meowdown/commit/c2c8031b459a49ad278d186029051b1bb84d69e8))
* strip the quote marker from a multi-line task's text ([#479](https://github.com/prosekit/meowdown/issues/479)) ([eecb28d](https://github.com/prosekit/meowdown/commit/eecb28d03ec0613087da4ab3a1acc91c1ebc1647))

## [0.65.4](https://github.com/prosekit/meowdown/compare/v0.65.3...v0.65.4) (2026-08-14)


### Bug Fixes

* stop reporting loss when only a closing fence shortens ([#473](https://github.com/prosekit/meowdown/issues/473)) ([5d5fb1d](https://github.com/prosekit/meowdown/commit/5d5fb1db2dca255ccbf35c333e13776b08f8d9f3))
* stop the table-row false positive in `checkRoundTrip` ([#475](https://github.com/prosekit/meowdown/issues/475)) ([e2d6700](https://github.com/prosekit/meowdown/commit/e2d67009ef00d5ce17707e1b22e3c6ff22088866))

## [0.65.3](https://github.com/prosekit/meowdown/compare/v0.65.2...v0.65.3) (2026-08-14)


### Bug Fixes

* make the round trip lossless ([#466](https://github.com/prosekit/meowdown/issues/466)) ([25907f9](https://github.com/prosekit/meowdown/commit/25907f9370313f9ddc07a183f3b50ad5e4945f7e))
* make the round trip lossless for the wider fuzz alphabet ([#468](https://github.com/prosekit/meowdown/issues/468)) ([06ae70f](https://github.com/prosekit/meowdown/commit/06ae70f3f5087217c6aad0378cf03bdda03d2a63))

## [0.65.2](https://github.com/prosekit/meowdown/compare/v0.65.1...v0.65.2) (2026-08-12)


### Bug Fixes

* stop Safari skipping a boundary unit on block entry ([#459](https://github.com/prosekit/meowdown/issues/459)) ([5a0cf30](https://github.com/prosekit/meowdown/commit/5a0cf304bce0ee1b789f59d48c5bf52a71a0ed5d))

## [0.65.1](https://github.com/prosekit/meowdown/compare/v0.65.0...v0.65.1) (2026-08-10)


### Bug Fixes

* fold stacked image size comments ([#455](https://github.com/prosekit/meowdown/issues/455)) ([dc5710c](https://github.com/prosekit/meowdown/commit/dc5710c618d18668b687a4d8ce12b0927e47b943))
* stop pausing `spellcheck` around edits ([#451](https://github.com/prosekit/meowdown/issues/451)) ([563162c](https://github.com/prosekit/meowdown/commit/563162c3280526b14742192bd2159ebee53fb190))

## [0.65.0](https://github.com/prosekit/meowdown/compare/v0.64.3...v0.65.0) (2026-08-07)


### Features

* add a `mod` flag to link follow payloads ([#450](https://github.com/prosekit/meowdown/issues/450)) ([601b38b](https://github.com/prosekit/meowdown/commit/601b38b64c96a4e433619c856d0fd5a17656011a))
* fire `onImageClick` on `Enter` over a selected image ([#453](https://github.com/prosekit/meowdown/issues/453)) ([74864e7](https://github.com/prosekit/meowdown/commit/74864e7ba77a7b1630a9aa908d6011e14de49168))

## [0.64.3](https://github.com/prosekit/meowdown/compare/v0.64.2...v0.64.3) (2026-08-06)


### Bug Fixes

* **core:** resolve the link `href` from the `URL` after the closing `]` ([#445](https://github.com/prosekit/meowdown/issues/445)) ([d1e2e5c](https://github.com/prosekit/meowdown/commit/d1e2e5c0a52274f93fd6fc1df3b99ac9f5abd172))

## [0.64.2](https://github.com/prosekit/meowdown/compare/v0.64.1...v0.64.2) (2026-08-05)


### Bug Fixes

* **core:** reveal the units on both sides of a boundary caret ([#443](https://github.com/prosekit/meowdown/issues/443)) ([2615ec8](https://github.com/prosekit/meowdown/commit/2615ec8d9282c338ed007aa3e83d0eff769a80e7))

## [0.64.1](https://github.com/prosekit/meowdown/compare/v0.64.0...v0.64.1) (2026-08-04)


### Bug Fixes

* cycle a nested list item back to a bullet with `cycleBulletOrderedList` ([#432](https://github.com/prosekit/meowdown/issues/432)) ([b3d7b3c](https://github.com/prosekit/meowdown/commit/b3d7b3c7b5d8adce12beb4be4681cb149a79837f))
* render two identical adjacent units as two previews ([#431](https://github.com/prosekit/meowdown/issues/431)) ([46e058e](https://github.com/prosekit/meowdown/commit/46e058e3f951aba05ae9076b9fd1eeaa8eccf563))

## [0.64.0](https://github.com/prosekit/meowdown/compare/v0.63.1...v0.64.0) (2026-08-03)


### Features

* **core:** prefer the native caret for touch input ([#426](https://github.com/prosekit/meowdown/issues/426)) ([75df74d](https://github.com/prosekit/meowdown/commit/75df74d06af58ca818bb1a2f8a42c44a453c5407))


### Bug Fixes

* grow a dragged selection to whole atom units ([#414](https://github.com/prosekit/meowdown/issues/414)) ([9c2afde](https://github.com/prosekit/meowdown/commit/9c2afde3cb40804e7de087de83263fac92baf97f))
* keep the caret out of an atom unit's hidden source ([#413](https://github.com/prosekit/meowdown/issues/413)) ([684d0e3](https://github.com/prosekit/meowdown/commit/684d0e35fbd46f940161d3d82afbc40631b27fc4))
* paint the virtual caret above code backgrounds ([#427](https://github.com/prosekit/meowdown/issues/427)) ([dd14211](https://github.com/prosekit/meowdown/commit/dd14211fa39e0c73caa26dba39203fc79703c738))
* set input modality correctly after a mouse press ([#429](https://github.com/prosekit/meowdown/issues/429)) ([111c708](https://github.com/prosekit/meowdown/commit/111c70811856cc7f0f7d2daf2aad80c9779b88c9))
* tweak virtual caret styles ([#428](https://github.com/prosekit/meowdown/issues/428)) ([7c87691](https://github.com/prosekit/meowdown/commit/7c876917d43873e06a0e6857cb38bb7451d981a6))

## [0.63.1](https://github.com/prosekit/meowdown/compare/v0.63.0...v0.63.1) (2026-07-31)


### Bug Fixes

* follow a selected atom unit on `Enter` ([#402](https://github.com/prosekit/meowdown/issues/402)) ([2df92f0](https://github.com/prosekit/meowdown/commit/2df92f0225dc612aba5c1bcadf22e8b823afd23d))
* resolve the follow target from inside the selected atom unit ([#404](https://github.com/prosekit/meowdown/issues/404)) ([c76d2e6](https://github.com/prosekit/meowdown/commit/c76d2e69fa8309103d4c872298a120ade618c16a))

## [0.63.0](https://github.com/prosekit/meowdown/compare/v0.62.0...v0.63.0) (2026-07-30)


### Features

* rename command `cycleOrderedList` to `cycleBulletOrderedList` ([#398](https://github.com/prosekit/meowdown/issues/398)) ([0f56b4f](https://github.com/prosekit/meowdown/commit/0f56b4fb2d13b806f6472f52d6bdaf9824457fda))

## [0.62.0](https://github.com/prosekit/meowdown/compare/v0.61.0...v0.62.0) (2026-07-30)


### Features

* add ordered list cycle command ([#396](https://github.com/prosekit/meowdown/issues/396)) ([d5c2f3a](https://github.com/prosekit/meowdown/commit/d5c2f3a39cc18113502c85b38a423577698e7138))


### Bug Fixes

* stop the virtual caret drifting after a window resize ([#394](https://github.com/prosekit/meowdown/issues/394)) ([f342dfe](https://github.com/prosekit/meowdown/commit/f342dfebcb77fb80bd26dcb5be7829559db970b4))

## [0.61.0](https://github.com/prosekit/meowdown/compare/v0.60.0...v0.61.0) (2026-07-29)


### Features

* persist tweet embed height to avoid layout shift ([#391](https://github.com/prosekit/meowdown/issues/391)) ([f70cb48](https://github.com/prosekit/meowdown/commit/f70cb4867d3ad6706ec6d9d7ff63301daf992b0f))
* resizable YouTube embed with persisted size ([#392](https://github.com/prosekit/meowdown/issues/392)) ([f81cf56](https://github.com/prosekit/meowdown/commit/f81cf5692ef6bdd27ec8d088bb3d20814fa7caa0))

## [0.60.0](https://github.com/prosekit/meowdown/compare/v0.59.1...v0.60.0) (2026-07-28)


### Features

* **core:** add `getIsComposing` ([#387](https://github.com/prosekit/meowdown/issues/387)) ([80247d9](https://github.com/prosekit/meowdown/commit/80247d9b1468089f689263217e82f6dd0fb4258f))


### Reverts

* remove pending-input reconciliation ([#388](https://github.com/prosekit/meowdown/issues/388)) ([c4de8c5](https://github.com/prosekit/meowdown/commit/c4de8c5ebfd277ad1d6a1483908483e9ce6a1887))

## [0.59.1](https://github.com/prosekit/meowdown/compare/v0.59.0...v0.59.1) (2026-07-27)


### Bug Fixes

* **react:** set editor class name before repaint ([#383](https://github.com/prosekit/meowdown/issues/383)) ([ca3c454](https://github.com/prosekit/meowdown/commit/ca3c4542b5e458545bf4d46f9214a074f48db140))

## [0.59.0](https://github.com/prosekit/meowdown/compare/v0.58.3...v0.59.0) (2026-07-25)


### Features

* find in document ([#377](https://github.com/prosekit/meowdown/issues/377)) ([1cadbe7](https://github.com/prosekit/meowdown/commit/1cadbe751ad661ea4bdacec8bb0cdb3b942d7ebb))


### Bug Fixes

* move a block between editors instead of duplicating it ([#378](https://github.com/prosekit/meowdown/issues/378)) ([35f72c3](https://github.com/prosekit/meowdown/commit/35f72c30ff2b1482ba4f70e7fda700de3e3d6877))

## [0.58.3](https://github.com/prosekit/meowdown/compare/v0.58.2...v0.58.3) (2026-07-25)


### Bug Fixes

* keep the editor styled when `editorClassName` prop changes ([#374](https://github.com/prosekit/meowdown/issues/374)) ([b3b63b4](https://github.com/prosekit/meowdown/commit/b3b63b435ebe92ad16cac692b28f2083e97094f7))

## [0.58.2](https://github.com/prosekit/meowdown/compare/v0.58.1...v0.58.2) (2026-07-24)


### Bug Fixes

* keep the typed text when typing over a fully selected code block ([#373](https://github.com/prosekit/meowdown/issues/373)) ([8405e97](https://github.com/prosekit/meowdown/commit/8405e97cefbe980e3efb6f8b696b11e83af3591d))
* stop Safari freezing when dragging a code block ([#370](https://github.com/prosekit/meowdown/issues/370)) ([b4fcf2a](https://github.com/prosekit/meowdown/commit/b4fcf2ae90cba3549df9df3a09048dc90de5da49))

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
