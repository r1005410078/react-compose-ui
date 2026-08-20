import { describe, expect, it } from 'vitest'
import { createStageInteractionController } from '../interaction-controller'
import { document, entity, layoutSnapshot } from '../test-fixtures'
import { STAGE_GESTURE_PRIORITY } from './gesture-priority'
import {
  createStageSegmentResizePlugin,
  STAGE_SEGMENT_RESIZE_PLUGIN_ID,
} from './segment-resize-plugin'
import type { StageInteractionEffect } from '../interaction-controller'

// command 关掉吸附，让断言直接落在指针位置上而不受 grid/smart snap 影响。
const FREE = { shift: false, alt: false, command: true }

function segmentSetup(patch: Record<string, unknown> = {}) {
  const value = document([entity('a', { x: 0, y: 0, width: 100, height: 50 })])
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
      tool: 'select',
      selectedIds: ['a'],
      idFactory: () => 'segment-id',
      ...patch,
      ...next,
    } as never)
  }
  update()
  const grabStart = () => {
    controller.send({
      type: 'pointer.down',
      pointerId: 1,
      button: 0,
      // 按在端点附近而不是端点上：命中区比端点大，grabOffset 必须吸收这个差值。
      point: { x: 4, y: 2 },
      hit: {
        kind: 'segment-endpoint',
        entityId: 'a',
        endpoint: 'start',
        start: { x: 0, y: 0 },
        end: { x: 100, y: 50 },
      },
      modifiers: FREE,
    })
  }
  const commits = () => effects.filter((effect) => effect.type === 'segment.commit')
  return { controller, effects, update, grabStart, commits, value }
}

describe('OpenSpec: stage-engine / Headless 两点端点会话 / 独立插件承担', () => {
  it('segment-resize 插件优先级与表一致', () => {
    const fromTable = STAGE_GESTURE_PRIORITY
      .find(({ id }) => id === STAGE_SEGMENT_RESIZE_PLUGIN_ID)

    expect(createStageSegmentResizePlugin().priority).toBe(fromTable?.priority)
  })

  it('抓取偏移保留按下当刻的端点与指针差值', () => {
    const { controller, grabStart } = segmentSetup()
    grabStart()

    // 按在 (4,2)、端点在 (0,0)：移动到 (54,32) 后端点应落在 (50,30) 而不是 (54,32)。
    controller.send({ type: 'pointer.move', pointerId: 1, point: { x: 54, y: 32 }, modifiers: FREE })

    expect(controller.getSnapshot().segmentPreview).toMatchObject({
      start: { x: 50, y: 30 },
      end: { x: 100, y: 50 },
    })
  })

  it('松手请求一次 segment.commit', () => {
    const { controller, grabStart, commits } = segmentSetup()
    grabStart()
    controller.send({ type: 'pointer.move', pointerId: 1, point: { x: 54, y: 32 }, modifiers: FREE })
    controller.send({ type: 'pointer.up', pointerId: 1, point: { x: 54, y: 32 }, modifiers: FREE })

    expect(commits()).toEqual([{
      type: 'segment.commit',
      entityId: 'a',
      start: { x: 50, y: 30 },
      end: { x: 100, y: 50 },
    }])
  })

  it('并发文档变化中止端点拖拽且不提交', () => {
    const { controller, update, grabStart, commits, value } = segmentSetup()
    grabStart()
    controller.send({ type: 'pointer.move', pointerId: 1, point: { x: 54, y: 32 }, modifiers: FREE })
    expect(controller.getSnapshot().phase).toBe('segment-resize')

    const next = document([entity('a', { x: 0, y: 0, width: 100, height: 50 })])
    expect(next).not.toBe(value)
    update({ document: next, layoutSnapshot: layoutSnapshot(next) })

    expect(controller.getSnapshot().phase).toBe('idle')
    controller.send({ type: 'pointer.up', pointerId: 1, point: { x: 54, y: 32 }, modifiers: FREE })
    expect(commits()).toHaveLength(0)
  })

  it('选区不再是该图形即结束会话', () => {
    const { controller, update, grabStart } = segmentSetup()
    grabStart()

    update({ selectedIds: [] })

    expect(controller.getSnapshot().phase).toBe('idle')
  })

  it('锁定目标上的端点按下不退化成移动手势', () => {
    const base = entity('a', { x: 0, y: 0, width: 100, height: 50 })
    const locked = document([{
      ...base,
      components: { ...base.components, Lock: { locked: true } },
    }])
    const { controller, effects, grabStart } = segmentSetup({
      document: locked,
      layoutSnapshot: layoutSnapshot(locked),
    })
    grabStart()

    // 端点手柄画在图形自身两端：放行会让这次按下变成一次移动。
    expect(effects).toEqual([])
    expect(controller.getSnapshot().phase).toBe('idle')
  })
})
