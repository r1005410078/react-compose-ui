import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [
    dts({
      entryRoot: 'src',
      include: ['src'],
      exclude: ['src/**/*.test.*'],
      tsconfigPath: 'tsconfig.json',
    }),
  ],
  build: {
    lib: { entry: resolve(__dirname, 'src/index.ts'), formats: ['es'], fileName: 'index' },
    rollupOptions: { external: ['@compose-ui/core'] },
  },
})
