import { once } from '@ocavue/utils'
import {
  createMarkBuilders,
  createNodeBuilders,
  type ExtractMarkBuilders,
  type ExtractNodeBuilders,
} from '@prosekit/core'
import type { Schema } from '@prosekit/pm/model'

import { defineEditorExtension, type EditorExtension } from './extension.ts'

export type TypedNodeBuilders = ExtractNodeBuilders<EditorExtension>
export type TypedMarkBuilders = ExtractMarkBuilders<EditorExtension>

/**
 * The schema shared by every parser and serializer. Building it once avoids
 * recreating an editor (and its schema) for each markdown conversion.
 */
const getSharedSchema: () => Schema = /* @__PURE__ */ once(() => {
  const schema = defineEditorExtension().schema
  if (schema == null) {
    throw new Error('Unexpected empty schema')
  }
  return schema
})

/** Typed node builders bound to the shared schema. */
export const getNodeBuilders: () => TypedNodeBuilders = /* @__PURE__ */ once(() => {
  return createNodeBuilders<EditorExtension>(getSharedSchema())
})

/** Typed mark builders bound to the shared schema. */
export const getMarkBuilders: () => TypedMarkBuilders = /* @__PURE__ */ once(() => {
  return createMarkBuilders<EditorExtension>(getSharedSchema())
})
