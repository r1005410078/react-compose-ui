import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react-swc'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    dts({
      entryRoot: 'src',
      include: ['src'],
      exclude: ['src/**/*.test.*', 'src/**/*.stories.*'],
      // 编辑器开发 tsconfig 会把 workspace 依赖指向源码，供 IDE 在未构建 dist 时解析。
      // 声明构建必须保留包边界，否则 vite-plugin-dts 会把相邻包带入当前 rootDir。
      tsconfigPath: 'tsconfig.build.json',
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.tsx'),
      formats: ['es'],
      fileName: 'index',
      cssFileName: 'styles',
    },
    rollupOptions: {
      external: [
        '@compose-ui/asset-browser',
        '@compose-ui/assets',
        '@compose-ui/core',
        '@compose-ui/command-panel',
        '@compose-ui/component-registry',
        '@compose-ui/history',
        '@compose-ui/pages',
        '@compose-ui/property-panel',
        '@compose-ui/scene-tree',
        '@compose-ui/stage',
        '@compose-ui/stage-engine',
        // Context 必须由宿主共享同一实例，不能内联进 Editor bundle。
        '@compose-ui/ui-context',
        'react',
        'react-dom',
        'react/jsx-runtime',
        'valibot',
      ],
    },
  },
})
