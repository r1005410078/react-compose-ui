import { describe, expect, it } from 'vitest'
import { createDocumentTransactionRuntime } from '@compose-ui/core'
import type { DocumentValidationIssueShape } from '@compose-ui/core'
import { createCadInsert } from '../block'
import {
  createCadLineEntity,
  createCadWireEntity,
  createEmptyCadDocument,
  getCadWire,
  validateCadDocument,
  type CadDocument,
} from '../document'
import { createCadTestCommandContext as context } from '../test-fixtures'
import { createCadCommandHandlers } from './cad-command-handlers'
import { createCadPortSession, createCadWireSession } from './cad-connection-commands'

function instance(id: string, x: number) {
  return {
    id,
    name: 'SYMBOL',
    components: {
      CadPlacement: { layerId: '0' },
      CadInsert: createCadInsert('block-1', { x, y: 100 }),
    },
  }
}

/** 两个实例，块两端各一个端口。 */
function documentWithInstances(ports = [
  { id: 'a', position: { x: 0, y: 0 } },
  { id: 'b', position: { x: 10, y: 0 } },
]): CadDocument {
  return {
    ...createEmptyCadDocument(),
    blocks: {
      'block-1': {
        id: 'block-1',
        name: 'SYMBOL',
        rootIds: ['m1'],
        entities: {
          m1: createCadLineEntity('m1', {
            layerId: '0',
            start: { x: 0, y: 0 },
            end: { x: 10, y: 0 },
          }),
        },
        ports,
      },
    },
    rootIds: ['i1', 'i2'],
    entities: { i1: instance('i1', 100), i2: instance('i2', 300) },
  }
}

function runtime(document = documentWithInstances()) {
  return createDocumentTransactionRuntime<CadDocument, DocumentValidationIssueShape>({
    document,
    validate: validateCadDocument,
    handlers: createCadCommandHandlers(),
  })
}

describe('OpenSpec: cad-document / CAD WIRE 命令', () => {
  it('落在端口上的点绑定该端口', () => {
    const session = createCadWireSession(context())
    session.advance({ kind: 'point', point: { x: 110, y: 100 } })
    const step = session.advance({ kind: 'point', point: { x: 300, y: 100 } })
    expect(step.status).toBe('commit')
    if (step.status !== 'commit' || !step.effect.command) return

    const store = runtime()
    expect(store.dispatch(step.effect.command).status).toBe('committed')
    const wire = getCadWire(store.document.entities[store.document.rootIds[store.document.rootIds.length - 1]!]!)
    expect(wire).toEqual({
      start: { kind: 'port', entityId: 'i1', portId: 'b' },
      end: { kind: 'port', entityId: 'i2', portId: 'a' },
    })
  })

  it('空处取点成为自由端点', () => {
    const session = createCadWireSession(context())
    session.advance({ kind: 'point', point: { x: 110, y: 100 } })
    const step = session.advance({ kind: 'point', point: { x: 555, y: 20 } })
    if (step.status !== 'commit' || !step.effect.command) throw new Error('应当提交')

    const store = runtime()
    store.dispatch(step.effect.command)
    const wire = getCadWire(store.document.entities[store.document.rootIds[store.document.rootIds.length - 1]!]!)
    expect(wire?.end).toEqual({ kind: 'free', point: { x: 555, y: 20 } })
  })

  it('两端解析到同一个端口时被拒绝', () => {
    const session = createCadWireSession(context())
    session.advance({ kind: 'point', point: { x: 110, y: 100 } })
    // 同一个端口的两个不同世界坐标不存在，因此用同一个点；这同时覆盖零长导线。
    const step = session.advance({ kind: 'point', point: { x: 110, y: 100 } })
    if (step.status !== 'commit' || !step.effect.command) throw new Error('应当提交')

    const store = runtime()
    const result = store.dispatch(step.effect.command)
    expect(result.status).not.toBe('committed')
    expect(store.document.rootIds).toEqual(['i1', 'i2'])
  })

  it('一次撤销回到画线之前', () => {
    const session = createCadWireSession(context())
    session.advance({ kind: 'point', point: { x: 110, y: 100 } })
    const step = session.advance({ kind: 'point', point: { x: 300, y: 100 } })
    if (step.status !== 'commit' || !step.effect.command) throw new Error('应当提交')

    const store = runtime()
    store.dispatch(step.effect.command)
    expect(store.document.rootIds).toHaveLength(3)
    store.undo()
    expect(store.document.rootIds).toEqual(['i1', 'i2'])
  })
})

describe('OpenSpec: cad-document / CAD PORT 命令', () => {
  it('加在块定义上，对全部实例生效', () => {
    const session = createCadPortSession(context(['i1']))
    expect(session.prompt?.accepts).toEqual(['point'])
    // i1 的插入点是 (100,100)，因此世界 (105,100) 是块局部 (5,0)。
    const step = session.advance({ kind: 'point', point: { x: 105, y: 100 } })
    if (step.status !== 'commit' || !step.effect.command) throw new Error('应当提交')

    const store = runtime(documentWithInstances([]))
    expect(store.dispatch(step.effect.command).status).toBe('committed')
    const ports = store.document.blocks['block-1']!.ports
    expect(ports).toHaveLength(1)
    expect(ports[0]!.position).toEqual({ x: 5, y: 0 })
  })

  it('没有选择时先提示选一个实例，多选被拒绝', () => {
    const session = createCadPortSession(context())
    expect(session.prompt?.accepts).toEqual(['selection'])
    expect(session.advance({ kind: 'selection', ids: ['i1', 'i2'] }).status).toBe('rejected')
    expect(session.advance({ kind: 'selection', ids: ['i1'] }).status).toBe('prompt')
    expect(session.prompt?.accepts).toEqual(['point'])
  })

  it('目标不是块实例时被拒绝', () => {
    const session = createCadPortSession(context(['line']))
    const step = session.advance({ kind: 'point', point: { x: 0, y: 0 } })
    if (step.status !== 'commit' || !step.effect.command) throw new Error('应当提交')

    const document = documentWithInstances()
    const store = runtime({
      ...document,
      rootIds: [...document.rootIds, 'line'],
      entities: {
        ...document.entities,
        line: createCadLineEntity('line', {
          layerId: '0',
          start: { x: 0, y: 0 },
          end: { x: 1, y: 1 },
        }),
      },
    })
    expect(store.dispatch(step.effect.command).status).not.toBe('committed')
  })

  it('实例比例为 0 时被拒绝', () => {
    const session = createCadPortSession(context(['i1']))
    const step = session.advance({ kind: 'point', point: { x: 105, y: 100 } })
    if (step.status !== 'commit' || !step.effect.command) throw new Error('应当提交')

    const document = documentWithInstances([])
    const store = runtime({
      ...document,
      entities: {
        ...document.entities,
        i1: {
          ...document.entities.i1!,
          components: {
            ...document.entities.i1!.components,
            CadInsert: createCadInsert('block-1', { x: 100, y: 100 }, { scale: { x: 0, y: 1 } }),
          },
        },
      },
    })
    expect(store.dispatch(step.effect.command).status).not.toBe('committed')
    expect(store.document.blocks['block-1']!.ports).toEqual([])
  })
})

describe('OpenSpec: cad-document / CAD 删除绑定目标时冻结导线端点', () => {
  function documentWithWire() {
    const document = documentWithInstances()
    return {
      ...document,
      rootIds: [...document.rootIds, 'w1'],
      entities: {
        ...document.entities,
        w1: createCadWireEntity('w1', {
          layerId: '0',
          start: { kind: 'port' as const, entityId: 'i1', portId: 'b' },
          end: { kind: 'port' as const, entityId: 'i2', portId: 'a' },
        }),
      },
    }
  }

  it('删除设备，导线留在原处且末端悬空', () => {
    const store = runtime(documentWithWire())
    expect(store.dispatch({
      id: 'c1',
      type: 'cad.entity.remove',
      payload: { entityId: 'i1' } as never,
    }).status).toBe('committed')

    expect(store.document.entities.i1).toBeUndefined()
    expect(getCadWire(store.document.entities.w1!)).toEqual({
      // 冻结在删除前最后一次解算的位置上：图上什么都没变。
      start: { kind: 'free', point: { x: 110, y: 100 } },
      end: { kind: 'port', entityId: 'i2', portId: 'a' },
    })

    store.undo()
    expect(getCadWire(store.document.entities.w1!)?.start)
      .toEqual({ kind: 'port', entityId: 'i1', portId: 'b' })
  })

  it('同批删除导线自身不留残留', () => {
    const store = runtime(documentWithWire())
    expect(store.dispatch({
      id: 'batch',
      type: 'transaction.batch',
      payload: {
        commands: [
          { id: 'c1', type: 'cad.entity.remove', payload: { entityId: 'i1' } },
          { id: 'c2', type: 'cad.entity.remove', payload: { entityId: 'w1' } },
        ],
      } as never,
    }).status).toBe('committed')
    expect(store.document.rootIds).toEqual(['i2'])
  })
})
