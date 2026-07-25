import {
  createDefaultCanvasSettings,
  createTransactionRuntime,
  type ComposeDocument,
} from '@compose-ui/core'
import { describe, expect, it } from 'vitest'
import {
  applyMatrix,
  createGroupCommand,
  createReparentCommand,
  createUngroupCommand,
  getNodeWorldMatrix,
} from './index'

function fixture(): ComposeDocument {
  return {
    schemaVersion: 2,
    canvas: createDefaultCanvasSettings(),
    rootIds: ['frame'],
    nodes: {
      frame: {
        id: 'frame',
        kind: 'frame',
        name: 'Frame',
        visible: true,
        locked: false,
        transform: { x: -200, y: 100, width: 800, height: 600, rotation: 0 },
        childIds: ['left', 'right'],
      },
      left: {
        id: 'left',
        kind: 'group',
        name: 'Left',
        visible: true,
        locked: false,
        transform: { x: 80, y: 60, width: 300, height: 240, rotation: 20 },
        childIds: ['a', 'b'],
      },
      right: {
        id: 'right',
        kind: 'group',
        name: 'Right',
        visible: true,
        locked: false,
        transform: { x: 480, y: 180, width: 200, height: 160, rotation: -10 },
        childIds: ['c'],
      },
      a: {
        id: 'a',
        kind: 'component',
        name: 'A',
        visible: true,
        locked: false,
        transform: { x: 20, y: 30, width: 100, height: 60, rotation: 5 },
        componentType: 'box',
        props: {},
      },
      b: {
        id: 'b',
        kind: 'component',
        name: 'B',
        visible: true,
        locked: false,
        transform: { x: 150, y: 80, width: 80, height: 50, rotation: -12 },
        componentType: 'box',
        props: {},
      },
      c: {
        id: 'c',
        kind: 'component',
        name: 'C',
        visible: true,
        locked: false,
        transform: { x: 20, y: 20, width: 60, height: 40, rotation: 0 },
        componentType: 'box',
        props: {},
      },
    },
  }
}

function worldPoints(document: ComposeDocument, nodeId: string) {
  const node = document.nodes[nodeId]!
  const matrix = getNodeWorldMatrix(document, nodeId)
  return [
    applyMatrix(matrix, { x: 0, y: 0 }),
    applyMatrix(matrix, { x: node.transform.width, y: node.transform.height }),
  ]
}

function expectPointsClose(actual: ReturnType<typeof worldPoints>, expected: ReturnType<typeof worldPoints>) {
  actual.forEach((point, index) => {
    expect(point.x).toBeCloseTo(expected[index]!.x, 7)
    expect(point.y).toBeCloseTo(expected[index]!.y, 7)
  })
}

describe('Stage structure commands', () => {
  it('OpenSpec: stage / 分组与重设父节点 / 分组同级节点', () => {
    const runtime = createTransactionRuntime({ document: fixture() })
    const beforeA = worldPoints(runtime.document, 'a')
    const beforeB = worldPoints(runtime.document, 'b')

    expect(runtime.dispatch(createGroupCommand(runtime.document, ['a', 'b'], 'selection'))).toMatchObject({
      status: 'committed',
    })

    expect(runtime.document.nodes.selection).toMatchObject({
      kind: 'group',
      childIds: ['a', 'b'],
    })
    expectPointsClose(worldPoints(runtime.document, 'a'), beforeA)
    expectPointsClose(worldPoints(runtime.document, 'b'), beforeB)
  })

  it('OpenSpec: stage / 分组与重设父节点 / 拒绝跨父节点分组', () => {
    const runtime = createTransactionRuntime({ document: fixture() })
    const result = runtime.dispatch(createGroupCommand(runtime.document, ['a', 'c'], 'invalid'))

    expect(result).toMatchObject({
      status: 'rejected',
      issues: [expect.objectContaining({ code: 'group.invalid-parent' })],
    })
    expect(runtime.entries).toHaveLength(1)
    expect(runtime.document.nodes.invalid).toBeUndefined()
  })

  it('OpenSpec: stage / 分组与重设父节点 / 取消分组或重设父节点', () => {
    const runtime = createTransactionRuntime({ document: fixture() })
    const beforeA = worldPoints(runtime.document, 'a')
    runtime.dispatch(createGroupCommand(runtime.document, ['a', 'b'], 'selection'))

    expect(runtime.dispatch(createUngroupCommand(runtime.document, 'selection'))).toMatchObject({
      status: 'committed',
    })
    expect(runtime.document.nodes.selection).toBeUndefined()
    expectPointsClose(worldPoints(runtime.document, 'a'), beforeA)

    const beforeReparent = worldPoints(runtime.document, 'a')
    expect(runtime.dispatch(
      createReparentCommand(runtime.document, ['a'], 'right', 1),
    )).toMatchObject({ status: 'committed' })
    expect(runtime.document.nodes.right).toMatchObject({ childIds: ['c', 'a'] })
    expectPointsClose(worldPoints(runtime.document, 'a'), beforeReparent)
  })
})
