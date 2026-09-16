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
      external: [
        '@compose-ui/assets',
        '@compose-ui/components',
        '@compose-ui/library',
        '@compose-ui/ui-context',
        'react',
        'react-dom',
        'react/jsx-runtime',
      ],
      output: {
        assetFileNames: (assetInfo) => assetInfo.names.includes('index.css')
          ? 'styles.css'
          : '[name][extname]',
      },
    },
  },
})
