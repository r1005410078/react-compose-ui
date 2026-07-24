import { describe, expect, it } from 'vitest'
import * as core from './index'
import type {
  ComposeDocument,
  ComposeNode,
  EditorCommand,
  JsonObject,
  TransactionRuntime,
} from './index'

const createTransactionRuntime = (
  core as unknown as {
    createTransactionRuntime(options: { document: ComposeDocument }): TransactionRuntime
  }
).createTransactionRuntime

function fixture(): ComposeDocument {
  return {
    schemaVersion: 1,
    rootIds: ['frame'],
    nodes: {
      frame: {
        id: 'frame',
        kind: 'frame',
        name: 'Frame',
        visible: true,
        locked: false,
        transform: { x: 0, y: 0, width: 1920, height: 1080, rotation: 0 },
        childIds: ['a', 'b', 'group'],
      },
      a: {
        id: 'a',
        kind: 'component',
        name: 'A',
        visible: true,
        locked: false,
        transform: { x: 10, y: 20, width: 100, height: 50, rotation: 0 },
        componentType: 'text',
        props: { text: 'A', appearance: { opacity: 1 } },
      },
      b: {
        id: 'b',
        kind: 'component',
        name: 'B',
        visible: true,
        locked: false,
        transform: { x: 200, y: 20, width: 100, height: 50, rotation: 0 },
        componentType: 'text',
        props: { text: 'B' },
      },
      group: {
        id: 'group',
        kind: 'group',
        name: 'Existing Group',
        visible: true,
        locked: false,
        transform: { x: 50, y: 200, width: 400, height: 200, rotation: 0 },
        childIds: ['c'],
      },
      c: {
        id: 'c',
        kind: 'component',
        name: 'C',
        visible: true,
        locked: false,
        transform: { x: 20, y: 20, width: 100, height: 50, rotation: 0 },
        componentType: 'text',
        props: { text: 'C' },
      },
    },
  }
}

function dispatch(
  runtime: TransactionRuntime,
  type: string,
  payload: Record<string, unknown>,
) {
  return runtime.dispatch({
    id: `command-${type}`,
    type,
    payload,
    meta: { label: type },
  } as EditorCommand)
}

function component(id: string, name = id): ComposeNode {
  return {
    id,
    kind: 'component',
    name,
    visible: true,
    locked: false,
    transform: { x: 30, y: 40, width: 120, height: 60, rotation: 0 },
    componentType: 'text',
    props: { text: name },
  }
}

function containerChildIds(runtime: TransactionRuntime, nodeId: string) {
  const node = runtime.document.nodes[nodeId]
  if (!node || node.kind === 'component') throw new Error(`${nodeId} is not a container`)
  return node.childIds
}

describe('built-in document commands', () => {
  it('OpenSpec: command-transaction / 内置文档命令 / 原子创建和删除节点', () => {
    const runtime = createTransactionRuntime({ document: fixture() })
    const frame = {
      id: 'frame-2',
      kind: 'frame',
      name: 'Frame 2',
      visible: true,
      locked: false,
      transform: { x: 2200, y: 0, width: 1280, height: 720, rotation: 0 },
      childIds: [],
    }

    expect(dispatch(runtime, 'frame.create', { node: frame, index: 1 }).status).toBe('committed')
    expect(dispatch(runtime, 'node.create', {
      node: component('new'),
      parentId: 'frame',
      index: 1,
    }).status).toBe('committed')
    expect(runtime.document.rootIds).toEqual(['frame', 'frame-2'])
    expect(containerChildIds(runtime, 'frame')).toEqual(['a', 'new', 'b', 'group'])

    expect(dispatch(runtime, 'node.delete', { nodeIds: ['group'] }).status).toBe('committed')
    expect(runtime.document.nodes.group).toBeUndefined()
    expect(runtime.document.nodes.c).toBeUndefined()
    runtime.undo()
    expect(runtime.document.nodes.group).toBeDefined()
    expect(runtime.document.nodes.c).toBeDefined()
  })

  it('OpenSpec: command-transaction / 内置文档命令 / 移动或复制场景节点', () => {
    const runtime = createTransactionRuntime({ document: fixture() })

    expect(dispatch(runtime, 'node.move', {
      nodeIds: ['a', 'b'],
      parentId: 'group',
      index: 1,
    }).status).toBe('committed')
    expect(containerChildIds(runtime, 'frame')).toEqual(['group'])
    expect(containerChildIds(runtime, 'group')).toEqual(['c', 'a', 'b'])

    expect(dispatch(runtime, 'node.duplicate', {
      nodes: {
        'a-copy': { ...component('a-copy', 'A copy'), props: { text: 'A' } },
      },
      rootIds: ['a-copy'],
      parentId: 'frame',
      index: 0,
    }).status).toBe('committed')
    expect(containerChildIds(runtime, 'frame')[0]).toBe('a-copy')
    expect(runtime.document.nodes['a-copy']).toMatchObject({ name: 'A copy' })

    expect(dispatch(runtime, 'node.move', {
      nodeIds: ['group'],
      parentId: 'group',
      index: 0,
    })).toMatchObject({
      status: 'rejected',
      issues: [expect.objectContaining({ code: 'node.cycle' })],
    })
  })

  it('OpenSpec: command-transaction / 内置文档命令 / 修改属性和变换', () => {
    const runtime = createTransactionRuntime({ document: fixture() })

    expect(dispatch(runtime, 'node.props.set', {
      nodeId: 'a',
      path: ['appearance', 'opacity'],
      value: 0.5,
    }).status).toBe('committed')
    expect(runtime.document.nodes.a).toMatchObject({
      props: { appearance: { opacity: 0.5 } },
    })

    expect(dispatch(runtime, 'node.transform.set', {
      updates: [{
        nodeId: 'a',
        transform: { x: 120, y: 140, width: 300, height: 160, rotation: 30 },
      }],
    }).status).toBe('committed')
    expect(runtime.document.nodes.a.transform).toEqual({
      x: 120,
      y: 140,
      width: 300,
      height: 160,
      rotation: 30,
    })

    expect(dispatch(runtime, 'node.set-locked', {
      nodeIds: ['a'],
      locked: true,
    }).status).toBe('committed')
    expect(dispatch(runtime, 'node.props.set', {
      nodeId: 'a',
      path: ['text'],
      value: 'Blocked',
    })).toMatchObject({
      status: 'rejected',
      issues: [expect.objectContaining({ code: 'node.locked' })],
    })
  })

  it('OpenSpec: command-transaction / 内置文档命令 / 分组和取消分组', () => {
    const runtime = createTransactionRuntime({ document: fixture() })
    const group = {
      id: 'selection-group',
      kind: 'group',
      name: 'Selection',
      visible: true,
      locked: false,
      transform: { x: 10, y: 20, width: 290, height: 50, rotation: 0 },
      childIds: ['a', 'b'],
    }

    expect(dispatch(runtime, 'node.group', {
      group,
      nodeIds: ['a', 'b'],
      childTransforms: {
        a: { x: 0, y: 0, width: 100, height: 50, rotation: 0 },
        b: { x: 190, y: 0, width: 100, height: 50, rotation: 0 },
      },
    }).status).toBe('committed')
    expect(containerChildIds(runtime, 'frame')).toEqual(['selection-group', 'group'])
    expect(runtime.document.nodes['selection-group']).toMatchObject({ childIds: ['a', 'b'] })

    expect(dispatch(runtime, 'node.ungroup', {
      groupId: 'selection-group',
      childTransforms: {
        a: { x: 10, y: 20, width: 100, height: 50, rotation: 0 },
        b: { x: 200, y: 20, width: 100, height: 50, rotation: 0 },
      },
    }).status).toBe('committed')
    expect(runtime.document.nodes['selection-group']).toBeUndefined()
    expect(containerChildIds(runtime, 'frame')).toEqual(['a', 'b', 'group'])
  })

  it('OpenSpec: command-transaction / 内置文档命令 / 批处理命令', () => {
    const runtime = createTransactionRuntime({ document: fixture() })
    const batchCommands: JsonObject[] = [
      {
        id: 'rename',
        type: 'node.rename',
        payload: { nodeId: 'a', name: 'Batch A' },
      },
      {
        id: 'visibility',
        type: 'node.set-visibility',
        payload: { nodeIds: ['b'], visible: false },
      },
    ]
    const batch: EditorCommand = {
      id: 'batch',
      type: 'transaction.batch',
      payload: {
        commands: batchCommands,
      },
      meta: { label: '批量修改' },
    }

    expect(runtime.dispatch(batch).status).toBe('committed')
    expect(runtime.entries).toHaveLength(2)
    expect(runtime.document.nodes.a.name).toBe('Batch A')
    expect(runtime.document.nodes.b.visible).toBe(false)
    runtime.undo()
    expect(runtime.document).toEqual(fixture())

    const invalidBatch: EditorCommand = {
      ...batch,
      id: 'invalid-batch',
      payload: {
        commands: [
          batchCommands[0],
          { id: 'bad', type: 'node.rename', payload: { nodeId: 'missing', name: 'Bad' } },
        ],
      },
    }
    expect(runtime.dispatch(invalidBatch).status).toBe('rejected')
    expect(runtime.document).toEqual(fixture())
  })
})
