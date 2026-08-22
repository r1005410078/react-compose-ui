import { describe, expect, it } from 'vitest'
import {
  createCadArcEntity,
  createCadLineEntity,
  createEmptyCadDocument,
  getCadArc,
  validateCadDocument,
  type CadBlockDefinition,
  type CadDocument,
} from '../document'
import { findCadEntitiesInBounds, findCadHit } from '../selection'
import { findCadSnap } from '../snap'
import { translateCadEntity } from '../transform'
import { arcMidpoint } from '../geometry'
import { collectCadVisibleCurves } from './cad-block-expand'
import { createCadInsert } from './cad-block-transform'

/** 圆心 (100,100)、半径 20、从 0° 顺时针扫 90° 的弧。 */
function documentWithArc(sweep = 90): CadDocument {
  return {
    ...createEmptyCadDocument(),
    rootIds: ['a1'],
    entities: {
      a1: createCadArcEntity('a1', {
        layerId: '0',
        center: { x: 100, y: 100 },
        radius: 20,
        startAngle: 0,
        sweep,
      }),
    },
  }
}

/** 一个块：一条线 + 一段四分之一弧，都在块局部坐标。 */
function symbolBlock(): CadBlockDefinition {
  return {
    id: 'block-1',
    name: 'SYMBOL',
    rootIds: ['m1', 'm2'],
    entities: {
      m1: createCadLineEntity('m1', { layerId: '0', start: { x: 0, y: 0 }, end: { x: 10, y: 0 } }),
      m2: createCadArcEntity('m2', {
        layerId: '0',
        center: { x: 10, y: 0 },
        radius: 5,
        startAngle: 0,
        sweep: 90,
      }),
    },
    ports: [],
  }
}

function documentWithInstance(scale: { x: number, y: number }, rotation = 0): CadDocument {
  return {
    ...createEmptyCadDocument(),
    blocks: { 'block-1': symbolBlock() },
    rootIds: ['i1'],
    entities: {
      i1: {
        id: 'i1',
        name: 'SYMBOL',
        components: {
          CadPlacement: { layerId: '0' },
          CadInsert: createCadInsert('block-1', { x: 100, y: 100 }, { rotation, scale }),
        },
      },
    },
  }
}

describe('OpenSpec: cad-document / CAD 可见几何遍历', () => {
  it('圆弧原样进入遍历，不被拍扁成线段', () => {
    const curves = collectCadVisibleCurves(documentWithArc())
    expect(curves).toHaveLength(1)
    expect(curves[0]!.curve.kind).toBe('arc')
  })

  it('隐藏图层上的圆弧不参与', () => {
    const document = documentWithArc()
    expect(collectCadVisibleCurves({
      ...document,
      layers: document.layers.map((layer) => ({ ...layer, visible: false })),
    })).toEqual([])
  })
})

describe('OpenSpec: cad-document / CAD 圆弧图元', () => {
  it('整圆是扫掠 360 的弧，命名跟着变', () => {
    expect(getCadArc(documentWithArc(360).entities.a1!)?.sweep).toBe(360)
    expect(documentWithArc(360).entities.a1!.name).toBe('Circle')
    expect(documentWithArc(90).entities.a1!.name).toBe('Arc')
  })

  it('半径非正或角度非有限被拒绝', () => {
    const withRadius = (radius: number) => validateCadDocument({
      ...documentWithArc(),
      entities: {
        a1: createCadArcEntity('a1', {
          layerId: '0',
          center: { x: 0, y: 0 },
          radius,
          startAngle: 0,
          sweep: 90,
        }),
      },
    })
    expect(withRadius(20).valid).toBe(true)
    for (const bad of [0, -5, Number.NaN]) {
      const result = withRadius(bad)
      expect(result.valid).toBe(false)
      if (!result.valid) {
        expect(result.issues.map(({ code }) => code)).toContain('entity.invalid-geometry')
      }
    }
  })

  it('既有文档不含圆弧，仍然合法', () => {
    expect(validateCadDocument(createEmptyCadDocument()).valid).toBe(true)
  })
})

describe('OpenSpec: cad-document / CAD 圆弧的命中与框选', () => {
  it('点在圆心不命中，点在弧上命中', () => {
    const document = documentWithArc()
    expect(findCadHit(document, { x: 100, y: 100 }, 5)).toBeNull()
    expect(findCadHit(document, { x: 120, y: 100 }, 5)).toBe('a1')
    // 扫掠外的同半径方位不命中。
    expect(findCadHit(document, { x: 80, y: 100 }, 5)).toBeNull()
  })

  it('窗口框选用紧包围盒', () => {
    const document = documentWithArc()
    // 这个框套住了 0–90° 的弧，但套不住整圆的包围盒。
    const bounds = { minX: 99, minY: 99, maxX: 121, maxY: 121 }
    expect(findCadEntitiesInBounds(document, bounds, 'window')).toEqual(['a1'])
    expect(findCadEntitiesInBounds(documentWithArc(360), bounds, 'window')).toEqual([])
  })

  it('交叉框选碰到弧就算', () => {
    const bounds = { minX: 115, minY: 95, maxX: 125, maxY: 105 }
    expect(findCadEntitiesInBounds(documentWithArc(), bounds, 'crossing')).toEqual(['a1'])
    // 框在圆内部而不碰弧线：交叉也不选中。
    const inner = { minX: 98, minY: 98, maxX: 102, maxY: 102 }
    expect(findCadEntitiesInBounds(documentWithArc(), inner, 'crossing')).toEqual([])
  })
})

describe('OpenSpec: cad-document / CAD 圆心与象限点捕捉', () => {
  it('圆心可捕捉', () => {
    expect(findCadSnap(documentWithArc(), { x: 101, y: 101 }, 5))
      .toEqual({ mode: 'center', point: { x: 100, y: 100 } })
  })

  it('端点压过圆心', () => {
    // 半径 20 的弧，端点 (120,100) 与圆心 (100,100) 相距 20；把半径开到 30 让两者同时入选。
    const snap = findCadSnap(documentWithArc(), { x: 101, y: 100 }, 30)
    expect(snap?.mode).toBe('endpoint')
  })

  it('扫掠外的象限点不是候选', () => {
    // 180° 方位（80,100）不在 0–90° 的弧上。
    const snap = findCadSnap(documentWithArc(), { x: 80, y: 100 }, 3)
    expect(snap).toBeNull()
    expect(findCadSnap(documentWithArc(360), { x: 80, y: 100 }, 3)?.mode).toBe('quadrant')
  })

  it('整圆没有端点也没有中点', () => {
    // 起始角写在 0°，因此 (120,100) 处若有端点候选，它会压过象限点——而那个「端点」只是
    // 「起始角写在哪」的产物。
    expect(findCadSnap(documentWithArc(360), { x: 120, y: 100 }, 3)?.mode).toBe('quadrant')
    expect(findCadSnap(documentWithArc(90), { x: 120, y: 100 }, 3)?.mode).toBe('endpoint')
  })
})

describe('OpenSpec: cad-document / CAD 几何位移 / 圆弧只移圆心', () => {
  it('半径与角度不变', () => {
    const moved = translateCadEntity(documentWithArc().entities.a1!, { x: 5, y: -5 })
    expect(getCadArc(moved)).toEqual({
      center: { x: 105, y: 95 },
      radius: 20,
      startAngle: 0,
      sweep: 90,
    })
  })
})

describe('OpenSpec: cad-document / CAD 块内圆弧的缩放', () => {
  const arcOf = (document: CadDocument) => {
    const found = collectCadVisibleCurves(document).find(({ curve }) => curve.kind === 'arc')
    return found?.curve.kind === 'arc' ? found.curve : null
  }

  it('等比缩放仍是精确弧', () => {
    const arc = arcOf(documentWithInstance({ x: 2, y: 2 }))!
    expect(arc.center).toEqual({ x: 120, y: 100 })
    expect(arc.radius).toBe(10)
    expect(arc.sweep).toBe(90)
  })

  it('镜像翻转弧的走向', () => {
    const arc = arcOf(documentWithInstance({ x: -1, y: 1 }))!
    expect(arc.sweep).toBe(-90)
    // 局部 (10,0) 的圆心镜像到 (90,100)；局部 90° 处的点 (10,5) 镜像到 (90,105)。
    expect(arc.center).toEqual({ x: 90, y: 100 })
    const end = arcMidpoint({ ...arc, sweep: arc.sweep * 2 })
    expect(end.x).toBeCloseTo(90)
    expect(end.y).toBeCloseTo(105)
  })

  it('两轴同时镜像等于旋转 180°，不翻转走向', () => {
    expect(arcOf(documentWithInstance({ x: -1, y: -1 }))!.sweep).toBe(90)
  })

  it('非等比缩放降级为线段但形状仍对', () => {
    const document = documentWithInstance({ x: 2, y: 1 })
    expect(arcOf(document)).toBeNull()
    const curves = collectCadVisibleCurves(document)
    // 一条线段（块内直线）加上拍扁出来的若干段。
    expect(curves.length).toBeGreaterThan(2)
    expect(curves.every(({ curve }) => curve.kind === 'segment')).toBe(true)
    // 半轴 (10,5)、圆心 (120,100)。45° 参数处椭圆在 (127.07,103.54)，同角度的圆在
    // (127.07,107.07)——两点相距 3.5，容差 1 足以区分「拍扁的是椭圆」还是「按某一轴硬算成圆」。
    expect(findCadHit(document, { x: 127.07, y: 103.54 }, 1)).toBe('i1')
    expect(findCadHit(document, { x: 127.07, y: 107.07 }, 1)).toBeNull()
  })
})
