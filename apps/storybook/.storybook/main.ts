import type { StorybookConfig } from '@storybook/react-vite'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const configDirectory = fileURLToPath(new URL('.', import.meta.url))

const config: StorybookConfig = {
  stories: ['../../../packages/*/src/**/*.stories.@(ts|tsx)'],
  addons: [
    '@storybook/addon-a11y',
    '@storybook/addon-vitest',
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  async viteFinal(config) {
    return {
      ...config,
      resolve: {
        ...config.resolve,
        alias: {
          ...(typeof config.resolve?.alias === 'object' ? config.resolve.alias : {}),
          '@compose-ui/storybook-fixtures': resolve(configDirectory, '../src/fixtures/index.tsx'),
        },
      },
      build: {
        ...config.build,
        // 物料包已经在各自构建中处理 Tailwind；Storybook 汇总多个公开 CSS
        // 入口时不应再次让 Lightning CSS 解析 Tailwind 的 prefix 语法。
        cssMinify: false,
      },
    }
  },
  docs: { autodocs: false },
}

export default config
