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

const markBuildersBySchema = new WeakMap<Schema, TypedMarkBuilders>()

/**
 * Typed mark builders bound to a specific schema, cached per schema.
 *
 * The inline-mark plugin creates marks from the live editor's own
 * `state.schema`, which is a different `Schema` instance than
 * {@link getSharedSchema}. A mark carries its `MarkType`, and a mark built from
 * a different schema instance is not type-identical, so the plugin must not use
 * {@link getMarkBuilders} (which is bound to the shared schema).
 */
export function getMarkBuildersForSchema(schema: Schema): TypedMarkBuilders {
  let builders = markBuildersBySchema.get(schema)
  if (!builders) {
    builders = createMarkBuilders<EditorExtension>(schema)
    markBuildersBySchema.set(schema, builders)
  }
  return builders
}
