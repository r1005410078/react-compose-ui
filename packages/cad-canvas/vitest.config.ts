import { mergeConfig } from 'vitest/config'
import sharedConfig from '../../vitest.shared'

export default mergeConfig(sharedConfig, {
  test: {
    name: 'cad-canvas',
    setupFiles: ['../../test/setup.ts'],
  },
})
