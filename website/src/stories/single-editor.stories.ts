import { SingleEditor, type SingleEditorProps } from './single-editor.tsx'

export default {
  component: SingleEditor,
}

export const Focus = { args: {} satisfies SingleEditorProps }

export const Show = { args: { mode: 'show' } satisfies SingleEditorProps }

export const Hide = { args: { mode: 'hide' } satisfies SingleEditorProps }

export const Readonly = { args: { readOnly: true } satisfies SingleEditorProps }

export const Empty = {
  args: { initialMarkdown: '', placeholder: 'Type some markdown...' } satisfies SingleEditorProps,
}
