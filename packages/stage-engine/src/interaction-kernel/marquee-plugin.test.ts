import { describe, expect, it } from 'vitest'
import { createStageInteractionController } from '../interaction-controller'
import { document, entity, layoutSnapshot } from '../test-fixtures'
import { STAGE_GESTURE_PRIORITY } from './gesture-priority'
import {
  createStageMarqueeToolPlugin,
  STAGE_MARQUEE_TOOL_PLUGIN_ID,
} from './marquee-plugin'
import type { StageInteractionEffect, StageInteractionHit } from '../interaction-controller'

const MODIFIERS = { shift: false, alt: false, command: false }
const value = document([
  entity('a', { x: 0, y: 0, width: 40, height: 40 }),
  entity('b', { x: 300, y: 0, width: 40, height: 40 }),
])

function marqueeSetup(patch: Record<string, unknown> = {}) {
  const effects: StageInteractionEffect[] = []
  const controller = createStageInteractionController()
  controller.connectSurface({
    resolveClientPoint: (point) => point,
    applyEffects: (next) => effects.push(...next),
  })
  const update = (next: Record<string, unknown> = {}) => {
    controller.updateContext({
      document: value,
      layoutSnapshot: layoutSnapshot(value),
      viewport: { x: 0, y: 0, zoom: 1 },
      surfaceSize: { width: 800, height: 600 },
      tool: 'marquee',
      selectedIds: [],
      idFactory: () => 'marquee-id',
      ...patch,
      ...next,
    } as never)
  }
  update()
  const selections = () => effects.filter((effect) => effect.type === 'selection.change')
  return { controller, effects, update, selections }
}

const down = (hit: StageInteractionHit) => ({
  type: 'pointer.down' as const,
  pointerId: 1,
  button: 0,
  // 起点落在根 Frame 内：Frame 完全包住框时不进入结果，断言因此只看真正的目标节点。
  point: { x: 5, y: 5 },
  hit,
  modifiers: MODIFIERS,
})

describe('OpenSpec: stage-engine / 框选工具与选区布尔组合 / 工具入口独立插件', () => {
  it('marquee-tool 插件优先级与表一致', () => {
    const fromTable = STAGE_GESTURE_PRIORITY
      .find(({ id }) => id === STAGE_MARQUEE_TOOL_PLUGIN_ID)

    expect(createStageMarqueeToolPlugin().priority).toBe(fromTable?.priority)
  })

  it('压在节点上也起框，而不是选中该节点', () => {
    const { controller, effects } = marqueeSetup()

    controller.send(down({ kind: 'entity', entityId: 'a' }))

    // 这是 marquee 工具与 select 唯一的行为差异：密集画布上用户否则无处下手。
    expect(controller.getSnapshot().phase).toBe('marquee')
    expect(effects.filter((effect) => effect.type === 'selection.change')).toHaveLength(0)
  })

  it('松手按框住的节点请求一次选区变更', () => {
    const { controller, selections } = marqueeSetup()

    controller.send(down({ kind: 'surface' }))
    controller.send({ type: 'pointer.move', pointerId: 1, point: { x: 60, y: 60 }, modifiers: MODIFIERS })
    controller.send({ type: 'pointer.up', pointerId: 1, point: { x: 60, y: 60 }, modifiers: MODIFIERS })

    expect(selections()).toEqual([{ type: 'selection.change', selectedIds: ['a'] }])
  })

  it('组合意图以松手时按住的修饰键为准', () => {
    const { controller, selections } = marqueeSetup({ selectedIds: ['b'] })

    controller.send(down({ kind: 'surface' }))
    // 按下与移动时没按 Shift，松手时才按住：用户可以在拖拽途中改主意。
    controller.send({ type: 'pointer.move', pointerId: 1, point: { x: 60, y: 60 }, modifiers: MODIFIERS })
    controller.send({
      type: 'pointer.up',
      pointerId: 1,
      point: { x: 60, y: 60 },
      modifiers: { ...MODIFIERS, shift: true },
    })

    expect(selections()).toEqual([{ type: 'selection.change', selectedIds: ['b', 'a'] }])
  })

  it('并发文档变化中止框选且不改选区', () => {
    const { controller, update, selections } = marqueeSetup()

    controller.send(down({ kind: 'surface' }))
    controller.send({ type: 'pointer.move', pointerId: 1, point: { x: 60, y: 60 }, modifiers: MODIFIERS })
    expect(controller.getSnapshot().phase).toBe('marquee')

    // baseSelection 是一串按下当刻冻结的 Entity ID，文档一变就可能指向已被删除的节点。
    const next = document([entity('a', { x: 0, y: 0, width: 40, height: 40 })])
    update({ document: next, layoutSnapshot: layoutSnapshot(next) })

    expect(controller.getSnapshot().phase).toBe('idle')
    controller.send({ type: 'pointer.up', pointerId: 1, point: { x: 60, y: 60 }, modifiers: MODIFIERS })
    expect(selections()).toHaveLength(0)
  })

  it('取消丢弃框且不改选区', () => {
    const { controller, effects, selections } = marqueeSetup()

    controller.send(down({ kind: 'surface' }))
    controller.send({ type: 'pointer.move', pointerId: 1, point: { x: 60, y: 60 }, modifiers: MODIFIERS })
    controller.send({ type: 'pointer.cancel', pointerId: 1 })

    expect(controller.getSnapshot().marquee).toBeNull()
    expect(effects).toContainEqual({ type: 'pointer.release', pointerId: 1 })
    expect(selections()).toHaveLength(0)
  })

  it('非 marquee 工具不被本插件接管', () => {
    const { controller } = marqueeSetup({ tool: 'select', selectedIds: ['a'] })

    controller.send(down({ kind: 'entity', entityId: 'a' }))

    // select 工具下压在节点上是移动手势，仍由 legacy 的实体分支处理。
    expect(controller.getSnapshot().phase).not.toBe('marquee')
  })
})
