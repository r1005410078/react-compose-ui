import { mergeConfig } from 'vitest/config'
import sharedConfig from '../../vitest.shared'
import { composePortableRuntimePlugin } from './scripts/portable-runtime-plugin'

export default mergeConfig(sharedConfig, {
  plugins: [composePortableRuntimePlugin()],
  test: {
    name: 'script-runtime',
    environment: 'node',
  },
})
