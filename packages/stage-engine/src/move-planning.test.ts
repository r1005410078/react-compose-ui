import { describe, expect, it } from 'vitest'
import {
  planMoveCommit,
  planMovePreview,
  resolveCommittableDropTarget,
} from './move-planning'
import { createStageSceneIndex } from './scene-index'
import { document, entity, layoutSnapshot } from './test-fixtures'
import type { StageInteractionContext } from './interaction-controller'

const MODIFIERS = { shift: false, alt: false, command: false }

function fixture() {
  const value = document([
    entity('dragged', { x: 0, y: 0, width: 40, height: 40 }),
    entity('target', { x: 400, y: 0, width: 200, height: 200, childIds: [] }),
  ])
  const solved = layoutSnapshot(value)
  const index = createStageSceneIndex(value, solved)
  const context = {
    document: value,
    layoutSnapshot: solved,
    viewport: { x: 0, y: 0, zoom: 1 },
    surfaceSize: { width: 800, height: 600 },
    tool: 'select',
    selectedIds: ['dragged'],
    idFactory: () => 'move-id',
  } as unknown as StageInteractionContext
  return { value, solved, index, context }
}

const query = (over: Record<string, unknown> = {}) => {
  const { index, context } = fixture()
  return {
    context,
    index,
    ids: ['dragged'],
    bounds: { x: 0, y: 0, width: 40, height: 40 },
    startWorld: { x: 10, y: 10 },
    world: { x: 10, y: 10 },
    zoom: 1,
    modifiers: MODIFIERS,
    parentLocked: false,
    ...over,
  } as Parameters<typeof planMovePreview>[0]
}

describe('OpenSpec: stage-engine / 画布拖拽 reparent 会话 / 移动预览求解', () => {
  it('位移不足以激活时不产出预览、参考线与落点', () => {
    // 按下时的亚像素抖动不该闪出吸附线，更不该在密集画布上算出落点提示。
    const preview = planMovePreview(query({ world: { x: 11, y: 10 } }))

    expect(preview).toEqual({ transforms: {}, dropTarget: null, snapGuides: [] })
  })

  it('缩小视图下按屏幕像素判定激活阈值', () => {
    // 世界位移 10、zoom 0.1 → 屏幕位移只有 1px，仍视为没有开始拖动。
    const preview = planMovePreview(query({ world: { x: 20, y: 10 }, zoom: 0.1 }))

    expect(preview.transforms).toEqual({})
  })

  it('轴向约束把另一个轴的位移归零', () => {
    const preview = planMovePreview(query({
      world: { x: 210, y: 130 },
      axis: 'x',
      modifiers: { ...MODIFIERS, command: true },
    }))

    expect(preview.transforms.dragged).toMatchObject({ x: 200, y: 0 })
  })

  it('锁定原父级时经过容器不产生 reparent 落点', () => {
    const free = planMovePreview(query({ world: { x: 500, y: 100 } }))
    const locked = planMovePreview(query({ world: { x: 500, y: 100 }, parentLocked: true }))

    expect(free.dropTarget).toMatchObject({ kind: 'reparent', containerId: 'target' })
    expect(locked.dropTarget).not.toMatchObject({ kind: 'reparent', containerId: 'target' })
  })

  it('宿主级锁定与手势中的 Space 同义', () => {
    const { index, context } = fixture()
    const hostLocked = planMovePreview({
      ...query({ world: { x: 500, y: 100 } }),
      index,
      context: { ...context, lockGestureParent: true } as StageInteractionContext,
    })

    expect(hostLocked.dropTarget).not.toMatchObject({ kind: 'reparent', containerId: 'target' })
  })
})

describe('OpenSpec: stage-engine / 画布拖拽 reparent 会话 / 提交前复核落点', () => {
  it('容器被锁定后落点不再成立', () => {
    const base = entity('target', { x: 400, y: 0, width: 200, height: 200, childIds: [] })
    const value = document([
      entity('dragged', { x: 0, y: 0, width: 40, height: 40 }),
      { ...base, components: { ...base.components, Lock: { locked: true } } },
    ])

    expect(resolveCommittableDropTarget(value, {
      kind: 'reparent', containerId: 'target',
    })).toBeNull()
  })

  it('容器从文档中消失后落点不再成立', () => {
    const { value } = fixture()

    expect(resolveCommittableDropTarget(value, {
      kind: 'reparent', containerId: 'gone',
    })).toBeNull()
  })

  it('没有 Hierarchy 的目标不能作为落点', () => {
    const { value } = fixture()

    // dragged 是叶子节点，没有 Hierarchy。
    expect(resolveCommittableDropTarget(value, {
      kind: 'reparent', containerId: 'dragged',
    })).toBeNull()
  })
})

describe('OpenSpec: stage-engine / 画布拖拽 reparent 会话 / 提交规划', () => {
  const commitQuery = (dropTarget: Parameters<typeof planMoveCommit>[0]['dropTarget']) => {
    const { value, solved, index } = fixture()
    return {
      document: value,
      layoutSnapshot: solved,
      index,
      ids: ['dragged'],
      transforms: {
        dragged: { x: 420, y: 20, width: 40, height: 40, rotation: 0 },
      },
      dropTarget,
      idFactory: () => 'move-id',
    }
  }

  it('落点成立时几何随 reparent 写进同一条命令', () => {
    const planned = planMoveCommit(commitQuery({ kind: 'reparent', containerId: 'target' }))

    // 一次手势只产生一条事务，否则撤销要按两下。
    expect(planned).toMatchObject({ type: 'command.dispatch' })
  })

  it('落点失效时退回纯几何提交', () => {
    const planned = planMoveCommit(commitQuery({ kind: 'reparent', containerId: 'gone' }))

    expect(planned).toMatchObject({
      type: 'command.dispatch',
      command: { meta: { targetIds: ['dragged'] } },
    })
  })

  it('没有落点也没有几何变化时不产生命令', () => {
    const planned = planMoveCommit({ ...commitQuery(null), transforms: {} })

    expect(planned).toBeNull()
  })
})
