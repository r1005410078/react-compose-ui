import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/coverage/**',
      '**/storybook-static/**',
      'node_modules/**',
      'playwright-report/**',
      'test-results/**',
      // worktree 嵌套在仓库内，且 ESLint 会遍历点目录。不排除的话
      // `eslint .` 会把另一个分支的完整副本再检查一遍。
      '.worktree/**',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        // 必须显式指定：typescript-eslint 会把每个加载过的 config 目录累加进一个
        // 进程级 Set，且从不清空。VSCode 的 ESLint server 是常驻进程，一旦同时
        // 见过主检出和 `.worktree/<change-id>` 下的同名 config，根目录推断就会因
        // 候选项多于一个而永久抛错。写死根目录可以完全绕开这条推断路径。
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'error',
        { allowConstantExport: true },
      ],
    },
  },
)
