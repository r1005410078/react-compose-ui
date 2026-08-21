import { describe, expect, it } from 'vitest'
import { createStageInteractionController } from '../interaction-controller'
import { document, entity, layoutSnapshot } from '../test-fixtures'
import { STAGE_GESTURE_PRIORITY } from './gesture-priority'
import {
  createStageEntitySelectMovePlugin,
  STAGE_ENTITY_SELECT_MOVE_PLUGIN_ID,
} from './move-plugin'
import type { ComposeEntity } from '@compose-ui/core'
import type { StageInteractionEffect } from '../interaction-controller'

const MODIFIERS = { shift: false, alt: false, command: false }

const locked = (id: string): ComposeEntity => {
  const base = entity(id, { x: 0, y: 0, width: 40, height: 40 })
  return { ...base, components: { ...base.components, Lock: { locked: true } } }
}

const value = document([
  entity('a', { x: 0, y: 0, width: 40, height: 40 }),
  entity('b', { x: 100, y: 0, width: 40, height: 40 }),
  locked('frozen'),
])

function selectSetup(patch: Record<string, unknown> = {}) {
  const effects: StageInteractionEffect[] = []
  const controller = createStageInteractionController()
  controller.connectSurface({
    resolveClientPoint: (point) => point,
    applyEffects: (next) => effects.push(...next),
  })
  controller.updateContext({
    document: value,
    layoutSnapshot: layoutSnapshot(value),
    viewport: { x: 0, y: 0, zoom: 1 },
    surfaceSize: { width: 800, height: 600 },
    tool: 'select',
    selectedIds: [],
    idFactory: () => 'select-id',
    ...patch,
  } as never)
  const down = (entityId: string, over: Record<string, unknown> = {}) => controller.send({
    type: 'pointer.down',
    pointerId: 1,
    button: 0,
    point: { x: 10, y: 10 },
    hit: { kind: 'entity', entityId },
    modifiers: MODIFIERS,
    ...over,
  } as never)
  const selections = () => effects.filter((effect) => effect.type === 'selection.change')
  return { controller, effects, down, selections }
}

describe('OpenSpec: stage-engine / ECS SceneIndex / 实体选中并拖动插件', () => {
  it('entity-select-move 插件优先级与表一致', () => {
    const fromTable = STAGE_GESTURE_PRIORITY
      .find(({ id }) => id === STAGE_ENTITY_SELECT_MOVE_PLUGIN_ID)

    expect(createStageEntitySelectMovePlugin().priority).toBe(fromTable?.priority)
  })

  it('按下即改选区并开始移动', () => {
    const { controller, down, selections } = selectSetup()

    down('a')

    expect(selections()).toEqual([{ type: 'selection.change', selectedIds: ['a'] }])
    expect(controller.getSnapshot().phase).toBe('move')
  })

  it('选区变更先于指针捕获发出', () => {
    const { effects, down } = selectSetup()

    down('a')

    // 宿主据此更新选中态；顺序颠倒会让捕获落在旧选区上。
    expect(effects.map((effect) => effect.type)).toEqual(['selection.change', 'pointer.capture'])
  })

  it('Shift 加选与减选', () => {
    const added = selectSetup({ selectedIds: ['a'] })
    added.down('b', { modifiers: { ...MODIFIERS, shift: true } })
    expect(added.selections()).toEqual([{ type: 'selection.change', selectedIds: ['a', 'b'] }])

    const removed = selectSetup({ selectedIds: ['a', 'b'] })
    removed.down('b', { modifiers: { ...MODIFIERS, shift: true } })
    expect(removed.selections()).toEqual([{ type: 'selection.change', selectedIds: ['a'] }])
  })

  it('基准选区滤掉已从文档中消失的 ID', () => {
    const { down, selections } = selectSetup({ selectedIds: ['a', 'ghost'] })

    down('b', { modifiers: { ...MODIFIERS, shift: true } })

    // 否则 Shift 加选会把幽灵一路带下去。
    expect(selections()).toEqual([{ type: 'selection.change', selectedIds: ['a', 'b'] }])
  })

  it('已选中的目标再次按下不改变选区顺序', () => {
    const { down, selections } = selectSetup({ selectedIds: ['a', 'b'] })

    down('b')

    expect(selections()).toEqual([{ type: 'selection.change', selectedIds: ['a', 'b'] }])
  })

  it('双击可编辑 Entity 进入原地编辑且不开始移动', () => {
    const { controller, effects, down } = selectSetup({ isTextEditable: () => true })

    down('a', { clickCount: 2 })

    expect(effects).toContainEqual({ type: 'text-editing.enter', entityId: 'a' })
    // 否则一次双击会同时打开编辑器并拖动目标。
    expect(controller.getSnapshot().phase).toBe('idle')
  })

  it('双击不可编辑 Entity 仍然开始移动', () => {
    const { controller, effects, down } = selectSetup({ isTextEditable: () => false })

    down('a', { clickCount: 2 })

    expect(effects).not.toContainEqual({ type: 'text-editing.enter', entityId: 'a' })
    expect(controller.getSnapshot().phase).toBe('move')
  })

  it('锁定目标改选区但不开始移动，也不落到框选', () => {
    const { controller, down, selections } = selectSetup()

    down('frozen')

    expect(selections()).toEqual([{ type: 'selection.change', selectedIds: ['frozen'] }])
    expect(controller.getSnapshot().phase).toBe('idle')
  })

  it('非 select/move 工具只改选区', () => {
    const { controller, down, selections } = selectSetup({ tool: 'scale' })

    down('a')

    expect(selections()).toHaveLength(1)
    expect(controller.getSnapshot().phase).toBe('idle')
  })

  it('右键按下不开始任何手势，也不改选区', () => {
    const { controller, effects, down } = selectSetup()

    // 右键承载上下文菜单：一旦被手势接管，菜单就再也打不开。判定在询问插件之前完成，
    // 否则每个插件都要重复它，漏一个就是一次静默回归。
    down('a', { button: 2 })

    expect(effects).toEqual([])
    expect(controller.getSnapshot().phase).toBe('idle')
  })

  it('命中不存在的 Entity 时消费按下，不改选区也不框选', () => {
    const { controller, effects, down } = selectSetup()

    down('gone')

    // 命中判定与文档已经脱节，这次按下就此打住。
    expect(effects).toEqual([])
    expect(controller.getSnapshot().phase).toBe('idle')
  })
})
