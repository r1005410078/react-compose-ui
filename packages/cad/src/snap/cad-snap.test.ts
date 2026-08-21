import { describe, expect, it } from 'vitest'
import { createCadLineEntity, createEmptyCadDocument, type CadDocument } from '../document'
import { resolveCadPoint } from '../point-input'
import { findCadSnap } from './cad-snap'

/** 由若干线段构造一份文档；线段按传入顺序命名。 */
function documentWith(
  segments: readonly { readonly start: { x: number; y: number }; readonly end: { x: number; y: number } }[],
  options: { readonly layerVisible?: boolean } = {},
): CadDocument {
  const base = createEmptyCadDocument()
  const entities = Object.fromEntries(segments.map((segment, index) => {
    const id = `l${index}`
    return [id, createCadLineEntity(id, { layerId: '0', ...segment })]
  }))
  return {
    ...base,
    layers: [{ ...base.layers[0]!, visible: options.layerVisible ?? true }],
    rootIds: Object.keys(entities),
    entities,
  }
}

const horizontal = { start: { x: 0, y: 0 }, end: { x: 100, y: 0 } }
const vertical = { start: { x: 50, y: -50 }, end: { x: 50, y: 50 } }

describe('CAD 对象捕捉', () => {
  it('OpenSpec: cad-document / CAD 对象捕捉 / 端点优先于中点', () => {
    // 端点 (100,0) 与另一条线的中点 (100,0) 重合的构造：端点必须胜出。
    const document = documentWith([horizontal, { start: { x: 90, y: -10 }, end: { x: 110, y: 10 } }])
    expect(findCadSnap(document, { x: 99, y: 1 }, 5)).toEqual({
      mode: 'endpoint',
      point: { x: 100, y: 0 },
    })
  })

  it('同为端点时取更近的那个', () => {
    const document = documentWith([horizontal])
    expect(findCadSnap(document, { x: 4, y: 0 }, 50)?.point).toEqual({ x: 0, y: 0 })
    expect(findCadSnap(document, { x: 96, y: 0 }, 50)?.point).toEqual({ x: 100, y: 0 })
  })

  it('OpenSpec: cad-document / CAD 对象捕捉 / 捕捉到两条线的交点', () => {
    const document = documentWith([horizontal, vertical])
    // 只开交点，避免端点与中点抢先。
    expect(findCadSnap(document, { x: 51, y: 1 }, 5, ['intersection'])).toEqual({
      mode: 'intersection',
      point: { x: 50, y: 0 },
    })

    // 平行不产生交点。
    const parallel = documentWith([horizontal, { start: { x: 0, y: 20 }, end: { x: 100, y: 20 } }])
    expect(findCadSnap(parallel, { x: 50, y: 10 }, 20, ['intersection'])).toBeNull()

    // 延长线相交但不在线段范围内，同样不产生候选。
    const apart = documentWith([horizontal, { start: { x: 200, y: -50 }, end: { x: 200, y: 50 } }])
    expect(findCadSnap(apart, { x: 150, y: 0 }, 60, ['intersection'])).toBeNull()
  })

  it('中点在没有端点竞争时被命中', () => {
    const document = documentWith([horizontal])
    expect(findCadSnap(document, { x: 51, y: 2 }, 5)).toEqual({
      mode: 'midpoint',
      point: { x: 50, y: 0 },
    })
  })

  it('OpenSpec: cad-document / CAD 对象捕捉 / 半径外不捕捉', () => {
    const document = documentWith([horizontal])
    expect(findCadSnap(document, { x: 50, y: 40 }, 5)).toBeNull()
    // 半径非正或没有启用模式时同样不捕捉。
    expect(findCadSnap(document, { x: 0, y: 0 }, 0)).toBeNull()
    expect(findCadSnap(document, { x: 0, y: 0 }, 10, [])).toBeNull()
  })

  it('OpenSpec: cad-document / CAD 对象捕捉 / 隐藏图层不参与捕捉', () => {
    const document = documentWith([horizontal, vertical], { layerVisible: false })
    expect(findCadSnap(document, { x: 0, y: 0 }, 10)).toBeNull()
    expect(findCadSnap(document, { x: 50, y: 0 }, 10, ['intersection'])).toBeNull()
  })

  it('OpenSpec: cad-document / CAD 对象捕捉 / 捕捉压过正交与网格', () => {
    const snapped = { x: 103, y: 47 }
    expect(resolveCadPoint({ x: 999, y: 999 }, 'pointer', {
      snapped,
      reference: { x: 0, y: 0 },
      ortho: true,
      grid: { enabled: true, step: 10 },
    })).toEqual(snapped)
  })

  it('键入坐标仍然压过捕捉', () => {
    // 「显式坐标跳过全部吸附」是总闸，捕捉也在其管辖之下。
    expect(resolveCadPoint({ x: 3, y: 7 }, 'typed', {
      snapped: { x: 100, y: 100 },
      ortho: true,
      grid: { enabled: true, step: 10 },
    })).toEqual({ x: 3, y: 7 })
  })
})
