import { describe, expect, it } from 'vitest'
import { createDocumentTransactionRuntime } from '@compose-ui/core'
import type { DocumentValidationIssueShape } from '@compose-ui/core'
import {
  createCadPolylineEntity,
  createEmptyCadDocument,
  getCadPolyline,
  validateCadDocument,
  type CadDocument,
} from '../document'
import { cadPolylineSegments, isDegenerateCadPolyline } from '../geometry'
import { findCadEntitiesInBounds, findCadHit } from '../selection'
import { findCadSnap } from '../snap'
import { translateCadEntity } from '../transform'
import {
  cadTestCommandMessages as messages,
  createCadTestCommandContext as context,
} from '../test-fixtures'
import { createCadCommandHandlers } from '../command/cad-command-handlers'
import {
  createCadPolylineSession,
  createCadRectangleSession,
} from '../command/cad-polyline-commands'
import { collectCadVisibleGeometry } from './cad-block-expand'
import { createCadInsert } from './cad-block-transform'

/** (100,100) 到 (200,150) 的闭合矩形。 */
const RECT = [
  { x: 100, y: 100 },
  { x: 200, y: 100 },
  { x: 200, y: 150 },
  { x: 100, y: 150 },
]

function documentWithRect(closed = true): CadDocument {
  return {
    ...createEmptyCadDocument(),
    rootIds: ['p1'],
    entities: {
      p1: createCadPolylineEntity('p1', { layerId: '0', vertices: RECT, closed }),
    },
  }
}

describe('OpenSpec: cad-document / CAD 多段线图元', () => {
  it('闭合比开放多一段', () => {
    expect(cadPolylineSegments(RECT, false)).toHaveLength(3)
    expect(cadPolylineSegments(RECT, true)).toHaveLength(4)
    // 两个点「闭合」出来的是同一条线来回走一遍，因此不补那一段。
    expect(cadPolylineSegments(RECT.slice(0, 2), true)).toHaveLength(1)
  })

  it('闭合的那一段接回首点', () => {
    const segments = cadPolylineSegments(RECT, true)
    expect(segments[3]).toEqual({ start: RECT[3], end: RECT[0] })
  })

  it('闭合四顶点在名字上就是矩形', () => {
    expect(documentWithRect().entities.p1!.name).toBe('Rectangle')
    expect(documentWithRect(false).entities.p1!.name).toBe('Polyline')
  })

  it('退化的多段线被拒绝', () => {
    expect(isDegenerateCadPolyline([{ x: 1, y: 1 }])).toBe(true)
    expect(isDegenerateCadPolyline([{ x: 1, y: 1 }, { x: 1, y: 1 }])).toBe(true)
    expect(isDegenerateCadPolyline(RECT)).toBe(false)

    for (const vertices of [[{ x: 1, y: 1 }], [{ x: 1, y: 1 }, { x: 1, y: 1 }]]) {
      const result = validateCadDocument({
        ...createEmptyCadDocument(),
        rootIds: ['p1'],
        entities: {
          p1: createCadPolylineEntity('p1', { layerId: '0', vertices, closed: false }),
        },
      })
      expect(result.valid).toBe(false)
      if (!result.valid) {
        expect(result.issues.map(({ code }) => code)).toContain('entity.invalid-geometry')
      }
    }
  })

  it('合法的矩形通过校验', () => {
    expect(validateCadDocument(documentWithRect()).valid).toBe(true)
  })
})

describe('OpenSpec: cad-document / CAD 多段线在遍历中展开为线段', () => {
  it('展开后各段共用同一个 ownerId', () => {
    const geometry = collectCadVisibleGeometry(documentWithRect())
    expect(geometry).toHaveLength(4)
    expect(new Set(geometry.map(({ ownerId }) => ownerId))).toEqual(new Set(['p1']))
    expect(geometry.every(({ geometry: shape }) => shape.kind === 'segment')).toBe(true)
  })

  it('点中任意一段选中的都是整条', () => {
    const document = documentWithRect()
    // 上边、右边、闭合那条左边，都指向同一个 Entity。
    expect(findCadHit(document, { x: 150, y: 100 }, 2)).toBe('p1')
    expect(findCadHit(document, { x: 200, y: 125 }, 2)).toBe('p1')
    expect(findCadHit(document, { x: 100, y: 125 }, 2)).toBe('p1')
    // 框内部是空的——多段线没有填充。
    expect(findCadHit(document, { x: 150, y: 125 }, 2)).toBeNull()
  })

  it('窗口框选要求整条在框内', () => {
    const document = documentWithRect()
    expect(findCadEntitiesInBounds(document, {
      minX: 90, minY: 90, maxX: 210, maxY: 160,
    }, 'window')).toEqual(['p1'])
    // 只盖住左半边：窗口不选、交叉选。
    const half = { minX: 90, minY: 90, maxX: 150, maxY: 160 }
    expect(findCadEntitiesInBounds(document, half, 'window')).toEqual([])
    expect(findCadEntitiesInBounds(document, half, 'crossing')).toEqual(['p1'])
  })

  it('顶点是端点、各段有中点', () => {
    const document = documentWithRect()
    expect(findCadSnap(document, { x: 201, y: 101 }, 3))
      .toEqual({ mode: 'endpoint', point: { x: 200, y: 100 } })
    expect(findCadSnap(document, { x: 150, y: 101 }, 3))
      .toEqual({ mode: 'midpoint', point: { x: 150, y: 100 } })
  })

  it('开放的多段线没有闭合那一段', () => {
    // 左边那条只在闭合时存在。
    expect(findCadHit(documentWithRect(false), { x: 100, y: 125 }, 2)).toBeNull()
    expect(findCadHit(documentWithRect(true), { x: 100, y: 125 }, 2)).toBe('p1')
  })

  it('块内多段线同样展开并经实例变换', () => {
    const document: CadDocument = {
      ...createEmptyCadDocument(),
      blocks: {
        'block-1': {
          id: 'block-1',
          name: 'BOX',
          rootIds: ['m1'],
          entities: {
            m1: createCadPolylineEntity('m1', {
              layerId: '0',
              vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }],
              closed: true,
            }),
          },
          ports: [],
        },
      },
      rootIds: ['i1'],
      entities: {
        i1: {
          id: 'i1',
          name: 'BOX',
          components: {
            CadPlacement: { layerId: '0' },
            CadInsert: createCadInsert('block-1', { x: 100, y: 100 }, { scale: { x: 2, y: 2 } }),
          },
        },
      },
    }
    const geometry = collectCadVisibleGeometry(document)
    expect(geometry).toHaveLength(4)
    expect(new Set(geometry.map(({ ownerId }) => ownerId))).toEqual(new Set(['i1']))
    // 局部 (10,10) 经 2 倍缩放与平移落到世界 (120,120)。
    expect(findCadHit(document, { x: 120, y: 110 }, 2)).toBe('i1')
  })
})

describe('OpenSpec: cad-document / CAD 几何位移 / 多段线全部顶点平移', () => {
  it('闭合标志不变', () => {
    const moved = translateCadEntity(documentWithRect().entities.p1!, { x: 5, y: -5 })
    expect(getCadPolyline(moved)).toEqual({
      vertices: [
        { x: 105, y: 95 },
        { x: 205, y: 95 },
        { x: 205, y: 145 },
        { x: 105, y: 145 },
      ],
      closed: true,
    })
  })
})

describe('OpenSpec: cad-document / CAD PLINE 与 RECTANG 命令', () => {
  function runtime() {
    return createDocumentTransactionRuntime<CadDocument, DocumentValidationIssueShape>({
      document: createEmptyCadDocument(),
      validate: validateCadDocument,
      handlers: createCadCommandHandlers(),
    })
  }

  it('一条多段线是一个 Entity', () => {
    const session = createCadPolylineSession(context())
    for (const point of RECT) session.advance({ kind: 'point', point })
    const step = session.advance({ kind: 'keyword', key: 'F' })
    expect(step.status).toBe('commit')
    if (step.status !== 'commit' || !step.effect.command) return

    const store = runtime()
    expect(store.dispatch(step.effect.command).status).toBe('committed')
    expect(store.document.rootIds).toHaveLength(1)
    expect(getCadPolyline(store.document.entities.p1 ?? store.document.entities[
      store.document.rootIds[0]!
    ]!)?.vertices).toHaveLength(4)

    store.undo()
    expect(store.document.rootIds).toEqual([])
  })

  it('闭合关键字接回首点', () => {
    const session = createCadPolylineSession(context())
    for (const point of RECT.slice(0, 3)) session.advance({ kind: 'point', point })
    const step = session.advance({ kind: 'keyword', key: 'c' })
    if (step.status !== 'commit' || !step.effect.command) throw new Error('应当提交')
    const payload = step.effect.command.payload as unknown as {
      entity: { components: { CadPolyline: { closed: boolean } } }
    }
    expect(payload.entity.components.CadPolyline.closed).toBe(true)
    // 闭合之后线段数等于顶点数。
    expect(step.effect.segments).toHaveLength(3)
  })

  it('两个点不能闭合', () => {
    const session = createCadPolylineSession(context())
    for (const point of RECT.slice(0, 2)) session.advance({ kind: 'point', point })
    expect(session.advance({ kind: 'keyword', key: 'C' }).status).toBe('rejected')
  })

  it('只放了一个点就结束时不写入', () => {
    const session = createCadPolylineSession(context())
    session.advance({ kind: 'point', point: RECT[0]! })
    expect(session.advance({ kind: 'accept' }).status).toBe('cancelled')
  })

  it('放弃退回上一个顶点', () => {
    const session = createCadPolylineSession(context())
    for (const point of RECT.slice(0, 3)) session.advance({ kind: 'point', point })
    const step = session.advance({ kind: 'keyword', key: 'U' })
    expect(step.status).toBe('prompt')
    if (step.status !== 'prompt') return
    expect(step.preview?.reference).toEqual(RECT[1])
  })

  it('两点画矩形', () => {
    const session = createCadRectangleSession(context())
    expect(session.prompt?.message).toBe(messages.rectangleFirstCorner)
    session.advance({ kind: 'point', point: { x: 100, y: 100 } })
    expect(session.prompt?.message).toBe(messages.rectangleSecondCorner)
    const step = session.advance({ kind: 'point', point: { x: 200, y: 150 } })
    if (step.status !== 'commit' || !step.effect.command) throw new Error('应当提交')

    const store = runtime()
    expect(store.dispatch(step.effect.command).status).toBe('committed')
    const polyline = getCadPolyline(store.document.entities[store.document.rootIds[0]!]!)
    expect(polyline).toEqual({ vertices: RECT, closed: true })
  })

  it('共线的两个角点被拒绝且停在原提示', () => {
    const session = createCadRectangleSession(context())
    session.advance({ kind: 'point', point: { x: 100, y: 100 } })
    expect(session.advance({ kind: 'point', point: { x: 200, y: 100 } }))
      .toEqual({ status: 'rejected', message: messages.degenerateRectangle })
    expect(session.prompt?.message).toBe(messages.rectangleSecondCorner)
    // 换一个不共线的点仍然能完成。
    expect(session.advance({ kind: 'point', point: { x: 200, y: 150 } }).status).toBe('commit')
  })
})
