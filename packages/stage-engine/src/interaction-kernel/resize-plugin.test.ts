import { describe, expect, it } from 'vitest'
import { createStageInteractionController } from '../interaction-controller'
import { document, entity, layoutSnapshot } from '../test-fixtures'
import { STAGE_GESTURE_PRIORITY } from './gesture-priority'
import { createStageResizePlugin, STAGE_RESIZE_PLUGIN_ID } from './resize-plugin'
import type { StageInteractionEffect } from '../interaction-controller'

// command 关掉吸附，让断言直接落在指针位移上。
const FREE = { shift: false, alt: false, command: true }

const value = document([
  entity('a', { x: 0, y: 0, width: 100, height: 50 }),
  entity('locked-one', { x: 300, y: 0, width: 100, height: 50, locked: true }),
])

function resizeSetup(patch: Record<string, unknown> = {}) {
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
      idFactory: () => 'resize-id',
      ...patch,
      ...next,
    } as never)
  }
  update()
  const grab = (handle = 'se') => controller.send({
    type: 'pointer.down',
    pointerId: 1,
    button: 0,
    point: { x: 100, y: 50 },
    hit: { kind: 'resize', handle },
    modifiers: FREE,
  } as never)
  const commands = () => effects.filter((effect) => effect.type === 'command.dispatch')
  return { controller, effects, update, grab, commands }
}

describe('OpenSpec: stage-engine / 受约束变换 System / 缩放手柄插件', () => {
  it('resize 插件优先级与表一致', () => {
    const fromTable = STAGE_GESTURE_PRIORITY.find(({ id }) => id === STAGE_RESIZE_PLUGIN_ID)

    expect(createStageResizePlugin().priority).toBe(fromTable?.priority)
  })

  it('拖动角手柄发布预览，松手提交一次', () => {
    const { controller, grab, commands } = resizeSetup()
    grab('se')
    controller.send({ type: 'pointer.move', pointerId: 1, point: { x: 200, y: 150 }, modifiers: FREE })

    expect(controller.getSnapshot().previewTransforms.a).toMatchObject({ width: 200, height: 150 })
    expect(commands()).toHaveLength(0)

    controller.send({ type: 'pointer.up', pointerId: 1, point: { x: 200, y: 150 }, modifiers: FREE })
    expect(commands()).toHaveLength(1)
  })

  it('非 select/scale 工具下命中手柄被消费，不退化成移动或框选', () => {
    const { controller, effects } = resizeSetup({ tool: 'marquee' })

    controller.send({
      type: 'pointer.down',
      pointerId: 1,
      button: 0,
      point: { x: 100, y: 50 },
      hit: { kind: 'resize', handle: 'se' },
      modifiers: FREE,
    } as never)

    expect(effects).toEqual([])
    expect(controller.getSnapshot().phase).toBe('idle')
  })

  it('没有可缩放目标时消费按下', () => {
    const { controller, effects } = resizeSetup({ selectedIds: ['locked-one'] })

    controller.send({
      type: 'pointer.down',
      pointerId: 1,
      button: 0,
      point: { x: 400, y: 50 },
      hit: { kind: 'resize', handle: 'se' },
      modifiers: FREE,
    } as never)

    expect(effects).toEqual([])
    expect(controller.getSnapshot().phase).toBe('idle')
  })

  it('并发文档变化中止缩放且不提交', () => {
    const { controller, update, grab, commands } = resizeSetup()
    grab('se')
    controller.send({ type: 'pointer.move', pointerId: 1, point: { x: 200, y: 150 }, modifiers: FREE })
    expect(controller.getSnapshot().phase).toBe('resize')

    const next = document([
      entity('a', { x: 0, y: 0, width: 100, height: 50 }),
      entity('locked-one', { x: 300, y: 0, width: 100, height: 50, locked: true }),
    ])
    update({ document: next, layoutSnapshot: layoutSnapshot(next) })

    expect(controller.getSnapshot().phase).toBe('idle')
    controller.send({ type: 'pointer.up', pointerId: 1, point: { x: 200, y: 150 }, modifiers: FREE })
    expect(commands()).toHaveLength(0)
  })

  it('取消丢弃预览并释放捕获', () => {
    const { controller, effects, grab, commands } = resizeSetup()
    grab('se')
    controller.send({ type: 'pointer.move', pointerId: 1, point: { x: 200, y: 150 }, modifiers: FREE })
    controller.send({ type: 'pointer.cancel', pointerId: 1 })

    expect(controller.getSnapshot().previewTransforms).toEqual({})
    expect(effects).toContainEqual({ type: 'pointer.release', pointerId: 1 })
    expect(commands()).toHaveLength(0)
  })

  it('目标要求保持比例时等价于按住 Shift', () => {
    const constrained = document([
      entity('a', { x: 0, y: 0, width: 100, height: 50, resize: 'preserve-aspect' }),
    ])
    const { controller, grab } = resizeSetup({
      document: constrained,
      layoutSnapshot: layoutSnapshot(constrained),
    })
    grab('se')

    // 只在 X 方向拖：等比约束应当同时带动 Y，否则同一次拖拽会让一部分目标变形。
    controller.send({ type: 'pointer.move', pointerId: 1, point: { x: 300, y: 50 }, modifiers: FREE })

    const preview = controller.getSnapshot().previewTransforms.a
    expect(preview && preview.height).toBeGreaterThan(50)
  })
})
