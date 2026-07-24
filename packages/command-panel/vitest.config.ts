import { mergeConfig } from 'vitest/config'
import sharedConfig from '../../vitest.shared'

export default mergeConfig(sharedConfig, {
  test: {
    name: 'command-panel',
    setupFiles: ['../../test/setup.ts'],
  },
})
