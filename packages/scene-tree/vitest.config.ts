import { mergeConfig } from 'vitest/config'
import sharedConfig from '../../vitest.shared'

export default mergeConfig(sharedConfig, {
  test: {
    name: 'scene-tree',
    setupFiles: ['../../test/setup.ts'],
  },
})
