import { mergeConfig } from 'vitest/config'
import sharedConfig from '../../vitest.shared'

export default mergeConfig(sharedConfig, {
  test: {
    name: 'component-registry',
    setupFiles: ['../../test/setup.ts'],
  },
})
