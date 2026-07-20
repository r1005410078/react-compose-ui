import { mergeConfig } from 'vitest/config'
import sharedConfig from '../../vitest.shared'

export default mergeConfig(sharedConfig, {
  test: {
    name: 'property-panel',
    setupFiles: ['../../test/setup.ts'],
  },
})
