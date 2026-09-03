import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [
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
    },
    rollupOptions: {
      // 第三方依赖外置：它们在 `dependencies` 里，内联进产物会让宿主装到两份，也让本包的
      // 体积凭空多出一个 XML 解析器。
      external: ['@compose-ui/core', 'fast-xml-parser', 'svgpath'],
    },
  },
})
