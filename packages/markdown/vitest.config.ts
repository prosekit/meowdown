import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    environment: 'node',
    setupFiles: ['@meowdown/vitest/setup-console'],
    snapshotSerializers: ['@meowdown/vitest/custom-string-serializer'],
  },
})
