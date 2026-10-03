/**
 * 同一份 QML 连截多次，比较**解码后的像素**是否逐个相同。
 *
 * @remarks
 * 比像素而不是比文件哈希：PNG 编码可能带不影响画面的差异。用法：
 * `bun scripts/qt/check-determinism.ts <png>...`，第一张作基准，退出码非零表示画面不确定。
 *
 * 判据是**通道最大差不超过 {@link MAX_CHANNEL_DELTA}**，而不是逐像素一致。Linux 验收环境
 * （xvfb + llvmpipe）实测：图形逐像素一致，文字每次有几十到一百多个通道值不同、最大差 4/255；
 * llvmpipe 单线程（`LP_NUM_THREADS=1`）与单线程渲染循环（`QSG_RENDER_LOOP=basic`）都不改变它。
 * 像素对比的逐像素阈值（pixelmatch 0.1）约等于 25/255 的色差，8/255 的抖动翻转不了「这个像素
 * 算不算不同」，因此它不会让对比结论随运行而变；超过这个量才说明截图真的不确定。
 */
const MAX_CHANNEL_DELTA = 8
import { readFileSync } from 'node:fs'
import { PNG } from 'pngjs'

const files = process.argv.slice(2)
if (files.length < 2) {
  console.error('至少需要两张截图')
  process.exit(1)
}
const base = PNG.sync.read(readFileSync(files[0]!))
let unstable = 0
for (const file of files.slice(1)) {
  const image = PNG.sync.read(readFileSync(file))
  let different = 0
  let maxDelta = 0
  for (let i = 0; i < base.data.length; i += 1) {
    const delta = Math.abs(base.data[i]! - image.data[i]!)
    if (delta > 0) {
      different += 1
      maxDelta = Math.max(maxDelta, delta)
    }
  }
  if (maxDelta > MAX_CHANNEL_DELTA) unstable += 1
  console.log(`${file}: ${different} 个通道值不同，最大差 ${maxDelta}`)
}
if (unstable > 0) console.error(`${unstable} 张截图与基准的通道差超过 ${MAX_CHANNEL_DELTA}/255`)
process.exit(unstable === 0 ? 0 : 1)
