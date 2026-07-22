import type { SnapshotSerializer } from 'vitest'

// Wrap strings that contain newlines in triple quotes and ensure they looks pretty in snapshots by adding extra newlines before and after the string.
const customStringSerializer: SnapshotSerializer = {
  serialize(val, config, indentation, depth, refs, printer) {
    if (depth === 0 && typeof val === 'string') {
      return `"""\n${val}\n"""`
    } else {
      return printer(val, config, indentation, depth, refs)
    }
  },
  test(val) {
    return (
      typeof val === 'string' && val.includes('\n') && !(val.startsWith('\n') && val.endsWith('\n')) && !val.startsWith('"""') && !val.endsWith('"""')
    )
  },
}

export default customStringSerializer
