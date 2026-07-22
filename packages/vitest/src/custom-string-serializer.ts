import type { SnapshotSerializer } from 'vitest'

// Wrap strings that contain newlines in triple quotes and ensure they looks pretty in snapshots by adding extra newlines before and after the string.
const customStringSerializer: SnapshotSerializer = {
  serialize(val, _config, _indentation, depth) {
    // `test` only matches multiline strings. A nested one must be rendered
    // directly: handing it back to `printer` re-enters the plugin chain and
    // recurses forever.
    return depth === 0 ? `"""\n${String(val)}\n"""` : JSON.stringify(val)
  },
  test(val) {
    return (
      typeof val === 'string' &&
      val.includes('\n') &&
      !(val.startsWith('\n') && val.endsWith('\n')) &&
      !val.startsWith('"""') &&
      !val.endsWith('"""')
    )
  },
}

export default customStringSerializer
