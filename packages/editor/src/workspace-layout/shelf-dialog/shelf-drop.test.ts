import { describe, expect, it } from 'vitest'
import { resolveShelfDropIndex, resolveShelfReorderTarget } from './shelf-drop'
import type { ShelfRect } from './shelf-drop'

/** 两行各三格，每格 100×30，行距 4。 */
const WRAPPED: readonly ShelfRect[] = [
  { left: 0, top: 0, right: 100, bottom: 30 },
  { left: 104, top: 0, right: 204, bottom: 30 },
  { left: 208, top: 0, right: 308, bottom: 30 },
  { left: 0, top: 34, right: 100, bottom: 64 },
  { left: 104, top: 34, right: 204, bottom: 64 },
]

const STACKED: readonly ShelfRect[] = [
  { left: 0, top: 0, right: 300, bottom: 80 },
  { left: 0, top: 88, right: 300, bottom: 168 },
  { left: 0, top: 176, right: 300, bottom: 256 },
]

describe('OpenSpec: editor-workspace-layout / 货架编排的拖拽与键盘 / 落点换算', () => {
  it('横排：落在某一格左半边即插在它之前', () => {
    expect(resolveShelfDropIndex(WRAPPED, { x: 20, y: 15 }, 'wrap')).toBe(0)
    expect(resolveShelfDropIndex(WRAPPED, { x: 120, y: 15 }, 'wrap')).toBe(1)
  })

  it('横排：落在右半边即插在它之后', () => {
    expect(resolveShelfDropIndex(WRAPPED, { x: 80, y: 15 }, 'wrap')).toBe(1)
  })

  /*
   * 判别性用例：只比横向中线时，第二行 x=20 会与第一行的第一格比出 0——落点跳回行首，
   * 而这只在换行之后出现。
   */
  it('横排：第二行按阅读顺序落在第二行，不跳回行首', () => {
    expect(resolveShelfDropIndex(WRAPPED, { x: 20, y: 49 }, 'wrap')).toBe(3)
    expect(resolveShelfDropIndex(WRAPPED, { x: 120, y: 49 }, 'wrap')).toBe(4)
  })

  it('横排：落在最后一格右侧即末尾', () => {
    expect(resolveShelfDropIndex(WRAPPED, { x: 260, y: 49 }, 'wrap')).toBe(5)
  })

  it('纵排：按纵向中线比', () => {
    expect(resolveShelfDropIndex(STACKED, { x: 150, y: 20 }, 'vertical')).toBe(0)
    expect(resolveShelfDropIndex(STACKED, { x: 150, y: 60 }, 'vertical')).toBe(1)
    expect(resolveShelfDropIndex(STACKED, { x: 150, y: 300 }, 'vertical')).toBe(3)
  })

  it('空编排区落到 0', () => {
    expect(resolveShelfDropIndex([], { x: 10, y: 10 }, 'wrap')).toBe(0)
    expect(resolveShelfDropIndex([], { x: 10, y: 10 }, 'vertical')).toBe(0)
  })
})

describe('OpenSpec: editor-workspace-layout / 货架编排的拖拽与键盘 / 重排落点', () => {
  it('往后挪要减掉它自己占的那一位', () => {
    // 0 号拖到「3 号之前」，落地是第 2 位——不减的话它停在 3，每次往后拖都多走一格。
    expect(resolveShelfReorderTarget(0, 3)).toBe(2)
  })

  it('往前挪不减', () => {
    expect(resolveShelfReorderTarget(3, 1)).toBe(1)
  })

  it('落回原位是恒等', () => {
    expect(resolveShelfReorderTarget(2, 2)).toBe(2)
    expect(resolveShelfReorderTarget(2, 3)).toBe(2)
  })
})
