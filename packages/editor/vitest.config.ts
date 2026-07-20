import { resolve } from 'node:path'
import { mergeConfig } from 'vitest/config'
import sharedConfig from '../../vitest.shared'

export default mergeConfig(sharedConfig, {
  resolve: {
    alias: {
      '@compose-ui/core': resolve(__dirname, '../core/src/index.ts'),
      '@compose-ui/scene-tree': resolve(__dirname, '../scene-tree/src/index.tsx'),
    },
  },
  test: {
    name: 'editor',
    setupFiles: ['../../test/setup.ts'],
  },
})
