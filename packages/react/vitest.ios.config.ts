import { defineSharedConfig } from '@meowdown/vitest/config'
import { defineProject, mergeConfig } from 'vitest/config'

// Runs the code block Enter test as an iPhone Safari user. Active only in the
// WebKit run; other runs keep the project empty so no second browser starts.
const enabled = process.env.MEOWDOWN_TEST_BROWSER === 'webkit'

export default enabled
  ? mergeConfig(
      defineSharedConfig({ env: 'browser', groupOrder: 2100, emulateIPhone: true }),
      defineProject({
        test: {
          name: 'react-webkit-ios',
          include: ['src/components/code-block-enter.test.tsx'],
        },
      }),
    )
  : defineProject({
      test: {
        name: 'react-webkit-ios',
        include: [],
      },
    })
