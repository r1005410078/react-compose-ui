/**
 * 同一份 QML 连截多次，比较**解码后的像素**是否逐个相同。
 *
 * @remarks
 * 比像素而不是比文件哈希：PNG 编码可能带不影响画面的差异。用法：
 * `bun scripts/qt/check-determinism.ts <png>...`，第一张作基准，退出码非零表示画面不确定。
 */
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
  if (different > 0) unstable += 1
  console.log(`${file}: ${different} 个通道值不同，最大差 ${maxDelta}`)
}
process.exit(unstable === 0 ? 0 : 1)
