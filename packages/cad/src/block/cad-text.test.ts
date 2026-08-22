import { describe, expect, it } from 'vitest'
import { createDocumentTransactionRuntime } from '@compose-ui/core'
import type { DocumentValidationIssueShape } from '@compose-ui/core'
import {
  createCadLineEntity,
  createCadTextEntity,
  createEmptyCadDocument,
  getCadText,
  validateCadDocument,
  type CadDocument,
} from '../document'
import { CAD_TEXT_ADVANCE_RATIO } from '../geometry'
import { findCadEntitiesInBounds, findCadHit } from '../selection'
import { findCadSnap } from '../snap'
import { translateCadEntity } from '../transform'
import {
  cadTestCommandMessages as messages,
  createCadTestCommandContext as context,
} from '../test-fixtures'
import { createCadCommandHandlers } from '../command/cad-command-handlers'
import { CAD_DEFAULT_TEXT_HEIGHT, createCadTextSession } from '../command/cad-text-command'
import { collectCadVisibleGeometry } from './cad-block-expand'
import { createCadInsert } from './cad-block-transform'

/** 锚点 (100,100)、字号 10、四个字符的左对齐标注。 */
function documentWithText(overrides: Record<string, unknown> = {}): CadDocument {
  return {
    ...createEmptyCadDocument(),
    rootIds: ['t1'],
    entities: {
      t1: createCadTextEntity('t1', {
        layerId: '0',
        position: { x: 100, y: 100 },
        content: 'QF01',
        height: 10,
        ...overrides,
      }),
    },
  }
}

const WIDTH = 4 * 10 * CAD_TEXT_ADVANCE_RATIO

describe('OpenSpec: cad-document / CAD 可见几何是一把伞', () => {
  it('遍历同时给出曲线与文字，文字带可区分的类别', () => {
    const document = documentWithText()
    const withLine: CadDocument = {
      ...document,
      rootIds: ['t1', 'l1'],
      entities: {
        ...document.entities,
        l1: createCadLineEntity('l1', {
          layerId: '0',
          start: { x: 0, y: 0 },
          end: { x: 10, y: 0 },
        }),
      },
    }
    expect(collectCadVisibleGeometry(withLine).map(({ geometry }) => geometry.kind))
      .toEqual(['text', 'segment'])
  })

  it('隐藏图层上的文字不参与', () => {
    const document = documentWithText()
    expect(collectCadVisibleGeometry({
      ...document,
      layers: document.layers.map((layer) => ({ ...layer, visible: false })),
    })).toEqual([])
  })
})

describe('OpenSpec: cad-document / CAD 文字图元 / 校验', () => {
  const validate = (overrides: Record<string, unknown>) =>
    validateCadDocument(documentWithText(overrides))

  it('内容为空、字高非正、对齐非法都被拒绝', () => {
    expect(validate({}).valid).toBe(true)
    for (const bad of [{ content: '' }, { height: 0 }, { height: -3 }, { align: 'middle' }]) {
      const result = validate(bad)
      expect(result.valid).toBe(false)
      if (!result.valid) {
        expect(result.issues.map(({ code }) => code)).toContain('entity.invalid-geometry')
      }
    }
  })

  it('内容即 Entity 名字', () => {
    // 场景树里「Text」全都一样，标签本身才是用户认得出的那个。
    expect(documentWithText().entities.t1!.name).toBe('QF01')
  })
})

describe('OpenSpec: cad-document / CAD 文字按包围盒命中', () => {
  it('点在笔画空隙上仍然命中', () => {
    const document = documentWithText()
    expect(findCadHit(document, { x: 100 + WIDTH / 2, y: 98 }, 1)).toBe('t1')
    // 框外就不命中了。
    expect(findCadHit(document, { x: 100 + WIDTH + 20, y: 98 }, 1)).toBeNull()
  })

  it('窗口要求整块在框内，交叉只要碰到', () => {
    const document = documentWithText()
    const full = { minX: 95, minY: 88, maxX: 100 + WIDTH + 5, maxY: 105 }
    const half = { minX: 95, minY: 88, maxX: 100 + WIDTH / 2, maxY: 105 }
    expect(findCadEntitiesInBounds(document, full, 'window')).toEqual(['t1'])
    expect(findCadEntitiesInBounds(document, half, 'window')).toEqual([])
    expect(findCadEntitiesInBounds(document, half, 'crossing')).toEqual(['t1'])
  })
})

describe('OpenSpec: cad-document / CAD 插入点捕捉', () => {
  it('捕捉到文字锚点', () => {
    expect(findCadSnap(documentWithText(), { x: 101, y: 101 }, 5))
      .toEqual({ mode: 'insertion', point: { x: 100, y: 100 } })
  })

  it('捕捉到块实例插入点', () => {
    const document: CadDocument = {
      ...createEmptyCadDocument(),
      blocks: {
        'block-1': {
          id: 'block-1',
          name: 'SYMBOL',
          rootIds: ['m1'],
          entities: {
            m1: createCadLineEntity('m1', {
              layerId: '0',
              start: { x: 20, y: 0 },
              end: { x: 30, y: 0 },
            }),
          },
          ports: [],
        },
      },
      rootIds: ['i1'],
      entities: {
        i1: {
          id: 'i1',
          name: 'SYMBOL',
          components: {
            CadPlacement: { layerId: '0' },
            CadInsert: createCadInsert('block-1', { x: 100, y: 100 }),
          },
        },
      },
    }
    // 插入点 (100,100) 上没有任何图元——块内几何从局部 (20,0) 才开始。
    expect(findCadSnap(document, { x: 101, y: 101 }, 5))
      .toEqual({ mode: 'insertion', point: { x: 100, y: 100 } })
  })

  it('端点压过插入点', () => {
    const document = documentWithText()
    const withLine: CadDocument = {
      ...document,
      rootIds: ['t1', 'l1'],
      entities: {
        ...document.entities,
        l1: createCadLineEntity('l1', {
          layerId: '0',
          start: { x: 102, y: 102 },
          end: { x: 200, y: 200 },
        }),
      },
    }
    expect(findCadSnap(withLine, { x: 101, y: 101 }, 10)?.mode).toBe('endpoint')
  })
})

describe('OpenSpec: cad-document / CAD 几何位移 / 文字只移锚点', () => {
  it('字号与旋转不动', () => {
    const moved = translateCadEntity(documentWithText().entities.t1!, { x: 5, y: -5 })
    expect(getCadText(moved)).toEqual({
      position: { x: 105, y: 95 },
      content: 'QF01',
      height: 10,
      rotation: 0,
      align: 'left',
    })
  })
})

describe('OpenSpec: cad-document / CAD TEXT 命令', () => {
  function runtime() {
    return createDocumentTransactionRuntime<CadDocument, DocumentValidationIssueShape>({
      document: createEmptyCadDocument(),
      validate: validateCadDocument,
      handlers: createCadCommandHandlers(),
    })
  }

  it('三步写出一段文字，回车接受默认字高', () => {
    const session = createCadTextSession(context())
    expect(session.prompt?.message).toBe(messages.textPosition)
    session.advance({ kind: 'point', point: { x: 100, y: 100 } })
    expect(session.prompt?.message).toContain(String(CAD_DEFAULT_TEXT_HEIGHT))

    session.advance({ kind: 'accept' })
    expect(session.prompt?.message).toBe(messages.textContent)
    const step = session.advance({ kind: 'text', text: 'QF01' })
    expect(step.status).toBe('commit')
    if (step.status !== 'commit' || !step.effect.command) return

    const store = runtime()
    expect(store.dispatch(step.effect.command).status).toBe('committed')
    expect(getCadText(store.document.entities[store.document.rootIds[0]!]!)).toEqual({
      position: { x: 100, y: 100 },
      content: 'QF01',
      height: CAD_DEFAULT_TEXT_HEIGHT,
      rotation: 0,
      align: 'left',
    })

    store.undo()
    expect(store.document.rootIds).toEqual([])
  })

  it('指点取字高', () => {
    const session = createCadTextSession(context())
    session.advance({ kind: 'point', point: { x: 100, y: 100 } })
    session.advance({ kind: 'point', point: { x: 100, y: 130 } })
    const step = session.advance({ kind: 'text', text: 'A' })
    if (step.status !== 'commit' || !step.effect.command) throw new Error('应当提交')
    const payload = step.effect.command.payload as unknown as {
      entity: { components: { CadText: { height: number } } }
    }
    expect(payload.entity.components.CadText.height).toBeCloseTo(30)
  })

  it('键入字高', () => {
    const session = createCadTextSession(context())
    session.advance({ kind: 'point', point: { x: 0, y: 0 } })
    session.advance({ kind: 'text', text: ' 25 ' })
    const step = session.advance({ kind: 'text', text: 'A' })
    if (step.status !== 'commit' || !step.effect.command) throw new Error('应当提交')
    const payload = step.effect.command.payload as unknown as {
      entity: { components: { CadText: { height: number } } }
    }
    expect(payload.entity.components.CadText.height).toBe(25)
  })

  it('非正字高被拒绝且停在原提示', () => {
    const session = createCadTextSession(context())
    session.advance({ kind: 'point', point: { x: 0, y: 0 } })
    expect(session.advance({ kind: 'text', text: '-3' }).status).toBe('rejected')
    expect(session.prompt?.message).toContain(messages.textHeight)
    // 仍然能继续给一个合法值。
    session.advance({ kind: 'text', text: '12' })
    expect(session.prompt?.message).toBe(messages.textContent)
  })

  it('空内容被拒绝且不写入文档', () => {
    const session = createCadTextSession(context())
    session.advance({ kind: 'point', point: { x: 0, y: 0 } })
    session.advance({ kind: 'accept' })
    expect(session.advance({ kind: 'text', text: '' }).status).toBe('rejected')
    expect(session.advance({ kind: 'accept' }).status).toBe('rejected')
  })
})

describe('OpenSpec: cad-document / CAD 块内圆弧的缩放 / 块内文字', () => {
  function documentWithInstance(scale: { x: number, y: number }): CadDocument {
    return {
      ...createEmptyCadDocument(),
      blocks: {
        'block-1': {
          id: 'block-1',
          name: 'SYMBOL',
          rootIds: ['m1'],
          entities: {
            m1: createCadTextEntity('m1', {
              layerId: '0',
              position: { x: 10, y: 0 },
              content: 'QF',
              height: 10,
            }),
          },
          ports: [],
        },
      },
      rootIds: ['i1'],
      entities: {
        i1: {
          id: 'i1',
          name: 'SYMBOL',
          components: {
            CadPlacement: { layerId: '0' },
            CadInsert: createCadInsert('block-1', { x: 100, y: 100 }, { scale }),
          },
        },
      },
    }
  }

  it('文字不被拍扁，字号按横向比例缩放', () => {
    const [first] = collectCadVisibleGeometry(documentWithInstance({ x: 2, y: 1 }))
    expect(first!.geometry.kind).toBe('text')
    if (first!.geometry.kind !== 'text') return
    // 非等比时圆弧会降级成线段，文字不会——把一串字拆成线段既不是那串字，也没人能读。
    expect(first!.geometry.height).toBe(20)
    expect(first!.geometry.position).toEqual({ x: 120, y: 100 })
  })

  it('镜像不翻转文字本身', () => {
    const [first] = collectCadVisibleGeometry(documentWithInstance({ x: -1, y: 1 }))
    if (first!.geometry.kind !== 'text') throw new Error('应当是文字')
    // 镜像的符号里，标注仍然要正着读。
    expect(first!.geometry.rotation).toBe(0)
    expect(first!.geometry.height).toBe(10)
  })
})
