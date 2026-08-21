import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react-swc'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig({
  resolve: {
    alias: [
      {
        find: 'use-sync-external-store/shim/with-selector',
        replacement: resolve(__dirname, 'src/lib/react-use-sync-external-store.ts'),
      },
      {
        find: 'use-sync-external-store/shim',
        replacement: resolve(__dirname, 'src/lib/react-use-sync-external-store.ts'),
      },
    ],
  },
  plugins: [
    react(),
    tailwindcss(),
    dts({
      entryRoot: 'src',
      include: ['src'],
      exclude: ['src/**/*.test.*', 'src/**/*.stories.*'],
      tsconfigPath: 'tsconfig.json',
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
      // Base UI 的条件导出在下游 Rolldown 构建中会回退到 CJS require。
      // 将其随组件库产出为 ESM，保证嵌入 Vite/Rolldown 宿主时不依赖浏览器端 require。
      external: [
        '@compose-ui/commands',
        '@compose-ui/ui-context',
        '@tanstack/react-virtual',
        'class-variance-authority',
        'clsx',
        'react',
        'react-dom',
        'react/jsx-runtime',
        'tailwind-merge',
      ],
    },
  },
})
