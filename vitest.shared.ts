import { defineConfig } from 'vitest/config'

/*
 * CI 上每个包只开一个 worker：turbo 已经在包之间并行，再让每个包按核数各开一组 worker，
 * 4 核的 runner 上同时跑着几十个 jsdom 进程，5 秒超时的交互用例就会被挤过线——每次挤掉的是
 * 不同的那一条，看起来像偶发失败。总 CPU 量不变，并行度交给 turbo 的 `--concurrency` 一处管。
 */
const ci = process.env.CI === 'true'

export default defineConfig({
  test: {
    environment: 'jsdom',
    clearMocks: true,
    ...(ci ? { maxWorkers: 1 } : {}),
  },
})
