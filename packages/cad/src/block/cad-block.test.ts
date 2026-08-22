import { describe, expect, it } from 'vitest'
import {
  createCadLineEntity,
  createEmptyCadDocument,
  validateCadDocument,
  type CadBlockDefinition,
  type CadDocument,
} from '../document'
import { findCadHit, findCadEntitiesInBounds, cadSelectionBoundsFromDrag } from '../selection'
import { findCadSnap } from '../snap'
import { parseComposeCadDocument, serializeComposeCadDocument } from '../store'
import { collectCadVisibleSegments } from './cad-block-expand'
import { createCadInsert, transformCadBlockPoint } from './cad-block-transform'

/** 一个 10×10 的方角符号：从原点向右 10、再向下 10。 */
function corner(id = 'block-1'): CadBlockDefinition {
  return {
    id,
    name: 'CORNER',
    rootIds: ['m1', 'm2'],
    entities: {
      m1: createCadLineEntity('m1', { layerId: '0', start: { x: 0, y: 0 }, end: { x: 10, y: 0 } }),
      m2: createCadLineEntity('m2', { layerId: '0', start: { x: 10, y: 0 }, end: { x: 10, y: 10 } }),
    },
  }
}

function documentWithInsert(
  insertOverrides: Parameters<typeof createCadInsert>[2] = {},
  position = { x: 100, y: 100 },
): CadDocument {
  const base = createEmptyCadDocument()
  const block = corner()
  return {
    ...base,
    blocks: { [block.id]: block },
    rootIds: ['i1'],
    entities: {
      i1: {
        id: 'i1',
        name: 'CORNER',
        components: {
          CadPlacement: { layerId: '0' },
          CadInsert: createCadInsert(block.id, position, insertOverrides),
        },
      },
    },
  }
}

describe('OpenSpec: cad-document / CAD 块实例 / 实例按插入参数变换块几何', () => {
  it('比例、旋转、平移依次作用', () => {
    const insert = createCadInsert('b', { x: 100, y: 50 }, { rotation: 90, scale: { x: 2, y: 2 } })

    // (10,0) 放大两倍成 (20,0)，顺时针转 90° 成 (0,20)，再平移到插入点。
    const moved = transformCadBlockPoint({ x: 10, y: 0 }, insert)
    expect(moved.x).toBeCloseTo(100)
    expect(moved.y).toBeCloseTo(70)
  })

  it('顺序是比例→旋转→平移，不是先平移', () => {
    // 先平移再旋转会绕世界原点转，符号会甩到图纸另一头——这条用例就是拦它的。
    const insert = createCadInsert('b', { x: 1000, y: 0 }, { rotation: 180 })
    const moved = transformCadBlockPoint({ x: 10, y: 0 }, insert)

    expect(moved.x).toBeCloseTo(990)
    expect(moved.y).toBeCloseTo(0)
  })

  it('原点始终落在插入点上', () => {
    const insert = createCadInsert('b', { x: 42, y: 7 }, { rotation: 33, scale: { x: 3, y: -2 } })

    expect(transformCadBlockPoint({ x: 0, y: 0 }, insert)).toEqual({ x: 42, y: 7 })
  })
})

describe('OpenSpec: cad-document / CAD 块实例 / 负比例镜像符号', () => {
  it('x 轴负比例把符号左右翻转', () => {
    const insert = createCadInsert('b', { x: 0, y: 0 }, { scale: { x: -1, y: 1 } })

    expect(transformCadBlockPoint({ x: 10, y: 5 }, insert)).toEqual({ x: -10, y: 5 })
  })
})

describe('OpenSpec: cad-document / CAD 块实例 / 改块定义，全部实例跟着变', () => {
  it('两个实例共享同一份定义，改定义两处同时变', () => {
    const base = createEmptyCadDocument()
    const block = corner()
    const document: CadDocument = {
      ...base,
      blocks: { [block.id]: block },
      rootIds: ['i1', 'i2'],
      entities: {
        i1: {
          id: 'i1',
          name: 'A',
          components: {
            CadPlacement: { layerId: '0' },
            CadInsert: createCadInsert(block.id, { x: 0, y: 0 }),
          },
        },
        i2: {
          id: 'i2',
          name: 'B',
          components: {
            CadPlacement: { layerId: '0' },
            CadInsert: createCadInsert(block.id, { x: 100, y: 0 }),
          },
        },
      },
    }

    expect(collectCadVisibleSegments(document)).toHaveLength(4)

    // 把定义里的第一段拉长一倍，两个实例的几何同时改变——不必逐个更新实例。
    const longer: CadBlockDefinition = {
      ...block,
      entities: {
        ...block.entities,
        m1: createCadLineEntity('m1', { layerId: '0', start: { x: 0, y: 0 }, end: { x: 20, y: 0 } }),
      },
    }
    const changed = collectCadVisibleSegments({ ...document, blocks: { [block.id]: longer } })

    expect(changed.filter(({ ownerId }) => ownerId === 'i1')[0]!.segment.end.x).toBe(20)
    expect(changed.filter(({ ownerId }) => ownerId === 'i2')[0]!.segment.end.x).toBe(120)
  })
})

describe('OpenSpec: cad-document / 块实例参与命中、框选与捕捉', () => {
  it('捕捉到块实例内线段的端点', () => {
    const document = documentWithInsert()

    // 定义里 (10,10) 是第二段的终点；插到 (100,100) 之后世界坐标是 (110,110)。
    const snap = findCadSnap(document, { x: 111, y: 111 }, 5)
    expect(snap).toMatchObject({ mode: 'endpoint', point: { x: 110, y: 110 } })
  })

  it('点选块实例得到实例而不是块内图元', () => {
    const document = documentWithInsert()

    expect(findCadHit(document, { x: 105, y: 100 }, 5)).toBe('i1')
  })

  it('窗口模式要求实例整体落在框内', () => {
    const document = documentWithInsert()
    // 实例占据 (100,100)-(110,110)。
    const partial = cadSelectionBoundsFromDrag({ x: 95, y: 95 }, { x: 105, y: 105 })
    const whole = cadSelectionBoundsFromDrag({ x: 90, y: 90 }, { x: 120, y: 120 })

    expect(findCadEntitiesInBounds(document, partial, 'window')).toEqual([])
    expect(findCadEntitiesInBounds(document, whole, 'window')).toEqual(['i1'])
    // 交叉只要碰到一段即可。
    expect(findCadEntitiesInBounds(document, partial, 'crossing')).toEqual(['i1'])
  })
})

describe('OpenSpec: cad-document / CAD 块定义表', () => {
  it('块内图元不算顶层孤儿', () => {
    const result = validateCadDocument(documentWithInsert())

    expect(result.valid).toBe(true)
  })

  it('拒绝嵌套块，错误路径指向那条图元', () => {
    const document = documentWithInsert()
    const block = corner()
    const nested = validateCadDocument({
      ...document,
      blocks: {
        [block.id]: {
          ...block,
          rootIds: [...block.rootIds, 'inner'],
          entities: {
            ...block.entities,
            inner: {
              id: 'inner',
              name: 'inner',
              components: {
                CadPlacement: { layerId: '0' },
                CadInsert: createCadInsert(block.id, { x: 0, y: 0 }),
              },
            },
          },
        },
      },
    })

    expect(nested.valid).toBe(false)
    if (nested.valid) return
    expect(nested.issues.some(({ code, path }) => code === 'block.nested-insert'
      && path.join('/') === 'blocks/block-1/entities/inner')).toBe(true)
  })

  it('悬空块引用被拒绝', () => {
    const document = documentWithInsert()
    const result = validateCadDocument({ ...document, blocks: {} })

    expect(result.valid).toBe(false)
    if (result.valid) return
    expect(result.issues.some(({ code }) => code === 'insert.unknown-block')).toBe(true)
  })

  it('块表随文件往返，不被序列化丢掉', () => {
    const document = documentWithInsert()
    const text = serializeComposeCadDocument(document)
    const parsed = parseComposeCadDocument(text)

    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.document.blocks).toEqual(document.blocks)
  })

  it('旧文档按空块表读入', () => {
    const withoutBlocks: Record<string, unknown> = { ...createEmptyCadDocument() }
    delete withoutBlocks.blocks
    const result = validateCadDocument(withoutBlocks)

    expect(result.valid).toBe(true)
    if (!result.valid) return
    expect(result.document.blocks).toEqual({})
    expect(result.document.schemaVersion).toBe(1)
  })
})
