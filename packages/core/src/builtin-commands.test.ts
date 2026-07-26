import { describe, expect, it } from 'vitest'
import * as core from './index'
import type {
  ComposeDocument,
  ComposeNode,
  EditorCommand,
  JsonObject,
  TransactionRuntime,
} from './index'
import { createDefaultCanvasSettings, createDefaultOutputSettings } from './index'

const createTransactionRuntime = (
  core as unknown as {
    createTransactionRuntime(options: { document: ComposeDocument }): TransactionRuntime
  }
).createTransactionRuntime

function fixture(): ComposeDocument {
  return {
    schemaVersion: 3,
    canvas: createDefaultCanvasSettings(),
    output: createDefaultOutputSettings(),
    rootIds: ['frame'],
    nodes: {
      frame: {
        id: 'frame',
        kind: 'frame',
        name: 'Frame',
        visible: true,
        locked: false,
        transform: { x: 0, y: 0, width: 1920, height: 1080, rotation: 0 },
        clipContent: true,
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
        kind: 'frame',
        name: 'Existing Frame',
        visible: true,
        locked: false,
        transform: { x: 50, y: 200, width: 400, height: 200, rotation: 0 },
        clipContent: false,
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
  it('OpenSpec: command-transaction / 内置文档命令 / 配置画布并撤销', () => {
    const runtime = createTransactionRuntime({ document: fixture() })

    expect(dispatch(runtime, 'canvas.configure', {
      grid: {
        stepX: 16,
        stepY: 12,
        offsetX: -4,
        offsetY: 6,
        primaryLineEvery: 4,
        snapEnabled: false,
      },
      smartSnap: { nodes: false, guides: true },
    }).status).toBe('committed')
    expect(runtime.document.canvas).toMatchObject({
      grid: { stepX: 16, stepY: 12, offsetX: -4, offsetY: 6, primaryLineEvery: 4 },
      smartSnap: { nodes: false, guides: true },
    })
    expect(runtime.entries).toHaveLength(2)

    expect(dispatch(runtime, 'canvas.configure', {
      grid: runtime.document.canvas.grid,
      smartSnap: runtime.document.canvas.smartSnap,
    }).status).toBe('noop')
    expect(dispatch(runtime, 'canvas.configure', {
      grid: { ...runtime.document.canvas.grid, stepX: 0 },
      smartSnap: runtime.document.canvas.smartSnap,
    }).status).toBe('rejected')

    runtime.undo()
    expect(runtime.document.canvas).toEqual(createDefaultCanvasSettings())
    runtime.redo()
    expect(runtime.document.canvas.grid.stepX).toBe(16)
  })

  it('OpenSpec: command-transaction / 内置文档命令 / 配置输出', () => {
    const runtime = createTransactionRuntime({ document: fixture() })

    expect(dispatch(runtime, 'output.configure', {
      width: 1920,
      height: 1080,
      backgroundColor: '#101820',
    }).status).toBe('committed')
    expect(runtime.document.output).toEqual({
      width: 1920,
      height: 1080,
      backgroundColor: '#101820',
    })
    expect(dispatch(runtime, 'output.configure', { ...runtime.document.output }).status).toBe('noop')
    expect(dispatch(runtime, 'output.configure', {
      width: 0,
      height: 1080,
      backgroundColor: '#101820',
    }).status).toBe('rejected')
    runtime.undo()
    expect(runtime.document.output).toEqual(createDefaultOutputSettings())
  })

  it('OpenSpec: command-transaction / 内置文档命令 / 创建移动和删除辅助线', () => {
    const runtime = createTransactionRuntime({ document: fixture() })
    const batch: EditorCommand = {
      id: 'guide-batch',
      type: 'transaction.batch',
      payload: {
        commands: [
          {
            id: 'guide-x',
            type: 'canvas.guide.create',
            payload: { guide: { id: 'guide-x', axis: 'x', position: 32 } },
          },
          {
            id: 'guide-y',
            type: 'canvas.guide.create',
            payload: { guide: { id: 'guide-y', axis: 'y', position: -16 } },
          },
        ],
      },
      meta: { label: '创建双轴辅助线' },
    }

    const created = runtime.dispatch(batch)
    expect(created.status).toBe('committed')
    if (created.status !== 'committed') return
    expect(created.transaction.forward).toHaveLength(2)
    expect(created.transaction.inverse).toHaveLength(2)
    expect(runtime.document.canvas.guides).toEqual([
      { id: 'guide-x', axis: 'x', position: 32 },
      { id: 'guide-y', axis: 'y', position: -16 },
    ])
    expect(dispatch(runtime, 'canvas.guide.create', {
      guide: { id: 'guide-x', axis: 'x', position: 64 },
    }).status).toBe('rejected')
    expect(dispatch(runtime, 'canvas.guide.create', {
      guide: { id: 'invalid', axis: 'x', position: Number.POSITIVE_INFINITY },
    }).status).toBe('rejected')
    expect(dispatch(runtime, 'canvas.guide.move', {
      guideId: 'missing',
      position: 0,
    }).status).toBe('rejected')
    expect(dispatch(runtime, 'canvas.guide.delete', {
      guideId: 'missing',
    }).status).toBe('rejected')

    expect(dispatch(runtime, 'canvas.guide.move', {
      guideId: 'guide-x',
      position: 48,
    }).status).toBe('committed')
    expect(dispatch(runtime, 'canvas.guide.move', {
      guideId: 'guide-x',
      position: 48,
    }).status).toBe('noop')
    expect(dispatch(runtime, 'canvas.guide.delete', {
      guideId: 'guide-y',
    }).status).toBe('committed')
    expect(runtime.document.canvas.guides).toEqual([
      { id: 'guide-x', axis: 'x', position: 48 },
    ])

    runtime.undo()
    runtime.undo()
    expect(runtime.document.canvas.guides).toHaveLength(2)
    runtime.undo()
    expect(runtime.document.canvas.guides).toEqual([])
  })

  it('OpenSpec: command-transaction / 原子节点样式命令 / 更新并撤销样式路径', () => {
    const runtime = createTransactionRuntime({ document: fixture() })

    expect(dispatch(runtime, 'node.style.set', {
      nodeId: 'frame',
      path: ['backgroundColor'],
      value: '#101820',
    }).status).toBe('committed')
    expect(runtime.document.nodes.frame.style).toMatchObject({
      backgroundColor: '#101820',
      borderColor: '#4a5667',
      opacity: 1,
    })

    expect(dispatch(runtime, 'node.style.set', {
      nodeId: 'frame',
      path: ['shadow'],
      value: {
        color: '#00000066',
        offsetX: 2,
        offsetY: 8,
        blur: 24,
        spread: 0,
      },
    }).status).toBe('committed')
    expect(runtime.document.nodes.frame.style?.shadow).toMatchObject({ blur: 24 })

    runtime.undo()
    runtime.undo()
    expect(runtime.document.nodes.frame.style).toBeUndefined()
  })

  it('OpenSpec: command-transaction / 原子节点样式命令 / 重置样式', () => {
    const runtime = createTransactionRuntime({ document: fixture() })

    expect(dispatch(runtime, 'node.style.set', {
      nodeId: 'frame',
      path: ['backgroundColor'],
      value: '#101820',
    }).status).toBe('committed')
    expect(dispatch(runtime, 'node.style.reset', {
      nodeId: 'frame',
      path: ['backgroundColor'],
    }).status).toBe('committed')
    expect(runtime.document.nodes.frame.style?.backgroundColor).toBe('#f8fafc')

    expect(dispatch(runtime, 'node.style.reset', {
      nodeId: 'frame',
      path: [],
    }).status).toBe('committed')
    expect(runtime.document.nodes.frame.style).toBeUndefined()
    expect(dispatch(runtime, 'node.style.reset', {
      nodeId: 'frame',
      path: [],
    }).status).toBe('noop')
  })

  it('OpenSpec: command-transaction / 原子节点样式命令 / 拒绝非法或锁定目标', () => {
    const runtime = createTransactionRuntime({ document: fixture() })

    expect(dispatch(runtime, 'node.style.set', {
      nodeId: 'frame',
      path: ['opacity'],
      value: 2,
    })).toMatchObject({
      status: 'rejected',
      issues: [expect.objectContaining({ code: 'style.invalid' })],
    })
    expect(dispatch(runtime, 'node.style.set', {
      nodeId: 'frame',
      path: ['unknown'],
      value: 1,
    })).toMatchObject({
      status: 'rejected',
      issues: [expect.objectContaining({ code: 'style.invalid-path' })],
    })

    expect(dispatch(runtime, 'node.set-locked', {
      nodeIds: ['frame'],
      locked: true,
    }).status).toBe('committed')
    expect(dispatch(runtime, 'node.style.set', {
      nodeId: 'frame',
      path: ['opacity'],
      value: 0.5,
    })).toMatchObject({
      status: 'rejected',
      issues: [expect.objectContaining({ code: 'node.locked' })],
    })
  })

  // OpenSpec: command-transaction / 内置文档命令 / 创建和移动任意根节点
  it('OpenSpec: command-transaction / 内置文档命令 / 原子创建和删除节点', () => {
    const runtime = createTransactionRuntime({ document: fixture() })
    const frame = {
      id: 'frame-2',
      kind: 'frame',
      name: 'Frame 2',
      visible: true,
      locked: false,
      transform: { x: 2200, y: 0, width: 1280, height: 720, rotation: 0 },
      clipContent: true,
      childIds: [],
    }

    expect(dispatch(runtime, 'node.create', {
      node: frame,
      parentId: null,
      index: 1,
    }).status).toBe('committed')
    expect(dispatch(runtime, 'node.create', {
      node: component('new'),
      parentId: 'frame',
      index: 1,
    }).status).toBe('committed')
    expect(dispatch(runtime, 'node.create', {
      node: component('root-component'),
      parentId: null,
      index: 2,
    }).status).toBe('committed')
    expect(dispatch(runtime, 'node.create', {
      node: { ...frame, id: 'nested-frame', name: 'Nested' },
      parentId: 'frame',
      index: 2,
    }).status).toBe('committed')
    expect(runtime.document.rootIds).toEqual(['frame', 'frame-2', 'root-component'])
    expect(containerChildIds(runtime, 'frame')).toEqual([
      'a',
      'new',
      'nested-frame',
      'b',
      'group',
    ])

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
      parentId: null,
      index: 1,
    }).status).toBe('committed')
    expect(runtime.document.rootIds[1]).toBe('a-copy')
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
    expect(dispatch(runtime, 'frame.clip-content.set', {
      frameId: 'frame',
      clipContent: false,
    }).status).toBe('committed')
    expect(runtime.document.nodes.frame).toMatchObject({ clipContent: false })
    expect(dispatch(runtime, 'frame.clip-content.set', {
      frameId: 'frame',
      clipContent: false,
    }).status).toBe('noop')

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

  it('OpenSpec: command-transaction / Stage Engine 空间命令规划 / 根级分组和取消分组', () => {
    const runtime = createTransactionRuntime({ document: fixture() })
    expect(dispatch(runtime, 'node.move', {
      nodeIds: ['a', 'b'],
      parentId: null,
      index: 1,
    }).status).toBe('committed')
    const frame = {
      id: 'selection-group',
      kind: 'frame',
      name: 'Selection',
      visible: true,
      locked: false,
      transform: { x: 10, y: 20, width: 290, height: 50, rotation: 0 },
      clipContent: false,
      style: {
        backgroundColor: 'transparent',
        borderColor: 'transparent',
        borderWidth: 0,
      },
      childIds: ['a', 'b'],
    }

    expect(dispatch(runtime, 'node.group', {
      frame,
      nodeIds: ['a', 'b'],
      childTransforms: {
        a: { x: 0, y: 0, width: 100, height: 50, rotation: 0 },
        b: { x: 190, y: 0, width: 100, height: 50, rotation: 0 },
      },
    }).status).toBe('committed')
    expect(runtime.document.rootIds).toEqual(['frame', 'selection-group'])
    expect(runtime.document.nodes['selection-group']).toMatchObject({
      kind: 'frame',
      clipContent: false,
      childIds: ['a', 'b'],
    })

    expect(dispatch(runtime, 'node.ungroup', {
      frameId: 'selection-group',
      childTransforms: {
        a: { x: 10, y: 20, width: 100, height: 50, rotation: 0 },
        b: { x: 200, y: 20, width: 100, height: 50, rotation: 0 },
      },
    }).status).toBe('committed')
    expect(runtime.document.nodes['selection-group']).toBeUndefined()
    expect(runtime.document.rootIds).toEqual(['frame', 'a', 'b'])
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
