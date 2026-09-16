import { resolve } from 'node:path'
import react from '@vitejs/plugin-react-swc'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [
    react(),
    dts({
      entryRoot: 'src',
      include: ['src'],
      exclude: ['src/**/*.test.*', 'src/**/*.stories.*'],
      tsconfigPath: 'tsconfig.json',
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es'],
      fileName: 'index',
      cssFileName: 'styles',
    },
    rollupOptions: {
      /*
       * echarts 外置：它在 `dependencies` 里，内联进产物会让宿主装到两份，本包的体积也会
       * 凭空多出一整个图表运行时。与 `svg-import` 外置解析库是同一条。
       */
      external: [
        '@compose-ui/component-registry',
        '@compose-ui/core',
        '@compose-ui/property-panel',
        '@compose-ui/ui-context',
        'echarts',
        'echarts/core',
        'echarts/charts',
        'echarts/components',
        'echarts/renderers',
        'valibot',
        'react',
        'react-dom',
        'react/jsx-runtime',
      ],
    },
  },
})
