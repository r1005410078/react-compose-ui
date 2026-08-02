import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const STYLESHEETS = [
  '../flex-layout/styles.css',
  './styles.css',
  '../styles.css',
] as const

describe('OpenSpec: basic-materials / 物料样式不依赖属性面板内部类名', () => {
  it.each(STYLESHEETS)('%s 不引用 property-panel 内部 BEM 类名', (relative) => {
    const source = readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8')
    const offenders = source
      .split('\n')
      .map((line, index) => ({ line: line.trim(), number: index + 1 }))
      .filter(({ line }) => line.includes('property-panel__'))
      .map(({ line, number }) => `${number}: ${line}`)

    // `property-panel__*` 是 property-panel 的实现细节；结构定位改用 data-property-part。
    expect(offenders).toEqual([])
  })
})
