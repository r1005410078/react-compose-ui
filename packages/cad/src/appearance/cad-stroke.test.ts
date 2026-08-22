import { describe, expect, it } from 'vitest'
import { createDocumentTransactionRuntime } from '@compose-ui/core'
import type { ComposeEntity } from '@compose-ui/core'
import type { DocumentValidationIssueShape } from '@compose-ui/core'
import {
  createCadLineEntity,
  createEmptyCadDocument,
  getCadStroke,
  validateCadDocument,
  type CadDocument,
} from '../document'
import { createCadCommandHandlers } from '../command/cad-command-handlers'
import {
  createCadColorSession,
  createCadLineTypeSession,
  createCadLineWeightSession,
} from '../command/cad-stroke-commands'
import {
  cadTestCommandMessages as messages,
  createCadTestCommandContext as context,
} from '../test-fixtures'
import {
  CAD_DEFAULT_STROKE_WIDTH,
  applyCadStrokePatch,
  parseCadColor,
  parseCadDashPattern,
  parseCadStrokeWidth,
  resolveCadStroke,
} from './cad-stroke'

/** 值类型放宽是刻意的：校验用例要喂进非法形状，那正是校验器要拦的东西。 */
function documentWith(components: Record<string, unknown> = {}): CadDocument {
  const base = createEmptyCadDocument()
  const line = createCadLineEntity('l1', {
    layerId: '0',
    start: { x: 0, y: 0 },
    end: { x: 10, y: 0 },
  })
  return {
    ...base,
    rootIds: ['l1'],
    entities: {
      l1: {
        ...line,
        components: { ...line.components, ...components } as ComposeEntity['components'],
      },
    },
  }
}

const LAYER_COLOR = createEmptyCadDocument().layers[0]!.color

describe('OpenSpec: cad-document / CAD 图元外观覆盖 / 解析', () => {
  it('不含覆盖时与引入本能力之前逐字相同', () => {
    const document = documentWith()
    expect(resolveCadStroke(document, document.entities.l1)).toEqual({
      color: LAYER_COLOR,
      width: CAD_DEFAULT_STROKE_WIDTH,
      dashPattern: [],
    })
  })

  it('逐项回退：只覆盖颜色时线宽与线型仍取默认', () => {
    const document = documentWith({ CadStroke: { color: '#ff0000' } })
    expect(resolveCadStroke(document, document.entities.l1)).toEqual({
      color: '#ff0000',
      width: CAD_DEFAULT_STROKE_WIDTH,
      dashPattern: [],
    })
  })

  it('覆盖了颜色之后不再跟随图层', () => {
    const document = documentWith({ CadStroke: { color: '#ff0000' } })
    const recolored: CadDocument = {
      ...document,
      layers: document.layers.map((layer) => ({ ...layer, color: '#00ff00' })),
    }
    expect(resolveCadStroke(recolored, recolored.entities.l1).color).toBe('#ff0000')
    // 对照：没有覆盖的图元跟着改后的图层走。
    const plain = documentWith().entities.l1!
    expect(resolveCadStroke({ ...recolored, entities: { l1: plain } }, plain).color)
      .toBe('#00ff00')
  })

  it('线宽与线型各自覆盖', () => {
    const document = documentWith({ CadStroke: { width: 3, dashPattern: [4, 2] } })
    expect(resolveCadStroke(document, document.entities.l1)).toEqual({
      color: LAYER_COLOR,
      width: 3,
      dashPattern: [4, 2],
    })
  })
})

describe('OpenSpec: cad-document / CAD 图元外观覆盖 / 校验', () => {
  it('给了就必须合法', () => {
    expect(validateCadDocument(documentWith({ CadStroke: { color: '#ff0000' } })).valid).toBe(true)
    for (const bad of [
      { color: '' },
      { color: 5 },
      { width: 0 },
      { width: -1 },
      { dashPattern: [4, 0] },
      { dashPattern: [4, -2] },
      { dashPattern: 'dashed' },
    ]) {
      const result = validateCadDocument(documentWith({ CadStroke: bad }))
      expect(result.valid).toBe(false)
      if (!result.valid) {
        expect(result.issues.map(({ code }) => code)).toContain('entity.invalid-geometry')
      }
    }
  })

  it('空的覆盖仍然合法', () => {
    // 命令不会产出空壳，但外部写入可能——它无害，不值得为它拒绝整份文档。
    expect(validateCadDocument(documentWith({ CadStroke: {} })).valid).toBe(true)
  })
})

describe('OpenSpec: cad-document / CAD 图元外观覆盖 / 清除即删键', () => {
  it('清除某一项只删那个键', () => {
    expect(applyCadStrokePatch({ color: '#ff0000', width: 3 }, { color: null }))
      .toEqual({ width: 3 })
  })

  it('缺席的项不动', () => {
    expect(applyCadStrokePatch({ color: '#ff0000', width: 3 }, { dashPattern: [2, 2] }))
      .toEqual({ color: '#ff0000', width: 3, dashPattern: [2, 2] })
  })

  it('三项全清时整个 Component 应当删掉', () => {
    expect(applyCadStrokePatch({ color: '#ff0000' }, { color: null })).toBeNull()
    expect(applyCadStrokePatch(undefined, { color: null })).toBeNull()
  })
})

describe('OpenSpec: cad-document / CAD COLOR、LWEIGHT 与 LTYPE 命令 / 值解析', () => {
  it('颜色接受十六进制、色名与 BYLAYER', () => {
    expect(parseCadColor('#FF0000')).toBe('#ff0000')
    expect(parseCadColor(' red ')).toBe('#ff0000')
    expect(parseCadColor('bylayer')).toBeNull()
    expect(parseCadColor('rebeccapurple')).toBeUndefined()
    expect(parseCadColor('#ff00')).toBeUndefined()
    expect(parseCadColor('')).toBeUndefined()
  })

  it('线宽接受正数与 BYLAYER', () => {
    expect(parseCadStrokeWidth('2.5')).toBe(2.5)
    expect(parseCadStrokeWidth('BYLAYER')).toBeNull()
    expect(parseCadStrokeWidth('0')).toBeUndefined()
    expect(parseCadStrokeWidth('-1')).toBeUndefined()
    expect(parseCadStrokeWidth('thick')).toBeUndefined()
  })

  it('线型接受一串正数、CONTINUOUS 与 BYLAYER', () => {
    expect(parseCadDashPattern('4, 2')).toEqual([4, 2])
    // 「实线」在 AutoCAD 里是一个具名线型，在本仓的模型里就是「没有虚线」。
    expect(parseCadDashPattern('continuous')).toBeNull()
    expect(parseCadDashPattern('BYLAYER')).toBeNull()
    expect(parseCadDashPattern('4,0')).toBeUndefined()
    expect(parseCadDashPattern('4,x')).toBeUndefined()
  })
})

describe('OpenSpec: cad-document / CAD COLOR、LWEIGHT 与 LTYPE 命令 / 会话', () => {
  function runtime(document = documentWith()) {
    return createDocumentTransactionRuntime<CadDocument, DocumentValidationIssueShape>({
      document,
      validate: validateCadDocument,
      handlers: createCadCommandHandlers(),
    })
  }

  it('先选后执行直接问值，一次撤销回到修改之前', () => {
    const session = createCadColorSession(context(['l1']))
    expect(session.prompt?.message).toBe(messages.strokeColor)
    const step = session.advance({ kind: 'text', text: 'red' })
    expect(step.status).toBe('commit')
    if (step.status !== 'commit' || !step.effect.command) return

    const store = runtime()
    expect(store.dispatch(step.effect.command).status).toBe('committed')
    expect(getCadStroke(store.document.entities.l1!)).toEqual({ color: '#ff0000' })

    store.undo()
    expect(getCadStroke(store.document.entities.l1!)).toBeUndefined()
  })

  it('没有选择时先要选择集', () => {
    const session = createCadLineWeightSession(context())
    expect(session.prompt?.message).toBe(messages.selectObjects)
    session.advance({ kind: 'selection', ids: ['l1'] })
    expect(session.prompt?.message).toBe(messages.strokeWidth)
  })

  it('值不合法时拒绝但不结束命令', () => {
    const session = createCadLineWeightSession(context(['l1']))
    expect(session.advance({ kind: 'text', text: '0' }))
      .toEqual({ status: 'rejected', message: messages.invalidStrokeWidth })
    // 打错一个值就要重新选一遍对象，在 CAD 里是不可接受的手感。
    expect(session.prompt?.message).toBe(messages.strokeWidth)
    expect(session.advance({ kind: 'text', text: '3' }).status).toBe('commit')
  })

  it('BYLAYER 清除覆盖，且不留下空壳', () => {
    const store = runtime(documentWith({ CadStroke: { color: '#ff0000' } }))
    const session = createCadColorSession(context(['l1']))
    const step = session.advance({ kind: 'text', text: 'BYLAYER' })
    if (step.status !== 'commit' || !step.effect.command) throw new Error('应当提交')

    expect(store.dispatch(step.effect.command).status).toBe('committed')
    expect(getCadStroke(store.document.entities.l1!)).toBeUndefined()
    expect(resolveCadStroke(store.document, store.document.entities.l1).color).toBe(LAYER_COLOR)
  })

  it('线型走同一条会话', () => {
    const session = createCadLineTypeSession(context(['l1']))
    const step = session.advance({ kind: 'text', text: '6,3' })
    if (step.status !== 'commit' || !step.effect.command) throw new Error('应当提交')
    const store = runtime()
    store.dispatch(step.effect.command)
    expect(getCadStroke(store.document.entities.l1!)).toEqual({ dashPattern: [6, 3] })
  })
})
