import type { StorybookConfig } from '@storybook/react-vite'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'

const configDirectory = fileURLToPath(new URL('.', import.meta.url))
const require = createRequire(import.meta.url)

/**
 * bunfig.toml 使用 `linker = "isolated"`，addon 不会被提升到根 node_modules，
 * Storybook 按裸包名查找时可能落空。解析到包自身的真实目录可以让 addon 与
 * framework 在隔离布局下稳定命中。
 */
function getAbsolutePath(packageName: string): string {
  return dirname(require.resolve(join(packageName, 'package.json')))
}

const config: StorybookConfig = {
  stories: ['../../../packages/*/src/**/*.stories.@(ts|tsx)'],
  addons: [
    getAbsolutePath('@storybook/addon-a11y'),
    getAbsolutePath('@storybook/addon-vitest'),
  ],
  framework: {
    name: getAbsolutePath('@storybook/react-vite'),
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
}

export default config
