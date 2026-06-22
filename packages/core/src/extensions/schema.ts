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

/** The schema shared by every parser and serializer, built once and cached. */
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

const MARK_BUILDERS_CACHE_KEY = 'meowdown_mark_builders'

/** Typed mark builders bound to a specific schema, cached per schema. */
export function getMarkBuildersForSchema(schema: Schema): TypedMarkBuilders {
  const cached = schema.cached[MARK_BUILDERS_CACHE_KEY] as TypedMarkBuilders | undefined
  if (cached) return cached
  const builders = createMarkBuilders<EditorExtension>(schema)
  schema.cached[MARK_BUILDERS_CACHE_KEY] = builders
  return builders
}

const NODE_BUILDERS_CACHE_KEY = 'meowdown_node_builders'

/** Typed node builders bound to a specific schema, cached per schema. */
export function getNodeBuildersForSchema(schema: Schema): TypedNodeBuilders {
  const cached = schema.cached[NODE_BUILDERS_CACHE_KEY] as TypedNodeBuilders | undefined
  if (cached) return cached
  const builders = createNodeBuilders<EditorExtension>(schema)
  schema.cached[NODE_BUILDERS_CACHE_KEY] = builders
  return builders
}
