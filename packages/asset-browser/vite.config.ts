import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react-swc'
import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import dts from 'vite-plugin-dts'

const injectMonacoStyles: Plugin = {
  name: 'compose-inject-monaco-styles',
  generateBundle(_options, bundle) {
    const stylesheet = Object.values(bundle).find((output) => (
      output.type === 'asset' && output.fileName === 'editor.css'
    ))
    const runtime = Object.values(bundle).find((output) => (
      output.type === 'chunk' && output.facadeModuleId?.endsWith('/monaco-runtime.ts')
    ))
    if (!stylesheet || stylesheet.type !== 'asset' || !runtime || runtime.type !== 'chunk') return
    const css = typeof stylesheet.source === 'string'
      ? stylesheet.source
      : new TextDecoder().decode(stylesheet.source)
    // 库的动态 CSS 关系在被宿主再次打包时会丢失，因此把 Monaco CSS 注入其动态 JS chunk。
    runtime.code = `const composeMonacoStyles=${JSON.stringify(css)};`
      + 'if(typeof document!=="undefined"&&!document.querySelector("style[data-compose-monaco-styles]")){'
      + 'const style=document.createElement("style");style.dataset.composeMonacoStyles="";'
      + 'style.textContent=composeMonacoStyles;document.head.append(style)}\n'
      + runtime.code
    delete bundle[stylesheet.fileName]
  },
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    injectMonacoStyles,
    dts({
      entryRoot: 'src',
      include: ['src'],
      exclude: ['src/**/*.test.*'],
      tsconfigPath: 'tsconfig.json',
    }),
  ],
  build: {
    // Monaco 只在脚本首次打开时加载；库模式默认合并 CSS，会把 300KB 编辑器样式
    // 提前塞进资源面板主样式，因此必须保留动态入口自己的 CSS chunk。
    cssCodeSplit: true,
    lib: {
      entry: resolve(__dirname, 'src/index.tsx'),
      formats: ['es'],
      fileName: 'index',
      cssFileName: 'styles',
    },
    rollupOptions: {
      external: [
        '@compose-ui/assets',
        '@compose-ui/components',
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
