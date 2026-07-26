import { mergeConfig } from 'vitest/config'
import sharedConfig from '../../vitest.shared'

export default mergeConfig(sharedConfig, {
  test: {
    name: 'asset-browser',
    setupFiles: ['../../test/setup.ts'],
  },
})
