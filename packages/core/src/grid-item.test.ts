import { describe, expect, it } from 'vitest'
import {
  collectComposeGridItemValidationIssues,
  createComposeGridItem,
  createDefaultComposeGridLayout,
  getComposeGridItem,
  isComposeGridLayout,
  isValidComposeGridItem,
  isValidComposeLayout,
  type ComposeEntity,
} from './index'

function entityWith(components: Record<string, unknown>): ComposeEntity {
  return { id: 'e1', name: 'e1', components } as unknown as ComposeEntity
}

describe('OpenSpec: compose-document / 网格 Layout 类型', () => {
  it('保存合法网格布局且文档里不含列宽', () => {
    const layout = createDefaultComposeGridLayout()
    expect(layout).toEqual({
      type: 'grid',
      columns: 12,
      rowHeight: 48,
      padding: { top: 16, right: 16, bottom: 16, left: 16 },
      rowGap: 6,
      columnGap: 6,
      float: false,
    })
    expect(isValidComposeLayout(layout)).toBe(true)
    // 列宽由内容宽推出，不进文档——同一份事实存两处必然漂移。
    expect(Object.keys(layout)).not.toContain('columnWidth')
  })

  it('每次调用返回独立引用', () => {
    const first = createDefaultComposeGridLayout()
    const second = createDefaultComposeGridLayout()
    expect(first).not.toBe(second)
    expect(first.padding).not.toBe(second.padding)
  })

  it('拒绝非法网格参数', () => {
    const base = createDefaultComposeGridLayout()
    expect(isValidComposeLayout({ ...base, columns: 0 })).toBe(false)
    expect(isValidComposeLayout({ ...base, columns: -3 })).toBe(false)
    expect(isValidComposeLayout({ ...base, columns: 2.5 })).toBe(false)
    expect(isValidComposeLayout({ ...base, rowHeight: 0 })).toBe(false)
    expect(isValidComposeLayout({ ...base, rowHeight: Number.POSITIVE_INFINITY })).toBe(false)
    expect(isValidComposeLayout({ ...base, rowGap: -1 })).toBe(false)
    expect(isValidComposeLayout({ ...base, float: 'yes' })).toBe(false)
    expect(isValidComposeLayout({ ...base, extra: 1 })).toBe(false)
  })

  it('未知 type 被拒绝且不按 flex 兜底', () => {
    const layout = { ...createDefaultComposeGridLayout(), type: 'masonry' }
    expect(isValidComposeLayout(layout)).toBe(false)
    // 缺 type 同样拒绝：回退会让一份写坏的 grid 文档静默渲染成一条轴上的序列。
    const withoutType: Record<string, unknown> = { ...createDefaultComposeGridLayout() }
    delete withoutType.type
    expect(isValidComposeLayout(withoutType)).toBe(false)
  })

  it('isComposeGridLayout 只对 grid 为真', () => {
    expect(isComposeGridLayout(createDefaultComposeGridLayout())).toBe(true)
    expect(isComposeGridLayout(undefined)).toBe(false)
  })
})

describe('OpenSpec: compose-document / 可选 GridItem Component', () => {
  it('校验合法 GridItem', () => {
    expect(isValidComposeGridItem({ x: 0, y: 2, w: 4, h: 2 })).toBe(true)
    expect(isValidComposeGridItem({ x: 0, y: 2, w: 4, h: 2, minW: 2, minH: 1 })).toBe(true)
  })

  it('拒绝非法格坐标', () => {
    expect(isValidComposeGridItem({ x: 0, y: 0, w: 0, h: 2 })).toBe(false)
    expect(isValidComposeGridItem({ x: -1, y: 0, w: 4, h: 2 })).toBe(false)
    expect(isValidComposeGridItem({ x: 0.5, y: 0, w: 4, h: 2 })).toBe(false)
    expect(isValidComposeGridItem({ x: 0, y: 0, w: 4 })).toBe(false)
    expect(isValidComposeGridItem({ x: 0, y: 0, w: 4, h: 2, extra: 1 })).toBe(false)
    expect(isValidComposeGridItem(null)).toBe(false)
  })

  it('最小跨度不得大于当前跨度', () => {
    // 两个数互相矛盾时面板会印出一对读不通的值，而缩放会立刻把它钳回来。
    expect(isValidComposeGridItem({ x: 0, y: 0, w: 2, h: 2, minW: 4 })).toBe(false)
    const issues = collectComposeGridItemValidationIssues({ x: 0, y: 0, w: 2, h: 2, minH: 5 })
    expect(issues.map((issue) => issue.path)).toContainEqual(['minH'])
  })

  it('缺席即不在格中', () => {
    expect(getComposeGridItem(entityWith({}))).toBeUndefined()
    expect(getComposeGridItem(undefined)).toBeUndefined()
    expect(getComposeGridItem(entityWith({ GridItem: { x: 1, y: 2, w: 3, h: 1 } })))
      .toEqual({ x: 1, y: 2, w: 3, h: 1 })
  })

  it('工厂给出仪表盘上最常见的一档', () => {
    expect(createComposeGridItem(0, 2)).toEqual({ x: 0, y: 2, w: 4, h: 2 })
    expect(isValidComposeGridItem(createComposeGridItem(3, 1, 6, 3))).toBe(true)
  })
})
