export {
  defineEditorExtension,
  type EditorExtension,
  type TypedEditor,
} from './extensions/extension.ts'
export { type MarkMode, defineMarkMode } from './extensions/mark-mode.ts'
export {
  defineImageExtension,
  defaultResolveImageUrl,
  type ImageExtensionOptions,
  type ImageUrlResolver,
  type ImageUploadHandler,
  type ImageUploadPredicate,
  type ImageUploadErrorHandler,
} from './extensions/images.ts'
export { codeBlockLanguages } from './extensions/code-block-languages.ts'
export { docToMarkdown } from './converters/pm-to-md.ts'
export { markdownToDoc } from './converters/md-to-pm.ts'
export type { CodeBlockAttrs } from '@prosekit/extensions/code-block'
