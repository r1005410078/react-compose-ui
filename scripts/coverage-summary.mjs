import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const workspaceRoot = process.cwd()
const packageRoot = join(workspaceRoot, 'packages')

/**
 * 仓库级覆盖率阈值。
 *
 * 基线取自 2026-08-18 首次全量实测（lines 79.65 / statements 75.33 /
 * functions 77.98 / branches 66.44），向下取整留出小幅缓冲，使阈值只做
 * 棘轮（ratchet）用途：允许覆盖率上升，阻止其回落。提升基线时应连同
 * 本注释一起更新，避免阈值来源不可追溯。
 */
const thresholds = {
  lines: 79,
  statements: 75,
  functions: 77,
  branches: 66,
}

const metrics = ['lines', 'statements', 'functions', 'branches']

function readPackageSummaries() {
  const summaries = []
  for (const name of readdirSync(packageRoot).sort()) {
    const summaryPath = join(packageRoot, name, 'coverage', 'coverage-summary.json')
    if (!existsSync(summaryPath)) continue
    const { total } = JSON.parse(readFileSync(summaryPath, 'utf8'))
    summaries.push({ name, total })
  }
  return summaries
}

// v8 在某个类别完全没有可覆盖项时会把 pct 写成字符串 "Unknown"，
// 直接参与数值计算会静默污染汇总结果，因此在入口处归一化。
function toPercent(value) {
  return typeof value === 'number' ? value : 0
}

function formatPercent(value) {
  return `${toPercent(value).toFixed(2)}%`.padStart(7)
}

const summaries = readPackageSummaries()

if (summaries.length === 0) {
  console.error('未找到任何 coverage-summary.json，请先运行 bun run test:coverage。')
  process.exit(1)
}

const totals = Object.fromEntries(metrics.map((metric) => [metric, { covered: 0, total: 0 }]))
for (const { total } of summaries) {
  for (const metric of metrics) {
    totals[metric].covered += total[metric].covered
    totals[metric].total += total[metric].total
  }
}

// 按行覆盖率升序排列，让最需要补测试的包出现在最前面。
summaries.sort((a, b) => toPercent(a.total.lines.pct) - toPercent(b.total.lines.pct))

console.log('\n包覆盖率（按行覆盖率升序）\n')
console.log(`${'包'.padEnd(24)}${'行'.padStart(9)}${'分支'.padStart(9)}${'函数'.padStart(9)}   未覆盖行`)
for (const { name, total } of summaries) {
  const uncovered = total.lines.total - total.lines.covered
  console.log(
    name.padEnd(24) +
      formatPercent(total.lines.pct).padStart(9) +
      formatPercent(total.branches.pct).padStart(9) +
      formatPercent(total.functions.pct).padStart(9) +
      `   ${uncovered}`,
  )
}

console.log(`\n仓库合计（${summaries.length} 个包）\n`)
const failures = []
for (const metric of metrics) {
  const { covered, total } = totals[metric]
  const pct = (covered / total) * 100
  const threshold = thresholds[metric]
  const ok = pct >= threshold
  if (!ok) failures.push({ metric, pct, threshold })
  console.log(
    `${ok ? '✓' : '✗'} ${metric.padEnd(12)}${formatPercent(pct)}  (${covered}/${total})  阈值 ${threshold}%`,
  )
}

if (failures.length > 0) {
  console.error('\n覆盖率低于阈值：')
  for (const { metric, pct, threshold } of failures) {
    console.error(`  ${metric}: ${pct.toFixed(2)}% < ${threshold}%`)
  }
  process.exit(1)
}

console.log('\n覆盖率满足全部阈值。')
