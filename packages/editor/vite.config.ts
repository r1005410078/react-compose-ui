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
      exclude: ['src/**/*.test.*'],
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
      external: [
        '@compose-ui/asset-browser',
        '@compose-ui/assets',
        '@compose-ui/core',
        '@compose-ui/command-panel',
        '@compose-ui/component-registry',
        '@compose-ui/history',
        '@compose-ui/scene-tree',
        '@compose-ui/stage',
        '@compose-ui/stage-engine',
        // Context 必须由宿主共享同一实例，不能内联进 Editor bundle。
        '@compose-ui/ui-context',
        'react',
        'react-dom',
        'react/jsx-runtime',
      ],
    },
  },
})
