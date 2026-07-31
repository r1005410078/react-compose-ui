import { describe, expect, it } from 'vitest'
import { createComposeEntityRegistry } from '@compose-ui/component-registry'
import {
  BUILTIN_COMMAND_TYPES,
  createDefaultCanvasSettings,
  createDefaultOutputSettings,
  getComposeLayoutItem,
  getComposeSpatialTransform,
  type ComposeDocument,
  type ComposeEntity,
  type ComposeLayoutSnapshot,
  type ComposeSpatialTransform,
} from '@compose-ui/core'
import type { ComposeSceneTreeOperation } from '@compose-ui/scene-tree'
import { planSceneOperation, type SceneOperationContext } from './scene-operations'

function transform(x: number, y: number, width: number, height: number): ComposeSpatialTransform {
  return { position: { x, y }, size: { width, height }, rotation: 0 }
}

function layoutItem(value: ComposeSpatialTransform) {
  return {
    positioning: 'absolute' as const,
    offset: value.position,
    width: { mode: 'fixed' as const, value: value.size.width, min: 1, max: null },
    height: { mode: 'fixed' as const, value: value.size.height, min: 1, max: null },
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
    alignSelf: 'auto' as const,
  }
}

function entity(
  id: string,
  components: ComposeEntity['components'],
): ComposeEntity {
  const spatial = components.Transform && 'position' in components.Transform
    ? components.Transform as unknown as ComposeSpatialTransform
    : transform(0, 0, 100, 100)
  const remaining = Object.fromEntries(
    Object.entries(components).filter(([key]) => key !== 'Transform'),
  )
  const base = {
    Transform: { rotation: spatial.rotation },
    LayoutItem: layoutItem(spatial),
    Visibility: { visible: true },
    Lock: { locked: false },
    ...remaining,
  }
  return {
    id,
    name: id,
    components: {
      Composition: { presetId: null, baseComponentKeys: Object.keys(base), capabilityIds: [] },
      ...base,
    },
  }
}

function documentFixture(): ComposeDocument {
  return {
    schemaVersion: 6,
    canvas: createDefaultCanvasSettings(),
    output: createDefaultOutputSettings(),
    rootIds: ['dashboard'],
    entities: {
      dashboard: entity('dashboard', {
        Transform: transform(40, 30, 800, 600),
        Hierarchy: { childIds: ['title'] },
        Clip: { enabled: true },
      }),
      title: entity('title', {
        Transform: transform(10, 10, 180, 40),
        Renderer: { type: 'text', props: {} },
      }),
    },
  }
}

const registry = createComposeEntityRegistry({
  presets: [{
    id: 'container',
    label: 'Container',
    createComponents: () => ({
      Transform: { rotation: 0 },
      LayoutItem: layoutItem(transform(0, 0, 1280, 720)),
      Visibility: { visible: true },
      Lock: { locked: false },
      Hierarchy: { childIds: [] },
      Clip: { enabled: true },
    }),
  }],
})

function snapshot(value: ComposeDocument): ComposeLayoutSnapshot {
  return {
    revision: 1,
    boxes: Object.fromEntries(Object.values(value.entities).map((item) => {
      const layout = getComposeLayoutItem(item)
      return [item.id, {
        x: layout.offset.x,
        y: layout.offset.y,
        width: layout.width.value,
        height: layout.height.value,
        positioning: layout.positioning,
      }]
    })),
    diagnostics: [],
  }
}

function context(overrides: Partial<SceneOperationContext> = {}): SceneOperationContext {
  let index = 0
  return {
    document: documentFixture(),
    layoutSnapshot: snapshot(documentFixture()),
    registry,
    containerPresetId: 'container',
    nextId: () => `id-${index++}`,
    ...overrides,
  }
}

function plannedCommand(operation: ComposeSceneTreeOperation, ctx = context()) {
  const result = planSceneOperation(operation, ctx)
  if (result.status !== 'planned') throw new Error(`预期 planned，实际 ${result.status}`)
  return result.plan
}

describe('planSceneOperation', () => {
  it('每种场景树操作都有对应规划器', () => {
    const operations: readonly ComposeSceneTreeOperation[] = [
      { type: 'create', parentId: null, index: 0 },
      { type: 'rename', nodeId: 'title', label: 'Next' },
      { type: 'delete', nodeIds: ['title'] },
      { type: 'move', nodeIds: ['title'], parentId: null, index: 0 },
      { type: 'duplicate', sourceNodeIds: ['title'], parentId: 'dashboard', index: 1 },
      { type: 'set-visibility', nodeIds: ['title'], visible: false },
      { type: 'set-locked', nodeIds: ['title'], locked: true },
    ]
    for (const operation of operations) {
      expect(planSceneOperation(operation, context()).status, operation.type).toBe('planned')
    }
  })

  it('容器 Preset 缺失时报告 unavailable 而不是抛错', () => {
    const result = planSceneOperation(
      { type: 'create', parentId: null, index: 0 },
      context({ containerPresetId: 'missing' }),
    )
    expect(result.status).toBe('unavailable')
    if (result.status !== 'unavailable') return
    expect(result.reason).toContain('missing')
  })

  it('根级创建沿对角线错开，子级创建从父容器原点开始并使用嵌套尺寸', () => {
    const root = plannedCommand({ type: 'create', parentId: null, index: 0 })
    const rootEntity = root.command.payload.entity as unknown as ComposeEntity
    // 文档已有 1 个根级 Entity：80 + 1 × 40。
    expect(getComposeSpatialTransform(rootEntity).position)
      .toEqual({ x: 120, y: 120 })
    expect(getComposeSpatialTransform(rootEntity).size)
      .toEqual({ width: 1280, height: 720 })
    expect(root.command.meta?.label).toBe('Create Container · 1280 × 720')
    expect(root.nextSelection).toEqual([rootEntity.id])

    const nested = plannedCommand({ type: 'create', parentId: 'dashboard', index: 0 })
    const nestedEntity = nested.command.payload.entity as unknown as ComposeEntity
    expect(getComposeSpatialTransform(nestedEntity).position)
      .toEqual({ x: 0, y: 0 })
    expect(getComposeSpatialTransform(nestedEntity).size)
      .toEqual({ width: 320, height: 180 })
    expect(nested.command.meta?.label).toBe('Create Container · 320 × 180')
  })

  it('跨父级移动使用 reparent，同父级内使用 moveEntity', () => {
    // 跨父级必须同时改变父子关系与局部 Transform，因此规划为一个原子 batch。
    const reparent = plannedCommand({
      type: 'move',
      nodeIds: ['title'],
      parentId: null,
      index: 0,
    })
    expect(reparent.command.type).toBe(BUILTIN_COMMAND_TYPES.batch)
    expect((reparent.command.payload.commands as unknown as { type: string }[]).map(
      (child) => child.type,
    )).toEqual([BUILTIN_COMMAND_TYPES.moveEntity, BUILTIN_COMMAND_TYPES.setTransform])

    const reorder = plannedCommand({
      type: 'move',
      nodeIds: ['title'],
      parentId: 'dashboard',
      index: 0,
    })
    expect(reorder.command.type).toBe(BUILTIN_COMMAND_TYPES.moveEntity)
    expect(reorder.command.meta?.label).toBe('Reorder title · position 1')
  })

  it('复制无有效来源时跳过，不产生命令', () => {
    const result = planSceneOperation(
      { type: 'duplicate', sourceNodeIds: ['missing-entity'], parentId: null, index: 0 },
      context(),
    )
    expect(result.status).toBe('skipped')
  })

  it('复制多个来源合并为单个 batch 并选中全部副本', () => {
    const plan = plannedCommand({
      type: 'duplicate',
      sourceNodeIds: ['dashboard', 'title'],
      parentId: null,
      index: 0,
    })
    expect(plan.command.type).toBe(BUILTIN_COMMAND_TYPES.batch)
    expect(plan.command.meta?.label).toBe('Duplicate 2 entities')
    expect(plan.nextSelection).toHaveLength(2)
  })

  it('批量操作标签统计目标数量，单个目标使用 Entity 名称', () => {
    expect(plannedCommand({ type: 'delete', nodeIds: ['title'] }).command.meta?.label)
      .toBe('Delete title')
    expect(
      plannedCommand({ type: 'delete', nodeIds: ['title', 'dashboard'] }).command.meta?.label,
    ).toBe('Delete 2 entities')
    expect(
      plannedCommand({ type: 'set-visibility', nodeIds: ['title'], visible: false })
        .command.meta?.label,
    ).toBe('Hide title')
    expect(
      plannedCommand({ type: 'set-locked', nodeIds: ['title'], locked: true })
        .command.meta?.label,
    ).toBe('Lock title')
  })

  it('全部命令统一标注 scene-tree 来源与目标 Entity', () => {
    const plan = plannedCommand({ type: 'rename', nodeId: 'title', label: 'Headline' })
    expect(plan.command.meta?.source).toBe('scene-tree')
    expect(plan.command.meta?.targetIds).toEqual(['title'])
    expect(plan.command.meta?.label).toBe('Rename title · “title” → “Headline”')
  })
})
