import { describe, expect, it } from 'vitest'
import { createCadLineEntity, createEmptyCadDocument, type CadDocument } from '../document'
import {
  applyCadSelection,
  cadSelectionBoundsFromDrag,
  cadSelectionModeFromDrag,
  findCadEntitiesInBounds,
  findCadHit,
  pruneCadSelection,
} from './index'

function documentWith(
  lines: readonly {
    readonly id: string
    readonly start: { x: number; y: number }
    readonly end: { x: number; y: number }
    readonly layerId?: string
  }[],
  extraLayers: readonly { id: string; visible: boolean }[] = [],
): CadDocument {
  const base = createEmptyCadDocument()
  const entities = Object.fromEntries(
    lines.map((line) => [
      line.id,
      createCadLineEntity(line.id, {
        layerId: line.layerId ?? '0',
        start: line.start,
        end: line.end,
      }),
    ]),
  )
  return {
    ...base,
    layers: [
      ...base.layers,
      ...extraLayers.map(({ id, visible }) => ({
        id,
        name: id,
        color: '#ffffff',
        visible,
        locked: false,
      })),
    ],
    rootIds: lines.map(({ id }) => id),
    entities,
  }
}

describe('OpenSpec: cad-document / CAD 图元命中 / 命中按距离而不是包围盒', () => {
  it('落在对角线包围盒内但离线段远时不命中', () => {
    // 对角线 (0,0)-(100,100) 的包围盒覆盖整个左下角，但 (90,10) 离线段有 ~56 个单位。
    const document = documentWith([{ id: 'diagonal', start: { x: 0, y: 0 }, end: { x: 100, y: 100 } }])

    expect(findCadHit(document, { x: 90, y: 10 }, 5)).toBeNull()
    expect(findCadHit(document, { x: 50, y: 52 }, 5)).toBe('diagonal')
  })

  it('两条交叉线互不遮挡：各自的容差内都能命中自己', () => {
    const document = documentWith([
      { id: 'a', start: { x: 0, y: 0 }, end: { x: 100, y: 100 } },
      { id: 'b', start: { x: 0, y: 100 }, end: { x: 100, y: 0 } },
    ])

    expect(findCadHit(document, { x: 20, y: 21 }, 5)).toBe('a')
    expect(findCadHit(document, { x: 20, y: 79 }, 5)).toBe('b')
  })

  it('容差外不命中', () => {
    const document = documentWith([{ id: 'a', start: { x: 0, y: 0 }, end: { x: 100, y: 0 } }])

    expect(findCadHit(document, { x: 50, y: 20 }, 5)).toBeNull()
  })

  it('端点之外的延长线上不命中', () => {
    const document = documentWith([{ id: 'a', start: { x: 0, y: 0 }, end: { x: 100, y: 0 } }])

    expect(findCadHit(document, { x: 120, y: 0 }, 5)).toBeNull()
    expect(findCadHit(document, { x: 102, y: 0 }, 5)).toBe('a')
  })
})

describe('OpenSpec: cad-document / CAD 图元命中 / 重叠时取后画的', () => {
  it('同一位置的两条线取 rootIds 靠后的', () => {
    const document = documentWith([
      { id: 'under', start: { x: 0, y: 0 }, end: { x: 100, y: 0 } },
      { id: 'over', start: { x: 0, y: 0 }, end: { x: 100, y: 0 } },
    ])

    expect(findCadHit(document, { x: 50, y: 0 }, 5)).toBe('over')
  })
})

describe('OpenSpec: cad-document / CAD 图元命中 / 隐藏图层不参与命中', () => {
  it('隐藏图层上的线点不到', () => {
    const document = documentWith(
      [{ id: 'a', start: { x: 0, y: 0 }, end: { x: 100, y: 0 }, layerId: 'hidden' }],
      [{ id: 'hidden', visible: false }],
    )

    expect(findCadHit(document, { x: 50, y: 0 }, 5)).toBeNull()
  })
})

describe('OpenSpec: cad-document / CAD 框选的窗口与交叉模式 / 判定模式', () => {
  it('左→右是窗口，右→左是交叉', () => {
    expect(cadSelectionModeFromDrag({ x: 0, y: 0 }, { x: 10, y: 10 })).toBe('window')
    expect(cadSelectionModeFromDrag({ x: 10, y: 0 }, { x: 0, y: 10 })).toBe('crossing')
  })

  it('方向由起终点决定，与归一化后的框无关', () => {
    // 两次拖动的归一化框完全相同，模式必须不同——方向信息不能靠框倒推。
    const forward = cadSelectionBoundsFromDrag({ x: 0, y: 0 }, { x: 10, y: 10 })
    const backward = cadSelectionBoundsFromDrag({ x: 10, y: 10 }, { x: 0, y: 0 })

    expect(forward).toEqual(backward)
    expect(cadSelectionModeFromDrag({ x: 0, y: 0 }, { x: 10, y: 10 })).toBe('window')
    expect(cadSelectionModeFromDrag({ x: 10, y: 10 }, { x: 0, y: 0 })).toBe('crossing')
  })
})

describe('OpenSpec: cad-document / CAD 框选的窗口与交叉模式 / 判定结果', () => {
  const document = documentWith([
    { id: 'inside', start: { x: 10, y: 10 }, end: { x: 20, y: 20 } },
    { id: 'straddling', start: { x: 15, y: 15 }, end: { x: 200, y: 200 } },
    { id: 'outside', start: { x: 300, y: 300 }, end: { x: 400, y: 400 } },
  ])
  const bounds = cadSelectionBoundsFromDrag({ x: 0, y: 0 }, { x: 50, y: 50 })

  it('窗口只选完全包含的', () => {
    expect(findCadEntitiesInBounds(document, bounds, 'window')).toEqual(['inside'])
  })

  it('交叉选相交或包含的', () => {
    expect(findCadEntitiesInBounds(document, bounds, 'crossing')).toEqual(['inside', 'straddling'])
  })

  it('完全穿过选框的线在交叉模式下被选中', () => {
    // 两端都在框外、中间穿过：只判四条边才拦得住它，只判端点包含会漏。
    const crossing = documentWith([{ id: 'through', start: { x: -10, y: 25 }, end: { x: 100, y: 25 } }])

    expect(findCadEntitiesInBounds(crossing, bounds, 'crossing')).toEqual(['through'])
    expect(findCadEntitiesInBounds(crossing, bounds, 'window')).toEqual([])
  })

  it('隐藏图层不被框选', () => {
    const hidden = documentWith(
      [{ id: 'a', start: { x: 10, y: 10 }, end: { x: 20, y: 20 }, layerId: 'hidden' }],
      [{ id: 'hidden', visible: false }],
    )

    expect(findCadEntitiesInBounds(hidden, bounds, 'crossing')).toEqual([])
  })
})

describe('OpenSpec: cad-document / CAD 选择集语义 / 选择集代数', () => {
  it('加入累积且去重', () => {
    let selection = applyCadSelection([], { kind: 'add', ids: ['a'] })
    selection = applyCadSelection(selection, { kind: 'add', ids: ['b'] })
    selection = applyCadSelection(selection, { kind: 'add', ids: ['a'] })

    expect(selection).toEqual(['a', 'b'])
  })

  it('移出只去掉指定的', () => {
    const selection = applyCadSelection(['a', 'b', 'c'], { kind: 'remove', ids: ['b'] })

    expect(selection).toEqual(['a', 'c'])
  })

  it('清空得到空集', () => {
    expect(applyCadSelection(['a'], { kind: 'clear' })).toEqual([])
  })

  it('内容没有变化时原样返回入参，便于按引用判断是否重绘', () => {
    const current = ['a', 'b']

    expect(applyCadSelection(current, { kind: 'add', ids: ['a'] })).toBe(current)
    expect(applyCadSelection(current, { kind: 'remove', ids: ['z'] })).toBe(current)
    expect(applyCadSelection([], { kind: 'clear' })).toEqual([])
  })

  it('剔除已不存在的 Entity', () => {
    expect(pruneCadSelection(['a', 'b'], (id) => id === 'a')).toEqual(['a'])
  })
})
