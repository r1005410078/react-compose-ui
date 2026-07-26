import {
  createDefaultCanvasSettings,
  createDefaultOutputSettings,
  type ComposeDocument,
  type ComposeFrameNode,
} from '@compose-ui/core'
import { describe, expect, it } from 'vitest'
import {
  applyMatrix,
  createStageSceneIndex,
  getNodeWorldMatrix,
} from './index'

function fixture(): ComposeDocument {
  return {
    schemaVersion: 3,
    canvas: {
      ...createDefaultCanvasSettings(),
      smartSnap: { nodes: true, guides: true },
      guides: [{ id: 'guide-x', axis: 'x', position: 24 }],
    },
    output: createDefaultOutputSettings(),
    rootIds: ['frame'],
    nodes: {
      frame: {
        id: 'frame',
        kind: 'frame',
        name: 'Frame',
        visible: true,
        locked: false,
        transform: { x: 100, y: 50, width: 500, height: 400, rotation: 0 },
        childIds: ['group'],
        clipContent: true,
      },
      group: {
        id: 'group',
        kind: 'frame',
        name: 'Nested Frame',
        visible: true,
        locked: false,
        transform: { x: 20, y: 30, width: 100, height: 80, rotation: 0 },
        childIds: ['node'],
        clipContent: false,
      },
      node: {
        id: 'node',
        kind: 'component',
        name: 'Node',
        visible: true,
        locked: false,
        transform: { x: 10, y: 5, width: 30, height: 20, rotation: 0 },
        componentType: 'box',
        props: {},
      },
    },
  }
}

describe('StageSceneIndex', () => {
  it('OpenSpec: stage-engine / 场景索引与坐标空间 / 查询嵌套世界几何', () => {
    const index = createStageSceneIndex(fixture())

    expect(index.order).toEqual(['frame', 'group', 'node'])
    expect(index.getParentId('node')).toBe('group')
    expect(index.isVisible('node')).toBe(true)
    expect(index.getWorldBounds('node')).toMatchObject({
      x: 130,
      y: 85,
      width: 30,
      height: 20,
    })
    expect(index.topLevelSelection(['group', 'node'])).toEqual(['group'])
    expect(index.closestFrameForNode('node')).toBe('group')
    expect(index.commonFrameForSelection(['node'])).toBe('group')
    expect(index.frameAtPoint({ x: 135, y: 90 })).toBe('group')
    expect(index.snapCandidates(['node'])).toContainEqual({
      axis: 'x',
      value: 24,
      source: 'guide',
    })
  })

  it('OpenSpec: stage-engine / 场景索引与坐标空间 / 文档更新后刷新索引', () => {
    const first = fixture()
    const second: ComposeDocument = {
      ...first,
      nodes: {
        ...first.nodes,
        node: {
          ...first.nodes.node!,
          transform: { ...first.nodes.node!.transform, x: 50 },
        },
      },
    }

    expect(createStageSceneIndex(first)).toBe(createStageSceneIndex(first))
    expect(createStageSceneIndex(second)).not.toBe(createStageSceneIndex(first))
    expect(createStageSceneIndex(second).getWorldBounds('node')?.x).toBe(170)
  })

  it('OpenSpec: stage-engine / 场景索引与坐标空间 / 命中旋转嵌套 Frame', () => {
    const base = fixture()
    const rotated: ComposeDocument = {
      ...base,
      nodes: {
        ...base.nodes,
        group: {
          ...base.nodes.group!,
          transform: {
            ...base.nodes.group!.transform,
            x: 480,
            rotation: 30,
          },
        },
      },
    }
    const center = applyMatrix(
      getNodeWorldMatrix(rotated, 'group'),
      { x: 75, y: 40 },
    )
    expect(createStageSceneIndex(rotated).frameAtPoint(center)).toBeNull()

    const unclipped: ComposeDocument = {
      ...rotated,
      nodes: {
        ...rotated.nodes,
        frame: {
          ...(rotated.nodes.frame as ComposeFrameNode),
          clipContent: false,
        },
      },
    }
    expect(createStageSceneIndex(unclipped).frameAtPoint(center)).toBe('group')
  })
})
