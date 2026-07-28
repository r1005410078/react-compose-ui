import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

export default defineConfig({
  plugins: [react()],
  resolve: {
    // 工作区库通过实际路径加载时，Bun 可能为其解析到另一份 React。
    // 将 React（包括 jsx-runtime 子路径）统一到示例宿主，避免跨大版本的 Element 不兼容。
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    // 工作区库的发布产物将 React 保留为 peer import。显式预构建可避免
    // Rolldown 在开发态把该间接依赖回退到浏览器不可用的 CJS require。
    include: ['react', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
  },
})
