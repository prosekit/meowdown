// The spellcheck-family subset of the content attributes CodeMirror 6 sets on
// its editable DOM:
// https://github.com/codemirror/view/blob/6.41.0/src/editorview.ts#L525-L528
export const NON_PROSE_ATTRS = {
  spellcheck: 'false',
  autocorrect: 'off',
  autocapitalize: 'off',
  writingsuggestions: 'false',
} as const
