import { describe, expect, it } from 'vitest'
import {
  resolveMarqueeHitTest,
  resolveMarqueeSelection,
  type StageMarqueeQuery,
} from './marquee-selection'
import { createStageSceneIndex } from './scene-index'
import { ROOT_FRAME_ID, document, entity, layoutSnapshot } from '../test-fixtures'

/** 左侧节点占 0..100，右侧节点占 200..300，两者都高 50。 */
const left = entity('left', { x: 0, y: 0, width: 100, height: 50 })
const right = entity('right', { x: 200, y: 0, width: 100, height: 50 })

function query(
  area: StageMarqueeQuery['area'],
  overrides: Partial<StageMarqueeQuery> = {},
  entities = [left, right],
): StageMarqueeQuery {
  const value = document(entities)
  return {
    area,
    direction: 'ltr',
    document: value,
    index: createStageSceneIndex(value, layoutSnapshot(value)),
    ...overrides,
  }
}

describe('框选判定模式协议', () => {
  it('OpenSpec: 相交判定选中部分重叠节点', () => {
    // 框右边缘停在 left 内部，只压住它的一半。框从画板外面起手，因此也相交到根 Frame。
    expect(resolveMarqueeSelection(query(
      { x: -10, y: -10, width: 60, height: 70 },
      { direction: 'rtl' },
    ))).toEqual([ROOT_FRAME_ID, 'left'])
  })

  it('OpenSpec: 包含模式排除部分重叠节点', () => {
    expect(resolveMarqueeSelection(query(
      { x: -10, y: -10, width: 60, height: 70 },
      { direction: 'ltr' },
    ))).toEqual([])
    expect(resolveMarqueeSelection(query(
      { x: -10, y: -10, width: 130, height: 70 },
      { direction: 'ltr' },
    ))).toEqual(['left'])
  })

  it('OpenSpec: 判定按拖拽方向切换', () => {
    const area = { x: -10, y: -10, width: 60, height: 70 }
    expect(resolveMarqueeSelection(query(area, { direction: 'ltr' }))).toEqual([])
    expect(resolveMarqueeSelection(query(area, { direction: 'rtl' })))
      .toEqual([ROOT_FRAME_ID, 'left'])
    expect(resolveMarqueeHitTest('ltr')).toBe('contain')
    expect(resolveMarqueeHitTest('rtl')).toBe('intersect')
  })

  it('OpenSpec: 没有可以覆盖方向的参数', () => {
    // 方向本身就是切换器；再给一个开关等于给同一件事造第二个、更慢的入口。
    expect(resolveMarqueeHitTest.length).toBe(1)
    const keys = Object.keys(query({ x: 0, y: 0, width: 1, height: 1 }))
    expect(keys).not.toContain('mode')
  })

  it('OpenSpec: 排除 hidden 与 locked 节点', () => {
    const hidden = entity('hidden', { x: 0, y: 0, visible: false })
    const locked = entity('locked', { x: 0, y: 0, locked: true })
    // 判定模式与本条无关，钉死一种免得跟着默认值漂。
    expect(resolveMarqueeSelection(query(
      { x: -10, y: -10, width: 400, height: 100 },
      { direction: 'rtl' },
      [left, right, hidden, locked],
    ))).toEqual([ROOT_FRAME_ID, 'left', 'right'])
  })

  it('OpenSpec: 按确定性场景顺序返回并保留既有选区顺序', () => {
    const area = { x: -10, y: -10, width: 400, height: 100 }
    const crossing = { direction: 'rtl' } as const
    expect(resolveMarqueeSelection(query(area, crossing)))
      .toEqual([ROOT_FRAME_ID, 'left', 'right'])
    // 既有选区顺序来自宿主的交互顺序，加选只在其后追加新命中。
    expect(resolveMarqueeSelection(query(area, { ...crossing, base: ['right'], combine: 'add' })))
      .toEqual(['right', ROOT_FRAME_ID, 'left'])
  })

  it('OpenSpec: Shift 加选与 Alt 减选', () => {
    const leftOnly = { x: -10, y: -10, width: 60, height: 70 }
    const crossing = { direction: 'rtl' } as const
    expect(resolveMarqueeSelection(query(leftOnly, { ...crossing, base: ['right'], combine: 'add' })))
      .toEqual(['right', ROOT_FRAME_ID, 'left'])
    expect(resolveMarqueeSelection(
      query(leftOnly, { ...crossing, base: ['left', 'right'], combine: 'add' }),
    )).toEqual(['left', 'right', ROOT_FRAME_ID])
    expect(resolveMarqueeSelection(
      query(leftOnly, { ...crossing, base: ['left', 'right'], combine: 'subtract' }),
    )).toEqual(['right'])
  })

  it('在画板内部拖框不选中画板本身', () => {
    // 完全落在根 Frame 内部的框表达的是"选这些子级"；把画板一并选中会让紧接着的移动
    // 整体搬走画板。
    expect(resolveMarqueeSelection(query({ x: 0, y: 0, width: 400, height: 100 })))
      .toEqual(['left', 'right'])
  })

  it('OpenSpec: 退化空框不命中任何节点', () => {
    const click = { x: 10, y: 10, width: 0, height: 0 }
    expect(resolveMarqueeSelection(query(click))).toEqual([])
    // 退化框不该把既有选区当成命中而误删。
    expect(resolveMarqueeSelection(query(click, { base: ['left'], combine: 'add' })))
      .toEqual(['left'])
    expect(resolveMarqueeSelection(query(click, { base: ['left'], combine: 'subtract' })))
      .toEqual(['left'])
  })
})
