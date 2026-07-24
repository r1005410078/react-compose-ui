import { resolve } from 'node:path'
import { mergeConfig } from 'vitest/config'
import sharedConfig from '../../vitest.shared'

export default mergeConfig(sharedConfig, {
  resolve: {
    alias: {
      '@compose-ui/core': resolve(__dirname, '../core/src/index.ts'),
      '@compose-ui/command-panel': resolve(__dirname, '../command-panel/src/index.tsx'),
      '@compose-ui/component-registry': resolve(__dirname, '../component-registry/src/index.ts'),
      '@compose-ui/scene-tree': resolve(__dirname, '../scene-tree/src/index.tsx'),
      '@compose-ui/stage': resolve(__dirname, '../stage/src/index.ts'),
    },
  },
  test: {
    name: 'editor',
    setupFiles: ['../../test/setup.ts'],
  },
})
