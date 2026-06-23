# Changelog

## [0.22.0](https://github.com/prosekit/meowdown/compare/core-v0.21.1...core-v0.22.0) (2026-06-23)


### Features

* add highlight mark syntax ([#141](https://github.com/prosekit/meowdown/issues/141)) ([abcd913](https://github.com/prosekit/meowdown/commit/abcd91353270a1cd17dbfd8960e7cdd0ea7512f3))
* add onTagClick prop ([#143](https://github.com/prosekit/meowdown/issues/143)) ([420d916](https://github.com/prosekit/meowdown/commit/420d91638592ca6ad68047acfef4090b0d3da137))
* convert pasted `<mark>` HTML to `==highlight==` ([#144](https://github.com/prosekit/meowdown/issues/144)) ([08c2617](https://github.com/prosekit/meowdown/commit/08c261768843d571213623550e9eb8644d29ea85))

## [0.21.1](https://github.com/prosekit/meowdown/compare/core-v0.21.0...core-v0.21.1) (2026-06-23)


### Bug Fixes

* **core:** keep the caret after an inserted wikilink ([#80](https://github.com/prosekit/meowdown/issues/80)) ([dedac49](https://github.com/prosekit/meowdown/commit/dedac49f17035c84c4700f6eed9345b6b1279d01))

## [0.21.0](https://github.com/prosekit/meowdown/compare/core-v0.20.0...core-v0.21.0) (2026-06-23)


### Features

* open the wikilink menu on Mod-Shift-K ([#134](https://github.com/prosekit/meowdown/issues/134)) ([8021ea0](https://github.com/prosekit/meowdown/commit/8021ea09adf39ffcf1267fe43a821188ebdb6bf0))
* render Markdown to React statically with MarkdownView ([#135](https://github.com/prosekit/meowdown/issues/135)) ([b541154](https://github.com/prosekit/meowdown/commit/b541154346b3ee56d923593fa1ef5b05ec061d66))

## [0.20.0](https://github.com/prosekit/meowdown/compare/core-v0.19.0...core-v0.20.0) (2026-06-22)


### Miscellaneous Chores

* **core:** Synchronize meowdown versions

## [0.19.0](https://github.com/prosekit/meowdown/compare/core-v0.18.0...core-v0.19.0) (2026-06-22)


### Features

* paste rich text as markdown ([#130](https://github.com/prosekit/meowdown/issues/130)) ([a1e6f23](https://github.com/prosekit/meowdown/commit/a1e6f2318f498405fc5675b1e693bebd97d14a1e))

## [0.18.0](https://github.com/prosekit/meowdown/compare/core-v0.17.4...core-v0.18.0) (2026-06-22)


### Features

* add circle task list items ([#128](https://github.com/prosekit/meowdown/issues/128)) ([48c0fea](https://github.com/prosekit/meowdown/commit/48c0fea4ceb106ad07f617a141198cfaa4626938))


### Bug Fixes

* capture the list marker gap width ([#127](https://github.com/prosekit/meowdown/issues/127)) ([05989bf](https://github.com/prosekit/meowdown/commit/05989bfb858824b04e0b4f49ac12568c24f7132d))

## [0.17.4](https://github.com/prosekit/meowdown/compare/core-v0.17.3...core-v0.17.4) (2026-06-21)


### Miscellaneous Chores

* **core:** Synchronize meowdown versions

## [0.17.3](https://github.com/prosekit/meowdown/compare/core-v0.17.2...core-v0.17.3) (2026-06-21)


### Bug Fixes

* **core:** preserve multi-line code blocks in list items ([#123](https://github.com/prosekit/meowdown/issues/123)) ([7954017](https://github.com/prosekit/meowdown/commit/79540174b3e52490ffc813e7078151e2c17b830a))

## [0.17.2](https://github.com/prosekit/meowdown/compare/core-v0.17.1...core-v0.17.2) (2026-06-21)


### Bug Fixes

* **core:** prevent selection highlight overflow on Safari ([#120](https://github.com/prosekit/meowdown/issues/120)) ([ce43f9e](https://github.com/prosekit/meowdown/commit/ce43f9e2a37f9ab9d436caf8a2a36587f481089d))

## [0.17.1](https://github.com/prosekit/meowdown/compare/core-v0.17.0...core-v0.17.1) (2026-06-21)


### Bug Fixes

* treat blockquote-marker-only lines as blank ([#118](https://github.com/prosekit/meowdown/issues/118)) ([f1ecd66](https://github.com/prosekit/meowdown/commit/f1ecd6609f2dbef2ac07159f6a41c2cc2afde3dc))

## [0.17.0](https://github.com/prosekit/meowdown/compare/core-v0.16.2...core-v0.17.0) (2026-06-21)


### Features

* delete table on Backspace over full cell selection ([#110](https://github.com/prosekit/meowdown/issues/110)) ([5b392cb](https://github.com/prosekit/meowdown/commit/5b392cb700c38e43e57609d87794d04377e8582a))
* make YAML frontmatter handling opt-in ([#111](https://github.com/prosekit/meowdown/issues/111)) ([e3a46dd](https://github.com/prosekit/meowdown/commit/e3a46ddefbc90dc5f79ccdd186c36fb4938c4d1f))


### Bug Fixes

* **core:** preserve soft line breaks ([#112](https://github.com/prosekit/meowdown/issues/112)) ([7e0e7bb](https://github.com/prosekit/meowdown/commit/7e0e7bb1757d1f3359397fa8447aa32b6924ca63))
* stop block handle drag preview inheriting gutter padding ([#115](https://github.com/prosekit/meowdown/issues/115)) ([82927e5](https://github.com/prosekit/meowdown/commit/82927e5f5b51a78e08857d89c80a24f09107fb05))

## [0.16.2](https://github.com/prosekit/meowdown/compare/core-v0.16.1...core-v0.16.2) (2026-06-20)


### Bug Fixes

* **core:** preserve thematic break marker on round-trip ([#104](https://github.com/prosekit/meowdown/issues/104)) ([7cfc064](https://github.com/prosekit/meowdown/commit/7cfc0646ad57d29491f6dcfb5820e6f0095e168f))

## [0.16.1](https://github.com/prosekit/meowdown/compare/core-v0.16.0...core-v0.16.1) (2026-06-20)


### Bug Fixes

* **core:** preserve setext heading underline ([#101](https://github.com/prosekit/meowdown/issues/101)) ([2742971](https://github.com/prosekit/meowdown/commit/27429714b2bc07adab2a4733c5165868a60477a4))

## [0.16.0](https://github.com/prosekit/meowdown/compare/core-v0.15.2...core-v0.16.0) (2026-06-20)


### Features

* **core:** support YAML frontmatter ([#100](https://github.com/prosekit/meowdown/issues/100)) ([b915768](https://github.com/prosekit/meowdown/commit/b915768914296eb88b88204822f865aa6b3d3a50))


### Bug Fixes

* **core:** avoid double-escaping pipes in table cells ([#102](https://github.com/prosekit/meowdown/issues/102)) ([79e2987](https://github.com/prosekit/meowdown/commit/79e2987358ca541782a5aa58c1c7e201e50ad086))
* **core:** emit empty code block without a blank line ([#99](https://github.com/prosekit/meowdown/issues/99)) ([83bef2c](https://github.com/prosekit/meowdown/commit/83bef2c81d22b1cf0911768586d7fedea2f0040f))
* **core:** improve markdown round-trip fidelity ([#98](https://github.com/prosekit/meowdown/issues/98)) ([8d704a1](https://github.com/prosekit/meowdown/commit/8d704a17f6d2655fa09eca668ccd32509ab25e67))
* **core:** stop emitting junk marker lines after nested blocks ([#103](https://github.com/prosekit/meowdown/issues/103)) ([e41ed98](https://github.com/prosekit/meowdown/commit/e41ed98afb06a853b3a50b8706ca84583d58718c))
* fall back to slice text when clipboardData is empty ([#93](https://github.com/prosekit/meowdown/issues/93)) ([ff3fc07](https://github.com/prosekit/meowdown/commit/ff3fc07ad8f11c8cc0cd71d36d653001a1d21556))

## [0.15.2](https://github.com/prosekit/meowdown/compare/core-v0.15.1...core-v0.15.2) (2026-06-19)


### Bug Fixes

* **core:** improve focus-mode marker reveal ([#88](https://github.com/prosekit/meowdown/issues/88)) ([adb668e](https://github.com/prosekit/meowdown/commit/adb668e30e36b9ddbf10ccab7551d557b17369f3))

## [0.15.1](https://github.com/prosekit/meowdown/compare/core-v0.15.0...core-v0.15.1) (2026-06-19)


### Bug Fixes

* **core:** keep empty list item markers on serialize ([#85](https://github.com/prosekit/meowdown/issues/85)) ([142359c](https://github.com/prosekit/meowdown/commit/142359c5a71ed327c27540e665f1b81ef4167da9))

## [0.15.0](https://github.com/prosekit/meowdown/compare/core-v0.14.0...core-v0.15.0) (2026-06-19)


### Features

* make autocomplete menu colors themeable ([#81](https://github.com/prosekit/meowdown/issues/81)) ([0f71204](https://github.com/prosekit/meowdown/commit/0f71204e7847f3ca8b8d3f1ab74e16f72c56deba))

## [0.14.0](https://github.com/prosekit/meowdown/compare/core-v0.13.0...core-v0.14.0) (2026-06-18)


### Features

* **core:** make wikilinks immutable in every mark mode ([#78](https://github.com/prosekit/meowdown/issues/78)) ([611e671](https://github.com/prosekit/meowdown/commit/611e6713c6260149ac7db5c33568b97bf49222ab))

## [0.13.0](https://github.com/prosekit/meowdown/compare/core-v0.12.0...core-v0.13.0) (2026-06-18)


### Features

* **core:** autolink bare domains via a curated TLD list ([#76](https://github.com/prosekit/meowdown/issues/76)) ([ec75857](https://github.com/prosekit/meowdown/commit/ec7585769ee65a72edaf3609fbc3603f6034c05e))
* **core:** render wikilinks as an immutable mark view ([#73](https://github.com/prosekit/meowdown/issues/73)) ([10da525](https://github.com/prosekit/meowdown/commit/10da52518b27bfaec2224614d1040270e6c676f2))

## [0.12.0](https://github.com/prosekit/meowdown/compare/core-v0.11.1...core-v0.12.0) (2026-06-18)


### Features

* add onImageClick prop ([#70](https://github.com/prosekit/meowdown/issues/70)) ([eb5f972](https://github.com/prosekit/meowdown/commit/eb5f972ac772887d0e5ba6a5c301fcbed3a235ac))
* add onLinkClick prop ([#71](https://github.com/prosekit/meowdown/issues/71)) ([af38591](https://github.com/prosekit/meowdown/commit/af38591a187625e976571bfd86c0817333a4fc78))
* **core:** render images and embeds inline via a mark view ([#58](https://github.com/prosekit/meowdown/issues/58)) ([776da6c](https://github.com/prosekit/meowdown/commit/776da6c7cd58cf1c8c75fe0308e2967841a62851))


### Bug Fixes

* **core:** improve image selection ([#69](https://github.com/prosekit/meowdown/issues/69)) ([b4a735d](https://github.com/prosekit/meowdown/commit/b4a735dd2bf7c4e1e1119e1efca7f7245d7577b7))

## [0.11.1](https://github.com/prosekit/meowdown/compare/core-v0.11.0...core-v0.11.1) (2026-06-17)


### Bug Fixes

* **core:** remove niche code block languages ([#64](https://github.com/prosekit/meowdown/issues/64)) ([73126db](https://github.com/prosekit/meowdown/commit/73126dbeb5bc09a55f95212e79e603481a7cf665))

## [0.11.0](https://github.com/prosekit/meowdown/compare/core-v0.10.0...core-v0.11.0) (2026-06-16)


### Features

* re-export prosekit keymap and extension APIs ([#61](https://github.com/prosekit/meowdown/issues/61)) ([8d847d7](https://github.com/prosekit/meowdown/commit/8d847d7fddb7d52052fb1b0517596c3de46b038a))

## [0.10.0](https://github.com/prosekit/meowdown/compare/core-v0.9.0...core-v0.10.0) (2026-06-16)


### Features

* start a bullet on Enter after a heading ([#55](https://github.com/prosekit/meowdown/issues/55)) ([ac7c6b4](https://github.com/prosekit/meowdown/commit/ac7c6b42f810784efb30cbd1e3fd521cc68379aa))

## [0.9.0](https://github.com/prosekit/meowdown/compare/core-v0.8.1...core-v0.9.0) (2026-06-16)


### Features

* auto-embed pasted tweet and YouTube links ([#54](https://github.com/prosekit/meowdown/issues/54)) ([0535da4](https://github.com/prosekit/meowdown/commit/0535da4266fb7c0d8153d4b8e18067d6443c7e32))
* **core:** autolink bare URLs ([#50](https://github.com/prosekit/meowdown/issues/50)) ([501a457](https://github.com/prosekit/meowdown/commit/501a4579e37ccff85acd8f6622ca69629c891d79))
* **core:** build markdown documents without an editor ([#48](https://github.com/prosekit/meowdown/issues/48)) ([bfe3125](https://github.com/prosekit/meowdown/commit/bfe31254c5483ff62fe962dfe61e9cb9b5160b45))
* **core:** embed youtube and tweets ([#52](https://github.com/prosekit/meowdown/issues/52)) ([8d6528b](https://github.com/prosekit/meowdown/commit/8d6528b53d16dc89d0f6e235918d8f1255d21157))


### Bug Fixes

* **core:** allow table node selection ([#53](https://github.com/prosekit/meowdown/issues/53)) ([2fa5d14](https://github.com/prosekit/meowdown/commit/2fa5d142b09c24a518620ff9dbc55c3c90a4fb3d))

## [0.8.1](https://github.com/prosekit/meowdown/compare/core-v0.8.0...core-v0.8.1) (2026-06-15)


### Bug Fixes

* **core:** keep empty table cells on markdown round-trip ([#46](https://github.com/prosekit/meowdown/issues/46)) ([3ab4cca](https://github.com/prosekit/meowdown/commit/3ab4ccad881c6e517f4f55645becb3435619cd8b))

## [0.8.0](https://github.com/prosekit/meowdown/compare/core-v0.7.0...core-v0.8.0) (2026-06-15)


### Bug Fixes

* **core:** run image drop handler ([#43](https://github.com/prosekit/meowdown/issues/43)) ([fb3fd9b](https://github.com/prosekit/meowdown/commit/fb3fd9b38d2200e7167298c7a7ac186e76849d25))

## [0.7.0](https://github.com/prosekit/meowdown/compare/core-v0.5.0...core-v0.7.0) (2026-06-15)


### Features

* **core:** drop the Mod-Alt-N heading shortcuts ([#40](https://github.com/prosekit/meowdown/issues/40)) ([d188bf1](https://github.com/prosekit/meowdown/commit/d188bf1b8b227f997abeb8a702f4cb25e2d6deee))


### Bug Fixes

* scope placeholder to empty doc ([#38](https://github.com/prosekit/meowdown/issues/38)) ([4bbdf19](https://github.com/prosekit/meowdown/commit/4bbdf19f2dc338c44c82a7381c5485c81e60d8b6))

## [0.5.0](https://github.com/prosekit/meowdown/compare/core-v0.4.0...core-v0.5.0) (2026-06-15)


### Features

* refine editor API ([#35](https://github.com/prosekit/meowdown/issues/35)) ([203cdc7](https://github.com/prosekit/meowdown/commit/203cdc78b06099309c57821a9d0f2c16bc12f9cf))

## [0.4.0](https://github.com/prosekit/meowdown/compare/core-v0.3.1...core-v0.4.0) (2026-06-15)


### Features

* add code block syntax highlighting and language selector ([#27](https://github.com/prosekit/meowdown/issues/27)) ([d2ae648](https://github.com/prosekit/meowdown/commit/d2ae648378fb24bccc172139cb1816cf8e125ab8))
* add inline image rendering ([d0a37d0](https://github.com/prosekit/meowdown/commit/d0a37d089a8f6aa2db4a19ec2a1a3a61baa7aee8))
* add onWikilinkClick prop ([d9d10db](https://github.com/prosekit/meowdown/commit/d9d10db2b78cfc1d7240abcce828471f0194b110))
* **core:** add checkRoundTrip to detect lossy markdown ([1a19c55](https://github.com/prosekit/meowdown/commit/1a19c559e699393358d5bccfdb9e812b5d34b2f4))
* **core:** add heading shortcuts ([4f48d58](https://github.com/prosekit/meowdown/commit/4f48d5859620599a062da4215345a4c1bfe359ed))
* **core:** expose the editor keybinding table ([876894e](https://github.com/prosekit/meowdown/commit/876894e1035453932d4ae077a15eea1db17783ae))
* **react:** add readOnly prop ([528d934](https://github.com/prosekit/meowdown/commit/528d9347c3619cdaa56d306433fc740559c85469))
* **react:** show placeholder text in empty blocks ([2a2b8fc](https://github.com/prosekit/meowdown/commit/2a2b8fce77aafe7d09aa608a4a62b8439d71f9f5))

## [0.3.1](https://github.com/prosekit/meowdown/compare/core-v0.3.0...core-v0.3.1) (2026-06-11)


### Bug Fixes

* **core:** remove table resize handle ([#19](https://github.com/prosekit/meowdown/issues/19)) ([7719a23](https://github.com/prosekit/meowdown/commit/7719a239aa670b490d59342b0f78a9096185e25a))

## [0.3.0](https://github.com/prosekit/meowdown/compare/core-v0.2.0...core-v0.3.0) (2026-06-11)


### Features

* add default editor theme stylesheet ([532b7e5](https://github.com/prosekit/meowdown/commit/532b7e55ea53a2035d6e5d5aa8a5715075451b66))
* add inline mark toggle keyboard shortcuts ([8653dfd](https://github.com/prosekit/meowdown/commit/8653dfddd896ba675c61a0f44f489de18e065daf))
* **core:** convert GFM task list ([#15](https://github.com/prosekit/meowdown/issues/15)) ([5b7b318](https://github.com/prosekit/meowdown/commit/5b7b318a36c80fdc2e45873f50160b4c1a36e797))
* **core:** parse hashtags ([bfb874a](https://github.com/prosekit/meowdown/commit/bfb874a6ab4c567b1a95f89f6b1b4f1230473000))
* **core:** parse wikilinks ([fee001f](https://github.com/prosekit/meowdown/commit/fee001f622fe60b6c4b303d7f1bd91f71c4fe1f1))
* **react:** add block handle ([95b0821](https://github.com/prosekit/meowdown/commit/95b082106fbfd8ae5146f7a68f6ce48f87ccbce7))

## [0.2.0](https://github.com/prosekit/meowdown/compare/core-v0.1.0...core-v0.2.0) (2026-06-08)


### Features

* add basic editor extensions ([#6](https://github.com/prosekit/meowdown/issues/6)) ([0c08fe4](https://github.com/prosekit/meowdown/commit/0c08fe455b1048cc9c057fe6edf910d4a501304a))
* add editor component ([#8](https://github.com/prosekit/meowdown/issues/8)) ([572c88f](https://github.com/prosekit/meowdown/commit/572c88f261dc8eacee6db947a990c3f034dd8289))
* parse and serialize markdown ([#10](https://github.com/prosekit/meowdown/issues/10)) ([187a1b6](https://github.com/prosekit/meowdown/commit/187a1b656e1eb6533d5dc246b14dd9029e5c2c71))

## [0.1.0](https://github.com/prosekit/meowdown/compare/core-v0.0.2...core-v0.1.0) (2026-06-08)


### Features

* release packages ([d21806a](https://github.com/prosekit/meowdown/commit/d21806adf2a123445e00f9066e5caf006eb76012))
