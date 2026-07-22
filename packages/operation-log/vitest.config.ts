import { mergeConfig } from 'vitest/config'
import sharedConfig from '../../vitest.shared'

export default mergeConfig(sharedConfig, {
  test: {
    name: 'operation-log',
    setupFiles: ['../../test/setup.ts'],
  },
})
