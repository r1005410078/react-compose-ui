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
        '@compose-ui/component-registry',
        '@compose-ui/core',
        '@compose-ui/property-panel',
        // Context 必须由宿主共享同一实例，不能内联进材料包。
        '@compose-ui/ui-context',
        'dompurify',
        'react',
        'react-dom',
        'react/jsx-runtime',
        'valibot',
      ],
    },
  },
})
