import { describe, expect, it } from 'vitest'
import {
  resolveMarqueeHitTest,
  resolveMarqueeSelection,
  type StageMarqueeQuery,
} from './marquee-selection'
import { createStageSceneIndex } from './scene-index'
import { document, entity, layoutSnapshot } from '../test-fixtures'

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
    // 框右边缘停在 left 内部，只压住它的一半。框从场景外面起手，但场景不是内容，不进结果。
    expect(resolveMarqueeSelection(query(
      { x: -10, y: -10, width: 60, height: 70 },
      { direction: 'rtl' },
    ))).toEqual(['left'])
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
      .toEqual(['left'])
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
    ))).toEqual(['left', 'right'])
  })

  it('OpenSpec: 按确定性场景顺序返回并保留既有选区顺序', () => {
    const area = { x: -10, y: -10, width: 400, height: 100 }
    const crossing = { direction: 'rtl' } as const
    expect(resolveMarqueeSelection(query(area, crossing)))
      .toEqual(['left', 'right'])
    // 既有选区顺序来自宿主的交互顺序，加选只在其后追加新命中。
    expect(resolveMarqueeSelection(query(area, { ...crossing, base: ['right'], combine: 'add' })))
      .toEqual(['right', 'left'])
  })

  it('OpenSpec: Shift 加选与 Alt 减选', () => {
    const leftOnly = { x: -10, y: -10, width: 60, height: 70 }
    const crossing = { direction: 'rtl' } as const
    expect(resolveMarqueeSelection(query(leftOnly, { ...crossing, base: ['right'], combine: 'add' })))
      .toEqual(['right', 'left'])
    expect(resolveMarqueeSelection(
      query(leftOnly, { ...crossing, base: ['left', 'right'], combine: 'add' }),
    )).toEqual(['left', 'right'])
    expect(resolveMarqueeSelection(
      query(leftOnly, { ...crossing, base: ['left', 'right'], combine: 'subtract' }),
    )).toEqual(['right'])
  })

  it('在场景内部拖框不选中场景本身', () => {
    // 完全落在根 Frame 内部的框表达的是"选这些子级"；把场景一并选中会让紧接着的移动
    // 整体搬走场景。
    expect(resolveMarqueeSelection(query({ x: 0, y: 0, width: 400, height: 100 })))
      .toEqual(['left', 'right'])
  })

  it('OpenSpec: 窗交框蹭到场景边缘不选中场景', () => {
    // 从工作区往回拖的窗交框蹭到场景边缘曾经会把整块场景选中，而紧接着的移动会把它搬走——
    // 子级是相对坐标，画面上看不出发生了什么。
    expect(resolveMarqueeSelection(query(
      { x: -40, y: -40, width: 30, height: 30 },
      { direction: 'rtl' },
    ))).toEqual([])
  })

  it('OpenSpec: 从外面完全框住场景也不选中它', () => {
    // 排除不看框与场景的相对位置：选场景走标题标签、command 点体或场景树。
    expect(resolveMarqueeSelection(query(
      { x: -500, y: -500, width: 3000, height: 3000 },
      { direction: 'ltr' },
    ))).toEqual(['left', 'right'])
  })

  it('OpenSpec: 嵌套 Frame 保持既有排除规则', () => {
    // 嵌套 Frame 没有标题标签，点体仍是唯一的画布选中入口，一并排除会让它够不着。
    const nested = entity('nested', { x: 0, y: 0, width: 200, height: 200, childIds: [] })
    const nestedFrame = {
      ...nested,
      components: { ...nested.components, Frame: { size: { width: 200, height: 200 }, guides: [] } },
    }
    const inside = { x: 20, y: 20, width: 60, height: 60 }
    expect(resolveMarqueeSelection(query(inside, { direction: 'rtl' }, [nestedFrame])))
      .toEqual([])
    const around = { x: -20, y: -20, width: 400, height: 400 }
    expect(resolveMarqueeSelection(query(around, { direction: 'ltr' }, [nestedFrame])))
      .toEqual(['nested'])
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

/*
 * 框选对 `path` 同样走几何而不是世界 AABB。判别点仍是包围盒的空角：一个只盖住空角的窗交框
 * 在按盒判定的实现上会选中它。
 */
describe('OpenSpec: stage-engine / 框选按几何判定 / path', () => {
  const bulge = entity('bulge', { x: 100, y: 100, width: 100, height: 75 })
  const pathNode = {
    ...bulge,
    components: {
      ...bulge.components,
      Renderer: { type: 'curve', props: {} },
      Curve: {
        kind: 'path',
        subpaths: [{
          start: { x: 0, y: 0 },
          segments: [{ c1: { x: 0, y: 100 }, c2: { x: 100, y: 100 }, to: { x: 100, y: 0 } }],
          closed: false,
        }],
      },
    },
  }

  it('只盖住包围盒空角的窗交框不选中', () => {
    expect(resolveMarqueeSelection(query(
      { x: 130, y: 101, width: 40, height: 10 },
      { direction: 'rtl' },
      [pathNode],
    ))).toEqual([])
  })

  it('盖住曲线的窗交框选中', () => {
    expect(resolveMarqueeSelection(query(
      { x: 130, y: 165, width: 40, height: 20 },
      { direction: 'rtl' },
      [pathNode],
    ))).toEqual(['bulge'])
  })
})
