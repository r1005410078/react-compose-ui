/**
 * 比较 Preview 与 Qt 两侧对同一批夹具的截图。
 *
 * 用法：bun scripts/qt/compare-render.ts [--reference 目录] [--actual 目录] [--diff 目录]
 *
 * 默认读 `native/qt/out/reference/`（`e2e/qt-reference.spec.ts` 写出）与 `native/qt/out/qt/`
 * （`qml-grab` 写出），差异图写到 `native/qt/out/diff/`。以参考图为准逐份比较：Qt 一侧缺图、
 * 尺寸不同或差异超出容差都判失败。
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import pixelmatch from 'pixelmatch'
import { PNG } from 'pngjs'

/*
 * 容差只在这里定义一处。两个数各管一件事：
 * - PIXEL_THRESHOLD 是 pixelmatch 的逐像素 YIQ 色差阈值（0–1）：抗锯齿边缘在两个光栅化器上
 *   必然不同，这一档决定「颜色差多少才算这个像素不一样」。
 * - MAX_DIFF_RATIO 是差异像素占整图的比例上限：它决定「不一样的像素多到什么程度才算两张图
 *   不一样」。
 * 实测（底座阶段四份夹具，macOS offscreen）：三份图形夹具差异为 0，文字 0.247%；而文字
 * 漏掉半行距补偿时是 1.017%——整行字高了 4px。上限取 0.5%：对实测留约两倍余量，同时把那类
 * 「整体错位几个像素」的映射错误挡在门外。Linux 验收环境的数字以 CI 实测为准再回来收紧。
 */
const PIXEL_THRESHOLD = 0.1
const MAX_DIFF_RATIO = 0.005

interface ComparisonResult {
  readonly name: string
  readonly status: 'pass' | 'fail'
  readonly detail: string
}

function readPng(path: string): PNG {
  return PNG.sync.read(readFileSync(path))
}

function compare(name: string, referencePath: string, actualPath: string, diffDir: string): ComparisonResult {
  if (!existsSync(actualPath)) {
    return { name, status: 'fail', detail: `Qt 一侧缺少截图 ${actualPath}` }
  }
  const reference = readPng(referencePath)
  const actual = readPng(actualPath)
  if (reference.width !== actual.width || reference.height !== actual.height) {
    return {
      name,
      status: 'fail',
      detail: `尺寸不同：预览 ${reference.width}×${reference.height}，Qt ${actual.width}×${actual.height}`,
    }
  }
  const { width, height } = reference
  const diff = new PNG({ width, height })
  const different = pixelmatch(reference.data, actual.data, diff.data, width, height, {
    threshold: PIXEL_THRESHOLD,
  })
  const ratio = different / (width * height)
  const detail = `差异像素 ${different}（${(ratio * 100).toFixed(3)}%）`
  if (ratio <= MAX_DIFF_RATIO) return { name, status: 'pass', detail }
  mkdirSync(diffDir, { recursive: true })
  const diffPath = join(diffDir, `${name}.png`)
  writeFileSync(diffPath, PNG.sync.write(diff))
  return {
    name,
    status: 'fail',
    detail: `${detail} 超出容差 ${(MAX_DIFF_RATIO * 100).toFixed(1)}%，差异图 ${diffPath}`,
  }
}

const { values } = parseArgs({
  options: {
    reference: { type: 'string', default: 'native/qt/out/reference' },
    actual: { type: 'string', default: 'native/qt/out/qt' },
    diff: { type: 'string', default: 'native/qt/out/diff' },
  },
})
const referenceDir = resolve(values.reference)
const actualDir = resolve(values.actual)
const diffDir = resolve(values.diff)

const references = existsSync(referenceDir)
  ? readdirSync(referenceDir).filter((file) => file.endsWith('.png')).sort()
  : []
if (references.length === 0) {
  console.error(`没有找到参考截图：${referenceDir}。先运行 e2e/qt-reference.spec.ts。`)
  process.exit(1)
}

const results = references.map((file) => compare(
  basename(file, '.png'),
  join(referenceDir, file),
  join(actualDir, file),
  diffDir,
))
for (const result of results) {
  console.log(`${result.status === 'pass' ? '✓' : '✗'} ${result.name}  ${result.detail}`)
}
const failed = results.filter((result) => result.status === 'fail').length
if (failed > 0) {
  console.error(`${failed} / ${results.length} 份夹具未通过像素对比`)
  process.exit(1)
}
console.log(`${results.length} 份夹具全部通过像素对比`)
