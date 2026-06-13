import { definePlugin, type PlainExtension } from '@prosekit/core'
import type { EditorNode } from '@prosekit/pm/model'
import type { EditorState } from '@prosekit/pm/state'
import { Plugin, PluginKey } from '@prosekit/pm/state'
import { Decoration, DecorationSet } from '@prosekit/pm/view'

import { findInlineImages, type InlineImage } from './find-inline-images.ts'
import type { ImageUrlResolver } from './images.ts'

const previewKey = new PluginKey<DecorationSet>('meowdown-image-preview')

const EMPTY: readonly InlineImage[] = []

/**
 * Per-block cache keyed by the immutable node instance: an unchanged
 * textblock never reparses, and the cache survives the block moving
 * around the document.
 */
const IMAGE_CACHE = new WeakMap<EditorNode, readonly InlineImage[]>()

function blockImages(node: EditorNode): readonly InlineImage[] {
  let images = IMAGE_CACHE.get(node)
  if (!images) {
    images = node.textContent.includes('![') ? findInlineImages(node.textContent) : EMPTY
    IMAGE_CACHE.set(node, images)
  }
  return images
}

function buildDecorations(state: EditorState, resolveUrl: ImageUrlResolver): DecorationSet {
  const decorations: Decoration[] = []
  const keyCounts = new Map<string, number>()
  state.doc.descendants((node, pos) => {
    if (node.type.spec.code) return false
    if (!node.isTextblock) return true
    for (const image of blockImages(node)) {
      const url = resolveUrl(image.src)
      if (!url) continue
      // Keyed by url so ProseMirror reuses the DOM node across rebuilds:
      // no <img> reload flicker while the markdown is unchanged. A count
      // suffix disambiguates the same url appearing twice.
      const count = keyCounts.get(url) ?? 0
      keyCounts.set(url, count + 1)
      const key = count === 0 ? `md-image:${url}` : `md-image:${url}:${count}`
      const alt = image.alt
      // Anchor inline, right after the image's literal text, so it flows with
      // surrounding text instead of dropping below the whole block.
      const at = pos + 1 + image.to
      decorations.push(
        Decoration.widget(at, () => createPreviewElement(url, alt), {
          key,
          side: 1,
        }),
      )
    }
    return false
  })
  return DecorationSet.create(state.doc, decorations)
}

function createPreviewElement(url: string, alt: string): HTMLElement {
  const wrapper = document.createElement('span')
  wrapper.className = 'md-image'
  wrapper.dataset.testid = 'md-image'
  wrapper.contentEditable = 'false'
  const img = document.createElement('img')
  img.src = url
  img.alt = alt
  img.draggable = false
  wrapper.appendChild(img)
  return wrapper
}

function createImagePreviewPlugin(resolveUrl: ImageUrlResolver): Plugin<DecorationSet> {
  return new Plugin<DecorationSet>({
    key: previewKey,
    state: {
      init(_config, state) {
        return buildDecorations(state, resolveUrl)
      },
      apply(tr, value, _oldState, newState) {
        if (!tr.docChanged) return value
        return buildDecorations(newState, resolveUrl)
      },
    },
    props: {
      decorations(state) {
        return previewKey.getState(state)
      },
    },
  })
}

export function defineImagePreview(resolveUrl: ImageUrlResolver): PlainExtension {
  return definePlugin(createImagePreviewPlugin(resolveUrl))
}
