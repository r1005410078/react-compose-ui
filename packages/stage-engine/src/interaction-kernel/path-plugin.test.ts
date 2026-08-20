import { describe, expect, it } from 'vitest'
import { createStageInteractionController } from '../interaction-controller'
import { document, entity, layoutSnapshot } from '../test-fixtures'
import { STAGE_GESTURE_PRIORITY } from './gesture-priority'
import { createStagePathPlugin, STAGE_PATH_PLUGIN_ID } from './path-plugin'
import type { StageInteractionEffect } from '../interaction-controller'

const MODIFIERS = { shift: false, alt: false, command: false }
const value = document([entity('a', { x: 0, y: 0, width: 100, height: 50 })])

function pathSetup() {
  const effects: StageInteractionEffect[] = []
  const controller = createStageInteractionController()
  controller.connectSurface({
    resolveClientPoint: (point) => point,
    applyEffects: (next) => effects.push(...next),
  })
  const update = (patch: Record<string, unknown> = {}) => {
    controller.updateContext({
      document: value,
      layoutSnapshot: layoutSnapshot(value),
      viewport: { x: 0, y: 0, zoom: 1 },
      surfaceSize: { width: 800, height: 600 },
      tool: 'select',
      selectedIds: ['a'],
      pathEditing: { entityId: 'a' },
      idFactory: () => 'path-id',
      ...patch,
    } as never)
  }
  update()
  const grabVertex = () => {
    controller.send({
      type: 'pointer.down',
      pointerId: 1,
      button: 0,
      point: { x: 10, y: 10 },
      hit: { kind: 'path-handle', handle: 'vertex', vertexId: 'k0' },
      modifiers: MODIFIERS,
    })
    controller.send({ type: 'pointer.move', pointerId: 1, point: { x: 40, y: 30 }, modifiers: MODIFIERS })
  }
  return { controller, effects, update, grabVertex }
}

const cancels = (effects: readonly StageInteractionEffect[]) => effects.filter(
  (effect) => effect.type === 'path.change' && effect.phase === 'cancel',
)

describe('OpenSpec: stage-engine / 可编辑路径手势 / 独立插件承担', () => {
  it('path 插件优先级与表一致', () => {
    const fromTable = STAGE_GESTURE_PRIORITY.find(({ id }) => id === STAGE_PATH_PLUGIN_ID)

    expect(createStagePathPlugin().priority).toBe(fromTable?.priority)
  })

  it('并发文档变化中止路径手势并通知宿主丢弃预览', () => {
    const { controller, effects, update, grabVertex } = pathSetup()
    grabVertex()
    expect(controller.getSnapshot().phase).toBe('path-edit')

    const next = document([entity('a', { x: 0, y: 0, width: 100, height: 50 })])
    update({ document: next, layoutSnapshot: layoutSnapshot(next) })

    // 引擎不持有路径几何，收不回宿主那份半途预览，必须显式发一次 cancel。
    expect(cancels(effects)).toHaveLength(1)
    expect(controller.getSnapshot().phase).toBe('idle')
  })

  it('并发布局重排中止路径手势', () => {
    const { controller, update, grabVertex } = pathSetup()
    grabVertex()

    const solved = layoutSnapshot(value)
    update({ layoutSnapshot: { ...solved, revision: solved.revision + 1 } })

    expect(controller.getSnapshot().phase).toBe('idle')
  })

  it('取消发出的世界坐标是最后一次移动的位置', () => {
    const { controller, effects, grabVertex } = pathSetup()
    grabVertex()

    controller.send({ type: 'pointer.cancel', pointerId: 1 })

    // 载荷取会话推进到的最新点，而不是按下点——宿主据此把预览退回正确的一侧。
    expect(cancels(effects)).toEqual([expect.objectContaining({
      entityId: 'a',
      vertexId: 'k0',
      handle: 'vertex',
      worldPoint: { x: 40, y: 30 },
    })])
  })

  it('宿主换掉正在编辑的路径即结束会话', () => {
    const { controller, effects, update, grabVertex } = pathSetup()
    grabVertex()

    update({ pathEditing: { entityId: 'b' } })

    expect(cancels(effects)).toHaveLength(1)
    expect(controller.getSnapshot().phase).toBe('idle')
  })
})
