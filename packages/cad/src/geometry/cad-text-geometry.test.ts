import { describe, expect, it } from 'vitest'
import {
  CAD_TEXT_ADVANCE_RATIO,
  CAD_TEXT_ASCENT_RATIO,
  CAD_TEXT_DESCENT_RATIO,
  cadTextBounds,
  cadTextCorners,
  cadTextWidth,
  pointToTextDistanceSquared,
  type CadTextShape,
} from './cad-text-geometry'
import { geometryCrossesBounds, geometryWithinBounds, textGeometry } from './cad-curve'

/** 锚点在原点、字号 10、四个字符的左对齐文字。 */
const label: CadTextShape = {
  position: { x: 0, y: 0 },
  content: 'QF01',
  height: 10,
  rotation: 0,
  align: 'left',
}

const WIDTH = 4 * 10 * CAD_TEXT_ADVANCE_RATIO
const TOP = -10 * CAD_TEXT_ASCENT_RATIO
const BOTTOM = 10 * CAD_TEXT_DESCENT_RATIO

describe('OpenSpec: cad-document / CAD 文字图元 / 按对齐锚点定位', () => {
  it('宽度由字符数、字号与前进宽度比例决定', () => {
    expect(cadTextWidth(label)).toBeCloseTo(WIDTH)
  })

  it('三种对齐相对锚点向不同方向展开', () => {
    expect(cadTextBounds(label)).toEqual({ minX: 0, minY: TOP, maxX: WIDTH, maxY: BOTTOM })
    expect(cadTextBounds({ ...label, align: 'center' }))
      .toEqual({ minX: -WIDTH / 2, minY: TOP, maxX: WIDTH / 2, maxY: BOTTOM })
    expect(cadTextBounds({ ...label, align: 'right' }))
      .toEqual({ minX: -WIDTH, minY: TOP, maxX: 0, maxY: BOTTOM })
  })

  it('基线之上高、之下浅', () => {
    // 锚点在基线上，因此框往上伸得多、往下伸得少。
    expect(TOP).toBeLessThan(0)
    expect(BOTTOM).toBeGreaterThan(0)
    expect(Math.abs(TOP)).toBeGreaterThan(BOTTOM)
  })
})

describe('OpenSpec: cad-document / CAD 文字按包围盒命中', () => {
  it('框内距离为零', () => {
    // 笔画之间的空隙同样算命中——文字占满自己的盒子，盒子就是用户看见的那块墨。
    expect(pointToTextDistanceSquared(label, { x: WIDTH / 2, y: -2 })).toBe(0)
    expect(pointToTextDistanceSquared(label, { x: 0, y: 0 })).toBe(0)
  })

  it('框外取到框边的距离', () => {
    expect(pointToTextDistanceSquared(label, { x: WIDTH + 3, y: 0 })).toBeCloseTo(9)
    expect(pointToTextDistanceSquared(label, { x: -4, y: 0 })).toBeCloseTo(16)
  })

  it('框随旋转一起转', () => {
    const rotated: CadTextShape = { ...label, rotation: 90 }
    // 未旋转时框在锚点右侧；转 90°（屏幕顺时针）之后它在锚点下方。
    expect(pointToTextDistanceSquared(rotated, { x: WIDTH / 2, y: 0 })).toBeGreaterThan(0)
    expect(pointToTextDistanceSquared(rotated, { x: 0, y: WIDTH / 2 })).toBe(0)

    const corners = cadTextCorners(rotated)
    expect(corners[0]!.x).toBeCloseTo(-TOP)
    expect(corners[0]!.y).toBeCloseTo(0)
  })

  it('长文字末尾仍在框内', () => {
    const long: CadTextShape = { ...label, content: '断路器 QF01 额定电流 630A' }
    const end = cadTextWidth(long)
    expect(pointToTextDistanceSquared(long, { x: end - 1, y: -2 })).toBe(0)
    expect(pointToTextDistanceSquared(long, { x: end + 5, y: -2 })).toBeGreaterThan(0)
  })
})

describe('OpenSpec: cad-document / CAD 文字按包围盒命中 / 框选', () => {
  it('窗口要求整块在框内', () => {
    const geometry = textGeometry(label)
    expect(geometryWithinBounds(geometry, { minX: -1, minY: -9, maxX: WIDTH + 1, maxY: 3 }))
      .toBe(true)
    // 只盖住一半。
    expect(geometryWithinBounds(geometry, { minX: -1, minY: -9, maxX: WIDTH / 2, maxY: 3 }))
      .toBe(false)
  })

  it('交叉只要碰到边就算', () => {
    const geometry = textGeometry(label)
    expect(geometryCrossesBounds(geometry, { minX: WIDTH / 2, minY: -2, maxX: 999, maxY: 2 }))
      .toBe(true)
    expect(geometryCrossesBounds(geometry, { minX: 500, minY: 500, maxX: 600, maxY: 600 }))
      .toBe(false)
  })
})
