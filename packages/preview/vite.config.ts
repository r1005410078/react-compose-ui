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
      exclude: ['src/**/*.test.*'],
      tsconfigPath: 'tsconfig.json',
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.tsx'),
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: {
      external: [
        '@compose-ui/component-registry',
        '@compose-ui/core',
        'react',
        'react-dom',
        'react/jsx-runtime',
      ],
    },
  },
})
