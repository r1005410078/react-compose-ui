import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    clearMocks: true,
    coverage: {
      provider: 'v8',
      // 各包独立运行 vitest，报告只落在自己的 coverage/ 下。
      // 这里不设 thresholds：各包体量差异过大（assets 31 行 vs editor 3310 行），
      // 逐包阈值会退化成 22 个互不相关的孤立数字。仓库级阈值统一由
      // scripts/coverage-summary.mjs 读取各包 json-summary 后判定。
      reporter: ['text-summary', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.stories.{ts,tsx}',
        'src/**/*.d.ts',
      ],
    },
  },
})
