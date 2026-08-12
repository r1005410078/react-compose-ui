import { mergeConfig } from 'vitest/config'
import sharedConfig from '../../vitest.shared'

export default mergeConfig(sharedConfig, {
  test: {
    name: 'component-library',
    setupFiles: ['../../test/setup.ts'],
  },
})
