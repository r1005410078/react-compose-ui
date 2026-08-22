import { segmentAt } from '../test-curves'
import { describe, expect, it } from 'vitest'
import {
  createCadLineEntity,
  createCadWireEntity,
  createEmptyCadDocument,
  validateCadDocument,
  type CadBlockDefinition,
  type CadDocument,
} from '../document'
import { collectCadVisibleGeometry, createCadInsert, inverseCadBlockPoint } from '../block'
import { previewCadTranslate, translateCadEntity } from '../transform'
import { findCadSnap } from '../snap'
import { collectCadInstancePorts, resolveCadPortPoint, resolveCadWireSegment } from './index'

/** 一个 10 长的水平符号，两端各一个端口。 */
function symbol(id = 'block-1'): CadBlockDefinition {
  return {
    id,
    name: 'SYMBOL',
    rootIds: ['m1'],
    entities: {
      m1: createCadLineEntity('m1', { layerId: '0', start: { x: 0, y: 0 }, end: { x: 10, y: 0 } }),
    },
    ports: [
      { id: 'a', position: { x: 0, y: 0 } },
      { id: 'b', position: { x: 10, y: 0 } },
    ],
  }
}

/** 两个实例（100,100）与（300,100），一条导线连接前者的 b 与后者的 a。 */
function wiredDocument(): CadDocument {
  const base = createEmptyCadDocument()
  return {
    ...base,
    blocks: { 'block-1': symbol() },
    rootIds: ['i1', 'i2', 'w1'],
    entities: {
      i1: {
        id: 'i1',
        name: 'SYMBOL',
        components: {
          CadPlacement: { layerId: '0' },
          CadInsert: createCadInsert('block-1', { x: 100, y: 100 }),
        },
      },
      i2: {
        id: 'i2',
        name: 'SYMBOL',
        components: {
          CadPlacement: { layerId: '0' },
          CadInsert: createCadInsert('block-1', { x: 300, y: 100 }),
        },
      },
      w1: createCadWireEntity('w1', {
        layerId: '0',
        start: { kind: 'port', entityId: 'i1', portId: 'b' },
        end: { kind: 'port', entityId: 'i2', portId: 'a' },
      }),
    },
  }
}

describe('OpenSpec: cad-document / CAD 块端口', () => {
  it('端口跟随实例变换', () => {
    const document: CadDocument = {
      ...createEmptyCadDocument(),
      blocks: { 'block-1': symbol() },
      rootIds: ['i1'],
      entities: {
        i1: {
          id: 'i1',
          name: 'SYMBOL',
          components: {
            CadPlacement: { layerId: '0' },
            // 90 度（屏幕顺时针）+ 2 倍：局部 (10,0) 应落到世界 (100,120)。
            CadInsert: createCadInsert('block-1', { x: 100, y: 100 }, {
              rotation: 90,
              scale: { x: 2, y: 2 },
            }),
          },
        },
      },
    }
    const ports = collectCadInstancePorts(document)
    expect(ports.map(({ portId }) => portId)).toEqual(['a', 'b'])
    expect(ports[1]!.point.x).toBeCloseTo(100)
    expect(ports[1]!.point.y).toBeCloseTo(120)
  })

  it('两个实例各按自己的变换解出端口', () => {
    const ports = collectCadInstancePorts(wiredDocument())
    expect(ports).toHaveLength(4)
    expect(resolveCadPortPoint(wiredDocument(), 'i1', 'b')).toEqual({ x: 110, y: 100 })
    expect(resolveCadPortPoint(wiredDocument(), 'i2', 'a')).toEqual({ x: 300, y: 100 })
  })

  it('旧文档按空端口读入', () => {
    const withoutPorts: Record<string, unknown> = { ...symbol() }
    delete withoutPorts.ports
    const result = validateCadDocument({
      ...createEmptyCadDocument(),
      blocks: { 'block-1': withoutPorts },
      rootIds: [],
      entities: {},
    })
    expect(result.valid).toBe(true)
    if (result.valid) expect(result.document.blocks['block-1']!.ports).toEqual([])
  })

  it('端口 id 重复被拒绝', () => {
    const duplicated = { ...symbol(), ports: [
      { id: 'a', position: { x: 0, y: 0 } },
      { id: 'a', position: { x: 10, y: 0 } },
    ] }
    const result = validateCadDocument({
      ...createEmptyCadDocument(),
      blocks: { 'block-1': duplicated },
    })
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.issues.map(({ code }) => code)).toContain('port.duplicate-id')
  })

  it('逆变换在比例为 0 时拒绝而不是产出 Infinity', () => {
    const insert = createCadInsert('block-1', { x: 100, y: 100 }, { scale: { x: 0, y: 1 } })
    expect(inverseCadBlockPoint({ x: 110, y: 100 }, insert)).toBeNull()
  })

  it('逆变换是正变换的逆', () => {
    const insert = createCadInsert('block-1', { x: 40, y: -7 }, {
      rotation: 33,
      scale: { x: 2, y: -1.5 },
    })
    const local = inverseCadBlockPoint({ x: 123, y: 456 }, insert)!
    const back = collectCadInstancePorts({
      ...createEmptyCadDocument(),
      blocks: { 'block-1': {
        ...symbol(),
        ports: [{ id: 'p', position: { x: local.x, y: local.y } }],
      } },
      rootIds: ['i1'],
      entities: {
        i1: {
          id: 'i1',
          name: 'S',
          components: { CadPlacement: { layerId: '0' }, CadInsert: insert },
        },
      },
    })[0]!.point
    expect(back.x).toBeCloseTo(123)
    expect(back.y).toBeCloseTo(456)
  })
})

describe('OpenSpec: cad-document / CAD 导线', () => {
  it('几何由端点解出，导线自身不存坐标', () => {
    const document = wiredDocument()
    expect(resolveCadWireSegment(document, { start: { kind: 'port', entityId: 'i1', portId: 'b' },
      end: { kind: 'port', entityId: 'i2', portId: 'a' } })).toEqual({
      start: { x: 110, y: 100 },
      end: { x: 300, y: 100 },
    })
  })

  it('移动符号，导线跟着走', () => {
    const document = wiredDocument()
    const moved: CadDocument = {
      ...document,
      entities: {
        ...document.entities,
        i1: translateCadEntity(document.entities.i1!, { x: 0, y: 50 }),
      },
    }
    const wire = segmentAt(collectCadVisibleGeometry(moved), 'w1')
    expect(wire.start).toEqual({ x: 110, y: 150 })
    // 另一端没动。
    expect(wire.end).toEqual({ x: 300, y: 100 })
    // 导线自身一个字节都没写。
    expect(moved.entities.w1).toBe(document.entities.w1)
  })

  it('平移只动自由端点，两端绑定则不动', () => {
    const document = wiredDocument()
    expect(translateCadEntity(document.entities.w1!, { x: 5, y: 5 }))
      .toMatchObject({ components: { CadWire: {
        start: { kind: 'port', entityId: 'i1', portId: 'b' },
        end: { kind: 'port', entityId: 'i2', portId: 'a' },
      } } })

    const half = createCadWireEntity('w2', {
      layerId: '0',
      start: { kind: 'port', entityId: 'i1', portId: 'b' },
      end: { kind: 'free', point: { x: 200, y: 200 } },
    })
    expect(translateCadEntity(half, { x: 5, y: 5 })).toMatchObject({ components: { CadWire: {
      start: { kind: 'port', entityId: 'i1', portId: 'b' },
      end: { kind: 'free', point: { x: 205, y: 205 } },
    } } })
  })

  it('导线参与可见性遍历，因此命中、框选与捕捉都看得见它', () => {
    const segments = collectCadVisibleGeometry(wiredDocument())
    expect(segments.filter(({ ownerId }) => ownerId === 'w1')).toHaveLength(1)
    // 导线中点是捕捉候选。
    const snap = findCadSnap(wiredDocument(), { x: 205, y: 100 }, 3, ['midpoint'])
    expect(snap).toEqual({ mode: 'midpoint', point: { x: 205, y: 100 } })
  })
})

describe('OpenSpec: cad-document / CAD 导线端点引用完整性', () => {
  const invalidWith = (
    start: Parameters<typeof createCadWireEntity>[1]['start'],
  ) => validateCadDocument({
    ...wiredDocument(),
    entities: {
      ...wiredDocument().entities,
      w1: createCadWireEntity('w1', {
        layerId: '0',
        start,
        end: { kind: 'free', point: { x: 0, y: 0 } },
      }),
    },
  })

  it('悬空端点、非实例与未知端口各给一个机器码', () => {
    const codes = (result: ReturnType<typeof validateCadDocument>) =>
      result.valid ? [] : result.issues.map(({ code }) => code)

    expect(codes(invalidWith({ kind: 'port', entityId: 'nope', portId: 'a' })))
      .toContain('wire.unknown-entity')
    expect(codes(invalidWith({ kind: 'port', entityId: 'w1', portId: 'a' })))
      .toContain('wire.not-instance')
    expect(codes(invalidWith({ kind: 'port', entityId: 'i1', portId: 'zzz' })))
      .toContain('wire.unknown-port')
  })

  it('切换到未声明该端口的块定义被拒绝', () => {
    const document = wiredDocument()
    const result = validateCadDocument({
      ...document,
      blocks: {
        ...document.blocks,
        'block-2': { ...symbol('block-2'), name: 'OTHER', ports: [{ id: 'x', position: { x: 0, y: 0 } }] },
      },
      entities: {
        ...document.entities,
        i1: {
          ...document.entities.i1!,
          components: {
            ...document.entities.i1!.components,
            CadInsert: createCadInsert('block-2', { x: 100, y: 100 }),
          },
        },
      },
    })
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.issues.map(({ code }) => code)).toContain('wire.unknown-port')
  })

  it('块内不得包含导线', () => {
    const result = validateCadDocument({
      ...createEmptyCadDocument(),
      blocks: {
        'block-1': {
          ...symbol(),
          rootIds: ['m1', 'w'],
          entities: {
            ...symbol().entities,
            w: createCadWireEntity('w', {
              layerId: '0',
              start: { kind: 'free', point: { x: 0, y: 0 } },
              end: { kind: 'free', point: { x: 1, y: 1 } },
            }),
          },
        },
      },
    })
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.issues.map(({ code }) => code)).toContain('block.nested-wire')
  })
})

describe('OpenSpec: cad-document / CAD 端口捕捉', () => {
  it('端口压过端点，即使端点更近', () => {
    // i1 的端口 b 在 (110,100)，符号线段的端点也在 (110,100)——这正是危险的重合情形。
    const snap = findCadSnap(wiredDocument(), { x: 110.5, y: 100 }, 5)
    expect(snap?.mode).toBe('port')
  })

  it('隐藏图层上的实例不产生端口候选', () => {
    const document = wiredDocument()
    const hidden: CadDocument = {
      ...document,
      layers: document.layers.map((layer) => ({ ...layer, visible: false })),
    }
    expect(collectCadInstancePorts(hidden)).toEqual([])
  })
})

describe('OpenSpec: cad-document / CAD 拖动预览与提交同源', () => {
  it('预览文档里导线跟着被拖的设备走', () => {
    const document = wiredDocument()
    const preview = previewCadTranslate(document, ['i1'], { x: 0, y: 50 })
    expect(segmentAt(collectCadVisibleGeometry(preview), 'w1').start)
      .toEqual({ x: 110, y: 150 })
  })

  it('没有可平移的 Entity 时返回入参本身', () => {
    const document = wiredDocument()
    expect(previewCadTranslate(document, ['ghost'], { x: 1, y: 1 })).toBe(document)
  })
})
