import type { SnapshotSerializer } from 'vitest'

// Wrap strings that contain newlines in triple quotes and ensure they looks pretty in snapshots by adding extra newlines before and after the string.
const customStringSerializer: SnapshotSerializer = {
  serialize(val, _config, _indentation, depth) {
    // `test` only matches multiline strings, so `val` is always one. A nested
    // string must not be handed back to `printer`: this serializer would
    // match it again and recurse forever.
    return depth === 0 ? `"""\n${String(val)}\n"""` : JSON.stringify(val)
  },
  test(val) {
    return (
      typeof val === 'string' && val.includes('\n') && !(val.startsWith('\n') && val.endsWith('\n'))
    )
  },
}

export default customStringSerializer
